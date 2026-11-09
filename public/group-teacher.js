// Teacher console for the live group lesson: sequence, visibility, board ink, activity, results, homework, evaluation.
import {STEP_TYPES, NARRATION, RATING, publicStep} from './group-plan.js';
import {el, renderStep, renderInk, playNarration, stopNarration, renderDisplay, speechUrl, renderExtras} from './group-view.js';
import {openLibrary} from './tool-library-ui.js';
import {toolOf, STAMPS} from './tool-library.js';
import {attachBoardTools} from './group-board-tools.js';
import {renderNarrator, setSpeaking} from './group-view.js';
import {openTextPicker} from './text-library.js';
import {speakingMs} from './narrator-scripts.js';
import {formatNumber} from './science-shadow-model.js';
import {open as openMotion, slideIn} from './motion.js';
import {activityOf, segmentLabel, bigOf, textOf, quickParams} from './activities.js';
import {teacherVoice} from './group-voice.js';
import {bookOf, bookFor, lessonBookPage} from './book-catalog.js';

const app = document.getElementById('gl-app'), code = app.dataset.code, base = '/teach/live/' + code;
const $ = x => document.getElementById(x);
const status = (text, bad = false) => { $('gl-status').textContent = text; $('gl-status').classList.toggle('is-error', bad); };
let plan = null, view = null, busy = false, lastStep = null, contentKey = '';
// The explanation of the interactive step plays by itself, segment after segment, and the teacher hears it too.
const remember = (k, d) => { try { const v = localStorage.getItem('gl-' + k); return v === null ? d : v === '1'; } catch { return d; } };
const keep = (k, v) => { try { localStorage.setItem('gl-' + k, v ? '1' : '0'); } catch {} };
let autoAdvance = remember('auto', true), listenHere = remember('here', true), lastSegmentSeq = 0, advanceTimer = 0, speakTimer = 0;
const autoStart = remember('autostart', true), autoStarted = new Set();
let lastStepId = null, lastHands = 0;
const speaker = () => view?.state?.speaker === 'female' ? 'female' : 'male';
/** A step's prepared explanation, with the natural voice when the server has one. */
const speakerButton = () => !view?.natural ? null : el('button', {type: 'button', class: 'gl-mini gl-speaker', 'data-narr': 'speaker', title: 'صوت المتحدث: رجل أو امرأة', onclick: () => command({op: 'speaker', speaker: speaker() === 'male' ? 'female' : 'male'})}, speaker() === 'male' ? '🧔 رجل' : '🧕 امرأة');
const spoken = s => s.narration.mode === 'speech' && view?.natural ? {...s.narration, url: speechUrl(base, s.id, null, speaker())} : s.narration; // interactive steps whose explanation already started by itself in this class
const INKABLE = ['title', 'page', 'board', 'interactive', 'questions'];

async function command(body) {
  if (busy && body.op !== 'stroke') return;
  try {
    const r = await fetch(base + '/command', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)});
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'تعذّر تنفيذ الأمر.');
  } catch (e) { status(e.message, true); }
}
async function post(path, body) {
  const r = await fetch(base + path, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)});
  const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(data.error || 'تعذّر الحفظ.');
}

const step = () => plan.steps[view.state.index];
const nameOf = id => view.students.find(s => s.id === id)?.name || 'طالب';

/** Whether the students see a step: the current one as the class has it now, the others as the teacher left them. */
const stepShown = (s, i) => i === view.state.index ? view.state.shown : !(view.state.hide?.[s.id] ?? s.startHidden);
function renderSequence() {
  // The lesson's sections under the board: go to any of them, and hide or show any of them on the students' board.
  $('gl-steps').replaceChildren(...plan.steps.map((s, i) => { const shown = stepShown(s, i), name = STEP_TYPES[s.type]?.short || s.type;
    return el('li', {'data-type': s.type, class: (i === view.state.index ? 'is-current' : '') + (shown ? '' : ' is-hidden-step')},
      el('button', {type: 'button', class: 'gl-go', title: `${i + 1}. ${s.title} (${STEP_TYPES[s.type]?.label || s.type})`, 'aria-current': i === view.state.index ? 'step' : null, onclick: () => command({op: 'go', index: i})},
        el('span', {class: 'gl-num', text: String(i + 1)}), el('span', {class: 'gl-step-name', text: name})),
      el('button', {type: 'button', class: 'gl-eye', 'aria-pressed': String(!shown), 'aria-label': (shown ? 'إخفاء عن الطلاب: ' : 'إظهار للطلاب: ') + name, title: shown ? `الطلاب يرون «${s.title}» — اضغط لإخفائها عنهم` : `«${s.title}» مخفية عن الطلاب — اضغط لإظهارها`, onclick: () => command({op: 'show', step: s.id, shown: !shown})}, shown ? '👁' : '🚫')); }));
  $('gl-prev').disabled = view.state.index === 0; $('gl-next').disabled = view.state.index === plan.steps.length - 1;
  $('gl-steps').querySelector('.is-current')?.scrollIntoView({block: 'nearest', inline: 'nearest'});
}

