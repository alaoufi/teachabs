// Optional browser verification for stage 044: the student's board pops up over everything with only a microphone,
// «كتابة» and ✕ (asks first); live voice between teacher and student (fake microphones); the teacher decides who is
// heard; the teacher's board stays fixed on a phone.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
(async () => {
  const {openStore} = await import('../store.mjs'), {createApp} = await import('../server.mjs');
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.address().port, out = process.env.SCIENCE_ARTIFACTS || '../group-verification';
  fs.mkdirSync(out, {recursive: true});
  const browser = await chromium.launch({headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
    ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
  const results = [], errors = [];
  const watch = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); }); };
  const until = async (p, fn, arg, ms = 15000) => { const end = Date.now() + ms; for (;;) { const v = await p.evaluate(fn, arg); if (v) return v; if (Date.now() > end) throw new Error('timed out: ' + fn); await p.waitForTimeout(250); } };
  try {
    const tc = await browser.newContext({viewport: {width: 1366, height: 768}, permissions: ['microphone']}); tc.setDefaultTimeout(15000);
    await tc.addCookies([{name: 'ks', value: store.session(store.tour().teacher), url: base}]);
    const t = await tc.newPage(); watch(t); t.on('dialog', d => d.accept().catch(() => {}));
    await t.goto(base + '/teach/plans');
    await t.locator('.gl-cur-subject[data-subject=science] li.is-ready button').click(); await t.waitForSelector('#pl-steps li');
    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/);
    const code = t.url().split('/').pop();

    const sc = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, permissions: ['microphone']}); sc.setDefaultTimeout(15000);
    const s = await sc.newPage(); watch(s);
    await s.goto(base + '/join?code=' + code); await s.getByLabel('اسمك الأول').fill('سلمى'); await s.getByRole('button', {name: 'دخول الحصة'}).click();
    await s.waitForSelector('#gl-start:not([hidden])');
    await s.waitForFunction(() => window.__voice); await s.locator('#gl-enter').click(); await s.waitForSelector('#gl-content .gl-page');
    const lay = await s.evaluate(() => {
      const b = document.querySelector('#gl-board').getBoundingClientRect(), bar = document.querySelector('.gl-sbar').getBoundingClientRect();
      return {board: [b.left, b.top, b.right, b.bottom], bar: [bar.top, bar.bottom], vw: innerWidth, vh: innerHeight, header: getComputedStyle(document.querySelector('body > header')).display,
        position: getComputedStyle(document.querySelector('#gl-app')).position, buttons: [...document.querySelectorAll('.gl-sbar button:not([hidden])')].map(x => x.id)};
    });
    assert.equal(lay.position, 'fixed'); assert.equal(lay.header, 'none');
    assert.ok(lay.board[0] >= 0 && lay.board[2] <= lay.vw && lay.board[1] >= 0 && lay.board[3] <= lay.bar[0] && lay.bar[1] <= lay.vh, JSON.stringify(lay));
    assert.deepEqual(lay.buttons, ['gl-mic', 'gl-hand', 'gl-write', 'gl-leave']);
    await s.mouse.wheel(0, 800); assert.equal(await s.evaluate(() => scrollY), 0, 'nothing scrolls under the board');
    await s.waitForTimeout(700); await s.screenshot({path: path.join(out, 'board-first-student.png')});
    results.push('student: the board pops up over everything; only 🎤, ✏️ and ✕; nothing scrolls');

    // ---- live voice ----
    await t.locator('#gl-voice').click();
    await until(t, () => document.querySelector('#gl-voice').getAttribute('aria-pressed') === 'true');
    await until(s, () => window.__voice.state === 'connected');
    await until(s, async () => ((await window.__voice.stats())?.bytesIn || 0) > 2000);
    results.push('voice: the teacher opened the microphone; the student device receives the teacher’s audio');
    await s.locator('#gl-mic').click();
    await until(s, () => document.querySelector('#gl-mic').getAttribute('aria-pressed') === 'true').catch(async e => { throw new Error(e.message + ' status=' + await s.locator('#gl-status').textContent() + ' disabled=' + await s.locator('#gl-mic').isDisabled()); });
    await t.locator('#gl-drawer-btn').click();
    await until(t, () => document.querySelector('#gl-students li.is-talking')?.textContent.includes('🎤 سلمى'));
    const sid = await t.evaluate(() => window.__voice.connected()[0]);
    await until(t, async id => ((await window.__voice.stats(id))?.bytesIn || 0) > 2000, sid);
    results.push('voice: the student opened the microphone; the teacher hears it and sees 🎤 next to the name');
    await t.keyboard.press('Escape');
    await t.locator('#gl-mics').click();
    await until(s, () => document.querySelector('#gl-mic').disabled && document.querySelector('#gl-mic').getAttribute('aria-pressed') === 'false');
    await until(t, () => /مغلق/.test(document.querySelector('#gl-mics').textContent));
    await t.locator('#gl-mics').click(); await until(s, () => !document.querySelector('#gl-mic').disabled);
    results.push('teacher control: «مايك الطلاب: مغلق» closes and disables the student microphone; opening it again re-enables it');

    // ---- writing sheet opens when the teacher opens the questions ----
    await t.locator('#gl-steps li[data-type=questions] button').click();
    await t.locator('#gl-quick').getByRole('button', {name: /افتح/}).click();
    await s.waitForSelector('#gl-sheet:not([hidden]) #gl-answer fieldset');
    await s.locator('#gl-answer fieldset').first().locator('.gl-choice').first().click();
    await s.waitForSelector('.gl-sent');
    await s.screenshot({path: path.join(out, 'board-first-student-writing.png')});
    await s.locator('#gl-sheet-close').click(); assert.equal(await s.locator('#gl-sheet').isHidden(), true);
    results.push('«كتابة»: the sheet opened over the board when the teacher opened the questions; the answer was sent; back to the board');

    // ---- leave asks first; class end shows a closing message ----
    s.once('dialog', d => d.dismiss()); await s.locator('#gl-leave').click(); await s.waitForTimeout(300);
    assert.match(s.url(), /\/class\//, 'cancelling keeps the student in class');
    await t.locator('#gl-live').click();
    await s.waitForSelector('#gl-ended:not([hidden])');
    assert.equal(await s.locator('#gl-ended-title').textContent(), 'انتهت الحصة');
    s.once('dialog', d => d.accept()); await s.locator('#gl-ended-close').click(); await s.waitForURL(/\/join/);
    results.push('✕ asks before leaving (cancel stays); at the end «انتهت الحصة» with a close button that asks first');

    // ---- teacher on a phone: the board stays put ----
    await t.locator('#gl-live').click();
    const pc = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}); pc.setDefaultTimeout(15000);
    await pc.addCookies(await tc.cookies()); // the same teacher who owns the class
    const tp = await pc.newPage(); watch(tp); await tp.goto(base + `/teach/live/${code}`); await tp.waitForSelector('#gl-steps li.is-current', {state: 'attached'}).catch(async e => { await tp.screenshot({path: path.join(out, 'phone-debug.png')}); throw new Error('phone: ' + JSON.stringify(errors) + ' ' + await tp.locator('#gl-status').textContent()); });
    await tp.waitForTimeout(500); if (process.env.DEBUG_PHONE) console.log('errors', errors);
    const m = await tp.evaluate(() => { const b = document.querySelector('#gl-board').getBoundingClientRect(); return {b: [b.top, b.bottom, b.width], vh: innerHeight, scroll: document.documentElement.scrollHeight > innerHeight + 1}; });
    assert.ok(!m.scroll && m.b[0] >= 0 && m.b[1] <= m.vh && m.b[2] >= 360, JSON.stringify(m));
    await tp.screenshot({path: path.join(out, 'board-first-teacher-phone.png')});
    results.push(`teacher phone: the whole board on screen (${Math.round(m.b[2])}px wide), the page does not scroll`);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok: true, results}, null, 1));
  } finally { await browser.close(); app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); }
})().catch(e => { console.error(e); process.exit(1); });
