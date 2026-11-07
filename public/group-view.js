// Shared rendering for the group lesson board (teacher console, display screen and student seat).
import {renderOriginalPage, boardLayout} from './group-plan.js';
import {formatNumber} from './science-shadow-model.js';
import {activityOf, tweenValues} from './activities.js';
import {TOOLS, TEXT_SIZES, smoothPath, straightPath, cameraTransform, wrapText} from './group-ink.js';
import {STAMPS} from './tool-library.js';

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
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function animateScene(frame, id, from, to, hide) {
  cancelAnimationFrame(frame._raf);
  const a = activityOf(id), start = performance.now(), duration = reduceMotion() ? 0 : 1600;
  const tick = now => {
    const t = duration ? Math.min(1, (now - start) / duration) : 1, ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    frame.innerHTML = a.render(tweenValues(id, from, to, t < 1 ? ease : 1), {hidden: hide});
    if (t < 1) frame._raf = requestAnimationFrame(tick); else frame._values = to;
  };
  frame._raf = requestAnimationFrame(tick);
}

// ---- narrator: an original speaking character with captions; it never covers the board's tools ----
const NARRATOR_SVG = `<svg viewBox="0 0 120 120" aria-hidden="true" class="gl-avatar-svg"><defs><radialGradient id="glav" cx="40%" cy="35%"><stop offset="0" stop-color="#ffe58a"/><stop offset="1" stop-color="#f2a93b"/></radialGradient></defs>
<g class="gl-rays" stroke="#f2a93b" stroke-width="6" stroke-linecap="round">${Array.from({length: 10}, (_, i) => { const a = i * Math.PI / 5, r1 = 46, r2 = 57; return `<line x1="${(60 + r1 * Math.cos(a)).toFixed(1)}" y1="${(60 + r1 * Math.sin(a)).toFixed(1)}" x2="${(60 + r2 * Math.cos(a)).toFixed(1)}" y2="${(60 + r2 * Math.sin(a)).toFixed(1)}"/>`; }).join('')}</g>
<circle cx="60" cy="60" r="40" fill="url(#glav)" stroke="#d98a1c" stroke-width="2"/>
<g class="gl-eyes" fill="#4a2a05"><ellipse cx="46" cy="54" rx="4.5" ry="6"/><ellipse cx="74" cy="54" rx="4.5" ry="6"/></g>
<circle cx="38" cy="68" r="5" fill="#ff9d7a" opacity=".6"/><circle cx="82" cy="68" r="5" fill="#ff9d7a" opacity=".6"/>
<ellipse class="gl-mouth" cx="60" cy="74" rx="11" ry="4" fill="#7a2e12"/></svg>`;
export function renderNarrator(board, info) {
  // Shown in its own strip under the board, so it never covers the lesson content.
  let box = board.parentElement.querySelector(':scope > .gl-narrator');
  if (!info) { box?.remove(); return null; }
  if (!box) {
    box = el('div', {class: 'gl-narrator', role: 'status', 'aria-live': 'polite'});
    const avatar = el('div', {class: 'gl-avatar'}); avatar.innerHTML = NARRATOR_SVG;
    box.append(avatar, el('div', {class: 'gl-bubble'}, el('p', {class: 'gl-caption'}), el('small', {class: 'gl-seg'})));
    board.after(box);
  }
  box.querySelector('.gl-caption').textContent = info.text;
  box.querySelector('.gl-seg').textContent = `${formatNumber(info.segment + 1)} / ${formatNumber(info.total)}${info.muted ? ' · الصوت مكتوم' : ''}`;
  box.classList.toggle('is-muted', Boolean(info.muted));
  return box;
}
export function setSpeaking(board, on) { board.parentElement.querySelector(':scope > .gl-narrator')?.classList.toggle('is-speaking', on); }

