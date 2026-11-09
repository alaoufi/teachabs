// Class controls use one line-icon family (Lucide, ISC licence, public/vendor/icons/) instead of emoji, which look
// different on every phone and computer. Only the controls change: the board, lesson aids, stars and the narrator's
// faces keep their pictures. Swapping happens on the page itself, so every button the class already has (and every
// label the class sets later, e.g. «🔇 كتم» ⇄ «🔊 صوت») follows without touching its code.
export const ICONS = {
  '🎙': 'mic', '🎤': 'mic', '📷': 'camera', '🔈': 'volume-1', '🔊': 'volume-2', '🔇': 'volume-x', '⛔': 'octagon-x',
  '🖥': 'monitor', '👥': 'users', '👪': 'users', '🧭': 'compass', '📚': 'library', '🗑': 'trash-2', '⏱': 'timer', '⏰': 'alarm-clock',
  '⏹': 'square', '⏸': 'pause', '⏩': 'fast-forward', '🎭': 'drama', '📏': 'ruler', '📐': 'triangle-right', '✋': 'hand',
  '✎': 'pencil', '✏': 'pencil', '🖌': 'brush', '🧰': 'toolbox', '🔬': 'microscope', '⚙': 'settings', '👁': 'eye', '🙈': 'eye-off',
  '📖': 'book-open', '📗': 'book', '📑': 'files', '🗂': 'folder', '📊': 'chart-bar', '🎲': 'dices', '👀': 'scan-eye', '✓': 'check',
  '✅': 'circle-check', '✕': 'x', '✖': 'x', '⛶': 'maximize', '➤': 'mouse-pointer-2', '🚦': 'traffic-cone', '📥': 'inbox',
  '🚫': 'ban', '📅': 'calendar', '🎧': 'headphones', '⌫': 'eraser', '↶': 'undo-2', '⋯': 'ellipsis', '◯': 'shapes',
};
const SPRITE = '/vendor/icons/lucide.svg';
// What an icon means, for a button left with nothing but the icon (screen readers read this name).
const NAMES = {hand: 'رفع اليد', x: 'إغلاق', check: 'تم', 'volume-x': 'كتم الصوت', 'volume-2': 'تشغيل الصوت', 'volume-1': 'اختبار الصوت', mic: 'المايك',
  camera: 'الكاميرا', eye: 'إظهار للطلاب', 'eye-off': 'إخفاء عن الطلاب', maximize: 'ملء الشاشة', settings: 'الإعدادات', compass: 'إدارة الفصل',
  users: 'الطلاب', 'trash-2': 'مسح', 'undo-2': 'تراجع', ellipsis: 'المزيد', pencil: 'قلم', eraser: 'ممحاة', 'octagon-x': 'إيقاف الكل',
  'book-open': 'كتاب الوزارة', library: 'النصوص', timer: 'مؤقت', pause: 'إيقاف مؤقت', 'fast-forward': 'التالي', monitor: 'شاشة العرض'};
const SKIP = '#gl-content, .gl-board, .gl-title-card, .gl-lesson-tools-list, .aid-card, .gl-narrator, textarea, input, svg, .gl-stars, .gl-star';
const HOST = 'button, a, summary, label, .gl-fly-head, .gl-fly-icon, .gl-sbtn, .gl-avl';
const first = text => { const m = /^\s*([\s\S])([\s\S]?)/u.exec(text); if (!m) return null; for (const k of [m[1] + m[2], m[1]]) { const key = k.replace('️', ''); if (ICONS[key]) return {key, len: (/^\s*/.exec(text)[0].length) + k.length + (text[(/^\s*/.exec(text)[0].length) + k.length] === '️' ? 1 : 0)}; } return null; };
/** An inline icon that takes the text colour and size. */
export function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'gl-ic'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use'); use.setAttribute('href', `${SPRITE}#${name}`); svg.append(use); return svg;
}
function swap(node) {
  const host = node.parentElement; if (!host || !host.closest(HOST) || host.closest(SKIP)) return;
  const hit = first(node.data); if (!hit) return;
  const rest = node.data.slice(hit.len).replace(/^\s+/, '');
  const svg = icon(ICONS[hit.key]); host.insertBefore(svg, node);
  if (rest) node.data = rest; else node.remove();
  if (!host.textContent.trim()) { // an icon alone: no gap after it, and the control keeps a spoken name
    svg.classList.add('is-solo');
    const ctl = host.closest('button, a, summary');
    if (ctl && !ctl.textContent.trim() && !ctl.getAttribute('aria-label') && !ctl.getAttribute('aria-labelledby')) ctl.setAttribute('aria-label', ctl.title || NAMES[ICONS[hit.key]] || '');
  }
}
function scan(root) {
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), found = [];
  for (let n = walk.nextNode(); n; n = walk.nextNode()) if (/\S/.test(n.data)) found.push(n);
  found.forEach(swap);
}
export function useIcons(root = document.body) {
  if (typeof document === 'undefined' || !root) return;
  scan(root);
  new MutationObserver(list => { for (const m of list) {
    if (m.type === 'characterData') swap(m.target);
    else for (const n of m.addedNodes) n.nodeType === 3 ? swap(n) : n.nodeType === 1 && scan(n);
  } }).observe(root, {subtree: true, childList: true, characterData: true});
}
