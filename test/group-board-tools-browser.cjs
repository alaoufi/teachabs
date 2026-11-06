// Optional browser verification of the group board tools: prepared texts, keyboard text, pen/brush/marker,
// sizes and colours, moving text, eraser, undo, smooth zoom/pan that students follow, and keyboard shortcuts.
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
    const tc = await browser.newContext({viewport: {width: 1400, height: 1000}}); tc.setDefaultTimeout(15000);
    const tour = store.tour();
    await tc.addCookies([{name: 'ks', value: store.session(tour.teacher), url: base}]);
    const t = await tc.newPage(); watch(t); t.on('dialog', d => d.accept().catch(() => {}));
    await t.goto(base + '/teach/plans'); await t.getByRole('button', {name: /درس جديد/}).click(); await t.waitForURL(/\/teach\/plans\/[0-9a-f-]{36}$/);
    await t.waitForSelector('#pl-steps li');
    await t.locator('#pl-steps li').nth(0).locator('summary').click();
    const snippetInputs = t.locator('#pl-steps li').nth(0).locator('.pl-snippets input');
    assert.equal(await snippetInputs.count(), 4, 'prepared texts in the default lesson');
    await t.locator('#pl-steps li').nth(0).getByRole('button', {name: '+ نص جاهز'}).click();
    await snippetInputs.nth(4).fill('ينتقل الضوء في خطوط مستقيمة');
    await t.getByRole('button', {name: 'حفظ الدرس'}).click(); await t.waitForFunction(() => document.querySelector('#pl-status').textContent.includes('حُفظ'));
    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/);
    const code = t.url().split('/').pop();
    await t.waitForSelector('#gl-steps li.is-current');
    const display = await tc.newPage(); watch(display); await display.goto(base + `/teach/live/${code}/display`);
    const sc = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}); sc.setDefaultTimeout(15000);
    const s = await sc.newPage(); watch(s);
    await s.goto(base + '/join?code=' + code); await s.getByLabel('اسمك الأول').fill('سارة'); await s.getByRole('button', {name: 'دخول الحصة'}).click();
    await s.waitForSelector('#gl-content .gl-page svg');
    results.push('prepared texts edited before class; lesson started; student joined');

    await t.locator('.gl-tools').evaluate(e => e.scrollIntoView({block: 'start'}));
    const board = await t.locator('#gl-board').boundingBox();
    assert.ok(board.y + board.height <= 1000, 'board fits on a 1000px-tall laptop screen');
    const at = (fx, fy) => [board.x + board.width * fx, board.y + board.height * fy];
    const drag = async (from, to, steps = 12) => { await t.mouse.move(...from); await t.mouse.down(); await t.mouse.move(...to, {steps}); await t.mouse.up(); };
    const studentInk = sel => s.waitForFunction(q => document.querySelectorAll('#gl-ink ' + q).length, sel);

    // Prepared text placed with one tap.
    assert.equal(await t.locator('.gl-snip').count(), 5);
    await t.locator('.gl-snip', {hasText: 'جسم معتم'}).click();
    await t.mouse.click(...at(0.8, 0.85));
    await s.waitForFunction(() => [...document.querySelectorAll('#gl-ink text')].some(x => x.textContent === 'جسم معتم'));
    // Keyboard text with the T shortcut.
    await t.locator('body').press('t');
    await t.mouse.click(...at(0.55, 0.12));
    await t.locator('#gl-textinput').fill('شعاع الضوء'); await t.locator('#gl-textinput').press('Enter');
    await s.waitForFunction(() => [...document.querySelectorAll('#gl-ink text')].some(x => x.textContent === 'شعاع الضوء'));
    results.push('prepared text placed with one tap; typed text with keyboard (T, Enter)');

    // Brush in red, marker in yellow over the text, large pen.
    await t.locator('body').press('b'); await t.locator('.gl-color[title="أحمر"]').click(); await t.locator('body').press('b');
    await drag(at(0.2, 0.5), at(0.45, 0.62));
    await studentInk('path.gl-brush[stroke="#c0392b"]');
    await t.locator('body').press('m'); await t.locator('.gl-color[title="أصفر"]').click(); await t.locator('body').press('m');
    await drag(at(0.3, 0.27), at(0.65, 0.27));
    await studentInk('.gl-markers path.gl-marker[stroke="#f4d03f"]');
    assert.equal(await s.locator('.gl-markers path').first().getAttribute('stroke-opacity'), '0.35');
    await t.locator('body').press('p'); await t.locator('.gl-color[title="أزرق"]').click(); await t.locator('.gl-size[data-size=l]').click(); await t.locator('body').press('p');
    await drag(at(0.1, 0.8), at(0.3, 0.75));
    await studentInk('path.gl-pen[stroke-width="6"]');
    results.push('brush (red), highlighter (yellow, transparent, under the text) and large blue pen reach the student');

    // Move the typed text.
    await t.locator('body').press('v');
    const textBox = await t.evaluate(() => { const r = [...document.querySelectorAll('#gl-ink text')].find(n => n.textContent === 'شعاع الضوء').getBoundingClientRect(); return {x: r.x, y: r.y, width: r.width, height: r.height}; });
    const before = await s.locator('#gl-ink text', {hasText: 'شعاع الضوء'}).getAttribute('x');
    await drag([textBox.x + textBox.width / 2, textBox.y + textBox.height / 2], [textBox.x + textBox.width / 2 - 150, textBox.y + textBox.height / 2 + 120]);
    await s.waitForFunction(x => document.querySelector('#gl-ink text') && [...document.querySelectorAll('#gl-ink text')].find(n => n.textContent === 'شعاع الضوء').getAttribute('x') !== x, before);
    results.push('text moved with the move tool');

    // Eraser removes the brush stroke; Ctrl+Z removes the last item.
    const count = async () => s.locator('#gl-ink path, #gl-ink text').count();
    const n0 = await count();
    await t.locator('body').press('e');
    await drag(at(0.25, 0.45), at(0.4, 0.66), 20);
    await s.waitForFunction(() => !document.querySelector('#gl-ink path.gl-brush'));
    await t.locator('body').press('Control+z');
    await s.waitForFunction(n => document.querySelectorAll('#gl-ink path, #gl-ink text').length === n, n0 - 2);
    results.push('eraser removed the brush stroke; Ctrl+Z undid the last item');
    await t.screenshot({path: path.join(out, 'board-tools-teacher.png')});

    // Smooth zoom that students follow; a student can zoom on their own and return.
    await t.locator('.gl-zoom [data-zoom=in]').click();
    await s.waitForFunction(() => document.querySelector('#gl-camera').style.transform.startsWith('scale(1.4)'));
    await display.waitForFunction(() => document.querySelector('#gl-camera').style.transform.startsWith('scale(1.4)'));
    await t.locator('body').press('h');
    await drag(at(0.5, 0.5), at(0.3, 0.4));
    const teacherCam = await t.locator('#gl-camera').evaluate(e => e.style.transform);
    await s.waitForFunction(c => document.querySelector('#gl-camera').style.transform === c, teacherCam);
    await s.locator('.gl-zoom [data-zoom=in]').click();
    await s.locator('[data-zoom=follow]').waitFor({state: 'visible'});
    await t.locator('.gl-zoom [data-zoom=fit]').click();
    await t.waitForTimeout(500);
    assert.notEqual(await s.locator('#gl-camera').evaluate(e => e.style.transform), 'scale(1) translate(0%, 0%)', 'student keeps own zoom');
    await s.locator('[data-zoom=follow]').click();
    await s.waitForFunction(() => document.querySelector('#gl-camera').style.transform === 'scale(1) translate(0%, 0%)');
    results.push('zoom and hand pan sync smoothly to student and display; student zooms alone then follows again');

    // Ctrl+wheel zoom at the cursor.
    await t.mouse.move(...at(0.7, 0.3)); await t.keyboard.down('Control'); await t.mouse.wheel(0, -300); await t.keyboard.up('Control');
    await t.waitForFunction(() => !document.querySelector('#gl-camera').style.transform.startsWith('scale(1)'));
    await t.locator('body').press('0');
    results.push('Ctrl+wheel zoom and 0 to fit');

    // Presenter keys move through the sequence.
    await t.locator('body').press('PageDown');
    await s.waitForSelector('#gl-content .gl-scene svg');
    await t.waitForFunction(() => document.querySelectorAll('.gl-snip').length === 3); // snippets follow the step
    await t.locator('body').press('ArrowRight');
    await s.waitForSelector('#gl-content .gl-page svg');
    assert.ok(await s.locator('#gl-ink text').count() >= 1, 'ink stays with its step');
    results.push('PageDown/ArrowRight move between steps; ink and prepared texts belong to their step');

    await s.screenshot({path: path.join(out, 'board-tools-student.png')});
    for (const w of [1400, 820, 390]) {
      await t.setViewportSize({width: w, height: 900});
      assert.equal(await t.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'overflow ' + w);
      if (w !== 1400) await t.screenshot({path: path.join(out, `board-tools-teacher-${w}.png`)});
    }
    for (const p of [t, display, s]) assert.equal(await p.locator('#gl-status.is-error').count(), 0, await p.locator('#gl-status').textContent());
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok: true, results}, null, 1));
  } finally { await browser.close(); app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); }
})().catch(e => { console.error(e); process.exit(1); });