export function renderInk(svg, items = []) {
  const markers = document.createElementNS(SVG, 'g'), ink = document.createElementNS(SVG, 'g');
  markers.setAttribute('class', 'gl-markers');
  // Reuse the drawing of every line that did not change, so a busy board redraws instantly on each update.
  const old = svg.__inkNodes || new Map(), next = new Map();
  for (const item of items) {
    const sig = JSON.stringify(item), had = item.id && old.get(item.id);
    const node = had && had.sig === sig ? had.node : inkNode(item);
    node.classList.remove('is-pending', 'is-erasing', 'is-moving'); node.removeAttribute('transform');
    if (item.kind === 'stamp') node.setAttribute('transform', `translate(${item.x} ${item.y})`);
    if (item.id) next.set(item.id, {sig, node});
    (item.tool === 'marker' ? markers : ink).append(node);
  }
  svg.__inkNodes = next;
  // a live line from the teacher is replaced by the finished stroke once it arrives
  for (const n of svg.querySelectorAll(':scope > .gl-live-remote.is-done')) n.remove();
  // Keep a stroke that is being drawn right now when a live update redraws the board.
  svg.replaceChildren(markers, ink, ...svg.querySelectorAll(':scope > .is-live, :scope > .gl-laser, :scope > .gl-live-remote'));
}

