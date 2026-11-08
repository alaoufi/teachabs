// Optional browser verification for stage 064: the teacher opens «📖 كتاب الوزارة» on the curriculum step; it opens at
// the lesson's printed page (PDF.js draws it from a stand-in source through the relay); «اعرضها على السبورة» shows it to
// the student; the teacher writes on it. The book viewer page turns pages. A generated PDF stands in for the real book.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {pick, openStepMenus} = require('./ui-helpers.cjs');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
(async () => {
  const {fakeBookSource} = await import('./fake-book.mjs'), src = await fakeBookSource(60); process.env.BOOKS_SOURCE_ORIGIN = src.origin;
  const {openStore} = await import('../store.mjs'), {createApp} = await import('../server.mjs');
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.address().port, out = process.env.SCIENCE_ARTIFACTS || '../group-verification';
  fs.mkdirSync(out, {recursive: true});
  const browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
  const results = [], errors = [];
  const watch = p => p.on('pageerror', e => errors.push(e.message));
  try {
    const tc = await browser.newContext({viewport: {width: 1366, height: 900}}); tc.setDefaultTimeout(20000); await openStepMenus(tc); await tc.addInitScript(() => localStorage.setItem('gl-autostart', '0'));
    const t = await tc.newPage(); watch(t); t.on('dialog', d => d.accept().catch(() => {}));
    await t.goto(base + '/start/teacher'); await t.locator('.gl-cur-subject[data-subject=math] li.is-ready button').first().click(); await t.waitForSelector('#pl-steps li');
    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/);
    const sc = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}); sc.setDefaultTimeout(20000);
    const s = await sc.newPage(); watch(s);
    await s.goto(base + '/start/student'); await s.waitForFunction(() => window.__voice); await s.locator('#gl-enter').click(); await s.waitForSelector('#gl-content .gl-page');
    await pick(t, '#gl-ministry-book'); await t.waitForSelector('.bk-dialog canvas');
    await t.waitForFunction(() => /الصفحة ١٣ من/.test(document.querySelector('.bk-dialog .gl-status')?.textContent || ''));
    assert.equal(await t.locator('.bk-dialog input[data-k=page]').inputValue(), '13');
    // PDF page = printed + 1: printed 13 is "PDF page 14" in the stand-in book; check the drawing has ink
    assert.ok(await t.evaluate(() => { const c = document.querySelector('.bk-dialog canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 128) n++; return n > 500; }));
    assert.ok(src.hits.length >= 1, 'the book came through the relay');
    await t.screenshot({path: path.join(out, 'book-dialog.png')});
    results.push('«📖 كتاب الوزارة» opened the grade 4 math book at the lesson\'s printed page 13 (drawn by PDF.js through the relay)');
    await t.locator('.bk-dialog [data-k=next]').click(); await t.waitForFunction(() => /الصفحة ١٤ من/.test(document.querySelector('.bk-dialog .gl-status')?.textContent || ''));
    await t.locator('.bk-dialog [data-k=show]').click(); await t.waitForSelector('.bk-dialog', {state: 'detached'});
    await s.waitForSelector('#gl-content .gl-page img[src^="data:image/jpeg"]');
    await pick(t, '.gl-tool[data-tool=pen]'); const r = await t.locator('#gl-ink').boundingBox();
    await t.mouse.move(r.x + r.width * 0.3, r.y + r.height * 0.3); await t.mouse.down(); await t.mouse.move(r.x + r.width * 0.5, r.y + r.height * 0.35, {steps: 8}); await t.mouse.up();
    await s.waitForFunction(() => document.querySelectorAll('#gl-ink .gl-stroke[data-id]').length === 1);
    await s.waitForTimeout(500); await s.screenshot({path: path.join(out, 'book-student.png')});
    results.push('page 14 shown on the board: the student\'s phone shows the book page, and the teacher\'s writing on it');
    // the book viewer page
    await t.goto(base + '/teach/books'); assert.equal(await t.locator('.bk-card').count(), 12);
    await t.locator('.bk-card[data-book=g4-t1-science] a.btn').click(); await t.waitForFunction(() => /الصفحة ١ من/.test(document.getElementById('bk-status').textContent));
    await t.locator('#bk-lesson').selectOption({label: 'الخلايا — ص ٢٦'}); await t.waitForFunction(() => /الصفحة ٢٦ من/.test(document.getElementById('bk-status').textContent));
    await t.locator('#bk-next').click(); await t.waitForURL(/page=27/);
    results.push('«مكتبة الكتب المدرسية»: 12 books; the science book viewer jumped to «الخلايا» (p. 26) and turned to p. 27');
    // any grade: «دروسي» → الصف الخامس → «حضّر هذا الدرس» → the class opens the book at the lesson's page
    await t.goto(base + '/teach/plans'); await t.locator('.gl-grade-tabs a', {hasText: 'الخامس'}).click(); await t.waitForURL(/grade=5/);
    await t.locator('li[data-lesson="p5m07"] form:has(input[value="cur-p5m07"]) button').click(); await t.waitForSelector('#pl-steps li');
    assert.ok(await t.locator('input[type=radio][name^=src-]').first().isChecked(), 'the curriculum step uses the ministry book');
    assert.equal(await t.locator('input[aria-label="رقم الصفحة"]').inputValue(), '38');
    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/);
    const code2 = t.url().slice(-6);
    await s.goto(base + '/join?code=' + code2); await s.getByLabel('اسم الطالب الأول').fill('ريم'); await s.getByRole('button', {name: 'دخول الحصة'}).click(); await s.waitForFunction(() => window.__voice); await s.locator('#gl-enter').click();
    await s.waitForSelector('#gl-content .gl-book-wait');
    await pick(t, '#gl-ministry-book'); await t.waitForFunction(() => /الصفحة ٣٨ من/.test(document.querySelector('.bk-dialog .gl-status')?.textContent || ''));
    await t.locator('.bk-dialog [data-k=show]').click(); await s.waitForSelector('#gl-content .gl-page img[src^="data:image/jpeg"]');
    results.push('grade 5: «حضّر هذا الدرس» for «خطة حل المسألة: التخمين والتحقق» made a prep on the book page 38; in class the student saw the waiting card, then the page');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok: true, results}, null, 1));
  } finally { await browser.close(); app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); await src.close(); }
})().catch(e => { console.error(e); process.exit(1); });