/** The most-used buttons of the current step sit in the bar above the board, so the teacher never scrolls. */
/** A step's controls fold into menus the teacher opens when needed (students never see them); open stays open. */
const qOpen = id => { try { return localStorage.getItem('gl-qopen') === 'all' || localStorage.getItem('gl-q-' + id) === '1'; } catch { return false; } };
function qMenu(id, label, children) {
  const items = children.filter(Boolean); if (!items.length) return null;
  const open = qOpen(id), menu = el('span', {class: 'gl-qmenu', role: 'group', 'aria-label': label, hidden: !open}, ...items);
  const btn = el('button', {type: 'button', class: 'gl-mini gl-qbtn', 'aria-expanded': String(open), 'data-q': id, onclick: () => {
    const now = menu.hidden; menu.hidden = !now; btn.setAttribute('aria-expanded', String(now)); try { localStorage.setItem('gl-q-' + id, now ? '1' : '0'); } catch {}
  }}, label + ' ▾');
  return el('span', {class: 'gl-qfly' + (open ? ' is-open' : '')}, btn, menu);
}
function renderQuick(s) {
  const q = $('gl-quick'), parts = [];
  if (s.type === 'interactive') {
    const a = activityOf(s.activity), act = view.act, v = act.values;
    const set = values => command({op: 'activity', action: 'set', values});
    const controls = [];
    for (const p of quickParams(a)) controls.push(...paramControl(p, v, set, true));
    controls.push(el('button', {type: 'button', class: 'gl-mini' + (act.reveal ? '' : ' is-warn'), 'aria-pressed': String(!act.reveal), onclick: () => command({op: 'activity', action: 'reveal', show: !act.reveal})}, act.reveal ? '🙈 ' + a.hideLabel.replace(/ ل\S+ الطلاب$/, '') : '👁 ' + a.revealLabel));
    parts.push(qMenu('activity', '🔬 تحكم النشاط', controls));
    if (s.narrator) parts.push(narratorQuick(s));
  } else if (s.type === 'board') {
    const revealed = view.state.revealed[s.id] || [], next = s.items.find(i => !revealed.includes(i.id));
    parts.push(el('button', {type: 'button', class: 'btn gl-mini', disabled: !next, onclick: () => command({op: 'reveal', next: true})}, next ? `▶ النص التالي (${formatNumber(revealed.length + 1)}/${formatNumber(s.items.length)})` : 'ظهرت كل النصوص'),
      qMenu('cards', '🗂 البطاقات', [
        el('button', {type: 'button', class: 'gl-mini', onclick: () => command({op: 'reveal', all: true})}, 'الكل'),
        el('button', {type: 'button', class: 'quiet gl-mini', onclick: () => command({op: 'reveal', all: false})}, 'إخفاء الكل'),
        // one tap per card: shown to everyone or hidden again
        el('span', {class: 'gl-seg-group gl-card-chips', role: 'group', 'aria-label': 'البطاقات'}, ...s.items.map((it, i) => el('button', {type: 'button', class: 'gl-mini gl-card-chip', 'aria-pressed': String(revealed.includes(it.id)),
          title: (it.text || it.caption || 'صورة').slice(0, 80), onclick: () => command({op: 'reveal', item: it.id, show: !revealed.includes(it.id)})}, formatNumber(i + 1))))]));
  } else if (s.type === 'questions') {
    const open = Boolean(view.state.open[s.id]), answered = Object.keys(view.results[s.id].answers).length, d = view.state.display[s.id];
    const firstChoice = s.questions.find(x => x.kind === 'choice');
    parts.push(el('button', {type: 'button', class: (open ? 'is-warn' : 'btn') + ' gl-mini', onclick: () => command({op: 'open', open: !open})}, open ? '⏹ إيقاف الإجابة' : '▶ افتح الإجابة'),
      el('span', {class: 'gl-quick-out', text: `أجاب ${formatNumber(answered)} من ${formatNumber(view.students.length)}`}),
      qMenu('results', '📊 النتائج', [
        firstChoice ? el('button', {type: 'button', class: 'gl-mini', 'aria-pressed': String(d?.mode === 'summary'), onclick: () => command({op: 'display', mode: 'summary', question: (d?.question && s.questions.find(x => x.id === d.question && x.kind === 'choice') ? d.question : firstChoice.id)})}, '📊 اعرض النتائج') : null,
        d ? el('button', {type: 'button', class: 'quiet gl-mini', onclick: () => command({op: 'display', mode: 'none'})}, 'إخفاء العرض') : null,
        el('button', {type: 'button', class: 'gl-mini', onclick: () => openDrawer(true)}, 'كل الإجابات')]));
  } else if (s.type === 'homework') {
    parts.push(homeworkButtons());
  } else if (s.type === 'evaluation') {
    parts.push(qMenu('evaluation', '✅ التقييم', [el('button', {type: 'button', class: 'gl-mini', onclick: () => openDrawer(true)}, 'قيّم الطلاب'),
      el('button', {type: 'button', class: (view.state.evaluationPublished ? 'is-warn' : 'btn') + ' gl-mini', onclick: () => command({op: 'publish-evaluation', on: !view.state.evaluationPublished})}, view.state.evaluationPublished ? 'إخفاء التقييم' : 'نشر التقييم')]));
  }
  if (s.type === 'page') {
    // the ministry book of this subject and grade, opening at the lesson's page; shown on the board for this class only
    const at = s.source === 'book' || s.book ? {book: s.book?.id || s.book, page: s.book?.page || s.page} : lessonBookPage(plan.lesson), book = at ? bookOf(at.book) : bookFor(plan.subject, plan.grade);
    // shown only while the platform may show the books (BOOKS_RELAY on the server); short labels keep this row on one line
    if (book && plan.booksShown) parts.push(el('button', {type: 'button', class: 'btn gl-mini', id: 'gl-ministry-book', title: `كتاب الوزارة: افتح ${book.title} على صفحة الدرس واعرضها على السبورة`, 'aria-label': 'كتاب الوزارة', onclick: () => openMinistryBook(book, at?.page || 1)}, '📖 الكتاب'));
    parts.push(el('button', {type: 'button', class: 'outline gl-mini', title: 'صوّر صفحة الكتاب أو اختر صورتها فتظهر على السبورة للجميع', 'aria-label': 'تصوير صفحة', onclick: () => $('gl-page-file').click()}, '📷 صورة'));
  }
  if (s.type !== 'interactive' || !s.narrator) {
    if (s.narration.mode === 'live') parts.push(el('span', {class: 'gl-live-voice', text: '🎙 اشرح بصوتك'}));
    else parts.push(qMenu('narration', s.narration.mode === 'recorded' ? '🔊 الشرح (تسجيلك)' : '🔊 الشرح الصوتي', [
      el('button', {type: 'button', class: 'gl-mini', onclick: () => command({op: 'narrate', target: 'screen'})}, '▶ شاشة العرض'),
      el('button', {type: 'button', class: 'gl-mini', title: 'يُسمع على أجهزة الطلاب وعلى جهازك معهم', onclick: () => { command({op: 'narrate', target: 'students'}); if (listenHere) playNarration(spoken(s)).catch(() => {}); }}, '▶ على أجهزة الطلاب'),
      el('button', {type: 'button', class: 'gl-mini', onclick: async () => { if (!await playNarration(spoken(s))) status('تعذّر تشغيل الشرح هنا.', true); }}, '▶ هنا'),
      el('button', {type: 'button', class: 'quiet gl-mini', onclick: stopNarration}, '■'), s.narration.mode === 'speech' ? speakerButton() : null]));
  }
  // Keep the focused button focused across live updates.
  const active = q.contains(document.activeElement) ? document.activeElement.textContent : null;
  q.replaceChildren(...parts.filter(Boolean));
  if (active) [...q.querySelectorAll('button')].find(b => b.textContent === active)?.focus();
}

function openDrawer(open) {
  const d = $('gl-drawer'), was = !d.hidden; d.hidden = !open; $('gl-drawer-btn').setAttribute('aria-expanded', String(open));
  app.classList.toggle('drawer-open', open);
  if (open && !was && getComputedStyle(d).position === 'fixed') slideIn(d, {fromRight: getComputedStyle(d).direction === 'ltr'}); // a docked panel stays still
}

function renderBoard() {
  const s = step(), revealed = view.state.revealed[s.id] || [];
  const content = s.type === 'board' ? {...publicStep(s, s.items.map(i => i.id))} : publicStep(s, revealed);
  const d = view.state.display[s.id];
  let display = null;
  if (d && s.type === 'questions') {
    const q = s.questions.find(x => x.id === d.question), r = view.results[s.id];
    if (d.mode === 'summary') display = {mode: 'summary', prompt: q.prompt, options: q.options, counts: r.counts[q.id]};
    else if (d.mode === 'correct') display = {mode: 'correct', prompt: q.prompt, options: q.options, answer: q.answer};
    else { const a = r.answers[d.student]?.[q.id]; display = {mode: 'spotlight', prompt: q.prompt, answer: a ? (q.kind === 'choice' ? q.options[a.choice] : a.text) : null, name: d.named ? nameOf(d.student) : null}; }
  }
  const places = view.state.places?.[s.id] || {};
  const actView = s.type === 'interactive' ? {id: s.activity, ...view.act} : null;
  const key = JSON.stringify([s.id, revealed, actView, display, places, view.state.pageVer || 0]);
  if (key !== contentKey) {
    contentKey = key; renderStep($('gl-content'), content, {teacher: true, revealed, shadow: actView, display, places});
    if (s.id !== lastStep) { $('gl-content').classList.remove('gl-enter'); void $('gl-content').offsetWidth; $('gl-content').classList.add('gl-enter'); }
  }
  if (s.id !== lastStep) { lastStep = s.id; tools.resetForStep(); renderSnippets(s); }
  renderInk($('gl-ink'), view.state.strokes[s.id] || []);
  tools.remoteCamera(view.state.camera?.[s.id]);
  renderTeacherNarrator(s);
  const show = $('gl-show');
  show.textContent = view.state.shown ? 'إخفاء عن الطلاب' : 'إظهار للطلاب'; show.setAttribute('aria-pressed', String(view.state.shown));
  $('gl-vis').textContent = !view.state.live ? 'انتهى العرض للطلاب' : view.state.shown ? 'الطلاب يرون هذه الخطوة' : 'الطلاب لا يرون هذه الخطوة الآن';
  $('gl-vis').classList.toggle('is-hidden', !view.state.shown || !view.state.live);
  $('gl-board').classList.toggle('is-off', !view.state.shown);
  const canInk = INKABLE.includes(s.type);
  for (const b of document.querySelectorAll('.gl-tools button')) b.disabled = !canInk && !['select', 'hand'].includes(b.dataset.tool);
  $('gl-board').classList.toggle('no-ink', !canInk);
  $('gl-live').textContent = view.state.live ? 'إنهاء العرض للطلاب' : 'استئناف العرض';
}

