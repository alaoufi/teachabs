// One command for the whole quality gate before a deploy: unit tests, then every browser check (accessibility and
// visual included) four at a time. Prints one line per check and the end of the log only for what failed, so a
// passing run is short to read. Logs stay in $CHECK_LOGS (default: a temp folder) for a closer look.
import {spawn} from 'node:child_process';
import {readdirSync, mkdirSync, writeFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const root = new URL('..', import.meta.url).pathname, logs = process.env.CHECK_LOGS || join(tmpdir(), 'teachabs-check');
mkdirSync(logs, {recursive: true});
const pw = process.env.PLAYWRIGHT_MODULE || ['/opt/node22/lib/node_modules/playwright'].find(existsSync) || 'playwright';
const run = (args, name, extra = {}) => new Promise(done => {
  let out = ''; const t0 = Date.now();
  const p = spawn(process.execPath, args, {cwd: root, env: {...process.env, PLAYWRIGHT_MODULE: pw, SCIENCE_ARTIFACTS: join(logs, 'art', name), ...extra}});
  p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
  const kill = setTimeout(() => p.kill('SIGKILL'), 400000);
  p.on('close', code => { clearTimeout(kill); writeFileSync(join(logs, name + '.log'), out); done({name, ok: code === 0, s: Math.round((Date.now() - t0) / 1000), out}); });
});
const tail = r => r.out.trim().split('\n').slice(-12).map(l => '    ' + l.slice(0, 300)).join('\n');
const only = process.argv.slice(2); // e.g. `npm run check -- live-ink a11y` runs just those browser checks
const unit = only.length ? null : await run(['--test', ...readdirSync(join(root, 'test')).filter(f => f.endsWith('.test.mjs')).map(f => 'test/' + f)], 'unit');
if (unit) console.log(`${unit.ok ? '✓' : '✗'} unit tests (${unit.s}s)` + (unit.ok ? '' : '\n' + tail(unit)));
const browser = readdirSync(join(root, 'test')).filter(f => f.endsWith('-browser.cjs') && (!only.length || only.some(o => f.includes(o))));
const queue = [...browser], results = [];
await Promise.all(Array.from({length: 4}, async () => { for (let f; (f = queue.shift());) { const r = await run(['test/' + f], f.replace('.cjs', '')); results.push(r); console.log(`${r.ok ? '✓' : '✗'} ${r.name} (${r.s}s)`); } }));
const bad = results.filter(r => !r.ok);
for (const r of bad) console.log(`\n✗ ${r.name}\n${tail(r)}`);
console.log(`\n${bad.length || (unit && !unit.ok) ? 'FAILED' : 'ALL PASSED'}: ${results.length - bad.length}/${results.length} browser checks${unit ? `, unit ${unit.ok ? 'passed' : 'failed'}` : ''}. Logs: ${logs}`);
process.exitCode = bad.length || (unit && !unit.ok) ? 1 : 0;
