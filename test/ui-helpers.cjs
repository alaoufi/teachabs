// Shared helpers for the browser checks: tools now live in families that open on demand (pens, shapes, colour, size,
// more), so a check opens the family before tapping the tool, as a teacher would.
async function pick(page, selector) {
  const loc = page.locator(selector).first();
  if (!await loc.isVisible()) await page.evaluate(sel => document.querySelector(sel)?.closest('.gl-fly')?.querySelector('.gl-fly-btn')?.click(), selector);
  await loc.click();
}
/** Keeps every step-control menu open (the teacher's own choice is remembered the same way). */
const openStepMenus = ctx => ctx.addInitScript(() => { try { localStorage.setItem('gl-qopen', 'all'); } catch {} });
/** Since stage 072 a class opens on the lesson's title; checks of the lesson's own steps move past it first, as a teacher would. */
async function pastTitle(page) {
  await page.waitForSelector('#gl-steps li.is-current');
  if (await page.locator('#gl-steps li.is-current').getAttribute('data-type') !== 'title') return;
  await page.locator('#gl-next').click();
  await page.waitForFunction(() => { const c = document.querySelector('#gl-steps li.is-current'); return c && c.dataset.type !== 'title'; });
}
module.exports = {pick, openStepMenus, pastTitle};
