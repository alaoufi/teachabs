// Optional browser verification for stage 041: the teacher's presentation mode. On a common laptop screen
// (1366x768) the whole board is on screen with no page scroll, the steps and quick controls sit above it,
// the drawing tools below it, and the side drawer holds the students and full step controls.
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
  const watch = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); };
  try {
    const tc = await browser.newContext({viewport: {width: 1366, height: 768}}); await tc.addInitScript(() => localStorage.setItem('gl-autostart', '0')); // this test leads the explanation by hand tc.setDefaultTimeout(15000);
    await tc.addCookies([{name: 'ks', value: store.session(store.tour().teacher), url: base}]);
    const t = await tc.newPage(); watch(t); t.on('dialog', d => d.accept().catch(() => {}));
    await t.goto(base + '/teach/plans');
    await t.locator('.gl-templates button', {hasText: 'حالات المادة'}).click(); await t.waitForURL(/\/teach\/plans\/[0-9a-f-]{36}$/);
    await t.waitForSelector('#pl-steps li');
    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/);
    await t.waitForSelector('#gl-steps li.is-current');

    const layout = () => t.evaluate(() => {
      const r = s => document.querySelector(s).getBoundingClientRect();
      const b = r('#gl-board'), top = r('.gl-bar-steps'), tools = r('.gl-bar-bottom');
      return {board: [b.top, b.bottom, b.left, b.right, b.width], stepsBottom: top.bottom, toolsTop: tools.top, toolsBottom: tools.bottom,
        vh: innerHeight, vw: innerWidth, vscroll: document.documentElement.scrollHeight > innerHeight + 1, hscroll: document.documentElement.scrollWidth > innerWidth + 1,
        siteHeader: getComputedStyle(document.querySelector('body > header')).display};
    });
    const onScreen = (m, minWidth) => {
      assert.equal(m.vscroll, false, JSON.stringify(m)); assert.equal(m.hscroll, false, JSON.stringify(m));
      assert.equal(m.siteHeader, 'none');
      const [top, bottom, left, right, width] = m.board;
      assert.ok(top >= m.stepsBottom - 1 && bottom <= m.toolsTop + 1 && left >= 0 && right <= m.vw && m.toolsBottom <= m.vh, JSON.stringify(m));
      assert.ok(width >= minWidth, `board ${width}px < ${minWidth}px`);
    };
    await t.waitForTimeout(400);
    const first = await layout(); onScreen(first, 800);
    assert.equal(await t.locator('#gl-drawer').isHidden(), true);
    await t.screenshot({path: path.join(out, 'present-1366-curriculum.png')});
    results.push(`curriculum step: whole board on screen at 1366x768 (${Math.round(first.board[4])}px wide), steps above, tools below, no scroll`);

    // interactive step, driven only from the quick controls above the board (the drawer stays closed)
    await t.locator('#gl-steps li[data-type=interactive] button').click(); await t.waitForSelector('#gl-content .gl-scene');
    const before = await t.locator('#gl-quick .gl-quick-out').first().textContent();
    await t.locator('#gl-quick').getByRole('button', {name: 'سخّن ١٠°'}).click();
    await t.waitForFunction(b => document.querySelector('#gl-quick .gl-quick-out')?.textContent !== b, before);
    await t.locator('#gl-quick [data-narr=start]').click(); await t.waitForSelector('.gl-stage > .gl-narrator');
    await t.waitForTimeout(400);
    const inter = await layout(); onScreen(inter, 600);
    const quick = await t.locator('#gl-quick button').evaluateAll(bs => bs.map(b => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.width > 0; }));
    assert.ok(quick.length >= 6 && quick.every(Boolean), 'every quick control is fully on screen');
    await t.screenshot({path: path.join(out, 'present-1366-interactive.png')});
    results.push('interactive step: heat and the narrator run from the quick bar above the board; every quick control visible; board and narrator still on screen');

    // board step quick buttons, then the questions step and the drawer
    await t.locator('#gl-steps li[data-type=board] button').click();
    await t.locator('#gl-quick').getByRole('button', {name: /النص التالي/}).click();
    await t.waitForFunction(() => [...document.querySelectorAll('#gl-quick button')].some(b => b.textContent.includes('النص التالي (٢/')));
    onScreen(await layout(), 800);
    await t.locator('#gl-steps li').nth(3).locator('button').click();
    await t.locator('#gl-drawer-btn').click(); await t.locator('#gl-drawer').waitFor();
    assert.equal(await t.locator('#gl-drawer-btn').getAttribute('aria-expanded'), 'true');
    await t.locator('#gl-panel').getByRole('button', {name: 'افتح الإجابة للطلاب'}).click();
    await t.keyboard.press('Escape'); await t.locator('#gl-drawer').waitFor({state: 'hidden'});
    results.push('board step reveals cards from the quick bar; the drawer opens with the full step controls and closes with Escape');

    for (const [w, h, min] of [[1920, 1080, 1200], [1280, 800, 800], [1024, 768, 700], [768, 1024, 600]]) {
      await t.setViewportSize({width: w, height: h}); await t.waitForTimeout(300);
      onScreen(await layout(), min);
    }
    results.push('no page scroll and the whole board visible at 1920x1080, 1280x800, 1024x768 and 768x1024');

    // the display screen for the smart board: one thin bar, the board (and narrator strip) fill the rest, no scroll
    const code = t.url().split('/').pop();
    const d = await tc.newPage(); watch(d); await d.goto(base + `/teach/live/${code}/display`);
    await d.waitForSelector('#gl-board:not([hidden])');
    for (const [w, h, min] of [[1366, 768, 900], [1920, 1080, 1400], [1280, 720, 850]]) {
      await d.setViewportSize({width: w, height: h}); await d.waitForTimeout(300);
      const m = await d.evaluate(() => { const b = document.querySelector('#gl-board').getBoundingClientRect(), n = document.querySelector('.gl-stage > .gl-narrator')?.getBoundingClientRect();
        return {top: b.top, bottom: Math.max(b.bottom, n ? n.bottom : 0), width: b.width, vh: innerHeight, scroll: document.documentElement.scrollHeight > innerHeight + 1, header: getComputedStyle(document.querySelector('body > header')).display}; });
      assert.ok(!m.scroll && m.header === 'none' && m.top >= 0 && m.bottom <= m.vh && m.width >= min, `display ${w}x${h} ${JSON.stringify(m)}`);
    }
    await d.setViewportSize({width: 1366, height: 768}); await d.screenshot({path: path.join(out, 'present-display-1366.png')});
    results.push('display screen: whole board on screen without scroll at 1366x768, 1920x1080 and 1280x720');
    assert.equal(await t.locator('#gl-status.is-error').count(), 0, await t.locator('#gl-status').textContent());
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok: true, results}, null, 1));
  } finally { await browser.close(); app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); }
})().catch(e => { console.error(e); process.exit(1); });