// The teacher sees the narrator exactly as the class does, and leads it: play, next, mute, hide, automatic advance.
function renderTeacherNarrator(s) {
  const n = view.state.narrator, g = s.type === 'interactive' ? s.narrator?.segments[n?.segment] : null;
  const info = g && n.visible ? {segment: n.segment, total: s.narrator.segments.length, text: g.text, muted: n.muted} : null;
  renderNarrator($('gl-board'), info);
  if (!g || n.seq === lastSegmentSeq) return;
  lastSegmentSeq = n.seq;
  clearTimeout(advanceTimer); clearTimeout(speakTimer);
  const duration = speakingMs(g.text) + 1600;
  if (listenHere && !n.muted) { stopNarration(); setSpeaking($('gl-board'), true); playNarration(g.audio ? {mode: 'recorded', audio: g.audio} : {mode: 'speech', text: g.text, url: view.natural ? speechUrl(base, s.id, n.segment, speaker()) : undefined}, {onEnd: () => setSpeaking($('gl-board'), false)}); }
  else if (info) { setSpeaking($('gl-board'), true); speakTimer = setTimeout(() => setSpeaking($('gl-board'), false), duration - 1600); }
  if (autoAdvance && n.segment < s.narrator.segments.length - 1) advanceTimer = setTimeout(() => { if (step()?.id === s.id && view.state.narrator.segment === n.segment) command({op: 'narrator', action: 'next'}); }, duration + 800);
}

function narratorPanel(s) {
  const n = view.state.narrator, segs = s.narrator.segments, on = n.segment >= 0;
  const act = (action, extra = {}) => command({op: 'narrator', action, ...extra});
  return el('section', {class: 'gl-narr-panel', 'aria-label': 'المتحدث'},
    el('h3', {text: '🔊 الشرح الصوتي للنشاط'}),
    el('div', {class: 'gl-row'},
      el('button', {type: 'button', class: on ? '' : 'btn', onclick: () => act(on ? 'replay' : 'start')}, on ? '↻ أعد المقطع' : '▶ ابدأ الجولة'),
      el('button', {type: 'button', disabled: !on || n.segment === 0, onclick: () => act('prev')}, 'السابق'),
      el('button', {type: 'button', class: on ? 'btn' : '', disabled: !on || n.segment === segs.length - 1, onclick: () => act('next')}, 'التالي'),
      el('button', {type: 'button', class: 'quiet', disabled: !on, onclick: () => { clearTimeout(advanceTimer); stopNarration(); act('stop'); }}, '■ إنهاء الجولة')),
    el('div', {class: 'gl-row'},
      el('button', {type: 'button', 'aria-pressed': String(!n.visible), onclick: () => act('visible', {on: !n.visible})}, n.visible ? 'إخفاء المتحدث' : 'إظهار المتحدث'),
      el('button', {type: 'button', 'aria-pressed': String(n.muted), onclick: () => { if (!n.muted) stopNarration(); act('mute', {on: !n.muted}); }}, n.muted ? '🔇 الصوت مكتوم — شغّله' : '🔊 اكتم الصوت'),
      el('label', {class: 'gl-field gl-inline'}, 'يُسمع على', el('select', {onchange: e => act('target', {to: e.target.value})},
        [['screen', 'شاشة العرض'], ['students', 'أجهزة الطلاب'], ['both', 'الاثنين']].map(([v, t]) => el('option', {value: v, selected: n.target === v}, t))))),
    el('div', {class: 'gl-row'},
      el('label', {class: 'gl-check'}, el('input', {type: 'checkbox', checked: autoAdvance, onchange: e => { autoAdvance = e.target.checked; keep('auto', autoAdvance); clearTimeout(advanceTimer); }}), 'انتقال تلقائي بعد كل مقطع'),
      el('label', {class: 'gl-check'}, el('input', {type: 'checkbox', checked: listenHere, onchange: e => { listenHere = e.target.checked; keep('here', listenHere); if (!listenHere) stopNarration(); }}), 'أسمعه على جهازي أيضًا')),
    el('ol', {class: 'gl-segs'}, segs.map((g, i) => el('li', {class: i === n.segment ? 'is-current' : ''},
      el('button', {type: 'button', onclick: () => act('goto', {segment: i})}, el('small', {text: (g.audio ? '🎤 ' : '') + segmentLabel(s.activity, g.values)}), el('span', {text: g.text}))))),
    el('p', {class: 'gl-hint', text: 'يظهر كلام المتحدث مكتوبًا دائمًا. الصوت من تسجيلك إن سجلته، وإلا من صوت الجهاز العربي إن وُجد. يمكنك الشرح بصوتك بدلًا منه بكتم صوته.'}));
}

function narratorQuick(s) {
  const n = view.state.narrator, segs = s.narrator.segments, on = n.segment >= 0;
  const act = (action, extra = {}) => command({op: 'narrator', action, ...extra});
  return el('div', {class: 'gl-narr-quick', role: 'group', 'aria-label': 'تحكم سريع بالمتحدث'},
    el('span', {class: 'gl-narr-label', text: on ? `🔊 الشرح ${formatNumber(n.segment + 1)}/${formatNumber(segs.length)}` : '🔊 الشرح'}),
    el('button', {type: 'button', class: on ? '' : 'btn', 'data-narr': on ? 'replay' : 'start', onclick: () => act(on ? 'replay' : 'start')}, on ? '↻ أعد' : '▶ شغّل الشرح'),
    on ? el('button', {type: 'button', 'data-narr': 'next', class: 'btn', disabled: n.segment === segs.length - 1, onclick: () => act('next')}, 'التالي') : null,
    el('button', {type: 'button', 'data-narr': 'mute', 'aria-pressed': String(n.muted), onclick: () => { if (!n.muted) stopNarration(); act('mute', {on: !n.muted}); }}, n.muted ? '🔇 مكتوم' : '🔊 كتم'),
    qMenu('narrator', '⚙️', [
    el('button', {type: 'button', 'data-narr': 'visible', 'aria-pressed': String(!n.visible), onclick: () => act('visible', {on: !n.visible})}, n.visible ? 'إخفاء' : 'إظهار'),
    speakerButton(),
    el('button', {type: 'button', 'data-narr': 'here', 'aria-pressed': String(listenHere), title: 'يُسمع الشرح على جهازك أيضًا', onclick: () => { listenHere = !listenHere; keep('here', listenHere); if (!listenHere) stopNarration(); renderQuick(step()); }}, listenHere ? '🎧 أسمعه هنا' : '🎧 لا أسمعه هنا'),
    el('button', {type: 'button', 'data-narr': 'auto', 'aria-pressed': String(autoAdvance), title: 'ينتقل من مقطع إلى التالي وحده', onclick: () => { autoAdvance = !autoAdvance; keep('auto', autoAdvance); clearTimeout(advanceTimer); renderQuick(step()); }}, autoAdvance ? '⏩ تلقائي' : '⏸ يدوي'),
    on ? el('button', {type: 'button', class: 'quiet', 'data-narr': 'stop', onclick: () => { clearTimeout(advanceTimer); stopNarration(); act('stop'); }}, '■ إنهاء') : null]));
}


