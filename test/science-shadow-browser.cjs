// Optional browser verification of the grade 4 light-and-shadow lesson.
// PLAYWRIGHT_MODULE may point to an installed Playwright; SCIENCE_ARTIFACTS chooses the screenshot folder.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
(async () => {
  const {openStore} = await import('../store.mjs'), {createApp} = await import('../server.mjs'), {SCIENCE_SHADOW_ROUTE} = await import('../science-lesson.mjs');
  const db = openStore(':memory:'), app = createApp(db);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.address().port, url = base + SCIENCE_SHADOW_ROUTE;
  const output = process.env.SCIENCE_ARTIFACTS || '../science-verification';
  fs.mkdirSync(output, {recursive: true});
  const browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
  const results = [];
  try {
    const context = await browser.newContext({viewport: {width: 1280, height: 900}}), page = await context.newPage(), errors = [], external = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('request', r => { if (new URL(r.url()).origin !== base) external.push(r.url()); });
    await page.goto(url);
    await page.waitForFunction(() => document.documentElement.classList.contains('sl-ready'));
    const text = id => page.locator('#' + id).textContent();
    assert.equal(await text('sl-hour-out'), '٨:٠٠ صباحًا');
    assert.equal(await text('sl-direction'), 'نحو الغرب');
    assert.equal(await text('sl-progress'), '٠ من ٥');

    // Slider → instant result.
    const setRange = async (id, value) => page.locator('#' + id).evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input', {bubbles: true})); }, String(value));
    await setRange('sl-hour', 9);
    assert.equal(await text('sl-length'), '١٫٥ م');
    assert.match(await text('sl-compare'), /يساوي/);
    await page.locator('[name=sl-challenge][value=equal]').check();
    assert.match(await text('sl-challenge-feedback'), /أحسنت/);
    results.push('slider updates readouts and equal challenge');

    // Keyboard on the slider moves one 15-minute step.
    await page.locator('#sl-hour').focus(); await page.keyboard.press('ArrowRight');
    const afterKey = await page.locator('#sl-hour').inputValue();
    assert.ok(['8.75', '9.25'].includes(afterKey), afterKey);
    results.push('keyboard step ' + afterKey);

    // Drag the sun in the sky to the afternoon side (west is drawn on the left).
    await page.locator('[name=sl-challenge][value=east]').check();
    await page.locator('#sl-scene').scrollIntoViewIfNeeded();
    const box = await page.locator('#sl-scene').boundingBox();
    await page.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.3); await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3, {steps: 10}); await page.mouse.up();
    assert.ok(Number(await page.locator('#sl-hour').inputValue()) > 12);
    assert.equal(await text('sl-direction'), 'نحو الشرق');
    assert.match(await text('sl-challenge-feedback'), /أحسنت/);
    results.push('dragging the sun sets afternoon hour ' + await page.locator('#sl-hour').inputValue());

    // Vanish, longest, faint.
    await setRange('sl-hour', 12); assert.match(await text('sl-length'), /٠ م/); assert.equal(await page.locator('#sl-scene polygon.shadow').count(), 0);
    await setRange('sl-hour', 17); await setRange('sl-height', 2);
    await page.locator('[name=sl-material][value=paper]').check({force: true});
    assert.match(await text('sl-material-text'), /جزء من الضوء/);
    const opacity = await page.locator('#sl-scene polygon.shadow').getAttribute('fill-opacity');
    assert.equal(opacity, '0.35');
    assert.equal(await text('sl-progress'), '٥ من ٥');
    assert.equal(await page.locator('.sl-challenge-list li.is-done').count(), 5);
    results.push('all five challenges completed by student control');

    // Animation moves the sun and stops; autoplay alone does not complete challenges.
    await page.locator('#sl-reset').click();
    assert.equal(await page.locator('#sl-hour').inputValue(), '8');
    await page.locator('#sl-play').click();
    assert.equal(await page.locator('#sl-play').getAttribute('aria-pressed'), 'true');
    await page.waitForTimeout(1600);
    const moving = Number(await page.locator('#sl-hour').inputValue());
    assert.ok(moving > 8.5, 'animation advanced: ' + moving);
    await page.locator('#sl-play').click();
    assert.equal(await page.locator('#sl-play').getAttribute('aria-pressed'), 'false');
    const paused = await page.locator('#sl-hour').inputValue(); await page.waitForTimeout(500);
    assert.equal(await page.locator('#sl-hour').inputValue(), paused);
    results.push('play/pause advanced to ' + paused);

    // Quiz feedback.
    await page.locator('[name=sl-q2][value=a]').check({force: true});
    assert.match(await page.locator('[data-question=q2] .sl-feedback').textContent(), /ليست الإجابة/);
    await page.locator('[name=sl-q2][value=c]').check({force: true});
    assert.match(await page.locator('[data-question=q2] .sl-feedback').textContent(), /إجابة صحيحة/);
    results.push('quiz immediate feedback');

    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({width, height: 900});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'overflow at ' + width);
      const small = await page.evaluate(() => [...document.querySelectorAll('.science-lesson button, .sl-nav a, .sl-choice span, .sl-option, .sl-challenge')].filter(e => e.getBoundingClientRect().height < 43.5).length);
      assert.equal(small, 0, 'touch targets at ' + width);
      await page.screenshot({path: path.join(output, `science-shadow-${width}.png`), fullPage: true});
    }
    results.push('no horizontal overflow and ≥44px targets at 320/390/768/1280');
    assert.deepEqual(errors, []); assert.deepEqual(external, []);

    // Phone emulation with real touch input on the sky.
    const phone = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true, deviceScaleFactor: 2});
    const touch = await phone.newPage(); await touch.goto(url);
    await touch.waitForFunction(() => document.documentElement.classList.contains('sl-ready'));
    await touch.locator('#sl-scene').scrollIntoViewIfNeeded();
    const tb = await touch.locator('#sl-scene').boundingBox(), cdp = await phone.newCDPSession(touch);
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: tb.x + tb.width * 0.55, y: tb.y + tb.height * 0.3}]});
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: tb.x + tb.width * 0.15, y: tb.y + tb.height * 0.35}]});
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    assert.ok(Number(await touch.locator('#sl-hour').inputValue()) > 12, 'touch drag moved the sun');
    await touch.locator('#sl-controls, .sl-controls').first().scrollIntoViewIfNeeded();
    await touch.screenshot({path: path.join(output, 'science-shadow-phone-lab.png')});
    results.push('touch drag on phone emulation');

    // Without JavaScript the explanation and initial picture still render.
    const nojs = await browser.newContext({javaScriptEnabled: false}), plain = await nojs.newPage(); await plain.goto(url);
    assert.equal(await plain.locator('#sl-scene svg').count(), 1); assert.ok((await plain.locator('#sl-explain').textContent()).includes('خطوط مستقيمة'));
    results.push('no-JS fallback renders explanation and scene');
    console.log(JSON.stringify({ok: true, results}, null, 1));
  } finally {
    await browser.close(); app.closeAllConnections(); await new Promise(r => app.close(r)); db.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
