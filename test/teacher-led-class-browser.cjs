// Optional browser verification of the teacher-led class: synced activity, handover, predict/reveal,
// and teacher → student audio using Chromium's SYNTHETIC fake microphone on one machine.
// This proves the local signalling/media path only; it is not a test of real voice, devices or networks.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
(async () => {
  const {openStore} = await import('../store.mjs'), {createApp} = await import('../server.mjs');
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.address().port, output = process.env.SCIENCE_ARTIFACTS || '../science-verification';
  fs.mkdirSync(output, {recursive: true});
  const browser = await chromium.launch({headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'], ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
  const results = [];
  try {
    const context = await browser.newContext({viewport: {width: 1280, height: 900}, permissions: ['microphone']});
    context.setDefaultTimeout(15000);
    await context.addInitScript(() => {
      const PC = window.RTCPeerConnection; window.__pcs = [];
      window.RTCPeerConnection = class extends PC { constructor(...a) { super(...a); window.__pcs.push(this); } };
    });
    const t = await context.newPage(), s = await context.newPage(), errors = [];
    for (const p of [t, s]) p.on('pageerror', e => errors.push(e.message));
    await t.goto(base + '/lesson/teacher'); await t.locator('form[action*="seat=teacher"] button').click();
    await s.goto(base + '/lesson/preview');
    for (const p of [t, s]) await p.locator('.class-activity details:has(#shadow-activity) > summary').click(); // optional panel, closed by default
    for (const p of [t, s]) await p.waitForFunction(() => !document.querySelector('#sa-hour').disabled || document.querySelector('#sa-role').textContent.includes('المعلم يقود'));
    await t.waitForFunction(() => !document.querySelector('#sa-hour').disabled);
    assert.equal(await s.locator('#sa-hour').isDisabled(), true, 'student cannot drive before handover');
    assert.equal(await s.locator('#sa-handover').count(), 0);
    results.push('teacher leads; student controls locked');

    // Teacher explains step by step; the student sees each step.
    await t.locator('#sa-later').click();
    await s.waitForFunction(() => document.querySelector('#sa-hour-out').textContent.startsWith('٩:'));
    assert.match(await s.locator('#sa-direction').textContent(), /الغرب/);
    // Teacher drags the sun across the sky.
    const sc = t.locator('#sa-scene'); await sc.scrollIntoViewIfNeeded(); const b = await sc.boundingBox();
    await t.mouse.move(b.x + b.width * 0.55, b.y + b.height * 0.3); await t.mouse.down(); await t.mouse.move(b.x + b.width * 0.2, b.y + b.height * 0.3, {steps: 12}); await t.mouse.up();
    await s.waitForFunction(() => document.querySelector('#sa-direction').textContent.includes('الشرق'));
    results.push('step buttons and sun drag sync to student');

    // Predict, then reveal.
    await t.locator('#sa-reveal').click();
    await s.waitForFunction(() => document.querySelector('#sa-length').textContent === 'توقّع أولًا');
    assert.equal(await s.locator('#sa-scene polygon.shadow').count(), 0);
    assert.ok(await t.locator('#sa-scene polygon.shadow').count() === 1, 'teacher still sees the shadow');
    await s.screenshot({path: path.join(output, 'class-student-predict.png')});
    await t.locator('#sa-reveal').click();
    await s.waitForFunction(() => document.querySelector('#sa-scene polygon.shadow'));
    results.push('predict mode hides shadow from student only, then reveal');

    // Handover with a challenge; the student drives and the teacher sees it live.
    await t.locator('#sa-challenge').selectOption('equal');
    await t.locator('#sa-handover').click();
    await s.waitForFunction(() => !document.querySelector('#sa-hour').disabled);
    assert.match(await s.locator('#sa-role').textContent(), /دورك الآن/);
    await s.locator('#sa-hour').evaluate(el => { el.value = '9'; el.dispatchEvent(new Event('input', {bubbles: true})); el.dispatchEvent(new Event('change', {bubbles: true})); });
    await t.waitForFunction(() => document.querySelector('#sa-challenge-box').classList.contains('is-success'));
    await s.waitForFunction(() => document.querySelector('#sa-challenge-box').textContent.includes('أحسنت'));
    await t.locator('#sa-handover').click();
    await s.waitForFunction(() => document.querySelector('#sa-hour').disabled);
    results.push('handover, student-driven challenge seen by teacher, control taken back');

    // Teacher voice: synthetic microphone, then confirm audio packets reach the student seat.
    await t.locator('#mic').click();
    await t.waitForFunction(() => document.querySelector('#mic').getAttribute('aria-pressed') === 'true');
    const received = await s.evaluate(async () => {
      for (let i = 0; i < 40; i++) {
        for (const pc of window.__pcs || []) {
          const stats = await pc.getStats();
          for (const r of stats.values()) if (r.type === 'inbound-rtp' && r.kind === 'audio' && r.bytesReceived > 2000) return {bytes: r.bytesReceived, packets: r.packetsReceived, level: r.audioLevel ?? null};
        }
        await new Promise(r => setTimeout(r, 500));
      }
      return null;
    });
    assert.ok(received && received.bytes > 2000, 'no inbound audio at the student seat: ' + JSON.stringify(received));
    results.push('synthetic teacher audio reached student: ' + JSON.stringify(received));

    // Board still works below the activity.
    await t.waitForSelector('.excalidraw'); await s.waitForSelector('.excalidraw');
    results.push('board loads for both seats');

    for (const width of [390, 1280]) {
      await t.setViewportSize({width, height: 900});
      assert.equal(await t.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'overflow ' + width);
      await t.screenshot({path: path.join(output, `class-teacher-${width}.png`), fullPage: false});
      if (width === 390) { await t.locator('#sa-teacher, .sa-teacher').first().scrollIntoViewIfNeeded(); await t.screenshot({path: path.join(output, 'class-teacher-activity-390.png')}); }
    }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok: true, results}, null, 1));
  } finally { await browser.close(); app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); }
})().catch(e => { console.error(e); process.exit(1); });
