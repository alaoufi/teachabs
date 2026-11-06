// Board interaction: drawing tools, typed text, eraser, moving text, and smooth zoom/pan (pinch, wheel, hand, buttons).
// mode 'teacher' sends ink and camera to the class; mode 'viewer' only zooms locally (students) or follows (display).
import {TOOLS, TEXT_SIZES, BOARD, clampCamera, zoomAround, LIMITS} from './group-ink.js';
import {inkNode, applyCamera} from './group-view.js';

export function attachBoardTools({mode, send = () => {}, items = () => [], canInk = () => false, onStatus = () => {}, onNext, onPrev, onUndo}) {
  const $ = id => document.getElementById(id);
  const board = $('gl-board'), camera = $('gl-camera'), ink = $('gl-ink'), teacher = mode === 'teacher';
  const state = {tool: 'select', color: '#173e34', size: 'm', camera: {z: 1, x: 0, y: 0}, remote: {z: 1, x: 0, y: 0}, following: true, lastLocal: 0, pendingText: null};
  const pointers = new Map();
  let gesture = null, cameraTimer = 0, spaceDown = false;

  // ---- coordinates ----
  const unrotatedRect = () => board.getBoundingClientRect();
  const toBoard = e => { const r = ink.getBoundingClientRect(); return [Math.max(0, Math.min(BOARD.width, (e.clientX - r.left) / r.width * BOARD.width)), Math.max(0, Math.min(BOARD.height, (e.clientY - r.top) / r.height * BOARD.height))]; };
  const unitsPerPixel = () => BOARD.width / unrotatedRect().width / state.camera.z;

  // ---- camera ----
  function setCamera(c, {animate = false, share = true} = {}) {
    state.camera = clampCamera(c);
    applyCamera(camera, state.camera, {animate});
    board.classList.toggle('is-zoomed', state.camera.z > 1);
    if (teacher && share) {
      state.lastLocal = Date.now();
      clearTimeout(cameraTimer);
      cameraTimer = setTimeout(() => send({op: 'camera', ...state.camera}), 120);
    }
    if (!teacher && mode === 'viewer' && share) { state.following = false; followButton(); }
  }
  function followButton() { const b = board.parentElement.querySelector('[data-zoom=follow]'); if (b) b.hidden = state.following; }
  /** Called with the teacher's camera from each live update. */
  function remoteCamera(c) {
    state.remote = clampCamera(c || {});
    if (teacher && Date.now() - state.lastLocal < 900) return;
    if (!teacher && !state.following) return;
    state.camera = state.remote; applyCamera(camera, state.camera, {animate: true}); board.classList.toggle('is-zoomed', state.camera.z > 1);
  }
  const zoomBy = (factor, center) => {
    const [px, py] = center || [state.camera.x + BOARD.width / state.camera.z / 2, state.camera.y + BOARD.height / state.camera.z / 2];
    setCamera(zoomAround(state.camera, factor, px, py), {animate: true});
  };
  for (const b of board.parentElement.querySelectorAll('[data-zoom]')) b.addEventListener('click', () => {
    const z = b.dataset.zoom;
    if (z === 'in') zoomBy(1.4); else if (z === 'out') zoomBy(1 / 1.4);
    else if (z === 'fit') setCamera({z: 1, x: 0, y: 0}, {animate: true});
    else if (z === 'max') {
      const stage = board.parentElement, on = !stage.classList.contains('is-max');
      stage.classList.toggle('is-max', on); document.documentElement.classList.toggle('gl-noscroll', on);
      b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '✕' : '⛶'; b.title = on ? 'إغلاق ملء الشاشة' : 'السبورة بملء الشاشة';
    }
    else { state.following = true; followButton(); state.camera = state.remote; applyCamera(camera, state.camera, {animate: true}); }
  });
  board.addEventListener('wheel', e => {
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomBy(Math.exp(-e.deltaY * 0.0025), toBoard(e)); return; }
    if (state.camera.z > 1) { e.preventDefault(); const u = unitsPerPixel(); setCamera({...state.camera, x: state.camera.x + e.deltaX * u, y: state.camera.y + e.deltaY * u}); }
  }, {passive: false});

  // ---- tool selection ----
  function setTool(tool) {
    if (!teacher) return;
    state.tool = tool; state.pendingText = tool === 'text' ? state.pendingText : null;
    for (const b of document.querySelectorAll('.gl-tool')) b.setAttribute('aria-pressed', String(b.dataset.tool === tool));
    board.dataset.tool = tool;
    if (tool !== 'text') closeTextbox();
  }
  if (teacher) {
    for (const b of document.querySelectorAll('.gl-tool')) b.addEventListener('click', () => setTool(b.dataset.tool));
    for (const b of document.querySelectorAll('.gl-color')) b.addEventListener('click', () => {
      state.color = b.dataset.color; for (const x of document.querySelectorAll('.gl-color')) x.setAttribute('aria-pressed', String(x === b));
      if (['select', 'hand', 'eraser'].includes(state.tool)) setTool('pen');
    });
    for (const b of document.querySelectorAll('.gl-size')) b.addEventListener('click', () => { state.size = b.dataset.size; for (const x of document.querySelectorAll('.gl-size')) x.setAttribute('aria-pressed', String(x === b)); });
  }

  // ---- typed text ----
  const textbox = $('gl-textbox'), input = $('gl-textinput');
  let textAt = null;
  function openTextbox(e, point) {
    textAt = point; textbox.hidden = false;
    const stage = textbox.parentElement.getBoundingClientRect();
    textbox.style.insetInlineStart = 'auto';
    textbox.style.left = Math.max(0, Math.min(stage.width - 280, e.clientX - stage.left - 140)) + 'px';
    textbox.style.top = Math.max(0, e.clientY - stage.top + 8) + 'px';
    input.value = ''; input.focus();
  }
  function closeTextbox() { if (textbox) { textbox.hidden = true; textAt = null; } }
  function placeText(text, point) {
    if (!text.trim()) return;
    const temp = inkNode({kind: 'text', text, color: state.color, size: state.size, x: point[0], y: point[1]}); temp.classList.add('is-pending'); ink.append(temp);
    send({op: 'text', text, x: point[0], y: point[1], color: state.color, size: state.size});
  }
  if (teacher) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); if (textAt) placeText(input.value, textAt); closeTextbox(); }
      if (e.key === 'Escape') closeTextbox();
    });
    $('gl-textok').addEventListener('click', () => { if (textAt) placeText(input.value, textAt); closeTextbox(); });
    $('gl-textcancel').addEventListener('click', closeTextbox);
  }
  /** A prepared text chosen from the step's list is placed with the next tap on the board. */
  function prepareSnippet(text) { setTool('text'); state.pendingText = text; onStatus('اضغط مكان النص على السبورة لوضعه: «' + text + '»'); }

  // ---- hit testing ----
  function hit(point) {
    const tol = 14 / state.camera.z;
    const list = items();
    for (let i = list.length - 1; i >= 0; i--) {
      const it = list[i];
      if (it.kind === 'text') {
        const node = ink.querySelector(`[data-id="${it.id}"]`); if (!node) continue;
        const b = node.getBBox(); if (point[0] >= b.x - tol && point[0] <= b.x + b.width + tol && point[1] >= b.y - tol && point[1] <= b.y + b.height + tol) return it;
      } else {
        const w = ((TOOLS[it.tool] || TOOLS.pen).widths[it.size] || 4) / 2 + tol;
        for (let j = 0; j < it.points.length - 1; j++) if (segmentDistance(point, it.points[j], it.points[j + 1]) <= w) return it;
      }
    }
    return null;
  }
  const erased = new Set();
  function eraseAt(point) {
    const it = hit(point);
    if (it && !erased.has(it.id)) { erased.add(it.id); ink.querySelector(`[data-id="${it.id}"]`)?.classList.add('is-erasing'); send({op: 'erase', id: it.id}); }
  }

  // ---- pointer handling ----
  board.addEventListener('pointerdown', e => {
    if (e.target.closest('.gl-zoom, .gl-textbox')) return;
    pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (pointers.size === 2) { startPinch(); return; }
    if (pointers.size > 2) return;
    const point = toBoard(e), tool = spaceDown || e.button === 1 ? 'hand' : (teacher ? state.tool : 'hand');
    const inking = teacher && canInk();
    if (!teacher && state.camera.z <= 1) return; // let the page scroll when not zoomed
    board.setPointerCapture(e.pointerId);
    if (['pen', 'brush', 'marker'].includes(tool) && inking) {
      e.preventDefault();
      const live = inkNode({kind: 'stroke', tool, size: state.size, color: state.color, points: [point]});
      live.classList.add('is-live'); ink.append(live); gesture = {type: 'draw', tool, points: [point], live};
    } else if (tool === 'text' && inking) {
      e.preventDefault();
      if (state.pendingText) { placeText(state.pendingText, point); state.pendingText = null; onStatus('وُضع النص الجاهز.'); }
      else openTextbox(e, point);
    } else if (tool === 'eraser' && inking) { e.preventDefault(); erased.clear(); gesture = {type: 'erase'}; eraseAt(point); }
    else if (tool === 'select' && inking && hit(point)) {
      // Move any drawn line or typed text: preview with a transform, send the offset once on release.
      e.preventDefault(); const it = hit(point), node = ink.querySelector(`[data-id="${it.id}"]`);
      node?.classList.add('is-moving'); gesture = {type: 'move', it, node, start: point};
    } else if (tool === 'select' && teacher && e.target.closest('.gl-item[data-item]')) {
      // Prepared board cards can be dragged anywhere on the board.
      e.preventDefault(); const card = e.target.closest('.gl-item[data-item]'), r = card.getBoundingClientRect(), ir = ink.getBoundingClientRect();
      const origin = [(r.left - ir.left) / ir.width * BOARD.width, (r.top - ir.top) / ir.height * BOARD.height];
      card.classList.add('is-dragging'); gesture = {type: 'card', card, start: point, origin, width: r.width / ir.width * 100};
    } else if (state.camera.z > 1 || tool === 'hand') {
      e.preventDefault(); gesture = {type: 'pan', last: {x: e.clientX, y: e.clientY}}; board.classList.add('is-panning');
    }
  });
  board.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (gesture?.type === 'pinch') return movePinch();
    if (!gesture) return;
    if (gesture.type === 'draw') {
      const events = e.getCoalescedEvents?.() || [e];
      for (const ev of events) {
        const p = toBoard(ev), last = gesture.points[gesture.points.length - 1];
        if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 1.5 / state.camera.z || gesture.points.length >= LIMITS.points) continue;
        gesture.points.push(p);
      }
      const next = inkNode({kind: 'stroke', tool: gesture.tool, size: state.size, color: state.color, points: gesture.points}); next.classList.add('is-live');
      if (gesture.live.isConnected) gesture.live.replaceWith(next); else ink.append(next);
      gesture.live = next;
    } else if (gesture.type === 'erase') eraseAt(toBoard(e));
    else if (gesture.type === 'move') {
      const p = toBoard(e); gesture.d = [p[0] - gesture.start[0], p[1] - gesture.start[1]];
      gesture.node?.setAttribute('transform', `translate(${gesture.d[0].toFixed(1)} ${gesture.d[1].toFixed(1)})`);
    } else if (gesture.type === 'card') {
      const p = toBoard(e), c = gesture.card;
      gesture.to = [Math.max(0, Math.min(BOARD.width - 40, gesture.origin[0] + p[0] - gesture.start[0])), Math.max(0, Math.min(BOARD.height - 30, gesture.origin[1] + p[1] - gesture.start[1]))];
      if (!c.classList.contains('is-placed')) { c.classList.add('is-placed'); c.style.inlineSize = gesture.width + '%'; }
      c.style.left = gesture.to[0] / 10 + '%'; c.style.top = gesture.to[1] / 6 + '%'; c.style.right = 'auto';
    } else if (gesture.type === 'pan') {
      const u = unitsPerPixel();
      setCamera({...state.camera, x: state.camera.x - (e.clientX - gesture.last.x) * u, y: state.camera.y - (e.clientY - gesture.last.y) * u});
      gesture.last = {x: e.clientX, y: e.clientY};
    }
  });
  function end(e) {
    pointers.delete(e.pointerId);
    if (gesture?.type === 'pinch') { if (pointers.size < 2) gesture = null; return; }
    const g = gesture; gesture = null; board.classList.remove('is-panning');
    if (!g) return;
    if (g.type === 'draw') { g.live.classList.remove('is-live'); if (g.points.length >= 2) { g.live.classList.add('is-pending'); send({op: 'stroke', tool: g.tool, size: state.size, color: state.color, points: g.points}); } else g.live.remove(); }
    if (g.type === 'move') { g.node?.classList.remove('is-moving'); if (g.d && Math.hypot(...g.d) > 0.5) send({op: 'move', id: g.it.id, dx: Math.round(g.d[0] * 10) / 10, dy: Math.round(g.d[1] * 10) / 10}); }
    if (g.type === 'card') { g.card.classList.remove('is-dragging'); if (g.to) send({op: 'place', item: g.card.dataset.item, x: g.to[0], y: g.to[1]}); }
  }
  board.addEventListener('pointerup', end); board.addEventListener('pointercancel', end);

  function startPinch() {
    if (gesture?.type === 'draw') gesture.live.remove();
    const [a, b] = [...pointers.values()];
    gesture = {type: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), mid: {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}};
  }
  function movePinch() {
    const [a, b] = [...pointers.values()]; if (!b) return;
    const dist = Math.hypot(a.x - b.x, a.y - b.y), mid = {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2};
    const u = unitsPerPixel();
    let c = {...state.camera, x: state.camera.x - (mid.x - gesture.mid.x) * u, y: state.camera.y - (mid.y - gesture.mid.y) * u};
    c = zoomAround(clampCamera(c), dist / gesture.dist, ...toBoard({clientX: mid.x, clientY: mid.y}));
    setCamera(c); gesture.dist = dist; gesture.mid = mid;
  }

  // ---- keyboard ----
  if (teacher) {
    const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    document.addEventListener('keydown', e => {
      if (e.key === ' ' && !typing()) { spaceDown = true; board.classList.add('is-space'); if (e.target === document.body) e.preventDefault(); }
      if (typing()) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); onUndo?.(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      const tools = {v: 'select', h: 'hand', p: 'pen', b: 'brush', m: 'marker', t: 'text', e: 'eraser'};
      if (tools[key]) { setTool(tools[key]); return; }
      if (key === '+' || key === '=') zoomBy(1.4); else if (key === '-') zoomBy(1 / 1.4); else if (key === '0') setCamera({z: 1, x: 0, y: 0}, {animate: true});
      else if (e.key === 'PageDown' || e.key === 'ArrowLeft') { e.preventDefault(); onNext?.(); }
      else if (e.key === 'PageUp' || e.key === 'ArrowRight') { e.preventDefault(); onPrev?.(); }
      else if (e.key === 'Escape') { closeTextbox(); state.pendingText = null; setTool('select'); }
    });
    document.addEventListener('keyup', e => { if (e.key === ' ') { spaceDown = false; board.classList.remove('is-space'); } });
  }

  if (teacher) setTool('select');
  return {remoteCamera, prepareSnippet, setTool, resetForStep() { closeTextbox(); state.pendingText = null; gesture = null; pointers.clear(); }, get tool() { return state.tool; }};
}

function segmentDistance(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
