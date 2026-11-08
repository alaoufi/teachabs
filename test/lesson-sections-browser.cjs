// Optional browser verification for stage 072: the class opens on the lesson's title (its topic) for the teacher and the
// students; the lesson's sections sit under the board; 👁 beside any section hides it from the students' board before the
// class gets there, and shows it again.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
(async () => {
  const {openStore} = await import('../store.mjs'), {createApp} = await import('../server.mjs');
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.address().port, out = process.env.SCIENCE_ARTIFACTS || '../group-verification';
  fs.mkdirSync(out, {recursive: true});
  const browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
  const results = [], errors = [];
  try {
    const tc = await browser.newContext({viewport: {width: 1366, height: 768}}); tc.setDefaultTimeout(15000); await tc.addInitScript(() => localStorage.setItem('gl-autostart', '0'));
    const t = await tc.newPage(); t.on('pageerror', e => errors.push(e.message)); t.on('dialog', d => d.accept().catch(() => {}));
    await t.goto(base + '/start/teacher'); await t.locator('.gl-cur-subject[data-subject=science] li.is-ready button').first().click(); await t.waitForSelector('#pl-steps li');
    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/);
    // the title first, on the teacher's board and the student's
    await t.waitForSelector('#gl-content .gl-title-card');
    assert.equal(await t.locator('#gl-content .gl-title-main').textContent(), 'الخلايا');
    assert.match(await t.locator('#gl-content .gl-title-meta').textContent(), /العلوم — الصف الرابع/);
    const lay = await t.evaluate(() => { const n = document.querySelector('.gl-sections').getBoundingClientRect(), b = document.querySelector('#gl-board').getBoundingClientRect(); return {under: n.top >= b.bottom - 1, inView: n.bottom <= innerHeight, board: b.width}; });
    assert.ok(lay.under && lay.inView && lay.board > 800, JSON.stringify(lay));
    assert.equal(await t.locator('#gl-steps li').first().getAttribute('data-type'), 'title');
    assert.equal(await t.locator('#gl-steps li.is-current .gl-step-name').textContent(), 'العنوان');
    await t.screenshot({path: path.join(out, 'sections-teacher.png')});
    const code = t.url().slice(-6), sc = await browser.newContext({viewport: {width: 844, height: 390}, isMobile: true, hasTouch: true}); sc.setDefaultTimeout(15000);
    const s = await sc.newPage(); s.on('pageerror', e => errors.push(e.message));
    await s.goto(base + '/join?code=' + code); await s.locator('input[name=name]').fill('ريم'); await s.getByRole('button', {name: 'دخول الحصة'}).click();
    await s.waitForFunction(() => window.__voice); await s.locator('#gl-enter').click();
    await s.waitForFunction(() => document.querySelector('#gl-content .gl-title-main')?.textContent === 'الخلايا');
    await s.screenshot({path: path.join(out, 'sections-student-title.png')});
    results.push('the class opened on «موضوع الدرس: الخلايا — العلوم، الصف الرابع» for the teacher and the student; the sections sit under the board');
    // hide section 3 (the prepared texts) before getting there
    const third = t.locator('#gl-steps li').nth(2);
    await third.locator('.gl-eye').click(); await t.waitForFunction(() => document.querySelectorAll('#gl-steps li')[2].classList.contains('is-hidden-step'));
    assert.equal(await third.locator('.gl-eye').getAttribute('aria-pressed'), 'true');
    assert.ok(await s.locator('#gl-content .gl-title-main').isVisible(), 'the students still see the current section');
    await t.locator('#gl-next').click(); await s.waitForSelector('#gl-content .gl-page'); // section 2: the curriculum page
    await t.locator('#gl-next').click(); await t.waitForFunction(() => document.querySelector('#gl-steps li.is-current')?.dataset.type === 'board');
    await s.waitForFunction(() => document.getElementById('gl-board').hidden && !document.getElementById('gl-wait').hidden); // the board is hidden; «المعلم يجهز الخطوة…»
    assert.match(await t.locator('#gl-vis').textContent(), /لا يرون/);
    results.push('👁 hid «النصوص المجهزة» before the class got there; arriving there, the students saw nothing of it');
    await third.locator('.gl-eye').click(); await t.waitForFunction(() => !document.querySelectorAll('#gl-steps li')[2].classList.contains('is-hidden-step'));
    await s.waitForFunction(() => !document.getElementById('gl-board').hidden && document.querySelector('#gl-content')?.dataset.type === 'board');
    assert.match(await t.locator('#gl-vis').textContent(), /يرون هذه/);
    results.push('👁 again showed it on the students\' board');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok: true, results}, null, 1));
  } finally { await browser.close(); app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); }
})().catch(e => { console.error(e); process.exit(1); });
