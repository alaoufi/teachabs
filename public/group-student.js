// Student seat and classroom display screen: shows only what the teacher has made visible.
import {publicStep, WORK_MODES} from './group-plan.js';
import {el, renderStep, renderInk, playNarration, stopNarration, renderNarrator, setSpeaking, speechUrl, laserTrail, liveInk, renderExtras} from './group-view.js';
import {speakingMs} from './narrator-scripts.js';
import {attachBoardTools} from './group-board-tools.js';
import {formatNumber} from './science-shadow-model.js';
import {activityOf} from './activities.js';
import {studentVoice} from './group-voice.js';

const app = document.getElementById('gl-app'), code = app.dataset.code, role = app.dataset.role, student = role === 'student';
const $ = x => document.getElementById(x);
const status = (text, bad = false) => { $('gl-status').textContent = text; $('gl-status').classList.toggle('is-error', bad); };
const classBase = '/class/' + code;
let renderKey = '', shownStep = null, lastSegment = 0, speakTimer = 0, wasMuted = false;
const tools = attachBoardTools({mode: 'viewer'});
let view = null, content = null, contentKey = null, homework = null, lastNarration = 0, pendingNarration = null, plan = null;
let explore = null, lastPageKey = '';
const sent = {};

async function getJSON(url) { const r = await fetch(url); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'تعذّر التحميل.'); return d; }
async function stepContent(stepId, key) {
  if (student) return getJSON(`${classBase}/content?step=${encodeURIComponent(stepId)}`);
  if (key.includes(':p') && key !== lastPageKey) { lastPageKey = key; plan = await getJSON('/teach/live/' + code + '/plan'); } // a new book page photo
  const step = plan.steps.find(s => s.id === stepId), revealed = key.split(':')[1] ? key.split(':')[1].split(',') : [];
  return publicStep(step, revealed);
}

// ---- answers ----
async function answer(body, button) {
  if (button) button.disabled = true;
  try {
    const r = await fetch(classBase + '/answer', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)});
    const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'لم تُرسل الإجابة.');
    sent[body.step + body.question] = true; status('وصلت إجابتك إلى المعلم.');
  } catch (e) { status(e.message, true); } finally { if (button) button.disabled = false; }
}
function questionForm(q, stepId, mine, {enabled, kind}) {
  const box = el('fieldset', {class: 'gl-aq', disabled: !enabled}, el('legend', {text: q.prompt}));
  const has = mine?.[q.id];
  if (q.kind === 'choice') {
    q.options.forEach((o, i) => box.append(el('label', {class: 'gl-choice' + (has?.choice === i ? ' is-chosen' : '')},
      el('input', {type: 'radio', name: kind + stepId + q.id, value: i, checked: has?.choice === i, onchange: () => answer({kind, step: stepId, question: q.id, choice: i})}), el('span', {text: o}))));
  } else {
    const t = el('textarea', {maxlength: 300, rows: 2, 'aria-label': 'إجابتك'}); t.value = has?.text || '';
    const b = el('button', {type: 'button', class: 'btn', onclick: () => t.value.trim() ? answer({kind, step: stepId, question: q.id, text: t.value}, b) : status('اكتب إجابتك أولًا.', true)}, has ? 'تحديث الإجابة' : 'إرسال');
    box.append(t, b);
  }
  if (has) box.append(el('small', {class: 'gl-sent', text: '✓ أُرسلت إجابتك'}));
  return box;
}

function renderAnswers() {
  const box = $('gl-answer');
  if (!box) return;
  if (!student || !view.step || view.step.type !== 'questions' || !content || content.type !== 'questions') { box.hidden = true; return; }
  if (box.contains(document.activeElement) && document.activeElement.tagName === 'TEXTAREA') return;
  box.hidden = false;
  box.replaceChildren(el('h2', {text: view.open ? 'أجب عن الأسئلة' : 'الأسئلة مغلقة الآن — ينتظر المعلم'}), ...content.questions.map(q => questionForm(q, content.id, view.mine, {enabled: view.open, kind: 'answer'})));
}

