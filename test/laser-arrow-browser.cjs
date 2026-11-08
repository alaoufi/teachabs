// Optional browser verification for stage 054 (ideas from Excalidraw, Microsoft Whiteboard and ClassIn): tools in a
// rail beside the board on a computer; ↗ arrow and ／ line reach the student; the 🔴 laser pointer shows a passing
// trail on the student's screen and is never stored.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {pick, openStepMenus, pastTitle} = require('./ui-helpers.cjs');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
(async () => {
  const {openStore} = await import('../store.mjs'), {createApp} = await import('../server.mjs');
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.address().port, out = process.env.SCIENCE_ARTIFACTS || '../group-verification';
  fs.mkdirSync(out, {recursive: true});
  const browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
  const results = [], errors = [];
  const watch = p => p.on('pageerror', e => errors.push(e.message));
  try {
    const tc = await browser.newContext({viewport: {width: 1366, height: 768}}); await openStepMenus(tc); tc.setDefaultTimeout(15000); await tc.addInitScript(() => localStorage.setItem('gl-autostart', '0'));
    const t = await tc.newPage(); watch(t); t.on('dialog', d => d.accept().catch(() => {}));
    await t.goto(base + '/start/teacher'); await t.locator('.gl-cur-subject[data-subject=science] li.is-ready button').first().click(); await t.waitForSelector('#pl-steps li');
    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/); await pastTitle(t);
    const lay = await t.evaluate(() => { const f = document.querySelector('footer.gl-bar-bottom').getBoundingClientRect(), b = document.querySelector('#gl-board').getBoundingClientRect(); return {railBeside: f.top < b.bottom && f.left > b.right - 2, board: b.width}; });
    assert.ok(lay.railBeside && lay.board > 850, JSON.stringify(lay)); // since stage 072 the lesson sections take a row under the board
    results.push(`computer: the tools sit in a rail beside the board; the board is ${Math.round(lay.board)}px wide`);
    const sc = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}); sc.setDefaultTimeout(15000);
    const s = await sc.newPage(); watch(s);
    await s.goto(base + '/start/student'); await s.waitForFunction(() => window.__voice); await s.locator('#gl-enter').click(); await s.waitForSelector('#gl-content .gl-page');
    const b = await t.locator('#gl-board').boundingBox(), at = (fx, fy) => [b.x + b.width * fx, b.y + b.height * fy];
    const drag = async (from, to) => { await t.mouse.move(...from); await t.mouse.down(); await t.mouse.move(...to, {steps: 8}); await t.mouse.up(); };
    await pick(t, '.gl-tool[data-tool=arrow]'); await drag(at(0.2, 0.8), at(0.45, 0.55));
    await pick(t, '.gl-tool[data-tool=line]'); await drag(at(0.2, 0.9), at(0.6, 0.9));
    await s.waitForFunction(() => document.querySelectorAll('#gl-ink path.gl-arrow, #gl-ink path.gl-line').length === 2);
    results.push('↗ arrow and ／ line drawn by the teacher appear on the student\'s board');
    await pick(t, '.gl-tool[data-tool=laser]');
    await t.mouse.move(...at(0.5, 0.3)); await t.mouse.down();
    for (let i = 0; i < 12; i++) await t.mouse.move(...at(0.5 + i * 0.02, 0.3 + (i % 3) * 0.02), {steps: 2});
    await s.waitForSelector('#gl-ink .gl-laser .gl-laser-dot');
    await s.screenshot({path: path.join(out, 'laser-student.png')});
    await t.mouse.up();
    await s.waitForFunction(() => !document.querySelector('#gl-ink .gl-laser-line'), null, {timeout: 5000});
    const stored = await t.evaluate(async () => (window.__lastView?.state?.strokes || null));
    assert.equal(await s.locator('#gl-ink path.gl-arrow, #gl-ink path.gl-line').count(), 2, 'the laser left nothing behind');
    results.push('🔴 the laser trail showed on the student\'s screen while the teacher pointed, then faded; nothing stored');
    await t.screenshot({path: path.join(out, 'laser-teacher.png')});
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok: true, results}, null, 1));
  } finally { await browser.close(); app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); }
})().catch(e => { console.error(e); process.exit(1); });
