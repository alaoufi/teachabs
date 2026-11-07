// Optional browser verification for stage 050: the teacher places the prepared texts before class (drag on a copy
// of the board); in class «النص التالي» shows them one by one in their places, never on top of each other, and the
// teacher circles or frames them; the student sees the same.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {pick, openStepMenus} = require('./ui-helpers.cjs');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
(async () => {
  const {openStore} = await import('../store.mjs'), {createApp} = await import('../server.mjs');
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.address().port, out = process.env.SCIENCE_ARTIFACTS || '../group-verification';
  fs.mkdirSync(out, {recursive: true});
  const browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
  const results = [], errors = [];
  const watch = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); }); };
  const rects = p => p.evaluate(() => [...document.querySelectorAll('#gl-content .gl-item')].map(c => { const r = c.getBoundingClientRect(); return {id: c.dataset.item, x: r.left, y: r.top, r: r.right, b: r.bottom}; }));
  const overlaps = list => list.some((a, i) => list.some((b, j) => j > i && a.x < b.r - 1 && b.x < a.r - 1 && a.y < b.b - 1 && b.y < a.b - 1));
  try {
    const tc = await browser.newContext({viewport: {width: 1366, height: 768}}); await openStepMenus(tc); tc.setDefaultTimeout(15000);
    await tc.addInitScript(() => localStorage.setItem('gl-autostart', '0'));
    const t = await tc.newPage(); watch(t); t.on('dialog', d => d.accept().catch(() => {}));
    await t.goto(base + '/start/teacher');
    await t.locator('.gl-cur-subject[data-subject=science] li.is-ready button').click(); await t.waitForSelector('#pl-steps li');
    await t.locator('#pl-steps li').nth(1).locator('summary').click();
    const lay = t.locator('.pl-layout').first(); await lay.scrollIntoViewIfNeeded();
    assert.equal(await t.locator('.pl-layout-warn').first().isHidden(), true, 'the automatic places do not overlap');
    // drag card 4 down to the bottom right
    const c4 = lay.locator('.gl-item').nth(3), b4 = await c4.boundingBox(), board = await lay.locator('.pl-layout-board').boundingBox();
    await t.mouse.move(b4.x + 20, b4.y + 20); await t.mouse.down();
    await t.mouse.move(board.x + board.width - 40, board.y + board.height * 0.72, {steps: 8}); await t.mouse.up();
    await t.waitForSelector('#pl-steps li:nth-child(2) .pl-item:nth-of-type(4) button:text("مكان تلقائي")', {state: 'attached'}).catch(() => {});
    await lay.screenshot({path: path.join(out, 'prepared-cards-planner.png')});
    await t.getByRole('button', {name: 'حفظ الدرس'}).click(); await t.waitForFunction(() => document.querySelector('#pl-status').textContent.includes('حُفظ'));
    const saved = await t.evaluate(async () => (await (await fetch(location.pathname + '.json')).json()).steps.find(s => s.type === 'board').items[3].at);
    assert.ok(saved && saved.y > 300, 'the dragged place was saved: ' + JSON.stringify(saved));
    results.push('planner: the four texts sit in their automatic places without overlap; card 4 dragged to a new place and saved');

    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/);
    const sc = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}); sc.setDefaultTimeout(15000);
    const s = await sc.newPage(); watch(s);
    await s.goto(base + '/start/student'); await s.waitForFunction(() => window.__voice); await s.locator('#gl-enter').click();
    await t.locator('#gl-steps li[data-type=board] button').click(); await s.waitForFunction(() => document.querySelector('#gl-content').dataset.type === 'board');
    assert.equal(await s.locator('#gl-content .gl-item').count(), 0, 'all texts start hidden');
    for (let n = 1; n <= 4; n++) {
      await t.locator('#gl-quick').getByRole('button', {name: /النص التالي/}).click();
      await s.waitForFunction(n => document.querySelectorAll('#gl-content .gl-item').length === n, n);
    }
    await t.waitForFunction(() => /ظهرت كل النصوص/.test(document.querySelector('#gl-quick').textContent)); // the teacher's bar updates a moment after the student's board
    const sr = await rects(s), tr = await rects(t);
    assert.ok(!overlaps(sr) && !overlaps(tr), 'texts never on top of each other');
    results.push('«النص التالي» showed the four texts one after another in their places; none on top of another (teacher and student)');

    for (const [tool, n] of [['ellipse', 0], ['rect', 3]]) {
      await pick(t, `.gl-tool[data-tool=${tool}]`);
      const b = await t.locator('#gl-content .gl-item').nth(n).boundingBox();
      await t.mouse.move(b.x - 6, b.y - 6); await t.mouse.down(); await t.mouse.move(b.x + b.width + 6, b.y + b.height + 6, {steps: 6}); await t.mouse.up();
    }
    await s.waitForFunction(() => document.querySelectorAll('#gl-ink path').length === 2);
    await t.screenshot({path: path.join(out, 'prepared-cards-teacher.png')}); await s.screenshot({path: path.join(out, 'prepared-cards-student.png')});
    results.push('◯ and ▭: the teacher circled one text and framed another; the student sees both');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok: true, results}, null, 1));
  } finally { await browser.close(); app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); }
})().catch(e => { console.error(e); process.exit(1); });