async function renderHomework() {
  const box = $('gl-hw');
  if (!box) return;
  if (!student || !view.homework) { box.hidden = true; return; }
  if (box.contains(document.activeElement) && document.activeElement.tagName === 'TEXTAREA') return;
  if (!homework || homework.id !== view.homework.step) homework = await stepContent(view.homework.step).catch(() => null);
  if (!homework) return;
  const open = view.homework.status === 'open', h = view.homework;
  box.hidden = false;
  box.replaceChildren(el('h2', {text: 'الواجب: ' + homework.title}), homework.instructions ? el('p', {text: homework.instructions}) : null,
    h.total ? el('p', {class: 'gl-score', text: `نتيجتك في أسئلة الاختيار: ${formatNumber(h.correct)} من ${formatNumber(h.total)}`}) : null,
    ...homework.questions.map(q => questionForm(q, homework.id, h.mine, {enabled: open, kind: 'homework'})),
    open ? null : el('p', {class: 'gl-hint', text: 'أغلق المعلم الواجب.'}));
}

function renderEvaluation() {
  const box = $('gl-eval');
  if (!box) return;
  if (!student || !view.evaluation) { box.hidden = true; return; }
  box.hidden = false;
  const e = view.evaluation;
  box.replaceChildren(el('h2', {text: 'تقييمي من المعلم'}), e.ratings ? el('ul', {class: 'gl-myratings'}, e.criteria.map((c, i) => el('li', {}, el('span', {text: c}), el('b', {text: e.ratings[i]})))) : el('p', {text: 'لم يقيّمك المعلم بعد.'}), e.note ? el('p', {class: 'gl-note-box', text: e.note}) : null);
}

function renderExplore() {
  // Each student explores privately (nothing is sent). One slider per activity; it is kept while dragging for smoothness.
  const a = activityOf(view.activity.id), p = a.params.find(x => x.key === a.exploreKey) || a.params[0];
  if (!explore || explore.id !== a.id) explore = {id: a.id, values: {...view.activity.values}};
  let wrap = $('gl-content').querySelector('.gl-explore');
  delete $('gl-content').dataset.step;
  if (!wrap || wrap.dataset.activity !== a.id) {
    const input = el('input', {type: 'range', min: p.min, max: p.max, step: p.step, value: explore.values[p.key], 'aria-label': p.label, oninput: e => { explore.values[p.key] = Number(e.target.value); renderExplore(); }});
    wrap = el('div', {class: 'gl-explore', 'data-activity': a.id}, el('h2', {class: 'gl-step-title', text: 'استكشف بنفسك'}), el('div', {class: 'gl-scene'}), el('label', {class: 'gl-field'}, el('span', {class: 'gl-explore-text'}), input));
    $('gl-content').replaceChildren(wrap);
  }
  wrap.querySelector('.gl-scene').innerHTML = a.render(explore.values, {hidden: false});
  wrap.querySelector('.gl-explore-text').textContent = `${p.label}: ${p.format(explore.values[p.key])} · ${a.facts(explore.values, false)}`;
}

/** Shows the narrator's caption and plays its voice here when the teacher chose this kind of device. */
async function narrator(n) {
  const board = $('gl-board');
  renderNarrator(board, n || null);
  if (!n) { if (lastSegment) { stopNarration(); lastSegment = 0; } return; }
  if (n.muted && !wasMuted) { stopNarration(); setSpeaking(board, false); }
  wasMuted = n.muted;
  if (n.seq <= lastSegment) return;
  lastSegment = n.seq; clearTimeout(speakTimer);
  const animate = ms => { setSpeaking(board, true); speakTimer = setTimeout(() => setSpeaking(board, false), ms); };
  if (!n.speak) { if (!n.muted) animate(speakingMs(n.text)); return; }
  try {
    const voice = withVoice(student ? await getJSON(`${classBase}/narration?step=${encodeURIComponent(view.step.id)}&segment=${n.segment}`)
      : (g => g.audio ? {mode: 'recorded', audio: g.audio} : {mode: 'speech', text: g.text})(plan.steps.find(s => s.id === view.step.id).narrator.segments[n.segment]), view.step.id, n.segment);
    setSpeaking(board, true);
    if (!await playNarration(voice, {onEnd: () => setSpeaking(board, false)})) {
      animate(speakingMs(n.text)); // caption still shows when the device has no Arabic voice
      if (voice.mode === 'recorded') { pendingNarration = voice; $('gl-audio').hidden = false; $('gl-audio').textContent = 'استمع لشرح المتحدث'; }
    }
  } catch (e) { status(e.message, true); }
}

