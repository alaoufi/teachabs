// Optional browser verification for stage 040: the states-of-matter lesson, the narrator strip under the board,
// and the floating student board (stays on top while scrolling, can fill the screen).
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
  const watch = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); };
  try {
    const tc = await browser.newContext({viewport: {width: 1700, height: 1000}}); tc.setDefaultTimeout(15000);
    await tc.addCookies([{name: 'ks', value: store.session(store.tour().teacher), url: base}]);
    const t = await tc.newPage(); watch(t); t.on('dialog', d => d.accept().catch(() => {}));
    await t.goto(base + '/teach/plans');
    assert.deepEqual(await t.locator('.gl-templates form button').allTextContents(), ['الضوء والظل', 'حالات المادة']);
    await t.locator('.gl-templates button', {hasText: 'حالات المادة'}).click(); await t.waitForURL(/\/teach\/plans\/[0-9a-f-]{36}$/);
    await t.waitForSelector('#pl-steps li');
    const inter = t.locator('#pl-steps li').nth(2); await inter.locator('summary').click();
    assert.equal(await inter.locator('.pl-body select').first().inputValue(), 'matter');
    assert.equal(await inter.locator('.pl-seg').count(), 7);
    assert.match(await inter.locator('.pl-seg').nth(3).locator('.pl-q-head b').textContent(), /١٠٠°س/);
    results.push('lesson created from the states-of-matter template; planner shows the matter activity and its 7-segment tour');
    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/);
    const code = t.url().split('/').pop();
    const display = await tc.newPage(); watch(display); await display.goto(base + `/teach/live/${code}/display`);
    const sc = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}); sc.setDefaultTimeout(15000);
    const s = await sc.newPage(); watch(s);
    await s.goto(base + '/join?code=' + code); await s.getByLabel('اسمك الأول').fill('نورة'); await s.getByRole('button', {name: 'دخول الحصة'}).click(); await s.waitForFunction(() => window.__voice); await s.locator('#gl-enter').click(); // the entry card opens the board
    await s.waitForSelector('#gl-content .gl-page svg');
    assert.equal(await s.locator('body > header').isVisible(), false, 'site header hidden for students');
    await t.locator('#gl-steps li[data-type=interactive] button').click(); await s.waitForSelector('#gl-content .matter-scene');
    const phase = p => p.evaluate(() => document.querySelector('#gl-content .m-phase')?.textContent);
    assert.equal(await phase(s), 'سائل (ماء)');
    // Teacher heats the water to boiling with the slider; everyone sees boiling.
    await t.locator('.gl-act-controls input[type=range]').evaluate(el => { el.value = '100'; el.dispatchEvent(new Event('change', {bubbles: true})); });
    await s.waitForFunction(() => document.querySelector('#gl-content .m-phase')?.textContent.startsWith('يغلي'));
    await t.locator('.gl-act-controls').getByRole('button', {name: 'سخّن ١٠°'}).click();
    await display.waitForFunction(() => document.querySelector('#gl-content .m-phase')?.textContent.startsWith('غاز'));
    await s.waitForFunction(() => document.querySelector('#gl-content .m-phase')?.textContent.startsWith('غاز'));
    assert.ok(await s.locator('#gl-content .particle.p-fly').count() > 0, 'gas particles fly');
    results.push('teacher heated water: liquid → boiling → gas on student and display, particles change motion');
    // Predict, then reveal.
    await t.locator('#gl-panel').getByRole('button', {name: 'إخفاء الحالة ليتوقع الطلاب'}).click();
    await s.waitForFunction(() => document.querySelector('#gl-content .m-phase')?.textContent.startsWith('توقّع'));
    assert.equal(await s.locator('#gl-content .particle').count(), 0);
    await t.locator('#gl-panel').getByRole('button', {name: 'اكشف الحالة'}).click();
    await s.waitForFunction(() => document.querySelector('#gl-content .particle'));
    results.push('state hidden for prediction, then revealed');
    // Narrator tour: ice first, strip under the board.
    await t.locator('#gl-quick [data-narr=start]').click();
    await s.waitForFunction(() => document.querySelector('.gl-narrator .gl-caption')?.textContent.startsWith('هذا جليد'));
    await s.waitForFunction(() => document.querySelector('#gl-content .m-phase')?.textContent.startsWith('صلب'), null, {timeout: 5000});
    for (const p of [s, display]) {
      const geo = await p.evaluate(() => { const b = document.querySelector('#gl-board').getBoundingClientRect(), n = document.querySelector('.gl-narrator').getBoundingClientRect(); return {inside: Boolean(document.querySelector('#gl-board .gl-narrator')), boardBottom: b.bottom, narratorTop: n.top}; });
      assert.equal(geo.inside, false); assert.ok(geo.narratorTop >= geo.boardBottom - 1, JSON.stringify(geo));
    }
    for (let i = 0; i < 3; i++) await t.locator('#gl-quick [data-narr=next]').click();
    await s.waitForFunction(() => document.querySelector('.gl-narrator .gl-seg').textContent.startsWith('٤'));
    await s.waitForFunction(() => document.querySelector('#gl-content .m-phase')?.textContent.startsWith('يغلي'), null, {timeout: 5000});
    await s.waitForTimeout(400);
    await display.screenshot({path: path.join(out, 'matter-display-boiling.png')});
    await s.screenshot({path: path.join(out, 'matter-student-phone.png')});
    results.push('narrator tour moves the water from ice to boiling; the narrator strip sits under the board on phone and display');
    // Individual exploration with the activity's own slider.
    await t.locator('#gl-panel').getByRole('button', {name: 'اسمح للطلاب بالاستكشاف على أجهزتهم'}).click();
    await s.waitForSelector('.gl-explore input[type=range]');
    await s.locator('.gl-explore input[type=range]').evaluate(el => { el.value = '-15'; el.dispatchEvent(new Event('input', {bubbles: true})); });
    await s.waitForFunction(() => document.querySelector('.gl-explore .m-phase')?.textContent.startsWith('صلب'));
    await t.locator('#gl-panel').getByRole('button', {name: 'إيقاف الاستكشاف الفردي'}).click();
    results.push('student explored alone: cooled the water to ice on their own phone');
    // Floating board while answering: stays on top after scrolling; full screen on demand.
    await t.locator('#gl-steps li').nth(3).locator('button').click();
    await t.locator('#gl-panel').getByRole('button', {name: 'افتح الإجابة للطلاب'}).click();
    await s.waitForSelector('#gl-answer fieldset:not([disabled])');
    // The board stays fixed over everything; the answers open in the «كتابة» sheet over it.
    const solo = await s.evaluate(() => ({fixed: getComputedStyle(document.querySelector('#gl-app')).position, sheet: !document.querySelector('#gl-sheet').hidden, scrolled: scrollY}));
    assert.deepEqual(solo, {fixed: 'fixed', sheet: true, scrolled: 0});
    await s.screenshot({path: path.join(out, 'floating-board-answering.png')});
    await s.locator('#gl-sheet-close').click(); await s.waitForSelector('#gl-sheet', {state: 'hidden'});
    results.push('student board stays fixed over everything; the answers open in a sheet over it and close back to the board');
    assert.equal(await s.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    for (const p of [t, display, s]) assert.equal(await p.locator('#gl-status.is-error').count(), 0, await p.locator('#gl-status').textContent());
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok: true, results}, null, 1));
  } finally { await browser.close(); app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); }
})().catch(e => { console.error(e); process.exit(1); });
