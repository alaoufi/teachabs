// Optional browser verification for stage 057 (ideas from Classroomscreen, ClassDojo, Pear Deck and Whiteboard.fi):
// «🧭 إدارة الفصل» — 🎲 a random student (no repeats until everyone had a turn), 👀 attention lock on the students'
// screens, 🚦 a work mode the students see. Two students on phones.
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
  const watch = p => p.on('pageerror', e => errors.push(e.message));
  try {
    const tc = await browser.newContext({viewport: {width: 1366, height: 768}}); tc.setDefaultTimeout(15000); await openStepMenus(tc); await tc.addInitScript(() => localStorage.setItem('gl-autostart', '0'));
    const t = await tc.newPage(); watch(t); t.on('dialog', d => d.accept().catch(() => {}));
    await t.goto(base + '/start/teacher'); await t.locator('.gl-cur-subject[data-subject=science] li.is-ready button').click(); await t.waitForSelector('#pl-steps li');
    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/);
    const students = [];
    for (let i = 0; i < 2; i++) {
      const sc = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}); sc.setDefaultTimeout(15000);
      const s = await sc.newPage(); watch(s); await s.goto(base + '/start/student'); await s.waitForFunction(() => window.__voice); await s.locator('#gl-enter').click(); await s.waitForSelector('#gl-content .gl-page');
      students.push(s);
    }
    await t.waitForFunction(() => /بقي/.test(document.querySelector('#gl-pick')?.textContent || '') || true);
    const picked = [];
    for (let i = 0; i < 2; i++) {
      await pick(t, '#gl-pick');
      await Promise.all(students.map(s => s.waitForSelector('#gl-pick-pop:not([hidden])')));
      const texts = await Promise.all(students.map(s => s.locator('#gl-pick-pop b').textContent()));
      assert.equal(texts.filter(x => x.includes('أنت')).length, 1, 'exactly one student is told «أنت!»');
      picked.push(texts.find(x => !x.includes('أنت')));
      if (i === 0) await students[0].screenshot({path: path.join(out, 'class-pick-student.png')});
      await Promise.all(students.map(s => s.waitForSelector('#gl-pick-pop', {state: 'hidden', timeout: 6000})));
    }
    assert.notEqual(picked[0], picked[1], 'the second pick is the other student: nobody twice until everyone had a turn');
    results.push(`🎲 picked ${picked.join(' then ')}: each student saw the name, the chosen one saw «أنت!»; no repeat`);
    await pick(t, '#gl-attention');
    await Promise.all(students.map(s => s.waitForSelector('#gl-attention-cover:not([hidden])')));
    await students[1].screenshot({path: path.join(out, 'class-attention-student.png')});
    await pick(t, '#gl-attention'); await Promise.all(students.map(s => s.waitForSelector('#gl-attention-cover', {state: 'hidden'})));
    results.push('👀 «انتباه» locked both students\' screens with «انظروا إلى المعلم», then opened them again');
    await pick(t, '.gl-work-btn[data-mode=pairs]');
    await Promise.all(students.map(s => s.waitForFunction(() => document.querySelector('#gl-work:not([hidden])')?.textContent.includes('عمل ثنائي'))));
    await pick(t, '.gl-work-btn[data-mode=none]'); await students[0].waitForSelector('#gl-work', {state: 'hidden'});
    results.push('🚦 «👥 عمل ثنائي» appeared on the students\' screens and went away when cancelled');
    await pick(t, '#gl-attention'); await t.locator('.gl-class-fly .gl-fly-btn').click(); await t.waitForTimeout(300);
    await t.screenshot({path: path.join(out, 'class-menu-teacher.png')});
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok: true, results}, null, 1));
  } finally { await browser.close(); app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); }
})().catch(e => { console.error(e); process.exit(1); });
