// Shared rendering for the group lesson board (teacher console, display screen and student seat).
import {renderOriginalPage} from './group-plan.js';
import {renderScene, lessonState, formatNumber} from './science-shadow-model.js';
import {TOOLS, TEXT_SIZES, smoothPath, cameraTransform} from './group-ink.js';

export const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (k === 'class') node.className = value; else if (k === 'text') node.textContent = value;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), value); else node.setAttribute(k, value === true ? '' : value);
  }
  for (const child of children.flat()) if (child !== null && child !== undefined && child !== false) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
};

const SVG = 'http://www.w3.org/2000/svg';
/** Draws ink items: smoothed pen/brush/marker strokes and typed text. Markers sit under the other ink. */
export function renderInk(svg, items = []) {
  const markers = document.createElementNS(SVG, 'g'), ink = document.createElementNS(SVG, 'g');
  markers.setAttribute('class', 'gl-markers');
  for (const item of items) (item.tool === 'marker' ? markers : ink).append(inkNode(item));
  // Keep a stroke that is being drawn right now when a live update redraws the board.
  svg.replaceChildren(markers, ink, ...svg.querySelectorAll(':scope > .is-live'));
}
export function inkNode(item) {
  if (item.kind === 'text') {
    const t = document.createElementNS(SVG, 'text');
    t.setAttribute('x', item.x); t.setAttribute('y', item.y); t.setAttribute('fill', item.color);
    t.setAttribute('font-size', TEXT_SIZES[item.size] || TEXT_SIZES.m); t.setAttribute('class', 'gl-text');
    t.setAttribute('direction', 'rtl'); t.setAttribute('text-anchor', 'start'); t.setAttribute('dominant-baseline', 'hanging');
    if (item.id) t.dataset.id = item.id;
    t.textContent = item.text;
    return t;
  }
  const tool = TOOLS[item.tool] || TOOLS.pen, path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', smoothPath(item.points)); path.setAttribute('stroke', item.color);
  path.setAttribute('stroke-width', tool.widths[item.size] || tool.widths.m); path.setAttribute('stroke-opacity', tool.opacity);
  path.setAttribute('class', 'gl-stroke gl-' + (item.tool || 'pen'));
  if (item.id) path.dataset.id = item.id;
  return path;
}
export function applyCamera(camera, c, {animate = true} = {}) {
  camera.classList.toggle('no-anim', !animate);
  camera.style.transform = cameraTransform(c);
}

/**
 * content: the public (or teacher) step. options.teacher shows hidden board items dimmed;
 * options.shadow is the activity state to draw; options.display is the questions display.
 */
export function renderStep(container, content, {teacher = false, revealed = null, shadow = null, display = null} = {}) {
  container.replaceChildren();
  if (!content) return;
  container.dataset.type = content.type;
  const title = el('h2', {class: 'gl-step-title', text: content.title});
  if (content.type === 'page') {
    const frame = el('div', {class: 'gl-page'});
    if (content.source === 'upload') frame.append(el('img', {src: content.image, alt: content.title}));
    else frame.innerHTML = renderOriginalPage(content.page); // fixed, escaped project content
    container.append(frame);
    return;
  }
  if (content.type === 'interactive') {
    const s = shadow || {};
    const frame = el('div', {class: 'gl-scene'}); frame.innerHTML = renderScene(lessonState(s), {hideShadow: !teacher && s.reveal === false});
    container.append(title, frame);
    const facts = el('p', {class: 'gl-facts'});
    if (teacher || s.reveal !== false) facts.textContent = `ارتفاع الشمس ${formatNumber(lessonState(s).elevation)}° · طول الظل ${formatNumber(lessonState(s).length)} م`;
    else facts.textContent = 'الظل مخفي: توقّع أين سيكون، ثم انتظر الكشف.';
    container.append(facts);
    return;
  }
  if (content.type === 'board') {
    const grid = el('div', {class: 'gl-items'});
    for (const item of content.items) {
      const hidden = teacher && revealed && !revealed.includes(item.id);
      const card = item.kind === 'image'
        ? el('figure', {class: 'gl-item gl-item-image'}, el('img', {src: item.image, alt: item.caption || 'صورة مجهزة'}), item.caption ? el('figcaption', {text: item.caption}) : null)
        : el('div', {class: 'gl-item gl-item-text', text: item.text});
      if (hidden) { card.classList.add('is-hidden'); card.append(el('span', {class: 'gl-badge', text: 'مخفي عن الطلاب'})); }
      grid.append(card);
    }
    if (!content.items.length) grid.append(el('p', {class: 'gl-wait-inline', text: 'سيعرض المعلم العناصر هنا.'}));
    container.append(title, grid);
    return;
  }
  if (content.type === 'questions') {
    container.append(title);
    if (display) container.append(renderDisplay(display));
    else container.append(el('ol', {class: 'gl-qlist'}, content.questions.map(q => el('li', {text: q.prompt}))));
    return;
  }
  if (content.type === 'homework') {
    container.append(title, content.instructions ? el('p', {class: 'gl-lead', text: content.instructions}) : null, el('ol', {class: 'gl-qlist'}, content.questions.map(q => el('li', {text: q.prompt}))));
    return;
  }
  container.append(title, el('p', {class: 'gl-lead', text: 'يقيّم المعلم الطلاب في هذه الخطوة: ' + content.criteria.join('، ') + '.'}));
}

export function renderDisplay(d) {
  const box = el('div', {class: 'gl-display-box'}, el('p', {class: 'gl-prompt', text: d.prompt}));
  if (d.mode === 'summary') {
    const total = d.counts.reduce((a, b) => a + b, 0) || 1;
    box.append(el('ul', {class: 'gl-bars'}, d.options.map((o, i) => {
      const bar = el('span', {class: 'gl-bar'}); bar.style.inlineSize = Math.round(d.counts[i] / total * 100) + '%';
      return el('li', {}, el('span', {class: 'gl-bar-label', text: o}), el('span', {class: 'gl-bar-track'}, bar), el('b', {text: formatNumber(d.counts[i])}));
    })));
  } else if (d.mode === 'correct') {
    box.append(el('ul', {class: 'gl-options'}, d.options.map((o, i) => el('li', {class: i === d.answer ? 'is-correct' : '', text: (i === d.answer ? '✓ ' : '') + o}))));
  } else {
    box.append(el('blockquote', {class: 'gl-spotlight', text: d.answer ?? 'لم يُجب هذا الطالب بعد.'}), el('p', {class: 'gl-who', text: d.name ? 'إجابة ' + d.name : 'إجابة أحد الطلاب'}));
  }
  return box;
}

// ---- narration ----
let audio = null;
export function stopNarration() { audio?.pause(); audio = null; if ('speechSynthesis' in window) speechSynthesis.cancel(); }
/** Plays recorded audio or Arabic device speech. Resolves false when the browser blocked it or no Arabic voice exists. */
export async function playNarration(n) {
  stopNarration();
  if (n.mode === 'recorded') {
    audio = new Audio(n.audio);
    try { await audio.play(); return true; } catch { return false; }
  }
  if (n.mode === 'speech') {
    if (!('speechSynthesis' in window)) return false;
    const voices = speechSynthesis.getVoices(), arabic = voices.find(v => v.lang?.toLowerCase().startsWith('ar'));
    const u = new SpeechSynthesisUtterance(n.text); u.lang = arabic?.lang || 'ar-SA'; if (arabic) u.voice = arabic;
    speechSynthesis.speak(u);
    return voices.length === 0 || Boolean(arabic);
  }
  return false;
}