/** The teacher's writing as it happens (students and the display): the line grows with each small batch of points. */
export function liveInk(svg, {ink: k, p}) {
  if (!svg || !k) return;
  let n = svg.querySelector(`:scope > .gl-live-remote[data-g="${k.g}"]`);
  // batches may arrive out of order: each one knows where its points belong in the line
  if (k.replace && n && n.__at > k.at) return;
  let raw;
  if (k.replace) raw = p;
  else { raw = (n?.__points || []).slice(); p.forEach((q, i) => { raw[k.at + i] = q; }); }
  const points = raw.filter(Boolean);
  if (points.length) {
    const fresh = inkNode({kind: 'stroke', tool: k.tool, size: k.size, color: k.color, points: points.length === 1 ? [points[0], points[0]] : points});
    fresh.classList.add('gl-live-remote'); fresh.dataset.g = k.g; fresh.__points = raw; fresh.__at = k.at;
    if (n) n.replaceWith(fresh); else svg.append(fresh);
    n = fresh;
  }
  if (n) { clearTimeout(n.__gone); n.__gone = setTimeout(() => n.remove(), k.end ? 2500 : 6000); if (k.end) n.classList.add('is-done'); }
}
export function inkNode(item) {
  if (item.kind === 'stamp') return stampNode(item);
  if (item.kind === 'text') {
    const t = document.createElementNS(SVG, 'text');
    t.setAttribute('x', item.x); t.setAttribute('y', item.y); t.setAttribute('fill', item.color);
    t.setAttribute('font-size', TEXT_SIZES[item.size] || TEXT_SIZES.m); t.setAttribute('class', 'gl-text');
    t.setAttribute('direction', 'rtl'); t.setAttribute('text-anchor', 'start'); t.setAttribute('dominant-baseline', 'hanging');
    if (item.id) t.dataset.id = item.id;
    const size = TEXT_SIZES[item.size] || TEXT_SIZES.m, lines = wrapText(item.text, item.size);
    if (lines.length === 1) t.textContent = item.text;
    else lines.forEach((line, i) => { const span = document.createElementNS(SVG, 'tspan'); span.setAttribute('x', item.x); if (i) span.setAttribute('dy', Math.round(size * 1.35)); span.textContent = line; t.append(span); });
    return t;
  }
  const tool = TOOLS[item.tool] || TOOLS.pen, path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', ['rect', 'line', 'arrow'].includes(item.tool) ? straightPath(item.points) : smoothPath(item.points)); path.setAttribute('stroke', item.color);
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
export function renderStep(container, content, {teacher = false, revealed = null, shadow = null, display = null, places = {}} = {}) {
  if (!content) { container.replaceChildren(); delete container.dataset.step; return; }
  const title = el('h2', {class: 'gl-step-title', text: content.title});
  if (content.type !== 'interactive') { container.replaceChildren(); delete container.dataset.step; }
  container.dataset.type = content.type;
  if (content.type === 'page') {
    const frame = el('div', {class: 'gl-page'});
    if (content.source === 'upload') frame.append(el('img', {src: content.image, alt: content.title}));
    else if (content.source === 'book') frame.append(el('div', {class: 'gl-book-wait'}, el('b', {text: '📖 ' + content.title}), el('p', {text: `صفحة ${content.page} من كتاب الوزارة — تظهر هنا عندما يعرضها المعلم.`})));
    else frame.innerHTML = renderOriginalPage(content.page); // fixed, escaped project content
    container.append(frame);
    return;
  }
  if (content.type === 'interactive') {
    // `act` is {id, values, reveal}; the activity registry knows how to draw and animate it.
    const act = shadow || {id: content.activity, values: activityOf(content.activity).initial(), reveal: true};
    const a = activityOf(act.id || content.activity), hide = !teacher && act.reveal === false;
    const old = container.dataset.step === content.id ? container.querySelector('.gl-scene') : null;
    if (old && old._hide === hide) {
      animateScene(old, a.id, old._values || act.values, act.values, hide);
      const facts = container.querySelector('.gl-facts');
      if (facts) facts.textContent = a.facts(act.values, hide);
      return;
    }
    container.replaceChildren(); container.dataset.type = 'interactive'; container.dataset.step = content.id;
    const frame = el('div', {class: 'gl-scene'}); frame.innerHTML = a.render(act.values, {hidden: hide}); frame._values = act.values; frame._hide = hide;
    container.append(title, frame, el('p', {class: 'gl-facts', text: a.facts(act.values, hide)}));
    return;
  }
  if (content.type === 'board') {
    // Every card sits in its planned place (or the teacher's live drag); hidden ones appear there, one after another.
    const layout = boardLayout(content.items);
    container.append(title);
    content.items.forEach((item, i) => {
      const hidden = teacher && revealed && !revealed.includes(item.id);
      const card = item.kind === 'image'
        ? el('figure', {class: 'gl-item gl-item-image'}, el('img', {src: item.image, alt: item.caption || 'صورة مجهزة'}), item.caption ? el('figcaption', {text: item.caption}) : null)
        : el('div', {class: 'gl-item gl-item-text', text: item.text});
      if (hidden) { card.classList.add('is-hidden'); card.append(el('span', {class: 'gl-badge', text: 'لم يظهر بعد'})); }
      card.dataset.item = item.id;
      if (teacher) card.prepend(el('b', {class: 'gl-card-num', text: formatNumber(i + 1), 'aria-hidden': 'true'})); // the order the teacher prepared
      const at = {...(item.place || layout[item.id]), ...(places?.[item.id] || {})};
      card.classList.add('is-placed', at.w === 'full' ? 'is-full' : 'is-half');
      card.style.left = at.x / 10 + '%'; card.style.top = at.y / 6 + '%';
      container.append(card);
    });
    if (!content.items.length) container.append(el('p', {class: 'gl-wait-inline', text: 'سيعرض المعلم النصوص هنا.'}));
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
let speakingId = null;
export function stopNarration() { audio?.pause(); audio = null; speakingId = null; window.App?.stopSpeaking?.(); if ('speechSynthesis' in window) speechSynthesis.cancel(); }
/** Plays recorded audio or Arabic device speech. Resolves false when the browser blocked it or no Arabic voice exists. */
export async function playNarration(n, {onEnd = () => {}} = {}) {
  stopNarration();
  if (n.mode === 'recorded') {
    const a = audio = new Audio(n.audio); a.onended = a.onerror = () => onEnd();
    try { await a.play(); return true; } catch { onEnd(); return false; }
  }
  if (n.mode === 'speech' && n.url) {
    // A natural voice made on the server (man or woman, as the teacher chose); without one, the device's voice below.
    const a = audio = new Audio(n.url); let ended = false; a.onended = () => { if (!ended) { ended = true; onEnd(); } };
    try { await a.play(); return true; }
    catch { if (audio === a) audio = null; return playNarration({mode: 'speech', text: n.text}, {onEnd}); }
  }
  if (n.mode === 'speech') {
    // Inside the Android app the page cannot speak; the app reads the text aloud with the phone's Arabic voice.
    if (window.App?.speak) {
      const id = 'n' + Date.now() + Math.random().toString(36).slice(2, 6);
      speakingId = id; window.__appSpeechDone = done => { if (done === speakingId) { speakingId = null; onEnd(); } };
      if (window.App.speak(n.text, id)) return true;
      speakingId = null; onEnd(); return false;
    }
    if (!('speechSynthesis' in window)) { onEnd(); return false; }
    const voices = speechSynthesis.getVoices(), arabic = voices.find(v => v.lang?.toLowerCase().startsWith('ar'));
    if (voices.length && !arabic) { onEnd(); return false; }
    const u = new SpeechSynthesisUtterance(n.text); u.lang = arabic?.lang || 'ar-SA'; if (arabic) u.voice = arabic;
    u.onend = u.onerror = () => onEnd();
    speechSynthesis.speak(u);
    return true;
  }
  onEnd(); return false;
}

// Board content is laid out at 1000×600 (like the ink) and scaled to the board, so a lesson looks the same on a
// phone, a laptop and a smart board, and nothing is cut off on small screens.
const boardEl = typeof document !== 'undefined' && document.getElementById('gl-board');
if (boardEl && 'ResizeObserver' in window) {
  const fit = () => { const w = boardEl.clientWidth; if (w) boardEl.style.setProperty('--k', String(w / 1000)); };
  new ResizeObserver(fit).observe(boardEl); fit();
}

/** Where the natural voice of a step's explanation (or of one narrator segment) is fetched from. */
export function speechUrl(base, stepId, segment, speaker) {
  return `${base}/speech?step=${encodeURIComponent(stepId)}${segment === undefined || segment === null ? '' : '&segment=' + segment}&v=${speaker || 'male'}`;
}

/** The laser pointer: a red trail that fades within a second; it is never stored. */
export function laserTrail(svg, points, start = false) {
  if (!svg || !points.length) return;
  let g = svg.querySelector(':scope > .gl-laser'); if (!g) { g = document.createElementNS(SVG, 'g'); g.setAttribute('class', 'gl-laser'); svg.append(g); }
  const last = start ? null : g.__last, all = last ? [last, ...points] : points;
  g.__last = points[points.length - 1];
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', all.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ') + (all.length === 1 ? ' l0.1 0' : ''));
  path.setAttribute('class', 'gl-laser-line'); g.append(path);
  const dot = g.querySelector('.gl-laser-dot') || g.appendChild(Object.assign(document.createElementNS(SVG, 'circle'), {}));
  dot.setAttribute('class', 'gl-laser-dot'); dot.setAttribute('r', 9); dot.setAttribute('cx', g.__last[0]); dot.setAttribute('cy', g.__last[1]); g.append(dot);
  clearTimeout(g.__hide); g.__hide = setTimeout(() => dot.remove(), 1200);
  setTimeout(() => path.remove(), 1100);
}

/** A tool from «مكتبة الأدوات» laid on the board (ruler, number line, clock…); moved and erased like ink. */
function stampNode(item) {
  const g = document.createElementNS(SVG, 'g'), add = (tag, attrs, text) => { const n = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (text !== undefined) n.textContent = text; g.append(n); return n; };
  g.setAttribute('class', 'gl-stamp gl-stamp-' + item.name); g.setAttribute('transform', `translate(${item.x} ${item.y})`);
  if (item.id) g.dataset.id = item.id;
  STAMPS[item.name]?.draw(add);
  return g;
}

/** ⏱ the timer chip and 🎭 the curtain, on every screen of the class. */
let timerTick = 0;
export function renderExtras(board, view, {teacher = false} = {}) {
  if (!board) return;
  const stage = board.parentElement;
  let chip = stage.querySelector(':scope > .gl-timer');
  clearInterval(timerTick);
  if (view.timer) {
    if (!chip) { chip = el('div', {class: 'gl-timer', role: 'timer', 'aria-live': 'off'}); stage.append(chip); }
    const ends = Date.now() + view.timer.remaining;
    const tick = () => {
      const left = Math.max(0, Math.round((ends - Date.now()) / 1000));
      chip.textContent = left ? `⏱ ${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}` : '⏰ انتهى الوقت';
      chip.classList.toggle('is-done', !left); chip.classList.toggle('is-low', left > 0 && left <= 10);
      if (!left) clearInterval(timerTick);
    };
    tick(); timerTick = setInterval(tick, 500);
  } else chip?.remove();
  let cur = board.querySelector(':scope > .gl-curtain');
  if (view.curtain) {
    if (!cur) { cur = el('div', {class: 'gl-curtain', 'aria-label': 'ستارة'}, el('span', {text: '🎭'})); board.append(cur); }
    cur.classList.toggle('is-teacher', teacher); cur.style.height = view.curtain + '%';
  } else cur?.remove();
}