/** Controls built from the activity's params, so every lesson's activity gets the same teacher tools. */
/** One activity control: a stepped range (− value +) or a choice (buttons when few, a menu when many). */
function paramControl(p, v, set, compact) {
  const mini = compact ? 'gl-mini' : '';
  if (p.kind === 'range') {
    const step = bigOf(p, v), out = el('output', {class: compact ? 'gl-quick-out' : '', text: compact ? p.format(v[p.key]) : `${p.label}: ${p.format(v[p.key])}`});
    if (!step) return [out];
    // «a step back / forward» is sent as a step, not as a target value, so quick taps on a slow network all count
    const nudge = by => command({op: 'activity', action: 'nudge', key: p.key, by});
    return [el('button', {type: 'button', class: mini, onclick: () => nudge(-step)}, textOf(p.earlier, v, '−')), out,
      el('button', {type: 'button', class: mini, onclick: () => nudge(step)}, textOf(p.later, v, '+'))];
  }
  const entries = Object.entries(p.options);
  if (entries.length <= 3) return [el('span', {class: 'gl-seg-group', role: 'group', 'aria-label': p.label}, ...entries.map(([k, label]) => el('button', {type: 'button', class: mini, 'aria-pressed': String(v[p.key] === k), onclick: () => set({[p.key]: k})}, label)))];
  return [el('label', {class: 'gl-quick-select'}, el('span', {class: 'gl-ctl-label', text: p.label}), el('select', {'aria-label': p.label, onchange: e => set({[p.key]: e.target.value})}, ...entries.map(([k, label]) => el('option', {value: k, selected: v[p.key] === k}, label))))];
}

function activityControls(s) {
  const a = activityOf(s.activity), act = view.act, v = act.values;
  const set = values => command({op: 'activity', action: 'set', values});
  const box = el('div', {class: 'gl-act-controls'});
  for (const p of a.params) {
    if (p.kind === 'range') box.append(el('div', {class: 'gl-row'}, ...paramControl(p, v, set, false)),
      el('label', {class: 'gl-field'}, p.label, el('input', {type: 'range', min: p.min, max: p.max, step: p.step, value: v[p.key], 'aria-label': p.label, onchange: e => set({[p.key]: Number(e.target.value)})})));
    else box.append(el('div', {class: 'gl-row', role: 'group', 'aria-label': p.label}, el('span', {class: 'gl-ctl-label', text: p.label + ':'}), ...Object.entries(p.options).map(([k, label]) => el('button', {type: 'button', 'aria-pressed': String(v[p.key] === k), onclick: () => set({[p.key]: k})}, label))));
  }
  box.append(el('div', {class: 'gl-row'},
    el('button', {type: 'button', class: act.reveal ? '' : 'is-warn', 'aria-pressed': String(!act.reveal), onclick: () => command({op: 'activity', action: 'reveal', show: !act.reveal})}, act.reveal ? a.hideLabel : a.revealLabel),
    el('button', {type: 'button', 'aria-pressed': String(view.state.explore), onclick: () => command({op: 'explore', on: !view.state.explore})}, view.state.explore ? 'إيقاف الاستكشاف الفردي' : 'اسمح للطلاب بالاستكشاف على أجهزتهم'),
    el('button', {type: 'button', class: 'quiet', onclick: () => command({op: 'activity', action: 'reset'})}, 'إعادة')),
    el('p', {class: 'gl-hint', text: 'الآن: ' + a.facts(v, false)}));
  return box;
}

function renderPanel() {
  const s = step(), panel = $('gl-panel');
  const head = el('h2', {text: STEP_TYPES[s.type].label});
  if (s.type === 'title') return panel.replaceChildren(head, el('p', {text: 'عنوان الدرس ظاهر على السبورة. قدّم الموضوع، واكتب عليه إن شئت، ثم اضغط «التالي» لأول فقرة.'}));
  if (s.type === 'page') return panel.replaceChildren(head, el('p', {text: 'اكتب على الصفحة بالقلم أثناء الشرح. الطلاب يرون الكتابة مباشرة. انتقل إلى «التالي» للشرح التفاعلي.'}));
  if (s.type === 'interactive') return panel.replaceChildren(head, activityControls(s), s.narrator ? narratorPanel(s) : null);
  if (s.type === 'board') {
    const revealed = view.state.revealed[s.id] || [];
    return panel.replaceChildren(head, el('div', {class: 'gl-row'},
      el('button', {type: 'button', onclick: () => command({op: 'reveal', all: true})}, 'إظهار الكل'), el('button', {type: 'button', class: 'quiet', onclick: () => command({op: 'reveal', all: false})}, 'إخفاء الكل')),
      el('ul', {class: 'gl-reveal'}, s.items.map((item, i) => {
        const on = revealed.includes(item.id);
        return el('li', {}, el('span', {text: `${i + 1}. ` + (item.kind === 'image' ? 'صورة' + (item.caption ? ': ' + item.caption : '') : item.text)}),
          el('button', {type: 'button', 'aria-pressed': String(on), onclick: () => command({op: 'reveal', item: item.id, show: !on})}, on ? 'إخفاء' : 'إظهار'));
      })));
  }
  if (s.type === 'questions') {
    const open = Boolean(view.state.open[s.id]), r = view.results[s.id], d = view.state.display[s.id];
    const answered = Object.keys(r.answers).length;
    const blocks = s.questions.map((q, i) => {
      const card = el('div', {class: 'gl-q'}, el('b', {text: `${i + 1}. ${q.prompt}`}));
      if (q.kind === 'choice') {
        const counts = r.counts[q.id], total = counts.reduce((a, b) => a + b, 0);
        card.append(renderDisplay({mode: 'summary', prompt: '', options: q.options.map((o, j) => (j === q.answer ? '✓ ' : '') + o), counts}),
          el('div', {class: 'gl-row'}, el('small', {text: `${formatNumber(total)} إجابة`}),
            el('button', {type: 'button', 'aria-pressed': String(d?.mode === 'summary' && d.question === q.id), onclick: () => command({op: 'display', mode: 'summary', question: q.id})}, 'اعرض النتائج للجميع'),
            el('button', {type: 'button', 'aria-pressed': String(d?.mode === 'correct' && d.question === q.id), onclick: () => command({op: 'display', mode: 'correct', question: q.id})}, 'اعرض الإجابة الصحيحة')));
      }
      const list = el('ul', {class: 'gl-answers'});
      for (const st of view.students) {
        const a = r.answers[st.id]?.[q.id];
        const shown = d?.mode === 'spotlight' && d.question === q.id && d.student === st.id;
        list.append(el('li', {class: a && q.kind === 'choice' ? (a.choice === q.answer ? 'is-right' : 'is-wrong') : ''},
          el('span', {text: `${st.name}: ` + (a ? (q.kind === 'choice' ? q.options[a.choice] : a.text) : '—')}),
          a ? el('span', {class: 'gl-row'},
            el('button', {type: 'button', class: 'quiet', 'aria-pressed': String(shown && !d.named), onclick: () => command({op: 'display', mode: 'spotlight', question: q.id, student: st.id, named: false})}, 'اعرضها دون اسم'),
            el('button', {type: 'button', class: 'quiet', 'aria-pressed': String(shown && d.named), onclick: () => command({op: 'display', mode: 'spotlight', question: q.id, student: st.id, named: true})}, 'مع الاسم')) : null));
      }
      card.append(list);
      return card;
    });
    return panel.replaceChildren(head, el('div', {class: 'gl-row'},
      el('button', {type: 'button', class: open ? 'is-warn' : 'btn', onclick: () => command({op: 'open', open: !open})}, open ? 'إيقاف استقبال الإجابات' : 'افتح الإجابة للطلاب'),
      el('button', {type: 'button', class: 'quiet', disabled: !d, onclick: () => command({op: 'display', mode: 'none'})}, 'إخفاء العرض عن الجميع'),
      el('span', {class: 'gl-hint', text: `أجاب ${formatNumber(answered)} من ${formatNumber(view.students.length)}. النتائج تظهر لك وحدك حتى تختار عرضها.`})), ...blocks);
  }
  if (s.type === 'homework') return panel.replaceChildren(head, el('p', {text: 'أسند الواجب ليظهر للطلاب على أجهزتهم ويحلوه حتى بعد انتهاء الحصة. تتابع التسليم في الجانب.'}), homeworkButtons());
  return panel.replaceChildren(head, el('p', {text: 'قيّم كل طالب في قائمة «التقييم» بالجانب، ثم انشر التقييم ليرى كل طالب تقييمه وحده.'}));
}

