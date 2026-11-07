// Optional browser verification for stage 059: professional models in the library. The teacher pins «الجهاز الهضمي»
// into the cells lesson (its interactive step is added), starts the class, opens the step, moves the food two stages
// on and lights the stomach; the student's phone follows live.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {openStepMenus} = require('./ui-helpers.cjs');
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
    await t.goto(base + '/start/teacher'); await t.locator('.gl-cur-subject[data-subject=science] li.is-ready button').click(); await t.waitForSelector('#pl-steps li');
    await t.locator('#pl-library').click(); await t.waitForSelector('.tl-dialog .tl-card');
    for (const id of ['digestive', 'nervous']) assert.ok(await t.locator(`.tl-card[data-tool=${id}]`).count(), id + ' is in the grade 4 science library');
    assert.equal(await t.locator('.tl-card[data-tool=urinary]').count(), 0, 'the urinary system is for grades 5–6');
    await t.locator('.tl-dialog select[aria-label="الصف"]').selectOption('6');
    assert.ok(await t.locator('.tl-card[data-tool=urinary]').count(), 'grade 6 shows the urinary system');
    await t.locator('.tl-dialog select[aria-label="الصف"]').selectOption('4');
    await t.locator('.tl-dialog select[aria-label="المادة"]').selectOption('math');
    assert.ok(await t.locator('.tl-card[data-tool=solids]').count(), 'solids are in the math library');
    await t.locator('.tl-dialog select[aria-label="المادة"]').selectOption('science');
    await t.locator('.tl-card[data-tool=digestive] .tl-pin').click();
    await t.locator('.tl-dialog select[aria-label="الصف"]').selectOption('8');
    for (const id of ['atom', 'heart', 'circuit']) assert.ok(await t.locator(`.tl-card[data-tool=${id}]`).count(), id + ' is in grade 8 (second intermediate) science');
    await t.locator('.tl-card[data-tool=atom] .tl-pin').click();
    await t.locator('.tl-dialog select[aria-label="المادة"]').selectOption('math');
    for (const id of ['linear', 'balance', 'angles']) assert.ok(await t.locator(`.tl-card[data-tool=${id}]`).count(), id + ' is in grade 8 math');
    await t.locator('.tl-dialog select[aria-label="الصف"]').selectOption('1');
    for (const id of ['numberline', 'solids']) assert.ok(await t.locator(`.tl-card[data-tool=${id}]`).count(), id + ' is in grade 1 math');
    await t.locator('.tl-dialog button[aria-label="إغلاق"]').click();
    assert.match(await t.locator('#pl-steps').textContent(), /الجهاز الهضمي/);
    await t.getByRole('button', {name: 'حفظ الدرس'}).click(); await t.waitForFunction(() => document.querySelector('#pl-status').textContent.includes('حُفظ'));
    results.push('library: grade 8 shows the atom, heart, circuit, linear function, balance and angles; grade 1 shows the number line and solids');
    results.push('planner: «الجهاز الهضمي» pinned from the library; its interactive step was added and saved');

    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/);
    const sc = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}); sc.setDefaultTimeout(15000);
    const s = await sc.newPage(); watch(s); await s.goto(base + '/start/student'); await s.waitForFunction(() => window.__voice); await s.locator('#gl-enter').click(); await s.waitForSelector('#gl-content .gl-page');
    await t.locator('#gl-steps li[data-type=interactive] button[title*="الجهاز الهضمي"]').click();
    await s.waitForSelector('#gl-content .digest-scene');
    for (let i = 0; i < 2; i++) await t.locator('#gl-quick').getByRole('button', {name: /المرحلة التالية/}).click();
    await s.waitForFunction(() => document.querySelector('#gl-content .digest-scene .c-crumb.is-on text')?.textContent.includes('المعدة'));
    await t.locator('#gl-quick select[aria-label="العضو المظلل"]').selectOption('stomach');
    await s.waitForFunction(() => document.querySelector('#gl-content .digest-scene [data-part="stomach"]')?.classList.contains('c-hl'));
    await s.waitForTimeout(700); await s.screenshot({path: path.join(out, 'models-student.png')}); await t.screenshot({path: path.join(out, 'models-teacher.png')});
    await t.locator('#gl-steps li[data-type=interactive] button[title*="تركيب الذرة"]').click();
    await s.waitForSelector('#gl-content .atom-scene');
    await t.locator('#gl-quick').getByRole('button', {name: /العنصر التالي/}).click();
    await s.waitForFunction(() => document.querySelector('#gl-content .atom-scene')?.textContent.includes('الهيليوم'));
    await s.waitForTimeout(500); await s.screenshot({path: path.join(out, 'models-student-atom.png')});
    results.push('class: an intermediate tool (the atom) pinned from grade 8, opened, and «العنصر التالي» moved the student\'s board from hydrogen to helium');
    results.push('class: the teacher moved the food to the stomach and lit it; the student\'s phone followed live');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok: true, results}, null, 1));
  } finally { await browser.close(); app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); }
})().catch(e => { console.error(e); process.exit(1); });
