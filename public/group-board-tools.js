// Board interaction: drawing tools, typed text, eraser, moving text, and smooth zoom/pan (pinch, wheel, hand, buttons).
// mode 'teacher' sends ink and camera to the class; mode 'viewer' only zooms locally (students) or follows (display).
import {TOOLS, TEXT_SIZES, BOARD, clampCamera, zoomAround, LIMITS, shapePoints} from './group-ink.js';
import {inkNode, applyCamera, laserTrail} from './group-view.js';
import {settle} from './motion.js';

export function attachBoardTools({mode, send = () => {}, items = () => [], canInk = () => false, onStatus = () => {}, onNext, onPrev, onUndo, onLaser = () => {}, onLiveInk = () => {}}) {
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
    for (const b of document.querySelectorAll('.gl-tool')) b.addEventListener('click', () => { setTool(b.dataset.tool); if (b.dataset.tool === 'text') openDocked(); });
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
  function closeTextbox() { if (textbox) { textbox.hidden = true; textAt = null; textbox.classList.remove('is-docked'); } }
  /** «كتابة» opens a large box under the board at once; the text goes on the next free line unless a spot is tapped. */
  function openDocked() { textAt = null; textbox.hidden = false; textbox.classList.add('is-docked'); textbox.style.left = ''; textbox.style.top = ''; input.value = ''; input.focus(); }
  function placeText(text, point) {
    if (!text.trim()) return;
    const temp = inkNode({kind: 'text', text, color: state.color, size: state.size, x: point[0], y: point[1]}); temp.classList.add('is-pending'); ink.append(temp);
    send({op: 'text', text, x: point[0], y: point[1], color: state.color, size: state.size});
  }
  if (teacher) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); if (textAt) placeText(input.value, textAt); else placeNow(input.value); closeTextbox(); }
      if (e.key === 'Escape') closeTextbox();
    });
    $('gl-textok').addEventListener('click', () => { if (textAt) placeText(input.value, textAt); else placeNow(input.value); closeTextbox(); });
    $('gl-textcancel').addEventListener('click', closeTextbox);
  }
  /** Where a new text goes without a tap: the first free place in what is visible, in tidy rows filled from the right — never on top of another text. */
  function nextLine(text) {
    const c = state.camera, z = c.z || 1, size = TEXT_SIZES[state.size] || 32, pad = 18 / z, gap = 8 / z;
    const left = c.x, top = c.y, right = c.x + BOARD.width / z, bottom = c.y + BOARD.height / z;
    const probe = inkNode({kind: 'text', text: text || 'ـ', color: state.color, size: state.size, x: 0, y: 0});
    probe.style.visibility = 'hidden'; ink.append(probe);
    let m; try { m = probe.getBBox(); } catch { m = null; } probe.remove();
    if (!m || !m.width) m = {x: -size * 6, y: -size, width: size * 6, height: size * 1.3};
    const texts = [...ink.querySelectorAll('text')].map(t => { try { return t.getBBox(); } catch { return null; } }).filter(b => b && b.width);
    const x0 = Math.min(BOARD.width - 10, right - pad), y0 = top + pad - m.y;
    const row = m.height + gap * 1.5, step = 4 / z; // tidy rows, one under the other, filled from the right
    const search = boxes => {
      const free = (x, y) => { const a = {x: x + m.x, y: y + m.y, r: x + m.x + m.width, b: y + m.y + m.height};
        return boxes.every(b => a.r + gap * 3 <= b.x || a.x >= b.x + b.width + gap * 3 || a.b + gap <= b.y || a.y >= b.y + b.height + gap); };
      for (let y = y0; y + m.y + m.height <= bottom - pad + 1; y += row)
        for (let x = x0; x + m.x >= left + pad - 1; x -= step) if (free(x, y)) return [Math.round(x), Math.round(y)];
      return null;
    };
    // first around what the screen shows; if a picture fills it all, over the picture — but never on another text
    const spot = search([...texts, ...contentBoxes()]) || search(texts); if (spot) return spot;
    return [x0, Math.round(y0)]; // the visible area is full: the teacher can wipe it or drag
  }
  /** What the lesson screen already shows under the ink (its lines of text, pictures, cards), in board units. */
  function contentBoxes() {
    const content = document.getElementById('gl-content'), m = ink.getScreenCTM?.(); if (!content || !m) return [];
    const inv = m.inverse(), pt = (x, y) => new DOMPoint(x, y).matrixTransform(inv), out = [];
    const add = r => { if (!r.width || !r.height) return; const a = pt(r.left, r.top), b = pt(r.right, r.bottom); out.push({x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y)}); };
    const walk = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, {acceptNode: n => n.data.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT});
    const range = document.createRange();
    for (let n; (n = walk.nextNode());) { if (n.parentElement.closest('svg')) continue; range.selectNodeContents(n); for (const r of range.getClientRects()) add(r); }
    for (const e of content.querySelectorAll('img, canvas, video')) add(e.getBoundingClientRect());
    for (const svg of content.querySelectorAll('svg')) { // inside a drawing: its words, pictures and shapes — not its background
      if (svg.parentElement.closest('svg')) continue;
      const whole = svg.getBoundingClientRect(), area = whole.width * whole.height;
      for (const e of svg.querySelectorAll('text, image, rect, circle, ellipse, path, polygon, polyline, line, use')) {
        const r = e.getBoundingClientRect(); if (e.tagName === 'text' || r.width * r.height < area * 0.4) add(r);
      }
    }
    return out;
  }
  /** One tap: a prepared or typed text goes straight onto the board; then «تحريك» is ready to drag it. */
  function placeNow(text) {
    if (!text || !text.trim()) return;
    placeText(text, nextLine(text)); setTool('select');
    onStatus('وُضع النص على السبورة. اسحبه بإصبعك لتغيير مكانه.');
  }
  function prepareSnippet(text) { placeNow(text); }

  // ---- hit testing ----
  function hit(point) {
    const tol = 14 / state.camera.z;
    const list = items();
    for (let i = list.length - 1; i >= 0; i--) {
      const it = list[i];
      if (it.kind === 'text' || it.kind === 'stamp') {
        const node = ink.querySelector(`[data-id="${it.id}"]`); if (!node) continue;
        const bb = node.getBBox(), b = it.kind === 'stamp' ? {x: bb.x + it.x, y: bb.y + it.y, width: bb.width, height: bb.height} : bb; // a stamp's box is in its own space
        if (point[0] >= b.x - tol && point[0] <= b.x + b.width + tol && point[1] >= b.y - tol && point[1] <= b.y + b.height + tol) return it;
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

  // laser points go out in small batches (about 14 a second) so the trail looks smooth on the students' screens
  let laserTimer = 0;
  function flushLaser() {
    laserTimer = 0; const g = gesture; if (!g || g.type !== 'laser' || !g.buf.length) return;
    const pts = g.buf.splice(0, 60).map(([x, y]) => [Math.round(Math.min(1000, Math.max(0, x))), Math.round(Math.min(600, Math.max(0, y)))]);
    onLaser(pts, g.start); g.start = false;
  }
  // live writing: the new points of the line go out about 20 times a second, so students see it being written
  let liveTimer = 0, liveSeq = 0;
  function flushLive(end = false) {
    clearTimeout(liveTimer); liveTimer = 0; const g = gesture?.type === 'draw' || gesture?.type === 'shape' ? gesture : end;
    if (!g || !g.g) return;
    const clip = ([x, y]) => [Math.min(1000, Math.max(0, x)), Math.min(600, Math.max(0, y))];
    if (g.type === 'shape') { g.seq = (g.seq || 0) + 1; onLiveInk({ink: {g: g.g, tool: g.tool, size: state.size, color: state.color, replace: true, at: g.seq, end: end !== false}, p: g.points.slice(0, 120).map(clip)}); return; }
    const at = g.sent, fresh = g.points.slice(at, at + 120); g.sent += fresh.length;
    if (fresh.length || end) onLiveInk({ink: {g: g.g, tool: g.tool, size: state.size, color: state.color, at, end: end !== false}, p: fresh.map(clip)});
    if (g.sent < g.points.length && end === false) liveTimer = setTimeout(() => flushLive(false), 50);
  }
  const queueLive = () => { if (!liveTimer) liveTimer = setTimeout(() => flushLive(false), 50); };
  // redraw the line being written once per screen frame, however fast the pen reports points
  let frame = 0;
  function drawLive() {
    frame = 0; const g = gesture; if (!g || (g.type !== 'draw' && g.type !== 'shape')) return;
    const next = inkNode({kind: 'stroke', tool: g.tool, size: state.size, color: state.color, points: g.points}); next.classList.add('is-live');
    if (g.live.isConnected) g.live.replaceWith(next); else ink.append(next);
    g.live = next;
  }
  const queueDraw = () => { if (!frame) frame = requestAnimationFrame(drawLive); };
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
      live.classList.add('is-live'); ink.append(live); gesture = {type: 'draw', tool, points: [point], live, g: (++liveSeq).toString(36) + Math.random().toString(36).slice(2, 7), sent: 0}; queueLive();
    } else if (tool === 'laser' && teacher) {
      // the laser pointer: everyone sees a passing red trail; nothing is stored
      e.preventDefault(); gesture = {type: 'laser', buf: [point], start: true}; laserTrail(ink, [point], true); flushLaser();
    } else if (['rect', 'ellipse', 'line', 'arrow'].includes(tool) && inking) {
      // Drag from one corner to the other: a rectangle or a circle around what needs attention.
      e.preventDefault();
      const live = inkNode({kind: 'stroke', tool, size: state.size, color: state.color, points: [point, point]});
      live.classList.add('is-live'); ink.append(live); gesture = {type: 'shape', tool, start: point, points: [point, point], live, g: (++liveSeq).toString(36) + Math.random().toString(36).slice(2, 7)};
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
      settle(card); card.classList.add('is-dragging'); gesture = {type: 'card', card, start: point, origin, width: r.width / ir.width * 100};
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
      queueDraw(); queueLive();
    } else if (gesture.type === 'laser') {
      const p = toBoard(e); gesture.buf.push(p); laserTrail(ink, [p]);
      if (!laserTimer) laserTimer = setTimeout(flushLaser, 70);
    } else if (gesture.type === 'shape') {
      gesture.end = toBoard(e); gesture.points = shapePoints(gesture.tool, gesture.start, gesture.end);
      queueDraw(); queueLive();
    } else if (gesture.type === 'erase') eraseAt(toBoard(e));
    else if (gesture.type === 'move') {
      const p = toBoard(e); gesture.d = [p[0] - gesture.start[0], p[1] - gesture.start[1]];
      const base = gesture.it.kind === 'stamp' ? [gesture.it.x, gesture.it.y] : [0, 0];
      gesture.node?.setAttribute('transform', `translate(${(base[0] + gesture.d[0]).toFixed(1)} ${(base[1] + gesture.d[1]).toFixed(1)})`);
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
    if (frame) { cancelAnimationFrame(frame); frame = 0; if (g && (g.type === 'draw' || g.type === 'shape')) { gesture = g; drawLive(); gesture = null; } }
    if (g && (g.type === 'draw' || g.type === 'shape')) flushLive(g);
    if (g.type === 'draw') { g.live.classList.remove('is-live'); if (g.points.length >= 2) { g.live.classList.add('is-pending'); send({op: 'stroke', tool: g.tool, size: state.size, color: state.color, points: g.points}); } else g.live.remove(); }
    if (g.type === 'laser') { clearTimeout(laserTimer); laserTimer = 0; gesture = g; flushLaser(); gesture = null; }
    if (g.type === 'shape') { g.live.classList.remove('is-live'); const [a, b] = [g.start, g.end || g.start]; if (Math.abs(b[0] - a[0]) > 6 || Math.abs(b[1] - a[1]) > 6) { g.live.classList.add('is-pending'); send({op: 'stroke', tool: g.tool, size: state.size, color: state.color, points: g.points}); } else g.live.remove(); }
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
      const tools = {v: 'select', h: 'hand', p: 'pen', b: 'brush', m: 'marker', r: 'rect', o: 'ellipse', l: 'line', a: 'arrow', k: 'laser', t: 'text', e: 'eraser'};
      if (tools[key]) { setTool(tools[key]); return; }
      if (key === '+' || key === '=') zoomBy(1.4); else if (key === '-') zoomBy(1 / 1.4); else if (key === '0') setCamera({z: 1, x: 0, y: 0}, {animate: true});
      else if (e.key === 'PageDown' || e.key === 'ArrowLeft') { e.preventDefault(); onNext?.(); }
      else if (e.key === 'PageUp' || e.key === 'ArrowRight') { e.preventDefault(); onPrev?.(); }
      else if (e.key === 'Escape') { closeTextbox(); state.pendingText = null; setTool('select'); }
    });
    document.addEventListener('keyup', e => { if (e.key === ' ') { spaceDown = false; board.classList.remove('is-space'); } });
  }

  if (teacher) setTool('select');
  return {remoteCamera, prepareSnippet, placeNow, openDocked, setTool, resetForStep() { closeTextbox(); state.pendingText = null; gesture = null; pointers.clear(); }, get tool() { return state.tool; }};
}

function segmentDistance(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
