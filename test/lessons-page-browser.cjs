// Optional browser check: lessons page → interactive lesson, and the in-class lesson link for both seats.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
(async () => {
  const {openStore} = await import('../store.mjs'), {createApp} = await import('../server.mjs');
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.address().port, output = process.env.SCIENCE_ARTIFACTS || '../science-verification';
  fs.mkdirSync(output, {recursive: true});
  const browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
  try {
    const errors = [];
    const phone = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, deviceScaleFactor: 2});
    const p = await phone.newPage(); p.on('pageerror', e => errors.push(e.message));
    await p.goto(base + '/demo'); await p.locator('a[href="/lessons"]').first().click();
    await p.waitForURL(/\/lessons$/);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await p.screenshot({path: path.join(output, 'lessons-page-390.png'), fullPage: true});
    await p.getByRole('link', {name: 'ابدأ الدرس'}).click();
    await p.waitForFunction(() => document.documentElement.classList.contains('sl-ready'));
    await p.getByRole('link', {name: 'جميع الدروس'}).first().click(); await p.waitForURL(/\/lessons$/);

    const context = await browser.newContext({viewport: {width: 1280, height: 900}}); context.setDefaultTimeout(15000);
    const t = await context.newPage(), s = await context.newPage();
    t.on('pageerror', e => errors.push(e.message)); s.on('pageerror', e => errors.push(e.message));
    await t.goto(base + '/lesson/teacher'); await t.locator('form[action*="seat=teacher"] button').click(); await t.waitForSelector('.excalidraw');
    await s.goto(base + '/lesson/preview'); await s.waitForSelector('.excalidraw');
    await t.locator('.aid-library summary').click();
    const option = await t.locator('.aid-library select option[value="science-g4-shadows"]').textContent();
    assert.match(option, /علوم · الصف 4 · الضوء والظل/);
    await t.locator('.aid-library select').first().selectOption('science-g4-shadows');
    const link = t.locator('.interactive-lesson-link a');
    await link.waitFor();
    assert.equal(await link.getAttribute('href'), '/interactive-lessons/science-4-shadows');
    assert.equal(await link.getAttribute('target'), '_blank');
    await s.locator('.aid-library summary').click();
    await s.locator('.interactive-lesson-link a').waitFor();
    await t.locator('.aid-library').screenshot({path: path.join(output, 'class-lesson-link.png')});
    const [popup] = await Promise.all([context.waitForEvent('page'), link.click()]);
    await popup.waitForFunction(() => document.documentElement.classList.contains('sl-ready'));
    assert.equal(new URL(popup.url()).pathname, '/interactive-lessons/science-4-shadows');
    assert.ok(t.url().includes('/lesson/preview'), 'teacher stays in the class');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok: true, results: ['demo → lessons → lesson → back on phone width', 'class dropdown lists the lesson', 'teacher and student see the link', 'link opens the lesson in a new tab while the class stays open']}, null, 1));
  } finally { await browser.close(); app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); }
})().catch(e => { console.error(e); process.exit(1); });
