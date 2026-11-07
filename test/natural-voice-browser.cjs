// Optional browser verification for stage 053: explanations try the natural server voice first (man or woman, chosen by
// the teacher) and fall back to the device voice when there is none. The server voice is simulated here.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const {openStore} = await import('../store.mjs'), {createApp} = await import('../server.mjs');
  process.env.AZURE_SPEECH_KEY = 'test'; // the server says it has a natural voice; the voice itself is simulated below
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.address().port;
  const browser = await chromium.launch({headless: true, args: ['--autoplay-policy=no-user-gesture-required'], ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
  const results = [], errors = [];
  // record which audio the page plays; pretend each clip ends quickly
  const spy = () => { window.__played = []; window.__said = []; const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { if (this.src && !this.srcObject) { window.__played.push(this.src); setTimeout(() => this.onended?.(), 30); return Promise.resolve(); } return play.call(this); };
    if (window.speechSynthesis) speechSynthesis.speak = u => { window.__said.push(u.text); setTimeout(() => u.onend?.(), 10); }; };
  let natural = true;
  const fakeVoice = async route => natural ? route.fulfill({status: 200, contentType: 'audio/mpeg', body: Buffer.from([0xff, 0xf3, 0x44, 0xc4])}) : route.fulfill({status: 404, contentType: 'application/json', body: '{"error":"x"}'});
  try {
    const tc = await browser.newContext({viewport: {width: 1366, height: 768}}); tc.setDefaultTimeout(15000); await tc.addInitScript(spy); await tc.route(/\/speech\?/, fakeVoice);
    const t = await tc.newPage(); t.on('pageerror', e => errors.push(e.message)); t.on('dialog', d => d.accept().catch(() => {}));
    await t.goto(base + '/start/teacher'); await t.locator('.gl-cur-subject[data-subject=science] li.is-ready button').click(); await t.waitForSelector('#pl-steps li');
    await t.locator('select[aria-label="صوت المتحدث"]').selectOption('female');
    await t.getByRole('button', {name: 'حفظ الدرس'}).click(); await t.waitForFunction(() => document.querySelector('#pl-status').textContent.includes('حُفظ'));
    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/);
    const sc = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}); sc.setDefaultTimeout(15000); await sc.addInitScript(spy); await sc.route(/\/speech\?/, fakeVoice);
    const s = await sc.newPage(); s.on('pageerror', e => errors.push(e.message));
    await s.goto(base + '/start/student'); await s.waitForFunction(() => window.__voice); await s.locator('#gl-enter').click(); await s.waitForSelector('#gl-content .gl-page');
    assert.match(await t.locator('#gl-quick .gl-speaker').textContent(), /امرأة/, 'the planned voice (woman) is the class voice');
    await t.locator('#gl-quick').getByRole('button', {name: '▶ على أجهزة الطلاب'}).click();
    await s.waitForFunction(() => window.__played.some(x => /\/class\/[A-Z0-9]{6}\/speech\?step=.*&v=female/.test(x)));
    await t.waitForFunction(() => window.__played.some(x => /\/teach\/live\/[A-Z0-9]{6}\/speech\?step=.*&v=female/.test(x)));
    results.push('the curriculum explanation played in the natural woman\'s voice on the student\'s and the teacher\'s device');
    await t.locator('#gl-quick .gl-speaker').click(); await t.waitForFunction(() => document.querySelector('#gl-quick .gl-speaker')?.textContent.includes('رجل'));
    await t.locator('#gl-steps li[data-type=interactive] button').click();
    await s.waitForFunction(() => window.__played.some(x => /segment=0&v=male/.test(x)));
    results.push('the teacher switched to a man\'s voice; the narrator of the interactive explanation spoke with it');
    natural = false; // no key on the server: back to the device voice
    await t.locator('#gl-quick [data-narr=next]').click();
    await s.waitForFunction(() => window.__said.length > 0);
    results.push('without a natural voice the device voice still reads the explanation');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok: true, results}, null, 1));
  } finally { await browser.close(); app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); }
})().catch(e => { console.error(e); process.exit(1); });