function homeworkButtons() {
  const st = view.state.homework;
  return el('div', {class: 'gl-row'},
    el('button', {type: 'button', class: st === 'open' ? 'is-warn' : 'btn', onclick: () => command({op: 'homework', status: st === 'open' ? 'closed' : 'open'})}, st === 'open' ? 'إغلاق الواجب' : st === 'closed' ? 'إعادة فتح الواجب' : 'أسند الواجب للطلاب'),
    el('small', {text: {none: 'لم يُسند بعد', open: 'الواجب مفتوح', closed: 'الواجب مغلق'}[st]}));
}

function renderSide() {
  $('gl-count').textContent = `(${formatNumber(view.students.length)})`;
  $('gl-count').classList.toggle('has-students', view.students.length > 0);
  const talking = new Set(voice.speaking());
  // ✋ raised hands first, in the order they went up; ⭐ gives a star the student sees at once
  const hands = view.hands || [], up = new Set(hands), stars = view.stars || {};
  $('gl-hands').hidden = !hands.length; $('gl-hands-n').textContent = formatNumber(hands.length);
  if (hands.length > lastHands) status(`✋ ${view.students.find(x => x.id === hands[hands.length - 1])?.name || 'طالب'} يرفع يده.`);
  lastHands = hands.length;
  const order = [...view.students].sort((a, b) => (up.has(b.id) - up.has(a.id)) || (hands.indexOf(a.id) - hands.indexOf(b.id)));
  $('gl-students').replaceChildren(...(view.students.length ? order.map(st => el('li', {class: (talking.has(st.id) ? 'is-talking ' : '') + (up.has(st.id) ? 'is-hand' : '')}, el('span', {text: (up.has(st.id) ? '✋ ' : '') + (talking.has(st.id) ? '🎤 ' : '') + st.name + (stars[st.id] ? ` ⭐${formatNumber(stars[st.id])}` : '')}),
    up.has(st.id) ? el('button', {type: 'button', class: 'outline gl-mini', onclick: () => command({op: 'hand-down', student: st.id})}, 'أنزل يده') : null,
    el('button', {type: 'button', class: 'outline gl-mini gl-star-btn', 'aria-label': 'نجمة لـ ' + st.name, onclick: () => command({op: 'star', student: st.id})}, '⭐ نجمة'),
    el('button', {type: 'button', class: 'quiet', 'aria-label': 'إخراج ' + st.name, onclick: async () => { if (!confirm(`إخراج ${st.name} من الحصة؟`)) return; try { await post('/remove', {student: st.id}); } catch (e) { status(e.message, true); } }}, 'إخراج'))) : [el('li', {class: 'gl-empty', text: 'بانتظار انضمام الطلاب برمز الحصة.'})]));
  const hw = plan.steps.find(s => s.type === 'homework');
  $('gl-homework').replaceChildren(...(hw ? [homeworkButtons(), el('ul', {class: 'gl-hw'}, view.students.map(st => {
    const h = view.homework[st.id];
    return el('li', {}, el('span', {text: st.name}), el('span', {text: h?.submitted ? `${formatNumber(h.correct)}/${formatNumber(h.total)} صحيحة · ${formatNumber(h.submitted)} إجابة` : 'لم يسلّم'}));
  }))] : [el('p', {text: 'لا يوجد واجب في هذا الدرس.'})]));
  const ev = plan.steps.find(s => s.type === 'evaluation');
  if (!ev) return $('gl-evaluation').replaceChildren(el('p', {text: 'لا توجد خطوة تقييم.'}));
  const publish = el('button', {type: 'button', class: view.state.evaluationPublished ? 'is-warn' : 'btn', onclick: () => command({op: 'publish-evaluation', on: !view.state.evaluationPublished})}, view.state.evaluationPublished ? 'إخفاء التقييم عن الطلاب' : 'نشر التقييم للطلاب');
  const forms = view.students.map(st => {
    const saved = view.evaluations[st.id], form = el('form', {class: 'gl-eval'});
    form.append(el('b', {text: st.name}), ...ev.criteria.map((c, i) => el('label', {class: 'gl-field'}, c, el('select', {name: 'r' + i}, RATING.map((label, v) => el('option', {value: v, selected: (saved?.ratings[i] ?? 0) === v}, v ? `${v} — ${label}` : 'بدون تقدير'))))),
      el('label', {class: 'gl-field'}, 'ملاحظة', Object.assign(el('textarea', {name: 'note', maxlength: 300, rows: 2}), {value: saved?.note || ''})),
      el('button', {type: 'submit', class: 'outline'}, saved ? 'تحديث التقييم' : 'حفظ التقييم'));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      try { await post('/evaluate', {student: st.id, ratings: ev.criteria.map((_, i) => Number(form.elements['r' + i].value)), note: form.elements.note.value}); status('حُفظ تقييم ' + st.name + '.'); } catch (err) { status(err.message, true); }
    });
    return form;
  });
  // Keep a form the teacher is typing in from being replaced by a live update.
  if ($('gl-evaluation').contains(document.activeElement) && document.activeElement.tagName !== 'BUTTON') return;
  $('gl-evaluation').replaceChildren(publish, ...(forms.length ? forms : [el('p', {text: 'لا يوجد طلاب بعد.'})]));
}

