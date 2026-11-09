// Optional browser verification (stage 080): visual regression. Each class screen is photographed on computer, tablet
// and phone and compared with its approved picture in test/visual-baseline/. A change bigger than a hair fails, so an
// unintended change in the look never reaches the teachers. The room code (random each run) is masked.
// After an intended design change: UPDATE_VISUAL=1 node test/visual-browser.cjs  (then review and commit the pictures).
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const {PNG} = require('pngjs'), pixelmatch = require('pixelmatch');
const DIR = path.join(__dirname, 'visual-baseline'), UPDATE = process.env.UPDATE_VISUAL === '1', LIMIT = 0.002; // 0.2% of the pixels
(async () => {
  const {openStore} = await import('../store.mjs'), {createApp} = await import('../server.mjs');
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.address().port, out = process.env.SCIENCE_ARTIFACTS || '../group-verification';
  fs.mkdirSync(out, {recursive: true}); fs.mkdirSync(DIR, {recursive: true});
  const browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
  const results = [], bad = [];
  const shot = async (page, name) => {
    await page.evaluate(() => { for (const n of document.querySelectorAll('.gl-code')) n.textContent = 'ABC123'; return document.fonts.ready; }); await page.waitForTimeout(300);
    const buf = await page.screenshot({mask: [page.locator('.gl-code, .gl-code-chip, #gl-status')], maskColor: '#888888', animations: 'disabled', caret: 'hide'});
    const file = path.join(DIR, name + '.png');
    if (UPDATE || !fs.existsSync(file)) { fs.writeFileSync(file, buf); results.push(`${name}: approved picture saved`); return; }
    const a = PNG.sync.read(fs.readFileSync(file)), b = PNG.sync.read(buf);
    if (a.width !== b.width || a.height !== b.height) { bad.push(`${name}: size ${a.width}x${a.height} → ${b.width}x${b.height}`); return; }
    const diff = new PNG({width: a.width, height: a.height}), n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {threshold: 0.1});
    const share = n / (a.width * a.height);
    if (share > LIMIT) { fs.writeFileSync(path.join(out, name + '-diff.png'), PNG.sync.write(diff)); fs.writeFileSync(path.join(out, name + '-now.png'), buf); bad.push(`${name}: ${(share * 100).toFixed(2)}% of the screen changed (see ${name}-diff.png)`); }
    else results.push(`${name}: matches the approved picture`);
  };
  try {
    const tc = await browser.newContext({viewport: {width: 1366, height: 768}, reducedMotion: 'reduce'}); await tc.addInitScript(() => localStorage.setItem('gl-autostart', '0'));
    const t = await tc.newPage(); t.on('dialog', d => d.accept().catch(() => {}));
    await t.goto(base + '/start/teacher'); await shot(t, 'start-1366');
    await t.locator('.gl-cur-subject[data-subject=science] li.is-ready button').first().click(); await t.waitForSelector('#pl-steps li'); await shot(t, 'planner-1366');
    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/); await t.waitForSelector('.gl-title-card');
    for (const [w, h] of [[1366, 768], [820, 1180], [390, 844]]) { await t.setViewportSize({width: w, height: h}); await shot(t, `teacher-title-${w}`); }
    await t.setViewportSize({width: 1366, height: 768});
    for (let i = 0; i < 3; i++) await t.locator('#gl-next').click();
    await t.waitForFunction(() => document.querySelectorAll('#gl-steps li')[3]?.classList.contains('is-current')); await t.waitForTimeout(600);
    for (const [w, h] of [[1366, 768], [820, 1180], [390, 844]]) { await t.setViewportSize({width: w, height: h}); await shot(t, `teacher-explain-${w}`); }
    const code = t.url().slice(-6), sc = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, reducedMotion: 'reduce'});
    const s = await sc.newPage(); await s.goto(base + '/join?code=' + code); await shot(s, 'join-390');
    await s.locator('input[name=name]').fill('ريم'); await s.getByRole('button', {name: 'دخول الحصة'}).click(); await s.waitForFunction(() => window.__voice); await s.locator('#gl-enter').click();
    await s.waitForSelector('#gl-content [data-step], #gl-content svg, #gl-content .gl-item'); await s.waitForTimeout(800); await shot(s, 'student-390');
    console.log(results.map(r => '✓ ' + r).join('\n'));
    assert.deepEqual(bad, [], 'the look changed:\n' + bad.join('\n'));
  } catch (e) { console.error(e.message || e); process.exitCode = 1; }
  finally { await browser.close(); app.close(); }
})();
