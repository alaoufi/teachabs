// Optional browser verification for stage 058: «مكتبة الأدوات». In the planner the library opens filtered by the
// lesson's subject, grade and curriculum lesson (its own tools first); the teacher pins the multiplication table, and
// pinning an interactive activity adds its step. In class «🧰 أدوات الدرس» lays the pinned table on the board, the
// whole library lays another tool, and the student sees both.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {openStepMenus, pastTitle} = require('./ui-helpers.cjs');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
(async () => {
  const {openStore} = await import('../store.mjs'), {createApp} = await import('../server.mjs');
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.address().port, out = process.env.SCIENCE_ARTIFACTS || '../group-verification';
  fs.mkdirSync(out, {recursive: true});
  const browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
  const results = [], errors = [];
  const watch = p => p.on('pageerror', e => errors.push(e.message));
  try {
    const tc = await browser.newContext({viewport: {width: 1366, height: 900}}); tc.setDefaultTimeout(15000); await openStepMenus(tc); await tc.addInitScript(() => localStorage.setItem('gl-autostart', '0'));
    const t = await tc.newPage(); watch(t); t.on('dialog', d => d.accept().catch(() => {}));
    await t.goto(base + '/start/teacher'); await t.locator('.gl-cur-subject[data-subject=math] li.is-ready button').first().click(); await t.waitForSelector('#pl-steps li');
    assert.equal(await t.locator('.pl-tool-chip').count(), 3, 'the ready lesson comes with its tools');
    const stepsBefore = await t.locator('#pl-steps > li').count();
    await t.locator('#pl-library').click(); await t.waitForSelector('.tl-dialog .tl-card');
    assert.equal(await t.locator('.tl-dialog select[aria-label="المادة"]').inputValue(), 'math');
    assert.equal(await t.locator('.tl-dialog select[aria-label="الدرس"]').inputValue(), 'm1-1');
    assert.match(await t.locator('.tl-group').first().textContent(), /مقترحة لهذا الدرس/);
    await t.screenshot({path: path.join(out, 'tool-library-planner.png')});
    await t.locator('.tl-card[data-tool=multtable] .tl-pin').click();
    await t.locator('.tl-dialog select[aria-label="المادة"]').selectOption('science');
    await t.locator('.tl-card[data-tool=matter] .tl-pin').click();
    await t.locator('.tl-dialog button[aria-label="إغلاق"]').click();
    assert.equal(await t.locator('.pl-tool-chip').count(), 5);
    assert.equal(await t.locator('#pl-steps > li').count(), stepsBefore + 1, 'pinning «حالات المادة» added its interactive step');
    assert.match(await t.locator('#pl-steps').textContent(), /حالات المادة/);
    await t.getByRole('button', {name: 'حفظ الدرس'}).click(); await t.waitForFunction(() => document.querySelector('#pl-status').textContent.includes('حُفظ'));
    const saved = await t.evaluate(async () => (await (await fetch(location.pathname + '.json')).json()).tools);
    assert.ok(saved.includes('multtable') && saved.includes('matter'), JSON.stringify(saved));
    results.push('planner: the library opened on «الرياضيات · الصف الرابع · القيمة المنزلية» with the lesson\'s tools first; pinned the multiplication table and «حالات المادة» (its step was added); saved');

    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/); await pastTitle(t);
    const sc = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}); sc.setDefaultTimeout(15000);
    const s = await sc.newPage(); watch(s); await s.goto(base + '/start/student'); await s.waitForFunction(() => window.__voice); await s.locator('#gl-enter').click(); await s.waitForSelector('#gl-content .gl-page');
    await t.locator('.gl-fly[data-fly=lesson] .gl-fly-btn').click();
    assert.equal(await t.locator('.gl-lesson-tool').count(), 5);
    await t.locator('.gl-lesson-tool[data-lib=multtable]').click();
    await s.waitForSelector('#gl-ink .gl-stamp-multtable');
    await t.locator('.gl-fly[data-fly=lesson] .gl-fly-btn').click(); await t.locator('#gl-open-library').click(); await t.waitForSelector('.tl-dialog .tl-card');
    await t.locator('.tl-card[data-tool=grid] .tl-use').click();
    await s.waitForSelector('#gl-ink .gl-stamp-grid');
    await s.waitForTimeout(400); await s.screenshot({path: path.join(out, 'tool-library-student.png')}); await t.screenshot({path: path.join(out, 'tool-library-class.png')});
    results.push('class: «🧰 أدوات الدرس» laid the pinned multiplication table, the whole library laid the coordinate grid; the student sees both');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok: true, results}, null, 1));
  } finally { await browser.close(); app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); }
})().catch(e => { console.error(e); process.exit(1); });
