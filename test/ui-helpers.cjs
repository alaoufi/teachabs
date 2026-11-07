// Shared helpers for the browser checks: tools now live in families that open on demand (pens, shapes, colour, size,
// more), so a check opens the family before tapping the tool, as a teacher would.
async function pick(page, selector) {
  const loc = page.locator(selector).first();
  if (!await loc.isVisible()) await page.evaluate(sel => document.querySelector(sel)?.closest('.gl-fly')?.querySelector('.gl-fly-btn')?.click(), selector);
  await loc.click();
}
/** Keeps every step-control menu open (the teacher's own choice is remembered the same way). */
const openStepMenus = ctx => ctx.addInitScript(() => { try { localStorage.setItem('gl-qopen', 'all'); } catch {} });
module.exports = {pick, openStepMenus};