function render() {
  if (!plan || !view) return;
  const cur = step(); // opening an interactive step starts its prepared explanation once
  if (cur?.id !== lastStepId) { if (lastStepId) { clearTimeout(advanceTimer); clearTimeout(speakTimer); stopNarration(); } lastStepId = cur?.id; } // leaving a step ends its explanation here
  if (cur?.type === 'interactive' && cur.narrator?.segments.length && view.state.narrator?.segment === -1 && view.state.live && autoStart && !autoStarted.has(cur.id)) {
    autoStarted.add(cur.id); command({op: 'narrator', action: 'start'});
  }
  renderSequence(); renderBoard(); renderQuick(step()); renderExtras($('gl-board'), view, {teacher: true}); renderClassTools();
  // Re-render the step tools but keep keyboard focus on the same control.
  const active = $('gl-panel').contains(document.activeElement) ? document.activeElement : null;
  const key = active && (active.getAttribute('aria-label') || active.textContent);
  renderPanel();
  if (key) [...$('gl-panel').querySelectorAll('button, input')].find(x => (x.getAttribute('aria-label') || x.textContent) === key)?.focus();
  renderSide();
}

// ---- controls ----
$('gl-prev').addEventListener('click', () => command({op: 'go', by: -1}));
$('gl-drawer-btn').addEventListener('click', () => openDrawer($('gl-drawer').hidden));
$('gl-hands').addEventListener('click', () => openDrawer(true));
$('gl-drawer-close').addEventListener('click', () => openDrawer(false));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('gl-drawer').hidden && !document.querySelector('dialog[open]')) openDrawer(false); });
$('gl-code').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('gl-code').dataset.join); status('نُسخ رابط الطلاب: ' + $('gl-code').dataset.join); } catch { status('رابط الطلاب: ' + $('gl-code').dataset.join); } });
if (matchMedia('(min-width: 1600px)').matches) openDrawer(true); // wide screens keep the drawer docked beside the board
$('gl-next').addEventListener('click', () => command({op: 'go', by: 1}));
$('gl-show').addEventListener('click', () => command({op: 'show', shown: !view.state.shown}));
$('gl-live').addEventListener('click', () => { if (!view.state.live || confirm('إنهاء العرض للطلاب؟ يبقى الواجب متاحًا إن كان مفتوحًا.')) command({op: 'live', on: !view.state.live}); });
$('gl-undo').addEventListener('click', () => command({op: 'undo-stroke'}));
$('gl-library').addEventListener('click', () => openTextPicker({title: 'نصوص توضيحية للسبورة', useLabel: 'ضعه على السبورة', onUse: text => tools.prepareSnippet(text)}));
$('gl-clear').addEventListener('click', () => { if (confirm('مسح كل الكتابة في هذه الخطوة؟')) command({op: 'clear-strokes'}); });

const tools = attachBoardTools({
  mode: 'teacher', send: command, items: () => view?.state.strokes[step().id] || [], canInk: () => view && INKABLE.includes(step().type),
  onStatus: text => status(text), onUndo: () => command({op: 'undo-stroke'}),
  onLaser: (p, start) => fetch(base + '/laser', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({p, start})}).catch(() => {}),
  onLiveInk: d => fetch(base + '/laser', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(d), keepalive: true}).catch(() => {}),
  onNext: () => command({op: 'go', by: 1}),
  onPrev: () => command({op: 'go', by: -1})
});
function renderSnippets(s) {
  const box = $('gl-snippets'), list = s.snippets || [];
  box.hidden = !list.length;
  box.replaceChildren(el('span', {class: 'gl-snip-label', text: 'نصوص جاهزة:'}), ...list.map(t => el('button', {type: 'button', class: 'gl-snip', onclick: () => tools.prepareSnippet(t)}, t)));
}

// ---- the ministry book: opened at the lesson's page on this device; the chosen page goes to this class only ----
async function openMinistryBook(book, page) {
  const {openBookDialog} = await import('./book-viewer.js');
  openBookDialog({book, page, onShow: async (image, at) => {
    await post('/book-page', {step: step().id, book: book.id, page: at, image});
    plan = await fetch(base + '/plan').then(r => r.json()); contentKey = ''; render();
    status(`ظهرت صفحة ${at} من كتاب الوزارة على السبورة للجميع. اكتب عليها كما تشاء؛ الكتاب لا يتغير.`);
  }});
}
// ---- the book page: photographed or picked during the class, shrunk on this device, shown on the board ----
async function shrinkImage(file) {
  const img = await createImageBitmap(file);
  for (const [max, quality] of [[1600, 0.82], [1300, 0.75], [1000, 0.7], [800, 0.6]]) {
    const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const data = c.toDataURL('image/jpeg', quality);
    if (data.length <= 880_000) return data;
  }
  throw new Error('الصورة كبيرة جدًا. جرّب صورة أصغر.');
}
const pageFile = el('input', {type: 'file', id: 'gl-page-file', accept: 'image/*', capture: 'environment', hidden: true, onchange: async e => {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  try {
    status('جارٍ رفع صفحة الكتاب…');
    await post('/page-image', {step: step().id, image: await shrinkImage(file)});
    plan = await fetch(base + '/plan').then(r => r.json()); contentKey = ''; render();
    status('ظهرت صفحة الكتاب على السبورة للجميع.');
  } catch (err) { status(err.message || 'تعذّر رفع الصورة.', true); }
}});
document.body.append(pageFile);

// ---- live voice: the teacher decides who is heard ----
const voice = teacherVoice({base, onChange: () => { renderVoice(); if (view) renderSide(); }});
function renderVoice() {
  const v = view?.voice || {teacher: false, mics: true}, talking = v.mics ? voice.speaking().length : 0;
  const label = (id, main, state) => { $(id).querySelector('.gl-avl').textContent = main; $(id).querySelector('.gl-avs').textContent = state; };
  label('gl-voice', '🎙 صوتي', voice.on ? ': يُسمع الآن' : ': مغلق');
  $('gl-voice').setAttribute('aria-pressed', String(voice.on)); $('gl-voice').classList.toggle('is-on', voice.on);
  const cam = Boolean(voice.camera);
  label('gl-cam', '📷 الكاميرا', cam ? ': تُعرض' : ': مغلقة');
  $('gl-cam').setAttribute('aria-pressed', String(cam)); $('gl-cam').classList.toggle('is-on', cam);
  const self = $('gl-selfcam'); if (cam && self.srcObject?.getVideoTracks()[0] !== voice.camera) { self.srcObject = new MediaStream([voice.camera]); self.play?.().catch(() => {}); }
  self.hidden = !cam; if (!cam) self.srcObject = null;
  label('gl-mics', v.mics ? '🎤 مايك الطلاب' : '🔇 مايك الطلاب', (v.mics ? ': مسموح' : ': مغلق') + (talking ? ` (${formatNumber(talking)} يتحدث)` : ''));
  $('gl-mics').setAttribute('aria-pressed', String(v.mics)); $('gl-mics').classList.toggle('is-off', !v.mics);
}
$('gl-voice').addEventListener('click', async () => {
  try { await voice.setMic(!voice.on); await command({op: 'voice', teacher: voice.on}); } catch (e) { status(e.message || 'تعذّر فتح المايك.', true); }
  renderVoice();
});
$('gl-cam').addEventListener('click', async () => {
  try { await voice.setCamera(!voice.camera); await command({op: 'voice', camera: Boolean(voice.camera)}); status(voice.camera ? 'الكاميرا تُعرض للطلاب.' : 'أُغلقت الكاميرا.'); }
  catch (e) { status(e.message || 'تعذّر فتح الكاميرا. اسمح للمتصفح باستخدامها.', true); }
  renderVoice();
});
// The control panel is always in reach: in the top bar on a computer or tablet, above the tools on an upright phone.
const avPhone = matchMedia('(max-width:1100px) and (orientation:portrait)');
function placeAv() { const av = $('gl-av'); if (avPhone.matches) document.querySelector('.gl-bar-bottom').prepend(av); else document.querySelector('.gl-bar-top .gl-bar-actions').prepend(av); }
avPhone.addEventListener?.('change', placeAv); placeAv();
$('gl-mics').addEventListener('click', () => command({op: 'voice', mics: !(view?.voice?.mics ?? true)}));
$('gl-stop').addEventListener('click', async () => { // emergency: everything silent and dark at once, no question asked
  await voice.stopAll().catch(() => {});
  await command({op: 'voice', teacher: false, camera: false, mics: false});
  renderVoice(); status('أُوقف كل شيء: صوتك وكاميرتك ومايك الطلاب.');
});
window.addEventListener('pagehide', () => { voice.stopAll().catch(() => {}); });