async function render() {
  $('gl-progress') && ($('gl-progress').textContent = `الخطوة ${formatNumber(view.index + 1)} من ${formatNumber(view.total)}`);
  const wait = $('gl-wait'), board = $('gl-board');
  if (!view.live || !view.step) {
    renderNarrator(board, null); stopNarration();
    board.hidden = true; wait.hidden = false; content = null; contentKey = null;
    wait.textContent = !view.live ? (view.homework?.status === 'open' ? 'انتهت الحصة. الواجب متاح أدناه.' : 'انتهت الحصة. شكرًا لك!') : 'المعلم يجهز الخطوة… انتبه لشرحه.';
  } else {
    board.hidden = false; wait.hidden = true;
    if (view.step.key !== contentKey) { contentKey = view.step.key; content = await stepContent(view.step.id, view.step.key).catch(e => { status(e.message, true); return null; }); }
    if (student && view.step.type === 'interactive' && view.explore) { renderExplore(); renderKey = ''; }
    else {
      // Redraw content only when it changed, so camera moves and ink stay smooth.
      const key = JSON.stringify([contentKey, view.activity, view.display, view.places, content ? 1 : 0]);
      if (key !== renderKey) { renderKey = key; renderStep($('gl-content'), content, {shadow: view.activity, display: view.display, places: view.places}); }
      if (view.step.id !== shownStep) { shownStep = view.step.id; const c = $('gl-content'); c.classList.remove('gl-enter'); void c.offsetWidth; c.classList.add('gl-enter'); tools.resetForStep(); }
    }
    renderInk($('gl-ink'), view.strokes || []);
    renderExtras($('gl-board'), view);
    tools.remoteCamera(view.camera);
    await narrator(view.narrator);
  }
  renderAnswers(); await renderHomework(); renderEvaluation();
  if (student) studentChrome();
  if (view.narrate && view.narrate.seq > lastNarration) {
    lastNarration = view.narrate.seq;
    try {
      const n = withVoice(student ? await getJSON(`${classBase}/narration?step=${encodeURIComponent(view.narrate.step)}`) : plan.steps.find(s => s.id === view.narrate.step).narration, view.narrate.step, null);
      if (!await playNarration(n)) { pendingNarration = n; $('gl-audio').hidden = false; $('gl-audio').textContent = 'استمع لشرح المعلم'; }
    } catch (e) { status(e.message, true); }
  }
}

