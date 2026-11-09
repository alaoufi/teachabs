// Calm, purposeful motion for the class and the board (GSAP, following the official gsap-core / gsap-timeline /
// gsap-performance skills in .claude/skills): transforms and opacity only, short durations, eases from the built-in set,
// clearProps when done so the board's own positioning, dragging and pen keep full control.
//  - GSAP (public/vendor/gsap/gsap.min.js, standard no-charge license) loads in the background; until it has loaded, or if
//    it fails, everything simply appears at once — nothing ever waits for an animation.
//  - prefers-reduced-motion: nothing moves (gsap.matchMedia keeps it in step if the setting changes during the class).
//  - Never animates the ink layer's geometry, the board camera, or anything under the teacher's pointer.
let gsap = null, reduce = false;
const media = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
reduce = Boolean(media?.matches);
media?.addEventListener?.('change', e => { reduce = e.matches; if (reduce && gsap) gsap.globalTimeline.progress(1); });

/** Loads GSAP once, without blocking the page. */
export const ready = (() => {
  if (typeof document === 'undefined') return Promise.resolve(null);
  if (globalThis.gsap) { gsap = globalThis.gsap; return Promise.resolve(gsap); }
  return new Promise(resolve => {
    const s = document.createElement('script'); s.src = '/vendor/gsap/gsap.min.js'; s.async = true;
    s.onload = () => { gsap = globalThis.gsap || null; gsap?.defaults({duration: 0.32, ease: 'power2.out', overwrite: 'auto'}); resolve(gsap); };
    s.onerror = () => resolve(null);
    document.head.append(s);
  });
})();

const on = () => gsap && !reduce;
const list = t => (t ? (t.length !== undefined && typeof t !== 'string' ? [...t] : [t]) : []).filter(Boolean);
/** Whatever is moving here stops at its final state at once (e.g. the teacher starts dragging a card that is still arriving). */
export function settle(targets) { if (gsap) for (const n of list(targets)) { gsap.killTweensOf(n); gsap.set(n, {clearProps: 'transform,opacity,visibility'}); } }

/** Explanation elements arriving one after another (cards the teacher reveals, the lesson title's lines). */
export function enter(targets, {y = 12, stagger = 0.07, delay = 0} = {}) {
  const els = list(targets); if (!els.length || !on()) return null;
  return gsap.fromTo(els, {autoAlpha: 0, y}, {autoAlpha: 1, y: 0, stagger, delay, clearProps: 'transform,opacity,visibility'});
}

/** Results bars (and similar charts) growing from their start edge to their value; the width itself is never animated. */
export function grow(bars, {from = 'right'} = {}) {
  const els = list(bars); if (!els.length || !on()) return null;
  return gsap.fromTo(els, {scaleX: 0, transformOrigin: from + ' center'}, {scaleX: 1, duration: 0.55, ease: 'power3.out', stagger: 0.06, clearProps: 'transform'});
}

/** Shapes, tools and writing that arrive from the teacher on another screen fade in (opacity only: their SVG transform,
 *  which places and moves them, is never touched). */
export function fadeIn(nodes) {
  const els = list(nodes); if (!els.length || !on()) return null;
  return gsap.fromTo(els, {opacity: 0}, {opacity: 1, duration: 0.28, ease: 'power1.out', clearProps: 'opacity'});
}

/** Menus, panels and dialogs: a short, light opening (no bounce). */
export function open(el, {y = 6, scale = 0.98} = {}) {
  if (!el || !on()) return null;
  return gsap.fromTo(el, {autoAlpha: 0, y, scale}, {autoAlpha: 1, y: 0, scale: 1, duration: 0.18, ease: 'power2.out', clearProps: 'transform,opacity,visibility'});
}
/** The side panel slides in from its edge. */
export function slideIn(el, {fromRight = false} = {}) {
  if (!el || !on()) return null;
  return gsap.fromTo(el, {autoAlpha: 0, xPercent: fromRight ? 8 : -8}, {autoAlpha: 1, xPercent: 0, duration: 0.24, ease: 'power2.out', clearProps: 'transform,opacity,visibility'});
}
export const motionOn = on;
