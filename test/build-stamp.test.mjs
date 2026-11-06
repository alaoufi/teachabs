// Fast navigation: pages and modules share a build stamp; stamped files are cached for a year.
import test from 'node:test';
import assert from 'node:assert/strict';
import {stampHtml, stampModule} from '../build-stamp.mjs';
import {openStore} from '../store.mjs';
import {createApp} from '../server.mjs';

const files = {'/a.js': 'text/javascript', '/b.css': 'text/css'};
test('stamping rewrites only our own static files', () => {
  assert.equal(stampHtml('<script src="/a.js?v=3"></script><link href="/b.css"><a href="/teach/plans">x</a><img src="/other.png">', files, 'B1'),
    '<script src="/a.js?b=B1"></script><link href="/b.css?b=B1"><a href="/teach/plans">x</a><img src="/other.png">');
  assert.equal(stampModule("import {x} from './a.js';\nimport y from './a.js?v=place2';\nconst z = await import('./a.js');\nimport w from './c.js';\nfetch('/a.js')", files, 'B1'),
    "import {x} from './a.js?b=B1';\nimport y from './a.js?b=B1';\nconst z = await import('./a.js?b=B1');\nimport w from './c.js';\nfetch('/a.js')");
});

test('server: pages carry the stamp; stamped modules are immutable and import stamped modules', async t => {
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  t.after(async () => { app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); });
  const base = 'http://127.0.0.1:' + app.address().port;
  const page = await (await fetch(base + '/guide')).text();
  const stamp = page.match(/group-lesson\.css\?b=([0-9a-f]{12})/)?.[1];
  assert.ok(stamp, 'the guide links the stamped stylesheet');
  const mod = await fetch(base + '/group-teacher.js?b=' + stamp);
  assert.equal(mod.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  const source = await mod.text();
  assert.match(source, new RegExp(`from './activities\\.js\\?b=${stamp}'`));
  assert.doesNotMatch(source, /from '\.\/[a-z-]+\.js'/, 'no unstamped relative import left');
  assert.equal((await fetch(base + '/group-teacher.js?b=old')).headers.get('cache-control'), 'public, no-cache', 'an old stamp is not cached for long');
});

test('app entry: /start/teacher signs in the trial teacher and opens «دروسي»', async t => {
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  t.after(async () => { app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); });
  const base = 'http://127.0.0.1:' + app.address().port;
  const r = await fetch(base + '/start/teacher', {redirect: 'manual'});
  assert.equal(r.status, 303); assert.equal(r.headers.get('location'), '/teach/plans');
  const cookie = r.headers.get('set-cookie').split(';')[0];
  const plans = await fetch(base + '/teach/plans', {headers: {cookie}});
  assert.equal(plans.status, 200); assert.match(await plans.text(), /منهج الصف الرابع/);
  const again = await fetch(base + '/start/teacher', {redirect: 'manual', headers: {cookie}});
  assert.equal(again.headers.get('location'), '/teach/plans');
});
