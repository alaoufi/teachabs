// Optional browser verification for stage 049: a real teacher and a real student in the same class at the same time.
// Teacher on a computer, student on a phone (fake microphone and camera): the teacher's voice and picture reach the
// student (even when connection messages arrive late and out of order), the student's voice reaches the teacher, the clear control panel works including «⛔ إيقاف الكل», and the
// lesson itself (curriculum page with its audio explanation, the interactive explanation) follows the teacher live.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
(async () => {
  const {openStore} = await import('../store.mjs'), {createApp} = await import('../server.mjs');
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  const base = process.env.LIVE_BASE || 'http://127.0.0.1:' + app.address().port, out = process.env.SCIENCE_ARTIFACTS || '../group-verification';
  fs.mkdirSync(out, {recursive: true});
  const browser = await chromium.launch({headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
    ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {}), ...(process.env.LIVE_BASE && process.env.HTTPS_PROXY ? {proxy: {server: process.env.HTTPS_PROXY}} : {})});
  const results = [], errors = [];
  const watch = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); }); };
  // A real network: connection messages are delayed by different amounts, so they may arrive out of order.
  const jitter = async ctx => { if (!process.env.LIVE_BASE) await ctx.route(/\/rtc$/, async route => { await new Promise(r => setTimeout(r, Math.random() * 600)); route.continue(); }); };
  const until = async (p, fn, arg, ms = 20000) => { const end = Date.now() + ms; for (;;) { const v = await p.evaluate(fn, arg); if (v) return v; if (Date.now() > end) throw new Error('timed out: ' + fn); await p.waitForTimeout(250); } };
  try {
    const tc = await browser.newContext({viewport: {width: 1366, height: 768}, permissions: ['microphone', 'camera']}); tc.setDefaultTimeout(30000);
    await jitter(tc); const t = await tc.newPage(); watch(t); t.on('dialog', d => d.accept().catch(() => {}));
    await t.goto(base + '/start/teacher');
    await t.locator('.gl-cur-subject[data-subject=science] li.is-ready button').click(); await t.waitForSelector('#pl-steps li');
    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/);
    await t.waitForSelector('#gl-steps li.is-current');

    const sc = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, permissions: ['microphone']}); sc.setDefaultTimeout(30000);
    await jitter(sc); const s = await sc.newPage(); watch(s);
    await s.addInitScript(() => { window.__spoken = []; window.speechSynthesis && (speechSynthesis.speak = u => { window.__spoken.push(u.text); setTimeout(() => u.onend?.(), 10); }); });
    await s.goto(base + '/start/student'); await s.waitForURL(/\/class\/[A-Z0-9]{6}$/);
    await s.waitForFunction(() => window.__voice); await s.locator('#gl-enter').click(); await s.waitForSelector('#gl-content .gl-page');
    results.push('the student entered the running class at the same time as the teacher');

    // ---- the control panel is always on screen ----
    const panel = await t.evaluate(() => [...document.querySelectorAll('#gl-av button')].map(b => { const r = b.getBoundingClientRect(); return {id: b.id, on: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth}; }));
    assert.deepEqual(panel.map(p => p.id), ['gl-voice', 'gl-cam', 'gl-mics', 'gl-stop']); assert.ok(panel.every(p => p.on), JSON.stringify(panel));

    // ---- teacher voice and camera reach the student ----
    await t.locator('#gl-voice').click(); await until(t, () => document.querySelector('#gl-voice').getAttribute('aria-pressed') === 'true');
    await t.locator('#gl-cam').click(); await until(t, () => document.querySelector('#gl-cam').getAttribute('aria-pressed') === 'true' && !document.querySelector('#gl-selfcam').hidden);
    await until(s, async () => ((await window.__voice.stats())?.bytesIn || 0) > 2000);
    await until(s, () => { const v = document.querySelector('#gl-teachercam'); return v && !v.hidden && v.videoWidth > 0; });
    await until(s, async () => ((await window.__voice.stats())?.videoIn || 0) > 20000);
    await s.waitForTimeout(800); await s.screenshot({path: path.join(out, 'live-av-student.png')});
    results.push('🎙 the teacher\'s voice is heard and 📷 the teacher\'s picture is seen on the student\'s phone');

    // ---- the student's voice reaches the teacher ----
    await s.locator('#gl-mic').click(); await until(s, () => document.querySelector('#gl-mic').getAttribute('aria-pressed') === 'true');
    const sid = await until(t, () => window.__voice.connected()[0]);
    await until(t, async id => ((await window.__voice.stats(id))?.bytesIn || 0) > 2000, sid);
    await until(t, () => document.querySelector('#gl-mics').textContent.includes('يتحدث'));
    await t.screenshot({path: path.join(out, 'live-av-teacher.png')});
    results.push('🎤 the student spoke and the teacher hears it; «مايك الطلاب» shows who is talking');

    // ---- the lesson follows the teacher live: page explanation, interactive explanation ----
    await t.locator('#gl-quick').getByRole('button', {name: '▶ على أجهزة الطلاب'}).click();
    await s.waitForFunction(() => window.__spoken.some(x => x.includes('درسنا اليوم')));
    results.push('🔊 the prepared explanation of the curriculum page played on the student\'s phone');
    await t.locator('#gl-steps li[data-type=interactive] button').click(); await s.waitForSelector('#gl-content .cells-scene');
    for (let i = 0; i < 3; i++) await t.locator('#gl-quick').getByRole('button', {name: /تكبير/}).click();
    await s.waitForFunction(() => document.querySelector('#gl-content .cells-scene .c-crumb.is-on text')?.textContent === 'الخلية');
    await t.locator('#gl-quick select[aria-label="الجزء المظلل"]').selectOption('nucleus');
    await s.waitForFunction(() => document.querySelector('#gl-content [data-part="nucleus"]')?.classList.contains('c-hl'));
    await s.waitForTimeout(700); await s.screenshot({path: path.join(out, 'live-av-student-interactive.png')});
    results.push('🔬 interactive explanation: the teacher zoomed to the cell and lit the nucleus — the student\'s board followed live');

    // ---- emergency: everything off at once ----
    await t.locator('#gl-stop').click();
    await until(t, () => document.querySelector('#gl-voice').getAttribute('aria-pressed') === 'false' && document.querySelector('#gl-cam').getAttribute('aria-pressed') === 'false' && /مغلق/.test(document.querySelector('#gl-mics').textContent));
    await until(s, () => document.querySelector('#gl-teachercam').hidden && document.querySelector('#gl-mic').disabled && document.querySelector('#gl-mic').getAttribute('aria-pressed') === 'false');
    results.push('⛔ «إيقاف الكل» closed the teacher\'s microphone and camera and every student microphone at once');

    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok: true, results}, null, 1));
  } finally { await browser.close(); app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); }
})().catch(e => { console.error(e); process.exit(1); });