// ---- the student's own screen: board over everything, microphone, writing sheet, leave with confirmation ----
let entered = !student, sheetKey = '', lastStar = null, starTimer = 0, lastPick = null, pickTimer = 0;
/** The natural voice (man or woman, as the teacher chose) for a spoken explanation, when the server has it. */
const withVoice = (n, stepId, segment) => n.mode === 'speech' && view?.natural ? {...n, url: speechUrl(student ? classBase : '/teach/live/' + code, stepId, segment, view?.speaker)} : n;
const voice = student ? studentVoice({base: classBase, onChange: () => studentChrome(), onVideo: stream => { const v = $('gl-teachercam'), track = stream.getVideoTracks()[0]; v.srcObject = stream; v.play?.().catch(() => {}); if (track) track.onmute = track.onunmute = track.onended = () => studentChrome(); studentChrome(); }}) : null;
// The teacher's picture: a small window in the corner of the board; a tap makes it bigger or smaller.
$('gl-teachercam')?.addEventListener('click', e => e.currentTarget.classList.toggle('is-big'));
function openSheet(open) {
  $('gl-sheet').hidden = !open; $('gl-write').setAttribute('aria-expanded', String(open)); app.classList.toggle('sheet-open', open);
}
function studentChrome() {
  if (!view) return;
  const writable = [$('gl-answer'), $('gl-hw'), $('gl-eval')].filter(b => b && !b.hidden);
  $('gl-sheet-empty').hidden = writable.length > 0;
  // A new thing to write (questions opened, homework assigned, evaluation published) opens the sheet once.
  const key = [view.step?.type === 'questions' && view.open ? view.step.id : '', view.homework?.status === 'open' ? view.homework.step : '', view.evaluation ? 'e' : ''].join('|');
  const fresh = key !== sheetKey && key.replace(/\|/g, '') !== ''; sheetKey = key;
  $('gl-write-dot').hidden = !writable.length;
  if (fresh && entered) openSheet(true);
  const v = view.voice || {mics: true};
  if (!v.mics && voice.on) voice.setMic(false).catch(() => {});
  $('gl-mic').disabled = !v.mics || !view.live;
  $('gl-mic').setAttribute('aria-pressed', String(voice.on)); $('gl-mic').classList.toggle('is-on', voice.on);
  $('gl-mic').querySelector('span').textContent = !v.mics ? 'المايك مغلق' : voice.on ? 'أغلق المايك' : 'المايك';
  const tv = $('gl-teachercam'); if (tv) { const vt = tv.srcObject?.getVideoTracks()[0]; tv.hidden = !(v.camera && vt && vt.readyState === 'live' && !vt.muted && view.live); if (!tv.hidden) tv.play?.().catch(() => {}); }
  // 👀 attention lock, 🚦 work mode and 🎲 the picked student (ideas from Pear Deck, Classroomscreen, ClassDojo)
  $('gl-attention-cover').hidden = !view.attention || !view.live;
  $('gl-work').hidden = !view.workMode; $('gl-work').textContent = WORK_MODES[view.workMode] || '';
  if (view.pick && view.pick.seq !== lastPick) {
    if (lastPick !== null) { const p = $('gl-pick-pop'), mine = view.pick.student === view.me; p.replaceChildren(el('span', {text: '🎲'}), el('b', {text: mine ? 'أنت! تفضّل بالإجابة' : view.pick.name})); p.classList.toggle('is-me', mine); p.hidden = false; clearTimeout(pickTimer); pickTimer = setTimeout(() => { p.hidden = true; }, 3500); }
    lastPick = view.pick.seq;
  } else if (lastPick === null) lastPick = view.pick?.seq ?? 0;
  // ✋ and ⭐ (ideas from ClassIn): the hand stays up until the teacher answers; a new star pops up briefly
  $('gl-hand').setAttribute('aria-pressed', String(Boolean(view.hand))); $('gl-hand').classList.toggle('is-on', Boolean(view.hand));
  $('gl-hand').querySelector('span').textContent = view.hand ? 'يدك مرفوعة' : 'ارفع يدك'; $('gl-hand').disabled = !view.live;
  $('gl-stars').hidden = !view.stars; $('gl-stars').textContent = '⭐ ' + formatNumber(view.stars || 0);
  if (view.starSeq && view.starSeq !== lastStar) { if (lastStar !== null) { const p = $('gl-star-pop'); p.hidden = false; p.classList.remove('is-pop'); void p.offsetWidth; p.classList.add('is-pop'); clearTimeout(starTimer); starTimer = setTimeout(() => { p.hidden = true; }, 2200); } lastStar = view.starSeq; }
  else if (lastStar === null) lastStar = view.starSeq || 0;
  $('gl-ended').hidden = view.live || !entered;
  if (!view.live) $('gl-ended-text').textContent = view.homework?.status === 'open' ? 'شكرًا لك! الواجب متاح في «كتابة».' : 'شكرًا لك!';
}
if (student) {
  $('gl-enter').addEventListener('click', () => {
    entered = true; $('gl-start').hidden = true; app.classList.add('is-in');
    if ('speechSynthesis' in window) speechSynthesis.speak(new SpeechSynthesisUtterance('')); // unlock speech on this tap
    voice.resume(); voice.hello(); studentChrome();
  });
  $('gl-mic').addEventListener('click', async () => {
    try { await voice.setMic(!voice.on); status(voice.on ? 'المايك مفتوح: المعلم يسمعك.' : 'أُغلق المايك.'); }
    catch (e) { status(e.message || 'لم يُسمح بالمايك.', true); }
    studentChrome();
  });
  $('gl-hand').addEventListener('click', async () => {
    try { const up = !view?.hand; await (await fetch(classBase + '/hand', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({up})})).json(); status(up ? 'رفعت يدك ✋ سيراها المعلم.' : 'أنزلت يدك.'); }
    catch { status('تعذّر رفع اليد.', true); }
  });
  $('gl-write').addEventListener('click', () => openSheet($('gl-sheet').hidden));
  $('gl-sheet-close').addEventListener('click', () => openSheet(false));
  const leave = () => { voice.setMic(false).catch(() => {}); location.href = '/join'; };
  $('gl-leave').addEventListener('click', () => { if (confirm(view?.live ? 'هل تريد مغادرة الحصة؟ ستغلق السبورة.' : 'إغلاق الحصة؟')) leave(); });
  $('gl-ended-close').addEventListener('click', () => { if (view?.homework?.status === 'open') { $('gl-ended').hidden = true; openSheet(true); } else if (confirm('إغلاق الحصة؟')) leave(); });
}

