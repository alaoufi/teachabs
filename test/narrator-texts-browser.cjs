// Optional browser verification for stage 038: narrator tour, explanatory text bank, saving work off the server, 3D board.
// The recorded narration uses Chromium's synthetic microphone; it is not a test of a real voice.
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
  const watch = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); };
  try {
    const tc = await browser.newContext({viewport: {width: 1700, height: 1000}, permissions: ['microphone'], acceptDownloads: true}); await openStepMenus(tc); await tc.addInitScript(() => localStorage.setItem('gl-autostart', '0')); // this test leads the explanation by hand tc.setDefaultTimeout(15000);
    const tour = store.tour();
    await tc.addCookies([{name: 'ks', value: store.session(tour.teacher), url: base}]);
    const t = await tc.newPage(); watch(t); t.on('dialog', d => d.accept().catch(() => {}));
    await t.goto(base + '/teach/plans'); await t.locator('.gl-templates button', {hasText: 'الضوء والظل'}).click(); await t.waitForURL(/\/teach\/plans\/[0-9a-f-]{36}$/);
    const planUrl = t.url();
    await t.waitForSelector('#pl-steps li');
    const interactive = t.locator('#pl-steps li').nth(2);
    await interactive.locator('summary').click();
    assert.equal(await interactive.locator('.pl-seg').count(), 7, 'ready narrator tour has 7 segments');
    await interactive.locator('.pl-seg').nth(0).locator('textarea').fill('مرحبًا يا أبطال! انظروا إلى الشمس في الصباح الباكر.');
    const seg2 = interactive.locator('.pl-seg').nth(1);
    await seg2.getByRole('button', {name: '● سجّل بصوتك'}).click(); await t.waitForTimeout(1500);
    await seg2.getByRole('button', {name: '■ إيقاف التسجيل'}).click(); await seg2.locator('audio').waitFor();
    results.push('narrator tour edited; teacher recorded a voice clip for segment 2');

    // Text bank: pick a ready text, edit it, save as a new text, and use it as a prepared text.
    const first = t.locator('#pl-steps li').nth(0); await first.locator('summary').click();
    await first.getByRole('button', {name: /أضف من النصوص التوضيحية/}).click();
    const dlg = t.locator('dialog.tl-dialog');
    await dlg.locator('.tl-item', {hasText: 'ما الظل؟'}).click();
    assert.match(await dlg.locator('textarea').inputValue(), /منطقة مظلمة/);
    await dlg.locator('input[aria-label="عنوان النص"]').fill('ما الظل؟ — بأسلوبي');
    await dlg.locator('textarea').fill('الظل مكان مظلم خلف الجسم، لأن الجسم منع الضوء من الوصول إليه. انظر إلى ظل يدك على الطاولة!');
    await dlg.getByRole('button', {name: 'احفظ كنص جديد'}).click();
    await dlg.locator('.tl-status', {hasText: 'حُفظ نصًا جديدًا'}).waitFor();
    assert.equal(store.group.texts(tour.teacher).length, 1, 'saved in the teacher library');
    await dlg.locator('.tl-item[data-key^="m:"]').first().waitFor();
    await t.screenshot({path: path.join(out, 'text-bank-dialog.png')});
    await dlg.getByRole('button', {name: 'استخدم النص'}).click();
    await t.waitForFunction(() => [...document.querySelectorAll('#pl-steps li:first-child .pl-snippets input')].some(i => i.value.startsWith('الظل مكان مظلم')));
    results.push('text bank: picked a ready text, edited it, saved it as a new text, used it in the lesson');

    // Draft kept on this device survives a reload before saving.
    await t.waitForTimeout(600);
    await t.reload(); await t.waitForSelector('#pl-draft:not([hidden])');
    await t.getByRole('button', {name: 'استعادة التعديل'}).click();
    await t.locator('#pl-steps li').nth(2).locator('summary').click();
    assert.equal(await t.locator('#pl-steps li').nth(2).locator('.pl-seg').nth(0).locator('textarea').inputValue(), 'مرحبًا يا أبطال! انظروا إلى الشمس في الصباح الباكر.');
    assert.equal(await t.locator('#pl-steps li').nth(2).locator('.pl-seg audio').count(), 1, 'recording survives in the local draft');
    await t.getByRole('button', {name: 'حفظ الدرس'}).click(); await t.waitForFunction(() => document.querySelector('#pl-status').textContent.includes('حُفظ'));
    assert.equal(await t.evaluate(k => localStorage.getItem(k), 'gl-plan-draft-' + planUrl.split('/').pop()), null, 'draft cleared after save');
    results.push('local draft restored after reload, then saved to the server and cleared');

    // Download the lesson and import it again as a new lesson.
    const [download] = await Promise.all([t.waitForEvent('download'), t.getByRole('button', {name: 'تنزيل الدرس كملف'}).click()]);
    const file = path.join(out, 'lesson-export.json'); await download.saveAs(file);
    const exported = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(exported.format, 'teachabs-lesson'); assert.ok(exported.plan.steps[2].narrator.segments[1].audio);
    await t.goto(base + '/teach/plans');
    await t.locator('#plans-import').setInputFiles(file); await t.waitForURL(/\/teach\/plans\/[0-9a-f-]{36}$/);
    assert.notEqual(t.url(), planUrl);
    await t.waitForSelector('#pl-steps li');
    results.push('lesson downloaded as a file (with recordings) and imported back as a new lesson');

    // Live class with the narrator.
    await t.goto(planUrl); await t.waitForSelector('#pl-steps li');
    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/);
    const code = t.url().split('/').pop();
    const display = await tc.newPage(); watch(display); await display.goto(base + `/teach/live/${code}/display`);
    const sc = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}); sc.setDefaultTimeout(15000);
    const s = await sc.newPage(); watch(s);
    await s.addInitScript(() => { window.__played = 0; const play = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { window.__played++; return play.call(this); }; });
    await s.goto(base + '/join?code=' + code); await s.getByLabel('اسم الطالب الأول').fill('ليان'); await s.getByRole('button', {name: 'دخول الحصة'}).click();
    await s.waitForSelector('#gl-content .gl-page svg');
    await t.locator('#gl-steps li[data-type=interactive] button').click(); await s.waitForSelector('#gl-content .gl-scene svg');
    await t.locator('.gl-narr-panel select').selectOption('students');
    await t.getByRole('button', {name: '▶ ابدأ الجولة'}).click();
    await s.waitForFunction(() => document.querySelector('.gl-narrator .gl-caption')?.textContent.startsWith('مرحبًا يا أبطال'));
    await display.waitForFunction(() => document.querySelector('.gl-narrator .gl-caption')?.textContent.startsWith('مرحبًا يا أبطال'));
    const sunX = () => s.evaluate(() => Number(document.querySelector('#gl-content .sun').getAttribute('cx')));
    await t.locator('.gl-narr-panel').getByRole('button', {name: 'التالي'}).click();
    await s.waitForFunction(() => window.__played > 0);
    results.push('narrator caption on student and display; recorded voice of segment 2 played on the student device');
    await t.locator('.gl-narr-panel').getByRole('button', {name: 'التالي'}).click(); // segment 3 → 9:00, the sun glides
    await s.waitForFunction(() => document.querySelector('.gl-narrator .gl-seg').textContent.startsWith('٣'));
    const x1 = await sunX(); await s.waitForTimeout(450); const x2 = await sunX(); await s.waitForTimeout(1600); const x3 = await sunX();
    assert.ok(x1 !== x3 && x2 !== x3, `sun glides between positions: ${x1} → ${x2} → ${x3}`);
    results.push(`sun glides smoothly (${Math.round(x1)} → ${Math.round(x2)} → ${Math.round(x3)})`);
    await t.screenshot({path: path.join(out, 'narrator-teacher.png')});
    await s.screenshot({path: path.join(out, 'narrator-student.png')});
    await t.locator('#gl-quick [data-narr=mute]').click();
    await s.waitForFunction(() => document.querySelector('.gl-narrator')?.classList.contains('is-muted'));
    await t.locator('#gl-quick [data-narr=visible]').click();
    await s.waitForFunction(() => !document.querySelector('.gl-narrator'));
    await t.getByRole('button', {name: 'إظهار المتحدث'}).click();
    await s.waitForSelector('.gl-narrator');
    await t.getByRole('button', {name: '■ إنهاء الجولة'}).click();
    await s.waitForFunction(() => !document.querySelector('.gl-narrator'));
    results.push('teacher muted, hid, showed and ended the narrator; students follow');

    // Put a saved explanatory text on the board during class; long text wraps.
    await pick(t, '#gl-library');
    const live = t.locator('dialog.tl-dialog');
    await live.locator('.tl-item[data-key^="m:"]').first().click();
    await live.getByRole('button', {name: 'ضعه على السبورة'}).click();
    await t.locator('#gl-board').evaluate(e => e.scrollIntoView({block: 'center'}));
    const b = await t.locator('#gl-board').boundingBox();
    await t.mouse.click(b.x + b.width * 0.9, b.y + b.height * 0.15);
    await s.waitForFunction(() => [...document.querySelectorAll('#gl-ink text')].some(n => n.querySelectorAll('tspan').length > 1 && n.textContent.includes('الظل مكان مظلم')));
    results.push('saved text placed on the board during class and wrapped over several lines');
    await display.screenshot({path: path.join(out, 'board-3d-display.png')});

    for (const p of [t, display, s]) assert.equal(await p.locator('#gl-status.is-error').count(), 0, await p.locator('#gl-status').textContent());
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok: true, results}, null, 1));
  } finally { await browser.close(); app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); }
})().catch(e => { console.error(e); process.exit(1); });
