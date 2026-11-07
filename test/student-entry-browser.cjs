// Optional browser verification for stage 062: on a phone with a parent's account, «أنا الطالب» shows the parent's
// children; tapping one enters the running class under the child's first name. Another phone enters by name.
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
    const tc = await browser.newContext({viewport: {width: 1366, height: 900}}); tc.setDefaultTimeout(15000); await tc.addInitScript(() => localStorage.setItem('gl-autostart', '0'));
    const t = await tc.newPage(); t.on('pageerror', e => errors.push(e.message)); t.on('dialog', d => d.accept().catch(() => {}));
    await t.goto(base + '/start/teacher'); await t.locator('.gl-cur-subject[data-subject=science] li.is-ready button').first().click(); await t.waitForSelector('#pl-steps li');
    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/);
    const pc = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}); pc.setDefaultTimeout(15000);
    assert.equal((await pc.request.post(base + '/demo/start', {form: {role: 'parent'}, headers: {origin: base}, maxRedirects: 0})).status(), 303);
    const p = await pc.newPage(); p.on('pageerror', e => errors.push(e.message));
    await p.goto(base + '/start/student'); await p.waitForSelector('.gl-kid');
    assert.match(await p.locator('.gl-kids').textContent(), /نورة/); assert.ok(await p.locator('.gl-or').isVisible());
    await p.screenshot({path: path.join(out, 'student-entry-parent.png')});
    await p.locator('.gl-kid', {hasText: 'نورة'}).click(); await p.waitForURL(/\/class\/[A-Z0-9]{6}$/);
    await p.waitForFunction(() => window.__voice); await p.locator('#gl-enter').click(); await p.waitForSelector('#gl-content .gl-page');
    results.push('parent account on a phone: «أنا الطالب» listed the children; tapping «نورة» entered the running class');
    const sc = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}); sc.setDefaultTimeout(15000);
    const s = await sc.newPage(); const code = t.url().slice(-6);
    await s.goto(base + '/join?code=' + code); await s.locator('input[name=name]').fill('ليان'); await s.getByRole('button', {name: 'دخول الحصة'}).click(); await s.waitForURL(/\/class\//);
    await t.waitForFunction(() => /نورة/.test(document.body.textContent) && /ليان/.test(document.body.textContent));
    results.push('another phone entered by the student\'s name; the teacher sees «نورة» and «ليان»');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok: true, results}, null, 1));
  } finally { await browser.close(); app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); }
})().catch(e => { console.error(e); process.exit(1); });
