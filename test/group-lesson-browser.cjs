// Optional browser verification of the group lesson: plan → live sequence with a display screen and three students.
// Uses Chromium's synthetic microphone for the recorded narration; this is not a test of a real voice.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {pick, openStepMenus} = require('./ui-helpers.cjs');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
(async () => {
  const {openStore} = await import('../store.mjs'), {createApp} = await import('../server.mjs');
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.address().port, out = process.env.SCIENCE_ARTIFACTS || '../group-verification';
  fs.mkdirSync(out, {recursive: true});
  const browser = await chromium.launch({headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'], ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
  const results = [], errors = [];
  const watch = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text()); }); };
  const shot = (p, name) => p.screenshot({path: path.join(out, name + '.png')});
  try {
    const tc = await browser.newContext({viewport: {width: 1700, height: 1000}, permissions: ['microphone']}); await openStepMenus(tc); tc.setDefaultTimeout(15000);
    const t = await tc.newPage(); watch(t); t.on('dialog', d => d.accept().catch(() => {}));
    await t.goto(base + '/demo'); await t.locator('#group form button').click(); await t.waitForURL(/\/teach\/plans/);
    await t.goto(base + '/teach/plans'); await t.locator('.gl-templates button', {hasText: 'الضوء والظل'}).click(); await t.waitForURL(/\/teach\/plans\/[0-9a-f-]{36}$/);
    await t.waitForSelector('#pl-steps li');
    assert.deepEqual(await t.locator('.pl-type').allTextContents(), ['المنهج', 'النصوص المجهزة', 'الشرح التفاعلي', 'الأسئلة', 'الواجب', 'التقييم']);
    // Prepare: record a narration for the curriculum step with the synthetic microphone.
    await t.locator('#pl-steps li').nth(0).locator('summary').click();
    const first = t.locator('#pl-steps li').nth(0);
    await first.locator('.pl-narration select').selectOption('recorded');
    await first.getByRole('button', {name: '● سجّل بصوتك'}).click(); await t.waitForTimeout(1500);
    await first.getByRole('button', {name: '■ إيقاف التسجيل'}).click();
    await first.locator('audio').waitFor();
    // Prepared board item and move a step to check ordering controls.
    await t.locator('#pl-steps li').nth(1).locator('summary').click();
    await t.locator('#pl-steps li').nth(1).getByRole('button', {name: '+ نص مجهز'}).click();
    await t.locator('#pl-steps li').nth(1).locator('.pl-item textarea').last().fill('تذكير: الظل في الجهة المقابلة للضوء.');
    await t.getByRole('button', {name: 'حفظ الدرس'}).click(); await t.waitForFunction(() => document.querySelector('#pl-status').textContent.includes('حُفظ')).catch(async e => { throw new Error('status: ' + await t.locator('#pl-status').textContent()); });
    await shot(t, 'group-planner');
    results.push('planner: six steps in the requested order, recorded narration, prepared item, saved');

    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/);
    const code = t.url().split('/').pop();
    await t.waitForSelector('#gl-steps li.is-current');
    const display = await tc.newPage(); watch(display); await display.goto(base + `/teach/live/${code}/display`);

    const students = [];
    for (const name of ['سارة', 'ليان', 'نورة']) {
      const c = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}); c.setDefaultTimeout(15000);
      const p = await c.newPage(); watch(p);
      await p.addInitScript(() => { window.__played = 0; const play = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { window.__played++; return play.call(this); }; });
      await p.goto(base + '/join?code=' + code); await p.getByLabel('اسمك الأول').fill(name); await p.getByRole('button', {name: 'دخول الحصة'}).click(); await p.waitForFunction(() => window.__voice); await p.locator('#gl-enter').click(); // the entry card opens the board
      await p.waitForURL(new RegExp('/class/' + code)); students.push(p);
    }
    await t.waitForFunction(() => document.querySelectorAll('#gl-students li').length === 3);
    results.push('three students joined with the class code');

    // 1) Curriculum page with ink and recorded narration on student devices.
    for (const p of students) await p.waitForSelector('#gl-content .gl-page svg');
    await pick(t, '.gl-tool[data-tool=pen]');
    const board = await t.locator('#gl-ink').boundingBox();
    await t.mouse.move(board.x + 100, board.y + 100); await t.mouse.down(); await t.mouse.move(board.x + 400, board.y + 160, {steps: 10}); await t.mouse.up();
    await students[0].waitForFunction(() => document.querySelectorAll('#gl-ink path.gl-pen').length === 1);
    await display.waitForFunction(() => document.querySelectorAll('#gl-ink path.gl-pen').length === 1);
    await t.locator('#gl-quick').getByRole('button', {name: 'على أجهزة الطلاب'}).click();
    await students[1].waitForFunction(() => window.__played > 0);
    results.push('curriculum page shown, teacher ink synced, recorded narration played on a student device');

    // Hide and show.
    await t.locator('#gl-show').click();
    await students[0].waitForFunction(() => !document.querySelector('#gl-wait').hidden);
    await t.locator('#gl-show').click();
    await students[0].waitForFunction(() => document.querySelector('#gl-wait').hidden);
    results.push('teacher hid and re-showed the step');

    // 2) Interactive explanation: predict, reveal, individual exploration.
    await t.locator('#gl-steps li[data-type=interactive] button').click();
    await students[0].waitForSelector('#gl-content .gl-scene svg');
    await t.locator('#gl-panel').getByRole('button', {name: 'إخفاء الظل ليتوقع الطلاب'}).click();
    await students[0].waitForFunction(() => !document.querySelector('#gl-content polygon.shadow') && document.querySelector('.gl-facts').textContent.includes('توقّع'));
    await shot(students[0], 'group-student-predict');
    await t.locator('#gl-panel').getByRole('button', {name: 'اكشف الظل'}).click();
    await students[0].waitForFunction(() => document.querySelector('#gl-content polygon.shadow'));
    await t.locator('#gl-panel').getByRole('button', {name: 'ساعة لاحقة'}).click();
    await students[2].waitForFunction(() => document.querySelector('.gl-facts').textContent.includes('٣٠°') === false);
    await t.locator('#gl-panel').getByRole('button', {name: 'اسمح للطلاب بالاستكشاف على أجهزتهم'}).click();
    await students[2].waitForSelector('.gl-explore input[type=range]');
    await t.locator('#gl-panel').getByRole('button', {name: 'إيقاف الاستكشاف الفردي'}).click();
    await students[2].waitForSelector('.gl-facts', {state: 'attached'}); // the facts line is in the page; phones hide it to give the drawing room
    results.push('interactive: predict/reveal, teacher moved the sun, individual exploration on/off');

    // 3) Prepared board items revealed one by one.
    await t.locator('#gl-steps li[data-type=board] button').click();
    await students[0].waitForFunction(() => document.querySelector('#gl-content').dataset.type === 'board');
    assert.equal(await students[0].locator('.gl-item').count(), 0);
    await t.locator('.gl-reveal li').nth(0).getByRole('button', {name: 'إظهار'}).click();
    await students[0].waitForFunction(() => document.querySelectorAll('.gl-item').length === 1);
    await t.locator('#gl-panel').getByRole('button', {name: 'إظهار الكل'}).click();
    await students[0].waitForFunction(() => document.querySelectorAll('.gl-item').length === 4);
    await shot(display, 'group-display-board');
    results.push('prepared board items: hidden at first, revealed one, then all');

    // 4) Questions: answers private to teacher, then shown as chosen.
    await t.locator('#gl-steps li[data-type=questions] button').click();
    await t.locator('#gl-panel').getByRole('button', {name: 'افتح الإجابة للطلاب'}).click();
    const choices = [1, 1, 0];
    for (const [i, p] of students.entries()) {
      await p.waitForSelector('#gl-answer fieldset:not([disabled])'); // the «كتابة» sheet opens by itself when the teacher opens the questions
      await p.locator('#gl-answer fieldset').nth(0).locator('.gl-choice').nth(choices[i]).click();
      await p.waitForSelector('#gl-answer .gl-sent');
    }
    await students[1].locator('#gl-answer textarea').fill('لأن الجسم المعتم يحجب الضوء');
    await students[1].getByRole('button', {name: 'إرسال'}).click();
    await t.waitForFunction(() => document.querySelector('#gl-panel').textContent.includes('أجاب ٣ من ٣'));
    assert.equal(await students[0].locator('.gl-bars').count(), 0, 'students do not see results before the teacher shows them');
    await t.locator('.gl-q').nth(0).getByRole('button', {name: 'اعرض النتائج للجميع'}).click();
    await display.waitForFunction(() => document.querySelectorAll('.gl-bars li').length === 3);
    await shot(display, 'group-display-results');
    await t.locator('.gl-q').nth(2).getByRole('button', {name: 'اعرضها دون اسم'}).click();
    await students[0].waitForFunction(() => document.querySelector('.gl-spotlight')?.textContent.includes('يحجب الضوء') && document.querySelector('.gl-who').textContent === 'إجابة أحد الطلاب');
    await shot(t, 'group-teacher-questions');
    results.push('questions: 3/3 answered, results private, summary then anonymous answer shown to all');

    // 5) Homework.
    await t.locator('#gl-next').click();
    await t.locator('#gl-panel').getByRole('button', {name: 'أسند الواجب للطلاب'}).click();
    await students[2].waitForSelector('#gl-hw fieldset:not([disabled])');
    await students[2].locator('#gl-hw fieldset').nth(0).locator('.gl-choice').nth(1).click();
    await students[2].waitForFunction(() => document.querySelector('#gl-hw .gl-score')?.textContent.includes('١ من ١'));
    await t.waitForFunction(() => document.querySelector('#gl-homework').textContent.includes('١/١ صحيحة'));
    results.push('homework assigned, solved on a phone, score visible to student and teacher');

    // 6) Evaluation.
    await t.locator('#gl-next').click();
    const form = t.locator('.gl-eval').nth(2);
    for (const i of [0, 1, 2]) await form.locator(`select[name=r${i}]`).selectOption('4');
    await form.locator('textarea').fill('مشاركة متميزة');
    await form.getByRole('button', {name: 'حفظ التقييم'}).click(); await t.waitForFunction(() => document.querySelector('#gl-status').textContent.includes('حُفظ تقييم'));
    await t.locator('#gl-evaluation').getByRole('button', {name: 'نشر التقييم للطلاب'}).click();
    await students[2].waitForFunction(() => document.querySelector('#gl-eval')?.textContent.includes('متميز'));
    await students[0].waitForFunction(() => document.querySelector('#gl-eval')?.textContent.includes('لم يقيّمك'));
    await shot(students[2], 'group-student-evaluation');
    results.push('evaluation saved and published; each student sees only their own');

    // End and layout checks.
    await t.locator('#gl-live').click();
    await students[0].waitForFunction(() => document.querySelector('#gl-wait').textContent.includes('انتهت الحصة'));
    for (const [p, w] of [[students[0], 390], [t, 1400], [t, 820]]) {
      await p.setViewportSize({width: w, height: 900});
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'overflow at ' + w);
    }
    await shot(t, 'group-teacher-820');
    for (const p of [t, display, ...students]) assert.equal(await p.locator('#gl-status.is-error').count(), 0, 'error status shown: ' + await p.locator('#gl-status').textContent());
    if (errors.length) console.error('ERRORS', JSON.stringify(errors));
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok: true, code, results}, null, 1));
  } finally { await browser.close(); app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); }
})().catch(e => { console.error(e); process.exit(1); });