// ---- connection ----
const plansReady = fetch(base + '/plan').then(r => r.json()).then(p => { plan = p; });
const events = new EventSource(base + '/events');
events.addEventListener('view', async ev => { await plansReady; view = JSON.parse(ev.data); status(view.state.live ? 'متصل. أنت تقود الحصة.' : 'العرض متوقف للطلاب.'); render(); renderVoice(); });
events.addEventListener('rtc', ev => voice.message(JSON.parse(ev.data)).catch(() => {}));
window.__voice = voice; // read by the browser tests
events.onerror = async () => {
  status('انقطع الاتصال. تجري إعادة المحاولة…', true);
  // After a server restart the trial forgets its classes: say so clearly instead of retrying forever.
  const r = await fetch(base + '/plan').catch(() => null);
  if (r && (r.status === 404 || r.status === 401)) { events.close(); classGone(); }
};
function classGone() {
  if (document.getElementById('gl-gone')) return;
  const box = document.createElement('div'); box.id = 'gl-gone'; box.className = 'gl-gone'; box.setAttribute('role', 'alertdialog');
  box.innerHTML = '<div class="gl-start-card"><h2>انتهت هذه الحصة التجريبية</h2><p>أُعيد تشغيل خادم التجربة فمُسحت الحصص الجارية. ابدأ من جديد.</p><a class="btn" href="/teach/plans">ابدأ من جديد</a></div>';
  document.body.append(box);
}

// Inside the Android app: say once if the phone has no Arabic voice, so the teacher knows why the explanation is silent.
setTimeout(() => { if (window.App?.voice?.() === 'none') status('جوالك لا يحوي صوتًا عربيًا لقراءة الشرح؛ يبقى مكتوبًا. للتثبيت: الإعدادات ← تحويل النص إلى كلام ← اللغة العربية.', true); }, 4000);

// ---- «اختبار الصوت»: plays a test sentence with the narrator's voice; if nothing can speak, says why and what to do ----
const SAMPLE = 'مرحبًا، هذا صوت المتحدث في الحصة.';
async function voiceProblem() {
  if (window.App?.voice) { // inside the Android app: the phone's own text-to-speech engine
    let v = window.App.voice(); for (let i = 0; v === 'loading' && i < 10; i++) { await new Promise(r => setTimeout(r, 300)); v = window.App.voice(); }
    return v === 'ar' ? null : 'app-none';
  }
  if (!('speechSynthesis' in window)) return 'browser-none';
  let voices = speechSynthesis.getVoices();
  if (!voices.length) { await new Promise(r => { speechSynthesis.onvoiceschanged = r; setTimeout(r, 1500); }); voices = speechSynthesis.getVoices(); }
  return voices.some(x => x.lang?.toLowerCase().startsWith('ar')) ? null : 'browser-none';
}
function voiceHelp(problem) {
  const steps = problem ? [
    'جهازك لا يحوي صوتًا عربيًا يقرأ النص، لذلك يظهر كلام المتحدث مكتوبًا بلا صوت. أجهزة هواوي الحديثة غالبًا بلا صوت عربي.',
    'الحل المضمون: سجّل الشرح بصوتك قبل الحصة. افتح «ترتيب الدرس» ← خطوة الشرح التفاعلي ← «🎤 سجّل بصوتك» لكل مقطع. التسجيل يُسمع على كل الأجهزة.',
    'أو ثبّت صوتًا عربيًا في الجوال: الإعدادات ← تحويل النص إلى كلام (أو: الوصول السهل ← تحويل النص إلى كلام) ← اختر محركًا يدعم العربية وثبّت بيانات اللغة العربية، ثم أعد فتح التطبيق.',
    'وتستطيع دائمًا أن تكتم المتحدث وتشرح بصوتك مباشرة عبر «🎙 صوتي».'
  ] : ['سمعت الجملة التجريبية؟ إذا لم تسمعها فارفع صوت الوسائط في الجوال وتأكد أنه ليس على الصامت، ثم اضغط «اختبار الصوت» مرة أخرى.'];
  $('gl-voice-help-text').replaceChildren(...steps.map(t => el('p', {text: t})));
  $('gl-voice-help').hidden = false;
}
$('gl-test-voice').addEventListener('click', async () => {
  const natural = view?.natural && await fetch(`${base}/speech?sample=1&v=${speaker()}`).then(r => r.ok ? r.blob() : null).catch(() => null);
  if (natural) {
    await playNarration({mode: 'recorded', audio: URL.createObjectURL(natural)});
    $('gl-voice-help-text').replaceChildren(el('p', {text: `هذا صوت المتحدث الطبيعي: ${speaker() === 'male' ? 'حامد (رجل)' : 'زارية (امرأة)'}. يُسمع على كل الأجهزة. غيّره بزر «🧔 صوت رجل / 🧕 صوت امرأة» فوق السبورة.`}));
    $('gl-voice-help').hidden = false; return;
  }
  const problem = await voiceProblem();
  if (!problem) await playNarration({mode: 'speech', text: SAMPLE});
  voiceHelp(problem);
});
$('gl-voice-help-close').addEventListener('click', () => { $('gl-voice-help').hidden = true; });

