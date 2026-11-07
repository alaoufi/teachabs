// Optional browser verification for stage 047: a live teacher-and-student trial without any sign-up.
// «أنا المعلم» → /start/teacher opens «دروسي»; «أنا الطالب» → /start/student joins the running trial class directly;
// the teacher photographs the book page during the class and everyone sees it; the prepared audio explanation of the
// curriculum page plays on the student's device; a vanished class shows a clear message; script errors are reported.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {pick, openStepMenus} = require('./ui-helpers.cjs');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
function png(w, h) { // a plain test picture standing in for a photo of a book page
  const crc = b => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const v of b) x = t[(x ^ v) & 255] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * (w * 3 + 1) + 1 + x * 3; raw[i] = 250; raw[i + 1] = 245 - (y % 40 < 3 ? 120 : 0); raw[i + 2] = 230; }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
(async () => {
  const {openStore} = await import('../store.mjs'), {createApp} = await import('../server.mjs');
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.address().port, out = process.env.SCIENCE_ARTIFACTS || '../group-verification';
  fs.mkdirSync(out, {recursive: true});
  const browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
  const results = [], errors = [];
  const watch = p => { p.on('pageerror', e => errors.push(e.message)); };
  try {
    const none = await (await browser.newContext()).newPage();
    await none.goto(base + '/start/student'); assert.match(none.url(), /\/join\?none=1$/);
    assert.match(await none.locator('.gl-status').first().textContent(), /لا توجد حصة تجريبية جارية/);
    results.push('«أنا الطالب» with no running class explains what to do');

    const tc = await browser.newContext({viewport: {width: 412, height: 860}, isMobile: true, hasTouch: true}); await openStepMenus(tc); tc.setDefaultTimeout(15000);
    const t = await tc.newPage(); watch(t); t.on('dialog', d => d.accept().catch(() => {}));
    await t.goto(base + '/start/teacher'); assert.match(t.url(), /\/teach\/plans$/);
    await t.locator('.gl-cur-subject[data-subject=science] li.is-ready button').first().click(); await t.waitForSelector('#pl-steps li');
    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/);
    await t.waitForSelector('#gl-steps li.is-current');

    const sc = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}); sc.setDefaultTimeout(15000);
    const s = await sc.newPage(); watch(s);
    await s.addInitScript(() => { window.__spoken = []; window.speechSynthesis && (speechSynthesis.speak = u => { window.__spoken.push(u.text); setTimeout(() => u.onend?.(), 10); }); });
    await s.goto(base + '/start/student'); await s.waitForURL(/\/class\/[A-Z0-9]{6}$/);
    assert.equal(s.url().split('/').pop(), t.url().split('/').pop(), 'joined the running class');
    await s.waitForFunction(() => window.__voice); await s.locator('#gl-enter').click(); await s.waitForSelector('#gl-content .gl-page');
    await t.locator('#gl-drawer-btn').click(); await t.waitForFunction(() => document.querySelector('#gl-students')?.textContent.includes('طالب 1')); await t.keyboard.press('Escape');
    results.push('«أنا الطالب» joined the running class directly as «طالب 1» — no code, no name, no sign-up');

    const placeAll = async () => { const n = await t.locator('.gl-snip').count(); for (let i = 0; i < n; i++) { await t.locator('.gl-snip').nth(i).click(); await t.waitForTimeout(250); } await t.waitForTimeout(600);
      return t.evaluate(() => { const ink = document.querySelector('#gl-ink'), m = ink.getScreenCTM().inverse(), b = [...ink.querySelectorAll('text')].map(x => x.getBBox());
        const rects = [...document.querySelectorAll('#gl-content .gl-page-svg text')].map(x => { const r = x.getBoundingClientRect(), a = new DOMPoint(r.left, r.top).matrixTransform(m), c = new DOMPoint(r.right, r.bottom).matrixTransform(m); return {x: a.x, y: a.y, width: c.x - a.x, height: c.y - a.y}; });
        const hit = (p, q) => p.x < q.x + q.width && q.x < p.x + p.width && p.y < q.y + q.height && q.y < p.y + p.height;
        return {n: b.length, onEachOther: b.some((p, i) => b.some((q, j) => j > i && hit(p, q))), onLesson: b.some(p => rects.some(q => hit(p, q))), rows: new Set(b.map(p => Math.round(p.y))).size}; }); };
    const tidy = await placeAll();
    assert.ok(tidy.n >= 4 && !tidy.onEachOther && !tidy.onLesson && tidy.rows < tidy.n, JSON.stringify(tidy));
    await t.screenshot({path: path.join(out, 'live-trial-snippets.png')});
    results.push(`«نصوص جاهزة»: ${tidy.n} texts placed with one tap each, in tidy rows, never on each other nor on the lesson text`);
    await pick(t, '#gl-clear'); await t.waitForFunction(() => !document.querySelector('#gl-ink text'));

    // the book page, photographed during the class
    await t.locator('#gl-page-file').setInputFiles({name: 'page.png', mimeType: 'image/png', buffer: png(600, 800)});
    await t.waitForFunction(() => document.querySelector('#gl-status')?.textContent.includes('ظهرت صفحة الكتاب'));
    await s.waitForSelector('#gl-content img'); await t.waitForSelector('#gl-content img');
    assert.match(await s.locator('#gl-content img').getAttribute('src'), /^data:image\/jpeg;base64,/);
    await s.waitForTimeout(400); await s.screenshot({path: path.join(out, 'live-trial-student-page.png')});
    const fit = await t.evaluate(() => { const i = document.querySelector('#gl-content img').getBoundingClientRect(), b = document.querySelector('#gl-board').getBoundingClientRect(); return {inside: i.top >= b.top - 1 && i.bottom <= b.bottom + 1 && i.left >= b.left - 1 && i.right <= b.right + 1, portrait: i.height > i.width}; });
    assert.deepEqual(fit, {inside: true, portrait: true}, 'the whole portrait page fits inside the board');
    results.push('📷 the teacher photographed the book page; it appeared on the teacher’s and the student’s board');

    const overPhoto = await placeAll();
    assert.ok(!overPhoto.onEachOther, 'texts over a photographed page still never sit on each other: ' + JSON.stringify(overPhoto));
    results.push('over a photographed page the texts still line up without covering each other');

    // the display screen held upright on a phone fills the whole screen (turned sideways), no empty space
    const dc = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}); await dc.addCookies(await tc.cookies());
    const d = await dc.newPage(); watch(d); await d.goto(t.url() + '/display'); await d.waitForSelector('#gl-board'); await d.waitForTimeout(600);
    const shown = await d.evaluate(() => { const r = document.querySelector('#gl-board').getBoundingClientRect(); return {h: r.height, vh: innerHeight, w: r.width, scroll: document.documentElement.scrollHeight > innerHeight + 1}; });
    assert.ok(shown.h > shown.vh * 0.72 && !shown.scroll, JSON.stringify(shown));
    await d.screenshot({path: path.join(out, 'live-trial-display-phone.png')});
    results.push(`display screen on an upright phone: the board fills ${Math.round(100 * shown.h / shown.vh)}% of the screen height, no empty space`);

    // the prepared audio explanation of the page plays on the student's device
    await t.locator('#gl-quick').getByRole('button', {name: '▶ على أجهزة الطلاب'}).click();
    await s.waitForFunction(() => window.__spoken.some(x => x.includes('درسنا اليوم: الخلايا')));
    results.push('🔊 the prepared audio explanation of the curriculum page played on the student’s device');
    await t.screenshot({path: path.join(out, 'live-trial-teacher.png')});

    // error reports reach the server log endpoint
    assert.equal((await t.evaluate(async () => (await fetch('/client-error', {method: 'POST', headers: {'content-type': 'application/json'}, body: '{"message":"x"}'})).status)), 204);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok: true, results}, null, 1));
  } finally { await browser.close(); app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); }
})().catch(e => { console.error(e); process.exit(1); });
