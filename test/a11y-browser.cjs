// Optional browser verification (stage 080): axe-core checks the class screens for accessibility problems that a
// teacher or student would hit — low contrast, controls with no name, missing labels — on computer, tablet and phone.
// Fails on serious or critical problems; minor/moderate ones are listed so they can be cleaned up over time.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
(async () => {
  const {openStore} = await import('../store.mjs'), {createApp} = await import('../server.mjs');
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.address().port, out = process.env.SCIENCE_ARTIFACTS || '../group-verification';
  fs.mkdirSync(out, {recursive: true});
  const browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
  const report = [], serious = [];
  const audit = async (page, label) => {
    await page.addScriptTag({content: AXE});
    const r = await page.evaluate(async () => (await axe.run(document, {resultTypes: ['violations'], rules: {region: {enabled: false}}})).violations
      .map(v => ({id: v.id, impact: v.impact, help: v.help, n: v.nodes.length, where: v.nodes.slice(0, 4).map(x => x.target.join(' ')), why: v.nodes[0]?.failureSummary?.split('\n').slice(0, 3).join(' ')})));
    for (const v of r) { report.push({screen: label, ...v}); if (v.impact === 'serious' || v.impact === 'critical') serious.push(`${label}: ${v.id} (${v.n}) ${v.where.join(' | ')} — ${v.why}`); }
  };
  try {
    const tc = await browser.newContext({viewport: {width: 1366, height: 768}, reducedMotion: 'reduce', bypassCSP: true}); await tc.addInitScript(() => localStorage.setItem('gl-autostart', '0'));
    const t = await tc.newPage(); t.on('dialog', d => d.accept().catch(() => {}));
    await t.goto(base + '/start/teacher'); await audit(t, 'start');
    await t.locator('.gl-cur-subject[data-subject=science] li.is-ready button').first().click(); await t.waitForSelector('#pl-steps li'); await audit(t, 'planner');
    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/); await t.waitForSelector('.gl-title-card');
    await audit(t, 'teacher-title');
    for (let i = 0; i < 3; i++) await t.locator('#gl-next').click();
    await t.waitForTimeout(400); await audit(t, 'teacher-board');
    await t.setViewportSize({width: 390, height: 844}); await t.waitForTimeout(300); await audit(t, 'teacher-phone');
    const code = t.url().slice(-6), sc = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, reducedMotion: 'reduce', bypassCSP: true});
    const s = await sc.newPage(); await s.goto(base + '/join?code=' + code); await audit(s, 'join');
    await s.locator('input[name=name]').fill('ريم'); await s.getByRole('button', {name: 'دخول الحصة'}).click(); await s.waitForFunction(() => window.__voice); await s.locator('#gl-enter').click(); await s.waitForTimeout(600);
    await audit(s, 'student');
    fs.writeFileSync(path.join(out, 'a11y-report.json'), JSON.stringify(report, null, 1));
    const minor = report.filter(v => v.impact !== 'serious' && v.impact !== 'critical');
    console.log(`axe: ${report.length} rule findings on 7 screens; ${serious.length} serious/critical, ${minor.length} minor/moderate`);
    for (const m of minor) console.log(`  · ${m.screen}: ${m.id} (${m.n})`);
    assert.deepEqual(serious, [], 'serious accessibility problems:\n' + serious.join('\n'));
    console.log('✓ no serious or critical accessibility problems on the class screens');
  } catch (e) { console.error(e.message || e); process.exitCode = 1; }
  finally { await browser.close(); app.close(); }
})();
