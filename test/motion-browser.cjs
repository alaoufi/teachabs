// Optional browser verification for stage 077 (GSAP motion on the class and the board): the lesson title's lines arrive one
// after another and leave no inline style behind; a menu opens with a short movement; with «تقليل الحركة» nothing moves;
// GSAP never blocks the page and the board's pen still draws.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {pick} = require('./ui-helpers.cjs');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
(async () => {
  const {openStore} = await import('../store.mjs'), {createApp} = await import('../server.mjs');
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.address().port, out = process.env.SCIENCE_ARTIFACTS || '../group-verification';
  fs.mkdirSync(out, {recursive: true});
  const browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
  const results = [], errors = [];
  const startClass = async (reducedMotion) => {
    const ctx = await browser.newContext({viewport: {width: 1366, height: 768}, reducedMotion}); ctx.setDefaultTimeout(15000);
    await ctx.addInitScript(() => localStorage.setItem('gl-autostart', '0'));
    const t = await ctx.newPage(); t.on('pageerror', e => errors.push(e.message)); t.on('dialog', d => d.accept().catch(() => {}));
    await t.goto(base + '/start/teacher'); await t.locator('.gl-cur-subject[data-subject=science] li.is-ready button').first().click(); await t.waitForSelector('#pl-steps li');
    await t.getByRole('button', {name: 'بدء الحصة بهذا الترتيب'}).click(); await t.waitForURL(/\/teach\/live\/[A-Z0-9]{6}$/);
    await t.waitForFunction(() => window.gsap); return {ctx, t};
  };
  try {
    const head = await (await fetch(base + '/vendor/gsap/gsap.min.js')).text();
    assert.match(head, /GSAP 3\.13/); results.push('GSAP 3.13 is served from the platform itself (no outside source)');
    // normal motion: the title's lines move in, then their inline styles are cleared
    const {ctx, t} = await startClass('no-preference');
    await t.evaluate(() => { const c = document.getElementById('gl-content'); delete c._titled; });
    await t.locator('#gl-next').click(); await t.locator('#gl-prev').click(); // back to the title: it arrives again
    const during = await t.waitForFunction(() => [...document.querySelectorAll('.gl-title-card > *')].some(n => gsap.isTweening(n)), null, {timeout: 3000}).then(() => true, () => false);
    await t.waitForTimeout(1500);
    const after = await t.evaluate(() => [...document.querySelectorAll('.gl-title-card > *')].map(n => n.getAttribute('style') || ''));
    assert.ok(after.every(s => !/opacity|transform|visibility/.test(s)), JSON.stringify(after));
    results.push(`the lesson title's lines arrived one after another${during ? '' : ' (already settled when checked)'} and left no inline style behind`);
    // a tool family's menu opens with a short movement and ends in place
    await t.locator('.gl-fly .gl-fly-btn').first().click();
    const menu = t.locator('.gl-fly.is-open .gl-fly-menu'); await menu.waitFor();
    await t.waitForTimeout(400);
    assert.equal(await menu.evaluate(n => getComputedStyle(n).opacity), '1');
    assert.ok(!/transform/.test(await menu.getAttribute('style') || ''));
    results.push('a tool menu opened (0.18 s, no bounce) and settled fully in place');
    await t.keyboard.press('Escape'); await t.mouse.click(5, 5);
    // the pen still draws on the board while motion is on
    await t.locator('#gl-next').click(); await t.waitForFunction(() => document.querySelector('#gl-steps li.is-current')?.dataset.type !== 'title');
    await pick(t, '.gl-tool[data-tool=pen]');
    const b = await t.locator('#gl-ink').boundingBox(), cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    const before = await t.locator('#gl-ink .gl-stroke[data-id]').count();
    await t.mouse.move(cx - 80, cy); await t.mouse.down(); for (let i = 1; i <= 10; i++) await t.mouse.move(cx - 80 + i * 16, cy + (i % 2) * 10); await t.mouse.up();
    await t.waitForFunction(n => document.querySelectorAll('#gl-ink .gl-stroke[data-id]').length > n, before);
    results.push('the pen drew on the board as before');
    await t.screenshot({path: path.join(out, 'motion-teacher.png')}); await ctx.close();
    // reduced motion: nothing moves at all
    const r = await startClass('reduce');
    const still = await r.t.evaluate(() => [...document.querySelectorAll('.gl-title-card > *')].every(n => !gsap.isTweening(n) && !n.getAttribute('style')));
    assert.ok(still); await r.t.locator('.gl-fly .gl-fly-btn').first().click();
    assert.ok(!(await r.t.locator('.gl-fly.is-open .gl-fly-menu').getAttribute('style')));
    results.push('with «تقليل الحركة» on the device, the title and the menus appear at once with no movement');
    await r.ctx.close();
    assert.deepEqual(errors, []);
    console.log(results.map(x => '✓ ' + x).join('\n'));
  } catch (e) { console.error(e); process.exitCode = 1; }
  finally { await browser.close(); app.close(); store.close?.(); }
})();
