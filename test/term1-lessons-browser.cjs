// Optional browser verification for stage 042: the term-1 curriculum on «دروسي», and the first science lesson
// (cells) and first math lesson (place value) run live: teacher at 1366x768, display screen and a student phone.
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
    const tc = await browser.newContext({viewport: {width: 1366, height: 768}}); tc.setDefaultTimeout(15000);
    await tc.addCookies([{name: 'ks', value: store.session(store.tour().teacher), url: base}]);
    const t = await tc.newPage(); watch(t); t.on('dialog', d => d.accept().catch(() => {}));
    await t.goto(base + '/teach/plans');
    const sci = t.locator('.gl-cur-subject[data-subject=science]'), math = t.locator('.gl-cur-subject[data-subject=math]');
    assert.match(await sci.locator('summary').textContent(), /1 جاهز من 12/);
    assert.match(await math.locator('summary').textContent(), /1 جاهز من 39/);
    assert.equal(await sci.locator('li').first().locator('span').textContent(), 'الخلايا');
    assert.deepEqual(await t.locator('.gl-templates form button').allTextContents(), ['الضوء والظل', 'حالات المادة']);
    await t.screenshot({path: path.join(out, 'term1-curriculum.png'), fullPage: true});
    results.push('«دروسي» lists term-1 science (12) and math (39) lessons in book order; cells and place value are ready');

    // ---- cells ----
    await sci.locator('li.is-ready button').click(); await t.waitForURL(/\/teach\/plans\/[0-9a-f-]{36}$/); await t.waitForSelector('#pl-steps li');
    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/);
    const code = t.url().split('/').pop();
    const display = await tc.newPage(); watch(display); await display.goto(base + `/teach/live/${code}/display`);
    const sc = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}); sc.setDefaultTimeout(15000);
    const s = await sc.newPage(); watch(s);
    await s.goto(base + '/join?code=' + code); await s.getByLabel('اسمك الأول').fill('ريم'); await s.getByRole('button', {name: 'دخول الحصة'}).click();
    await s.waitForSelector('#gl-content .gl-page');
    await t.locator('#gl-next').click(); await s.waitForSelector('#gl-content .cells-scene');
    const quick = t.locator('#gl-quick');
    for (let i = 0; i < 3; i++) await quick.getByRole('button', {name: /تكبير/}).click();
    await s.waitForFunction(() => document.querySelector('#gl-content .cells-scene .c-crumb.is-on text')?.textContent === 'الخلية');
    await display.waitForFunction(() => document.querySelectorAll('#gl-content .cells-scene [data-part="chloroplast"]').length > 0);
    await quick.locator('select[aria-label="الجزء المظلل"]').selectOption('nucleus');
    await s.waitForFunction(() => document.querySelector('#gl-content [data-part="nucleus"]')?.classList.contains('c-hl'));
    await quick.getByRole('button', {name: 'خلية حيوانية'}).click();
    await display.waitForFunction(() => !document.querySelector('#gl-content [data-part="wall"]') && document.querySelector('#gl-content [data-part="nucleus"]'));
    await quick.locator('select[aria-label="الجزء المظلل"]').selectOption('chloroplast');
    await display.waitForFunction(() => document.querySelector('#gl-content .cells-scene').textContent.includes('لا يوجد في الخلية الحيوانية'));
    results.push('cells: zoomed from the plant to one cell, spotlighted the nucleus, switched to an animal cell; chloroplasts shown as missing');
    await quick.locator('select[aria-label="الجزء المظلل"]').selectOption('none');
    await quick.getByRole('button', {name: /إخفاء الأسماء/}).click();
    await s.waitForFunction(() => document.querySelector('#gl-content .cells-scene').textContent.includes('توقّع'));
    assert.equal(await s.locator('#gl-content .cells-scene').textContent().then(x => x.includes('النواة')), false, 'names hidden on the student device');
    await quick.getByRole('button', {name: /اكشف الأسماء/}).click();
    await s.waitForFunction(() => document.querySelector('#gl-content .cells-scene').textContent.includes('النواة'));
    await quick.locator('[data-narr=start]').click();
    await s.waitForFunction(() => document.querySelector('.gl-narrator .gl-caption')?.textContent.includes('هذا نبات'));
    await t.waitForTimeout(800); await t.screenshot({path: path.join(out, 'term1-cells-teacher.png')});
    for (let i = 0; i < 3; i++) await quick.locator('[data-narr=next]').click();
    await display.waitForFunction(() => document.querySelector('#gl-content .cells-scene .c-crumb.is-on text')?.textContent === 'الخلية' && document.querySelector('.gl-narrator .gl-caption')?.textContent.includes('خلية نباتية واحدة'));
    await display.waitForTimeout(600); await display.screenshot({path: path.join(out, 'term1-cells-display.png')});
    await s.screenshot({path: path.join(out, 'term1-cells-student.png')});
    results.push('cells: names hidden for prediction then revealed; the narrated tour zooms in step by step on the display and the student phone');
    const m = await t.evaluate(() => ({scroll: document.documentElement.scrollHeight > innerHeight + 1, hscroll: document.documentElement.scrollWidth > innerWidth + 1}));
    assert.deepEqual(m, {scroll: false, hscroll: false});
    await t.getByRole('button', {name: 'إنهاء العرض'}).click();

    // ---- place value ----
    await t.goto(base + '/teach/plans');
    await math.locator('li.is-ready button').click(); await t.waitForURL(/\/teach\/plans\/[0-9a-f-]{36}$/); await t.waitForSelector('#pl-steps li');
    const inter = t.locator('#pl-steps li').nth(1); await inter.locator('summary').click();
    assert.equal(await inter.locator('.pl-seg').count(), 7);
    assert.equal(await inter.locator('.pl-seg').first().locator('input[type=number]').inputValue(), '7', 'large ranges use a number box, not a giant menu');
    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/);
    const code2 = t.url().split('/').pop();
    await s.goto(base + '/join?code=' + code2); await s.getByLabel('اسمك الأول').fill('ريم'); await s.getByRole('button', {name: 'دخول الحصة'}).click();
    await s.waitForSelector('#gl-content .gl-page');
    await t.locator('#gl-next').click(); await s.waitForSelector('#gl-content .pv-scene');
    assert.match(await s.locator('#gl-content .pv-scene').textContent(), /٤٠٬٠٠٠/);
    await quick.locator('select[aria-label="المنزلة"]').selectOption('thousands');
    await quick.getByRole('button', {name: '+ ١٬٠٠٠'}).click();
    await s.waitForFunction(() => document.querySelector('#gl-content .pv-scene')?.textContent.includes('٣٤٦٬٦٧٨'));
    assert.match(await s.locator('#gl-content .pv-scene').textContent(), /قيمة الرقم ٦ في منزلة آحاد الألوف = ٦٬٠٠٠/);
    await quick.getByRole('button', {name: /إخفاء القيمة/}).click();
    await s.waitForFunction(() => document.querySelector('#gl-content .pv-scene')?.textContent.includes('= ؟'));
    await quick.getByRole('button', {name: /اكشف القيمة/}).click();
    await t.waitForTimeout(600); await t.screenshot({path: path.join(out, 'term1-placevalue-teacher.png')}); await s.screenshot({path: path.join(out, 'term1-placevalue-student.png')});
    results.push('place value: chose «آحاد الألوف», +١٬٠٠٠ made ٣٤٦٬٦٧٨ on the student phone; value hidden for students to work out, then revealed');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok: true, results}, null, 1));
  } finally { await browser.close(); app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); }
})().catch(e => { console.error(e); process.exit(1); });
