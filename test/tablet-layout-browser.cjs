// Optional browser verification for stage 074: the class on iPads and Android tablets, upright and sideways. The teacher's
// board takes most of the width, the sections row sits under it and fits, the tools sit beside it (sideways) or under it
// (upright), nothing scrolls the page; the student's board on an upright tablet stays level (only phones turn it).
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
(async () => {
  const {openStore} = await import('../store.mjs'), {createApp} = await import('../server.mjs');
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.address().port, out = process.env.SCIENCE_ARTIFACTS || '../group-verification';
  fs.mkdirSync(out, {recursive: true});
  const browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
  const results = [], errors = [];
  try {
    const tc = await browser.newContext({viewport: {width: 1366, height: 768}}); tc.setDefaultTimeout(15000); await tc.addInitScript(() => localStorage.setItem('gl-autostart', '0'));
    const t = await tc.newPage(); t.on('pageerror', e => errors.push(e.message));
    await t.goto(base + '/start/teacher'); await t.locator('.gl-cur-subject[data-subject=science] li.is-ready button').first().click(); await t.waitForSelector('#pl-steps li');
    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/);
    await t.locator('#gl-steps li[data-type=board] .gl-go').click(); await t.waitForFunction(() => document.querySelector('#gl-steps li.is-current')?.dataset.type === 'board');
    const live = t.url(), code = live.slice(-6), cookies = await tc.cookies();
    // [name, width, height, the least share of the width the teacher's board takes]
    const sizes = [['iPad mini upright', 744, 1133, 95], ['iPad mini sideways', 1133, 744, 70], ['iPad upright', 820, 1180, 95], ['iPad sideways', 1180, 820, 78],
      ['iPad Pro upright', 1024, 1366, 95], ['iPad Pro sideways', 1366, 1024, 85], ['10" tablet upright', 800, 1280, 95], ['10" tablet sideways', 1280, 800, 70],
      ['7" tablet upright', 600, 960, 95], ['7" tablet sideways', 960, 600, 75]];
    for (const [name, w, h, pct] of sizes) {
      const c = await browser.newContext({viewport: {width: w, height: h}, isMobile: true, hasTouch: true}); c.setDefaultTimeout(15000);
      await c.addInitScript(() => localStorage.setItem('gl-autostart', '0')); await c.addCookies(cookies);
      const p = await c.newPage(); p.on('pageerror', e => errors.push(e.message)); await p.goto(live); await p.waitForSelector('#gl-steps li.is-current'); await p.waitForTimeout(500);
      const m = await p.evaluate(() => { const q = s => document.querySelector(s).getBoundingClientRect(), b = q('#gl-board'), n = q('.gl-sections'), f = q('footer.gl-bar-bottom'), z = q('.gl-stage > .gl-zoom'), ol = document.querySelector('#gl-steps');
        return {pct: Math.round(b.width / innerWidth * 100), under: n.top >= b.bottom - 1 && n.bottom <= innerHeight + 1, fits: ol.scrollWidth <= ol.clientWidth + 1,
          tools: f.left >= b.right - 1 || f.right <= b.left + 1 ? 'beside' : f.top >= b.bottom - 1 ? 'under' : 'over', zoomClear: z.right <= n.left || z.left >= n.right || z.bottom <= n.top || z.top >= n.bottom,
          scroll: document.documentElement.scrollHeight > innerHeight + 1 || document.documentElement.scrollWidth > innerWidth + 1}; });
      const sideways = w > h;
      assert.ok(m.pct >= pct && m.under && m.fits && m.zoomClear && !m.scroll && m.tools === (sideways ? 'beside' : 'under'), `${name} ${w}x${h} ${JSON.stringify(m)}`);
      await p.screenshot({path: path.join(out, `tablet-teacher-${w}x${h}.png`)});
      const s = await (await browser.newContext({viewport: {width: w, height: h}, isMobile: true, hasTouch: true})).newPage(); s.on('pageerror', e => errors.push(e.message));
      await s.goto(base + '/join?code=' + code); await s.locator('input[name=name]').fill('طالب'); await s.getByRole('button', {name: 'دخول الحصة'}).click();
      await s.waitForFunction(() => window.__voice); await s.locator('#gl-enter').click(); await s.waitForSelector('#gl-board:not([hidden])');
      const sm = await s.evaluate(() => { const b = document.querySelector('#gl-board').getBoundingClientRect(); return {level: b.width > b.height, pct: Math.round(b.width / innerWidth * 100), inView: b.top >= -1 && b.bottom <= innerHeight + 1}; });
      assert.ok(sm.level && sm.inView && sm.pct >= 70, `student on ${name}: ${JSON.stringify(sm)}`);
      await c.close(); await s.context().close();
      results.push(`${name} ${w}x${h}: teacher's board ${m.pct}% of the width, tools ${m.tools} it, sections fit under it; student's board level (${sm.pct}%)`);
    }
    // a phone held upright still turns the student's board sideways
    const ph = await (await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true})).newPage();
    await ph.goto(base + '/join?code=' + code); await ph.locator('input[name=name]').fill('جوال'); await ph.getByRole('button', {name: 'دخول الحصة'}).click();
    await ph.waitForFunction(() => window.__voice); await ph.locator('#gl-enter').click(); await ph.waitForSelector('#gl-board:not([hidden])');
    assert.ok(await ph.evaluate(() => { const b = document.querySelector('#gl-board').getBoundingClientRect(); return b.height > b.width; }), 'phone: board turned sideways');
    results.push('phone upright 390x844: the student\'s board still turns sideways');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok: true, results}, null, 1));
  } finally { await browser.close(); app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); }
})().catch(e => { console.error(e); process.exit(1); });