$('gl-audio')?.addEventListener('click', async () => {
  $('gl-audio').hidden = true;
  if (pendingNarration) { const n = pendingNarration; pendingNarration = null; if (!await playNarration(n)) status('تعذّر تشغيل الشرح على هذا الجهاز.', true); }
  else if ('speechSynthesis' in window) speechSynthesis.speak(new SpeechSynthesisUtterance(''));
});
if ($('gl-audio') && !student) $('gl-audio').hidden = false; // the display screen needs one tap to allow sound
$('gl-full')?.addEventListener('click', () => document.documentElement.requestFullscreen?.());

let queue = Promise.resolve();
const ready = student ? Promise.resolve() : getJSON('/teach/live/' + code + '/plan').then(p => { plan = p; });
const events = new EventSource(student ? classBase + '/events' : '/teach/live/' + code + '/display-events');
events.addEventListener('laser', ev => { const d = JSON.parse(ev.data); if (d.ink) liveInk($('gl-ink'), d); else laserTrail($('gl-ink'), d.p, d.start); }); // the teacher's laser pointer and live writing
events.addEventListener('view', ev => {
  const next = JSON.parse(ev.data);
  queue = queue.then(() => ready).then(async () => { view = next; status(student ? 'متصل بالحصة.' : 'شاشة العرض متصلة.'); await render(); }).catch(e => status(e.message, true));
});
events.addEventListener('removed', () => { events.close(); status('أخرجك المعلم من الحصة.', true); $('gl-board').hidden = true; if (student) voice.setMic(false).catch(() => {}); });
events.onerror = async () => {
  status('انقطع الاتصال. تجري إعادة المحاولة…', true);
  // After a server restart the trial forgets its classes: say so clearly instead of retrying forever.
  const r = await fetch(classBase + '/content?step=_').catch(() => null);
  if (r && (r.status === 404 || r.status === 401)) { events.close(); classGone(); }
};
function classGone() {
  if (document.getElementById('gl-gone')) return;
  const box = document.createElement('div'); box.id = 'gl-gone'; box.className = 'gl-gone'; box.setAttribute('role', 'alertdialog');
  box.innerHTML = '<div class="gl-start-card"><h2>انتهت هذه الحصة التجريبية</h2><p>أُعيد تشغيل خادم التجربة فمُسحت الحصص الجارية. ابدأ من جديد.</p><a class="btn" href="/start/student">ابدأ من جديد</a></div>';
  document.body.append(box);
}
if (student) {
  events.addEventListener('rtc', ev => voice.message(JSON.parse(ev.data)).catch(() => {}));
  events.onopen = () => { if (entered) voice.hello(); }; // after a reconnect the teacher rebuilds the audio link
  window.__voice = voice; // read by the browser tests
}

// Inside the Android app: say once if the phone has no Arabic voice, so the teacher knows why the explanation is silent.
setTimeout(() => { if (window.App?.voice?.() === 'none') status('جوالك لا يحوي صوتًا عربيًا لقراءة الشرح؛ يبقى مكتوبًا. للتثبيت: الإعدادات ← تحويل النص إلى كلام ← اللغة العربية.', true); }, 4000);