// ---- tool families (pens, shapes, colour, size, more): one button each opens its family; picking closes it ----
function closeFlies(except) { for (const f of document.querySelectorAll('.gl-fly')) if (f !== except) { f.querySelector('.gl-fly-menu').hidden = true; f.querySelector('.gl-fly-btn').setAttribute('aria-expanded', 'false'); f.classList.remove('is-open'); } }
for (const f of document.querySelectorAll('.gl-fly')) {
  const btn = f.querySelector('.gl-fly-btn'), menu = f.querySelector('.gl-fly-menu');
  btn.addEventListener('click', e => { e.stopPropagation(); const open = menu.hidden; closeFlies(f); menu.hidden = !open; btn.setAttribute('aria-expanded', String(open)); f.classList.toggle('is-open', open); if (open) openMotion(menu, {y: 4}); });
  menu.addEventListener('click', e => { if (e.target.closest('button')) closeFlies(); }); // the tool's own click has already run
}
document.addEventListener('pointerdown', e => { if (!e.target.closest('.gl-fly')) closeFlies(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeFlies(); });
/** The family button shows what is chosen inside it: the pen or shape in use, the colour, the size. */
function syncFlies() {
  for (const f of document.querySelectorAll('.gl-fly[data-fly=pens], .gl-fly[data-fly=shapes]')) {
    const on = f.querySelector('.gl-tool[aria-pressed=true]'), b = f.querySelector('.gl-fly-btn'); if (b.getAttribute('aria-pressed') !== String(Boolean(on))) b.setAttribute('aria-pressed', String(Boolean(on))); // only on change: the watcher below sees this too
    if (on) { f.querySelector('.gl-fly-icon').textContent = on.firstElementChild.textContent; f.querySelector('.gl-fly-label').textContent = on.lastElementChild.textContent; }
  }
  const c = document.querySelector('.gl-color[aria-pressed=true]'); if (c) document.querySelector('.gl-current-color').style.background = c.dataset.color;
  const z = document.querySelector('.gl-size[aria-pressed=true]'); if (z) document.querySelector('.gl-current-size').dataset.dot = z.dataset.size;
}
new MutationObserver(syncFlies).observe(document.querySelector('.gl-tools'), {subtree: true, attributes: true, attributeFilter: ['aria-pressed']});
syncFlies();

// ---- ⏱ timer, 🎭 curtain, 📏📐 measuring tools (from «⋯ المزيد») ----
for (const b of document.querySelectorAll('.gl-timer-btn')) b.addEventListener('click', () => command(Number(b.dataset.sec) ? {op: 'timer', seconds: Number(b.dataset.sec)} : {op: 'timer', stop: true}));
for (const b of document.querySelectorAll('.gl-curtain-btn')) b.addEventListener('click', () => {
  const now = view?.curtain || 0, v = Number(b.dataset.level);
  command({op: 'curtain', level: v < 0 ? Math.max(0, (now || 100) + v) : v}); // «كشف ربع» lifts it a quarter each time
});
for (const b of document.querySelectorAll('.gl-stamp-btn')) b.addEventListener('click', () => {
  const c = view?.state?.camera?.[step().id] || {z: 1, x: 0, y: 0}, z = c.z || 1; // in the middle of what the teacher sees
  const below = b.dataset.stamp === 'protractor' ? 90 : -80; // the protractor a little lower, so the two never land on each other
  command({op: 'stamp', name: b.dataset.stamp, x: Math.round(Math.min(800, c.x + 500 / z - 200)), y: Math.round(Math.max(0, Math.min(440, c.y + 300 / z + below)))});
  status('وُضعت الأداة. حرّكها بأداة «تحريك»، وامسحها بالممحاة.');
});

// ---- 🧭 class management (ideas from Classroomscreen, ClassDojo, Pear Deck, Whiteboard.fi) ----
$('gl-pick').addEventListener('click', () => {
  const all = view?.students || []; if (!all.length) return status('لا يوجد طلاب في الحصة بعد.', true);
  const done = new Set(view.state.picked || []), left = all.filter(x => !done.has(x.id)), pool = left.length ? left : all; // nobody twice until everyone had a turn
  const who = pool[Math.floor(Math.random() * pool.length)];
  command({op: 'pick', student: who.id, name: who.name}); status(`🎲 ${who.name}`);
});
$('gl-pick-reset').addEventListener('click', () => command({op: 'pick-reset'}));
$('gl-attention').addEventListener('click', () => command({op: 'attention', on: !view?.state?.attention}));
for (const b of document.querySelectorAll('.gl-work-btn')) b.addEventListener('click', () => command({op: 'work-mode', mode: b.dataset.mode}));
function renderClassTools() {
  const st = view?.state || {}; if (!$('gl-attention')) return;
  $('gl-attention').setAttribute('aria-pressed', String(Boolean(st.attention)));
  $('gl-attention').textContent = st.attention ? '👀 الشاشات مقفلة — افتحها' : '👀 انتباه: اقفل شاشات الطلاب';
  for (const b of document.querySelectorAll('.gl-work-btn')) b.setAttribute('aria-pressed', String((st.workMode || 'none') === b.dataset.mode));
  const left = (view.students || []).filter(x => !(st.picked || []).includes(x.id)).length;
  $('gl-pick').textContent = '🎲 اختر طالبًا' + (view.students?.length ? ` (بقي ${formatNumber(left || view.students.length)})` : '');
  document.querySelector('.gl-class-fly .gl-fly-btn').classList.toggle('is-on', Boolean(st.attention || st.workMode));
}

// ---- «🧰 أدوات الدرس»: the tools pinned while preparing the lesson, and the whole library, one tap away ----
function placeStamp(name) {
  const c = view?.state?.camera?.[step().id] || {z: 1, x: 0, y: 0}, z = c.z || 1, st = STAMPS[name];
  // the first free spot in what the teacher sees, away from the tools already on the board
  const boxes = (view?.state?.strokes?.[step().id] || []).filter(i => i.kind === 'stamp' && STAMPS[i.name]).map(i => ({x: i.x, y: i.y, w: STAMPS[i.name].w, h: STAMPS[i.name].h}));
  const left = Math.max(0, c.x), top = Math.max(0, c.y), right = Math.min(1000, c.x + 1000 / z), bottom = Math.min(600, c.y + 600 / z);
  const free = (x, y) => boxes.every(b => x + st.w + 8 <= b.x || x >= b.x + b.w + 8 || y + st.h + 8 <= b.y || y >= b.y + b.h + 8);
  let at = null;
  for (let y = top + 10; !at && y + st.h <= bottom; y += 20) for (let x = right - st.w - 10; x >= left; x -= 20) if (free(x, y)) { at = [x, y]; break; }
  at ||= [Math.max(0, Math.min(1000 - st.w, c.x + 500 / z - st.w / 2 - boxes.length * 24)), Math.max(0, Math.min(600 - st.h, c.y + 300 / z - st.h / 2 + boxes.length * 24))];
  command({op: 'stamp', name, x: Math.round(at[0]), y: Math.round(at[1])}); status('وُضعت الأداة. حرّكها بأداة «تحريك»، وامسحها بالممحاة.');
}
function useTool(t) {
  if (t.kind === 'stamp') return placeStamp(t.id);
  if (t.kind === 'activity') {
    const i = plan.steps.findIndex(st => st.type === 'interactive' && st.activity === t.id);
    return i >= 0 ? command({op: 'go', index: i}) : status('هذا الشرح التفاعلي ليس خطوة في هذا الدرس. أضفه من «ترتيب الدرس».', true);
  }
  if (t.id === 'timer') return command({op: 'timer', seconds: 180});
  if (t.id === 'picker') return $('gl-pick').click();
  if (t.id === 'curtain') return command({op: 'curtain', level: 100});
  if (t.id === 'laser') return tools.setTool('laser');
}
const useLabel = t => ({stamp: 'ضعها على السبورة', activity: 'انتقل إليه', class: 'شغّلها'})[t.kind];
function renderLessonTools() {
  const box = $('gl-lesson-tools'); if (!box || !plan) return;
  const list = (plan.tools || []).map(toolOf).filter(Boolean);
  box.replaceChildren(...(list.length ? list.map(t => el('button', {type: 'button', class: 'gl-lesson-tool', 'data-lib': t.id, title: `${t.title}: ${useLabel(t)}`, onclick: () => useTool(t)}, el('span', {text: t.icon}), el('span', {text: t.title}))) : [el('small', {class: 'gl-hint', text: 'لا أدوات مثبتة لهذا الدرس.'})]));
}
$('gl-open-library').addEventListener('click', () => openLibrary({subject: plan.subject, grade: plan.grade, lesson: plan.lesson || '', onUse: useTool, useLabel}));
plansReady.then(renderLessonTools);
