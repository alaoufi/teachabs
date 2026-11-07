// Optional browser verification for stage 051: inside the Android app the page cannot speak, so explanations are read
// aloud by the app (window.App.speak, the phone's Arabic voice). Simulated here: the teacher and the student hear the
// interactive explanation and the curriculum page explanation through the app.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const {openStore} = await import('../store.mjs'), {createApp} = await import('../server.mjs');
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.address().port;
  const browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
  const results = [], errors = [];
  // the app's bridge, as MainActivity provides it; the page's own speech is switched off as in the WebView
  const appBridge = () => { window.__said = []; delete window.speechSynthesis;
    window.App = {voice: () => 'ar', stopSpeaking() {}, speak(text, id) { window.__said.push(text); setTimeout(() => window.__appSpeechDone?.(id), 20); return true; }}; };
  try {
    const tc = await browser.newContext({viewport: {width: 1366, height: 768}}); tc.setDefaultTimeout(15000); await tc.addInitScript(appBridge);
    const t = await tc.newPage(); t.on('pageerror', e => errors.push(e.message)); t.on('dialog', d => d.accept().catch(() => {}));
    await t.goto(base + '/start/teacher'); await t.locator('.gl-cur-subject[data-subject=science] li.is-ready button').click(); await t.waitForSelector('#pl-steps li');
    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/);
    const sc = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}); sc.setDefaultTimeout(15000); await sc.addInitScript(appBridge);
    const s = await sc.newPage(); s.on('pageerror', e => errors.push(e.message));
    await s.goto(base + '/start/student'); await s.waitForFunction(() => window.__voice); await s.locator('#gl-enter').click(); await s.waitForSelector('#gl-content .gl-page');
    await t.locator('#gl-quick').getByRole('button', {name: '▶ على أجهزة الطلاب'}).click();
    await s.waitForFunction(() => window.__said.some(x => x.includes('درسنا اليوم')));
    await t.waitForFunction(() => window.__said.some(x => x.includes('درسنا اليوم')));
    results.push('curriculum page: the explanation was read aloud by the app on the student\'s and the teacher\'s phone');
    await t.locator('#gl-steps li[data-type=interactive] button').click();
    await s.waitForFunction(() => document.querySelector('.gl-narrator .gl-caption')?.textContent.length > 10);
    const first = await s.locator('.gl-narrator .gl-caption').textContent();
    await s.waitForFunction(x => window.__said.includes(x), first); await t.waitForFunction(x => window.__said.includes(x), first);
    await t.waitForFunction(() => document.querySelector('#gl-quick .gl-narr-label')?.textContent.includes('٢'), null, {timeout: 20000});
    results.push('interactive step: the narrator spoke through the app on both phones and moved on to the next segment by itself');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok: true, results}, null, 1));
  } finally { await browser.close(); app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); }
})().catch(e => { console.error(e); process.exit(1); });
