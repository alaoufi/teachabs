// Optional browser verification for stage 052 (ideas from ClassIn): the student raises a hand ✋, the teacher sees it
// at once (badge and list), lowers it and gives a star ⭐; the student sees «أحسنت!» and the star count.
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
    const sc = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}); sc.setDefaultTimeout(15000);
    const s = await sc.newPage(); watch(s);
    await s.goto(base + '/start/student'); await s.waitForFunction(() => window.__voice); await s.locator('#gl-enter').click(); await s.waitForSelector('#gl-content .gl-page');
    const bar = await s.evaluate(() => { const b = document.querySelector('.gl-sbar').getBoundingClientRect(); return [...document.querySelectorAll('.gl-sbar > *:not([hidden])')].every(x => { const r = x.getBoundingClientRect(); return r.width === 0 || (r.left >= b.left - 1 && r.right <= b.right + 1 && r.left >= 0 && r.right <= innerWidth); }); });
    assert.ok(bar, 'the student bar fits the phone');
    await s.locator('#gl-hand').click();
    await t.waitForSelector('#gl-hands:not([hidden])'); assert.equal((await t.locator('#gl-hands').textContent()).includes('١'), true);
    await s.waitForFunction(() => document.querySelector('#gl-hand').getAttribute('aria-pressed') === 'true');
    results.push('✋ the student raised a hand; the teacher sees «✋ ١» at once');
    await t.locator('#gl-hands').click(); await t.locator('#gl-students li.is-hand').getByRole('button', {name: 'أنزل يده'}).click();
    await s.waitForFunction(() => document.querySelector('#gl-hand').getAttribute('aria-pressed') === 'false'); await t.waitForSelector('#gl-hands[hidden]', {state: 'attached'});
    results.push('the teacher answered and lowered the hand; it went down on the student\'s phone');
    await t.locator('#gl-students .gl-star-btn').first().click();
    await s.waitForSelector('#gl-star-pop:not([hidden])'); await s.waitForTimeout(500);
    await s.screenshot({path: path.join(out, 'hand-star-student.png')});
    assert.match(await s.locator('#gl-stars').textContent(), /⭐ ١/);
    await t.screenshot({path: path.join(out, 'hand-star-teacher.png')});
    results.push('⭐ the teacher gave a star; «أحسنت!» popped up on the student\'s phone and the count shows ⭐ ١');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok: true, results}, null, 1));
  } finally { await browser.close(); app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); }
})().catch(e => { console.error(e); process.exit(1); });
