// Optional browser verification for stage 061: «مكتبة الوسائل الدراسية». The teacher opens the library on grade 4 science,
// sees each lesson with its aids, starts «الغذاء والتغذية» from its ready prep (aids pinned, interactive step included),
// starts the class, and the student receives the lesson page; the pinned aid is one tap away in class.
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
    await t.goto(base + '/start/teacher'); await t.waitForURL(/\/teach/);
    assert.equal(await t.locator('.gl-cur-subject li.is-ready').count(), 51, 'every lesson of the term is ready');
    await t.locator('a[href="/teach/aids"]').first().click(); await t.waitForSelector('.aid-card');
    await t.locator('select[aria-label="المادة"]').selectOption('science'); await t.waitForURL(/subject=science/);
    await t.locator('select[aria-label="الصف"]').selectOption('4'); await t.waitForURL(/grade=4/);
    assert.equal(await t.locator('.aid-lesson-list li').count(), 12);
    assert.match(await t.locator('li[data-lesson="s3-5-2"]').textContent(), /الجهاز الهضمي/);
    assert.ok(await t.locator('.aid-card[data-aid=digestive] svg').count());
    await t.screenshot({path: path.join(out, 'aids-library.png'), fullPage: false});
    results.push('«مكتبة الوسائل الدراسية»: grade 4 science shows the 12 lessons with their aids, and the aids with their pictures');
    await t.locator('li[data-lesson="s3-5-2"] button').click(); await t.waitForSelector('#pl-steps li');
    assert.equal(await t.locator('.pl-tool-chip').count(), 4, 'the lesson\'s aids are pinned');
    assert.match(await t.locator('#pl-steps').textContent(), /الجهاز الهضمي/);
    results.push('«ابدأ من الدرس الجاهز»: the prep opened with its 4 aids pinned and its interactive step (digestive system)');
    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/); await pastTitle(t);
    const sc = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}); sc.setDefaultTimeout(15000);
    const s = await sc.newPage(); watch(s); await s.goto(base + '/start/student'); await s.waitForFunction(() => window.__voice); await s.locator('#gl-enter').click();
    await s.waitForFunction(() => document.querySelector('#gl-content .gl-page')?.textContent.includes('الكربوهيدرات'));
    await t.locator('.gl-fly[data-fly=lesson] .gl-fly-btn').click();
    assert.equal(await t.locator('.gl-lesson-tool').count(), 4);
    await t.locator('.gl-lesson-tool[data-lib=plate]').click(); await s.waitForSelector('#gl-ink .gl-stamp-plate');
    await s.waitForTimeout(400); await s.screenshot({path: path.join(out, 'aids-student.png')});
    results.push('class: the student received the original lesson page; «طبق الغذاء الصحي» from the lesson\'s aids appeared on the student\'s board');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok: true, results}, null, 1));
  } finally { await browser.close(); app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); }
})().catch(e => { console.error(e); process.exit(1); });
