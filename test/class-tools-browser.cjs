// Optional browser verification for stage 056 (ideas from ClassIn, Newline and Microsoft Whiteboard): from «⋯ المزيد»
// the teacher starts a ⏱ timer, lowers a 🎭 curtain and lifts it a quarter at a time, and lays a 📏 ruler and a
// 📐 protractor on the board and moves the ruler; the student sees each of them.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {pick, openStepMenus} = require('./ui-helpers.cjs');
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
    const tc = await browser.newContext({viewport: {width: 1366, height: 768}}); tc.setDefaultTimeout(15000); await openStepMenus(tc); await tc.addInitScript(() => localStorage.setItem('gl-autostart', '0'));
    const t = await tc.newPage(); watch(t); t.on('dialog', d => d.accept().catch(() => {}));
    await t.goto(base + '/start/teacher'); await t.locator('.gl-cur-subject[data-subject=math] li.is-ready button').first().click(); await t.waitForSelector('#pl-steps li');
    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/);
    const sc = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}); sc.setDefaultTimeout(15000);
    const s = await sc.newPage(); watch(s);
    await s.goto(base + '/start/student'); await s.waitForFunction(() => window.__voice); await s.locator('#gl-enter').click(); await s.waitForSelector('#gl-content .gl-page');
    await pick(t, '.gl-timer-btn[data-sec="180"]');
    await s.waitForFunction(() => /⏱ 0[23]:\d\d/.test(document.querySelector('.gl-timer')?.textContent || ''));
    results.push('⏱ a 3-minute timer started by the teacher counts down on the student\'s screen');
    await pick(t, '.gl-curtain-btn[data-level="100"]');
    await s.waitForFunction(() => document.querySelector('#gl-board > .gl-curtain')?.style.height === '100%');
    await pick(t, '.gl-curtain-btn[data-level="-25"]');
    await s.waitForFunction(() => document.querySelector('#gl-board > .gl-curtain')?.style.height === '75%');
    results.push('🎭 the curtain covered the student\'s board, then «كشف ربع» showed its top quarter');
    await pick(t, '.gl-curtain-btn[data-level="0"]'); await s.waitForFunction(() => !document.querySelector('#gl-board > .gl-curtain'));
    await pick(t, '.gl-stamp-btn[data-stamp=ruler]'); await pick(t, '.gl-stamp-btn[data-stamp=protractor]');
    await s.waitForFunction(() => document.querySelector('#gl-ink .gl-stamp-ruler') && document.querySelector('#gl-ink .gl-stamp-protractor'));
    const before = await s.locator('#gl-ink .gl-stamp-ruler').getAttribute('transform');
    await pick(t, '.gl-tool[data-tool=select]');
    const r = await t.locator('#gl-ink .gl-stamp-ruler rect').boundingBox();
    await t.mouse.move(r.x + 30, r.y + 20); await t.mouse.down(); await t.mouse.move(r.x + 30, r.y + 140, {steps: 6}); await t.mouse.up();
    await s.waitForFunction(b => document.querySelector('#gl-ink .gl-stamp-ruler')?.getAttribute('transform') !== b, before);
    await s.waitForTimeout(400); await s.screenshot({path: path.join(out, 'class-tools-student.png')}); await t.screenshot({path: path.join(out, 'class-tools-teacher.png')});
    results.push('📏 ruler and 📐 protractor laid on the board; the teacher moved the ruler and the student saw it move');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok: true, results}, null, 1));
  } finally { await browser.close(); app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); }
})().catch(e => { console.error(e); process.exit(1); });
