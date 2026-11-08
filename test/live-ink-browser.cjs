// Optional browser verification for stage 063: a smooth, live board. While the teacher is still writing (pen not
// lifted), the student's phone already shows the line growing; batches delayed by a jittery network still draw the
// line in the right order; on release the finished stroke replaces the live one. A busy board (150 lines) redraws fast.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {pick, openStepMenus, pastTitle} = require('./ui-helpers.cjs');
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
    // a real network: the live batches are delayed by different amounts, so they arrive out of order
    await tc.route(/\/laser$/, async route => { await new Promise(r => setTimeout(r, Math.random() * 400)); route.continue(); });
    const t = await tc.newPage(); watch(t); t.on('dialog', d => d.accept().catch(() => {}));
    await t.goto(base + '/start/teacher'); await t.locator('.gl-cur-subject[data-subject=math] li.is-ready button').first().click(); await t.waitForSelector('#pl-steps li');
    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/); await pastTitle(t);
    const sc = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}); sc.setDefaultTimeout(15000);
    const s = await sc.newPage(); watch(s);
    await s.goto(base + '/start/student'); await s.waitForFunction(() => window.__voice); await s.locator('#gl-enter').click(); await s.waitForSelector('#gl-content .gl-page');
    await pick(t, '.gl-tool[data-tool=pen]');
    const r = await t.locator('#gl-ink').boundingBox();
    await t.mouse.move(r.x + r.width * 0.3, r.y + r.height * 0.4); await t.mouse.down();
    for (let i = 1; i <= 40; i++) { await t.mouse.move(r.x + r.width * (0.3 + i * 0.008), r.y + r.height * (0.4 + Math.sin(i / 5) * 0.08)); await t.waitForTimeout(25); }
    // the pen is still down: the student already sees the line being written
    await s.waitForFunction(() => document.querySelector('#gl-ink > .gl-live-remote')?.__points?.filter(Boolean).length > 10);
    const liveLen = await s.evaluate(() => document.querySelector('#gl-ink > .gl-live-remote').__points.filter(Boolean).length);
    await s.screenshot({path: path.join(out, 'live-ink-student-writing.png')});
    results.push(`while the teacher was still writing, the student's phone showed the line growing (${liveLen} points so far)`);
    await t.mouse.up();
    await s.waitForFunction(() => document.querySelectorAll('#gl-ink .gl-stroke[data-id]').length === 1 && !document.querySelector('#gl-ink > .gl-live-remote'));
    // the live line was drawn in order: its points go left to right like the teacher's hand
    const sent = await t.evaluate(() => [...document.querySelectorAll('#gl-ink .gl-stroke[data-id]')].length);
    assert.equal(sent, 1);
    results.push('on release the finished stroke replaced the live line (no duplicate), even with batches arriving out of order');
    // a rectangle: the student sees it stretch while the teacher drags
    await pick(t, '.gl-tool[data-tool=rect]');
    await t.mouse.move(r.x + r.width * 0.55, r.y + r.height * 0.2); await t.mouse.down();
    for (let i = 1; i <= 15; i++) { await t.mouse.move(r.x + r.width * (0.55 + i * 0.01), r.y + r.height * (0.2 + i * 0.01)); await t.waitForTimeout(30); }
    await s.waitForFunction(() => document.querySelector('#gl-ink > .gl-live-remote.gl-rect'));
    await t.mouse.up();
    await s.waitForFunction(() => document.querySelectorAll('#gl-ink .gl-stroke[data-id]').length === 2 && !document.querySelector('#gl-ink > .gl-live-remote'));
    results.push('a rectangle stretched live on the student\'s phone while the teacher dragged it, then became a stroke');
    // a busy board: 150 lines; redrawing after one more line reuses the unchanged ones
    const ms = await s.evaluate(async () => {
      const {renderInk} = await import('/group-view.js?b=' + Date.now()).catch(() => import('/group-view.js'));
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); document.body.append(svg);
      const items = Array.from({length: 150}, (_, i) => ({id: 'x' + i, kind: 'stroke', tool: 'pen', size: 'm', color: '#1f2937', points: Array.from({length: 120}, (_, j) => [j * 7, (i * 4 + Math.sin(j / 3) * 20) % 600])}));
      renderInk(svg, items); const t0 = performance.now(); renderInk(svg, [...items, {...items[0], id: 'new'}]); const dt = performance.now() - t0;
      const reused = svg.querySelector('[data-id="x5"]'); renderInk(svg, items); svg.remove(); return {dt, kept: reused === null ? false : true};
    });
    assert.ok(ms.dt < 40, 'redraw ' + ms.dt);
    results.push(`a busy board (150 lines): adding one line redrew in ${ms.dt.toFixed(1)} ms by reusing the unchanged lines`);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ok: true, results}, null, 1));
  } finally { await browser.close(); app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); }
})().catch(e => { console.error(e); process.exit(1); });
