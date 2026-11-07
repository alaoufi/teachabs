// Pure state machine for a live group lesson. The teacher controls sequence, visibility and what is shown to everyone.
import {publicStep, RATING} from './public/group-plan.js';
import {activityOf, cleanValues} from './public/activities.js';
import {UserError} from './store.mjs';
import {TOOLS, TEXT_SIZES, LIMITS as INK, colorAllowed, clampCamera} from './public/group-ink.js';

const need = (ok, message, status = 400) => { if (!ok) throw new UserError(message, status); };
export const MAX_STUDENTS = 40, MAX_STROKES = INK.items, MAX_POINTS = INK.points;
const INKABLE = ['page', 'board', 'interactive', 'questions'];

export function initialState(plan) {
  return {live: true, index: 0, shown: !plan.steps[0].startHidden, revealed: {}, open: {}, display: {}, strokes: {}, camera: {}, narrator: initialNarrator(), acts: {}, explore: false, homework: 'none', evaluationPublished: false, narrate: null, seq: 0};
}

const current = (state, plan) => plan.steps[state.index];

/** Live voice settings; older sessions without them start with the teacher silent and student mics allowed. */
export const voiceOf = state => ({teacher: false, mics: true, camera: false, ...(state.voice || {})});

export const initialNarrator = () => ({visible: true, muted: false, segment: -1, target: 'both', seq: 0}); // heard on the students' devices and the display screen

/** Move the shared scene to a narrated segment so everyone sees the sun where the narrator is talking about it. */
function goSegment(s, step, index) {
  const g = step.narrator.segments[index], act = actOf(s, step);
  s.narrator.segment = index; s.narrator.seq = s.seq; s.explore = false;
  s.acts[step.id] = {...act, values: {...act.values, ...g.values}, reveal: true};
  return s;
}

/** Shared state of an interactive step: the activity's values and whether results are revealed. */
export function actOf(state, step) {
  const a = state.acts?.[step.id];
  return a && a.values ? a : {values: activityOf(step.activity).initial(), reveal: true};
}

function addInk(s, step, item) {
  const list = s.strokes[step.id] || [];
  need(list.length < MAX_STROKES, 'امتلأت مساحة الكتابة في هذه الخطوة. امسح بعضها أولًا.', 409);
  s.strokes[step.id] = [...list, {id: 'k' + s.seq, ...item}];
  return s;
}

export function teacherCommand(state, plan, cmd) {
  need(cmd && typeof cmd.op === 'string', 'أمر غير صالح.');
  const s = structuredClone(state), step = current(s, plan);
  s.seq++; s.camera ||= {}; s.strokes ||= {}; s.narrator ||= initialNarrator(); s.acts ||= {};
  switch (cmd.op) {
    case 'go': {
      need(Number.isInteger(cmd.index) && cmd.index >= 0 && cmd.index < plan.steps.length, 'خطوة غير موجودة.');
      s.index = cmd.index; s.shown = !plan.steps[cmd.index].startHidden; return s;
    }
    case 'show': need(typeof cmd.shown === 'boolean', 'قيمة غير صالحة.'); s.shown = cmd.shown; return s;
    case 'reveal': {
      need(step.type === 'board', 'هذه الخطوة ليست سبورة مجهزة.');
      const ids = step.items.map(i => i.id), list = new Set(s.revealed[step.id] || []);
      if (cmd.next === true) { const id = ids.find(x => !list.has(x)); need(id, 'ظهرت كل النصوص.'); list.add(id); } // the next card, in the prepared order
      else if (cmd.all === true) ids.forEach(id => list.add(id));
      else if (cmd.all === false) list.clear();
      else { need(ids.includes(cmd.item) && typeof cmd.show === 'boolean', 'عنصر غير موجود.'); cmd.show ? list.add(cmd.item) : list.delete(cmd.item); }
      s.revealed[step.id] = ids.filter(id => list.has(id)); return s;
    }
    case 'open': need(step.type === 'questions' && typeof cmd.open === 'boolean', 'استقبال الإجابات لخطوة الأسئلة فقط.'); s.open[step.id] = cmd.open; return s;
    case 'display': {
      need(step.type === 'questions', 'العرض لخطوة الأسئلة فقط.');
      if (cmd.mode === 'none') { s.display[step.id] = null; return s; }
      const q = step.questions.find(x => x.id === cmd.question);
      need(q, 'سؤال غير موجود.');
      if (cmd.mode === 'summary' || cmd.mode === 'correct') { need(q.kind === 'choice', 'هذا العرض لأسئلة الاختيار.'); s.display[step.id] = {mode: cmd.mode, question: q.id}; return s; }
      need(cmd.mode === 'spotlight' && typeof cmd.student === 'string' && typeof cmd.named === 'boolean', 'طريقة عرض غير معروفة.');
      s.display[step.id] = {mode: 'spotlight', question: q.id, student: cmd.student, named: cmd.named}; return s;
    }
    case 'stroke': {
      need(INKABLE.includes(step.type), 'الكتابة متاحة على المنهج والشرح والسبورة والأسئلة.');
      need(Array.isArray(cmd.points) && cmd.points.length >= 2 && cmd.points.length <= MAX_POINTS && cmd.points.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p[0] >= 0 && p[0] <= 1000 && p[1] >= 0 && p[1] <= 600), 'خط غير صالح.');
      need(colorAllowed(cmd.color), 'لون غير متاح.');
      const tool = cmd.tool ?? 'pen', size = cmd.size ?? 'm';
      need(Object.hasOwn(TOOLS, tool) && Object.hasOwn(TOOLS[tool].widths, size), 'أداة غير معروفة.');
      return addInk(s, step, {kind: 'stroke', tool, size, color: cmd.color, points: cmd.points.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10])});
    }
    case 'text': {
      need(INKABLE.includes(step.type), 'الكتابة متاحة على المنهج والشرح والسبورة والأسئلة.');
      const text = typeof cmd.text === 'string' ? cmd.text.trim() : '';
      need(text.length >= 1 && text.length <= INK.text, `اكتب نصًا حتى ${INK.text} حرف.`);
      need(colorAllowed(cmd.color) && Object.hasOwn(TEXT_SIZES, cmd.size ?? 'm'), 'لون أو حجم غير متاح.');
      need(Number.isFinite(cmd.x) && Number.isFinite(cmd.y) && cmd.x >= 0 && cmd.x <= 1000 && cmd.y >= 0 && cmd.y <= 600, 'موضع غير صالح.');
      return addInk(s, step, {kind: 'text', text, color: cmd.color, size: cmd.size ?? 'm', x: Math.round(cmd.x), y: Math.round(cmd.y)});
    }
    case 'move': {
      const list = s.strokes[step.id] || [], item = list.find(i => i.id === cmd.id);
      need(item, 'العنصر غير موجود.', 404);
      const clampX = v => Math.round(Math.min(1000, Math.max(0, v)) * 10) / 10, clampY = v => Math.round(Math.min(600, Math.max(0, v)) * 10) / 10;
      if (Number.isFinite(cmd.dx) && Number.isFinite(cmd.dy)) {
        // Move any ink item by an offset, keeping it on the board.
        if (item.kind === 'text') { item.x = clampX(item.x + cmd.dx); item.y = clampY(item.y + cmd.dy); }
        else {
          const xs = item.points.map(p => p[0]), ys = item.points.map(p => p[1]);
          const dx = Math.min(1000 - Math.max(...xs), Math.max(-Math.min(...xs), cmd.dx)), dy = Math.min(600 - Math.max(...ys), Math.max(-Math.min(...ys), cmd.dy));
          item.points = item.points.map(([x, y]) => [Math.round((x + dx) * 10) / 10, Math.round((y + dy) * 10) / 10]);
        }
        return s;
      }
      need(item.kind === 'text' && Number.isFinite(cmd.x) && Number.isFinite(cmd.y), 'موضع غير صالح.');
      item.x = Math.round(clampX(cmd.x)); item.y = Math.round(clampY(cmd.y)); return s;
    }
    case 'place': {
      need(step.type === 'board' && step.items.some(i => i.id === cmd.item), 'العنصر غير موجود في النصوص المجهزة.', 404);
      s.places ||= {};
      if (cmd.reset === true) { const p = {...(s.places[step.id] || {})}; delete p[cmd.item]; s.places[step.id] = p; return s; }
      need(Number.isFinite(cmd.x) && Number.isFinite(cmd.y) && cmd.x >= 0 && cmd.x <= 1000 && cmd.y >= 0 && cmd.y <= 600, 'موضع غير صالح.');
      s.places[step.id] = {...(s.places[step.id] || {}), [cmd.item]: {x: Math.round(cmd.x), y: Math.round(cmd.y)}}; return s;
    }
    case 'erase': {
      const list = s.strokes[step.id] || [];
      need(list.some(i => i.id === cmd.id), 'العنصر غير موجود.', 404);
      s.strokes[step.id] = list.filter(i => i.id !== cmd.id); return s;
    }
    case 'undo-stroke': s.strokes[step.id] = (s.strokes[step.id] || []).slice(0, -1); return s;
    case 'clear-strokes': s.strokes[step.id] = []; return s;
    case 'camera': s.camera[step.id] = clampCamera(cmd); return s;
    case 'shadow': // older clients
      return teacherCommand(state, plan, {op: 'activity', ...({set: {action: 'set', values: cmd.command}, reveal: {action: 'reveal', show: cmd.command?.show}, reset: {action: 'reset'}})[cmd.command?.op] || {action: 'unknown'}});
    case 'activity': {
      need(step.type === 'interactive', 'هذه الخطوة ليست الشرح التفاعلي.');
      const act = actOf(s, step);
      if (cmd.action === 'set') {
        let values; try { values = cleanValues(step.activity, cmd.values, act.values); } catch (e) { throw new UserError(e.message); }
        s.acts[step.id] = {...act, values}; return s;
      }
      if (cmd.action === 'nudge') { // one step up or down from the value the server holds now: quick taps never get lost
        const p = activityOf(step.activity).params.find(x => x.key === cmd.key && x.kind === 'range');
        need(p && Number.isFinite(cmd.by) && Math.abs(cmd.by) <= p.max - p.min, 'قيمة غير صالحة.');
        const to = Math.min(p.max, Math.max(p.min, act.values[p.key] + cmd.by));
        let values; try { values = cleanValues(step.activity, {[p.key]: to}, act.values); } catch (e) { throw new UserError(e.message); }
        s.acts[step.id] = {...act, values}; return s;
      }
      if (cmd.action === 'reveal') { need(typeof cmd.show === 'boolean', 'قيمة غير صالحة.'); s.acts[step.id] = {...act, reveal: cmd.show}; return s; }
      if (cmd.action === 'reset') { s.acts[step.id] = {values: activityOf(step.activity).initial(), reveal: true}; return s; }
      throw new UserError('أمر غير متاح في الحصة الجماعية.');
    }
    case 'narrator': {
      need(step.type === 'interactive' && step.narrator, 'المتحدث متاح في خطوة الشرح التفاعلي.');
      const n = s.narrator, last = step.narrator.segments.length - 1;
      switch (cmd.action) {
        case 'start': n.visible = true; return goSegment(s, step, 0);
        case 'goto': need(Number.isInteger(cmd.segment) && cmd.segment >= 0 && cmd.segment <= last, 'مقطع غير موجود.'); return goSegment(s, step, cmd.segment);
        case 'next': need(n.segment < last, 'هذا آخر مقطع.'); return goSegment(s, step, n.segment + 1);
        case 'prev': need(n.segment > 0, 'هذا أول مقطع.'); return goSegment(s, step, n.segment - 1);
        case 'replay': need(n.segment >= 0, 'ابدأ الجولة أولًا.'); n.seq = s.seq; return s;
        case 'stop': n.segment = -1; n.seq = s.seq; return s;
        case 'visible': need(typeof cmd.on === 'boolean', 'قيمة غير صالحة.'); n.visible = cmd.on; return s;
        case 'mute': need(typeof cmd.on === 'boolean', 'قيمة غير صالحة.'); n.muted = cmd.on; return s;
        case 'target': need(['screen', 'students', 'both'].includes(cmd.to), 'جهة غير صالحة.'); n.target = cmd.to; return s;
        default: throw new UserError('أمر غير معروف للمتحدث.');
      }
    }
    case 'explore': need(typeof cmd.on === 'boolean', 'قيمة غير صالحة.'); s.explore = cmd.on; return s;
    case 'narrate': need(step.narration.mode !== 'live', 'هذه الخطوة شرحها مباشر بصوت المعلم.'); need(['here', 'screen', 'students'].includes(cmd.target), 'جهة غير صالحة.'); s.narrate = {step: step.id, target: cmd.target, seq: s.seq}; return s;
    case 'homework': need(['none', 'open', 'closed'].includes(cmd.status) && plan.steps.some(x => x.type === 'homework'), 'لا يوجد واجب في الدرس.'); s.homework = cmd.status; return s;
    case 'publish-evaluation': need(typeof cmd.on === 'boolean', 'قيمة غير صالحة.'); s.evaluationPublished = cmd.on; return s;
    case 'live': need(typeof cmd.on === 'boolean', 'قيمة غير صالحة.'); s.live = cmd.on; return s;
    case 'hand-down': { // the teacher answered the raised hand (one student, or everyone)
      s.hands = {...(s.hands || {})};
      if (cmd.all === true) s.hands = {}; else { need(typeof cmd.student === 'string', 'طالب غير معروف.'); delete s.hands[cmd.student]; }
      return s;
    }
    case 'star': { // encouragement: a star for a student, seen by that student
      need(typeof cmd.student === 'string' && cmd.student.length <= 64, 'طالب غير معروف.');
      s.stars = {...(s.stars || {})}; s.stars[cmd.student] = Math.min(99, (s.stars[cmd.student] || 0) + 1);
      s.lastStar = {student: cmd.student, seq: s.seq}; return s;
    }
    case 'voice': { // live voice: the teacher's own microphone and camera, and whether students may use their microphones
      s.voice ||= voiceOf(state);
      if (Object.hasOwn(cmd, 'teacher')) { need(typeof cmd.teacher === 'boolean', 'قيمة غير صالحة.'); s.voice.teacher = cmd.teacher; }
      if (Object.hasOwn(cmd, 'mics')) { need(typeof cmd.mics === 'boolean', 'قيمة غير صالحة.'); s.voice.mics = cmd.mics; }
      if (Object.hasOwn(cmd, 'camera')) { need(typeof cmd.camera === 'boolean', 'قيمة غير صالحة.'); s.voice.camera = cmd.camera; }
      return s;
    }
    default: throw new UserError('أمر غير معروف.');
  }
}

const homeworkStep = plan => plan.steps.find(s => s.type === 'homework');
const evaluationStep = plan => plan.steps.find(s => s.type === 'evaluation');

export function checkAnswer(state, plan, payload, kind) {
  need(payload && typeof payload.question === 'string', 'إجابة غير صالحة.');
  let step;
  if (kind === 'answer') {
    step = current(state, plan);
    need(state.live && state.shown && step.type === 'questions' && step.id === payload.step && state.open[step.id], 'المعلم لم يفتح الإجابة على هذه الأسئلة الآن.', 409);
  } else {
    step = homeworkStep(plan);
    need(step && step.id === payload.step && state.homework === 'open', 'الواجب غير مفتوح الآن.', 409);
  }
  const q = step.questions.find(x => x.id === payload.question);
  need(q, 'سؤال غير موجود.');
  if (q.kind === 'choice') { need(Number.isInteger(payload.choice) && payload.choice >= 0 && payload.choice < q.options.length, 'اختر إجابة.'); return {step: step.id, question: q.id, data: {choice: payload.choice}}; }
  const text = typeof payload.text === 'string' ? payload.text.trim() : '';
  need(text.length >= 1 && text.length <= 300, 'اكتب إجابة حتى ٣٠٠ حرف.');
  return {step: step.id, question: q.id, data: {text}};
}

export function checkEvaluation(plan, payload, studentIds) {
  const step = evaluationStep(plan);
  need(step, 'لا توجد خطوة تقييم في الدرس.');
  need(studentIds.includes(payload?.student), 'الطالب غير موجود.', 404);
  need(Array.isArray(payload.ratings) && payload.ratings.length === step.criteria.length && payload.ratings.every(r => Number.isInteger(r) && r >= 0 && r <= 4), 'اختر تقديرًا لكل معيار.');
  const note = typeof payload.note === 'string' ? payload.note.trim() : '';
  need(note.length <= 300, 'الملاحظة حتى ٣٠٠ حرف.');
  return {step: step.id, data: {ratings: payload.ratings, note}};
}

function scoreOf(step, answers) {
  const choice = step.questions.filter(q => q.kind === 'choice');
  return {correct: choice.filter(q => answers[q.id]?.choice === q.answer).length, total: choice.length};
}

/** responses: [{student, step, item, kind, data}] */
const byStudent = (responses, kind, stepId) => {
  const out = {};
  for (const r of responses) if (r.kind === kind && r.step === stepId) (out[r.student] ||= {})[r.item] = r.data;
  return out;
};

/** A student raises or lowers their hand; the teacher sees the order in which hands went up. */
export function studentHand(state, student, up) {
  need(typeof up === 'boolean', 'قيمة غير صالحة.');
  const s = structuredClone(state); s.hands = {...(s.hands || {})};
  if (up) s.hands[student] ||= Date.now(); else delete s.hands[student];
  s.seq = (s.seq || 0) + 1; return s;
}

export function teacherView(state, plan, students, responses) {
  const step = current(state, plan), results = {};
  for (const st of plan.steps.filter(x => x.type === 'questions')) {
    const answers = byStudent(responses, 'answer', st.id);
    results[st.id] = {answers, counts: Object.fromEntries(st.questions.filter(q => q.kind === 'choice').map(q => [q.id, q.options.map((_, i) => Object.values(answers).filter(a => a[q.id]?.choice === i).length)]))};
  }
  const hw = homeworkStep(plan), homework = hw ? Object.fromEntries(students.map(s => {
    const answers = byStudent(responses, 'homework', hw.id)[s.id] || {};
    return [s.id, {answers, submitted: Object.keys(answers).length, ...scoreOf(hw, answers)}];
  })) : {};
  const ev = evaluationStep(plan), evaluations = ev ? Object.fromEntries(responses.filter(r => r.kind === 'evaluation').map(r => [r.student, r.data])) : {};
  return {role: 'teacher', state, voice: voiceOf(state), hands: Object.entries(state.hands || {}).sort((a, b) => a[1] - b[1]).map(([id]) => id), stars: state.stars || {}, act: step.type === 'interactive' ? actOf(state, step) : null, current: step.id, students, results, homework, evaluations};
}

export function publicView(state, plan, student, responses, studentNames = {}) {
  const step = current(state, plan), shown = state.live && state.shown;
  const view = {role: student ? 'student' : 'display', live: state.live, title: plan.title, index: state.index, total: plan.steps.length, shown, seq: state.seq, voice: voiceOf(state)};
  if (student) { view.hand = Boolean(state.hands?.[student]); view.stars = state.stars?.[student] || 0; if (state.lastStar?.student === student) view.starSeq = state.lastStar.seq; }
  if (shown) {
    const revealed = state.revealed[step.id] || [];
    view.step = {id: step.id, type: step.type, title: step.title, key: `${step.id}:${revealed.join(',')}${step.type === 'page' ? ':p' + (state.pageVer || 0) : ''}`};
    if (INKABLE.includes(step.type)) view.strokes = state.strokes[step.id] || [];
    if (step.type === 'board') view.places = Object.fromEntries(Object.entries(state.places?.[step.id] || {}).filter(([id]) => revealed.includes(id)));
    view.camera = state.camera?.[step.id] || {z: 1, x: 0, y: 0};
    if (step.type === 'interactive') {
      view.activity = {id: step.activity, ...actOf(state, step)}; view.explore = state.explore;
      const n = state.narrator || initialNarrator(), g = step.narrator?.segments[n.segment];
      if (n.visible && g) view.narrator = {segment: n.segment, total: step.narrator.segments.length, text: g.text, seq: n.seq, muted: n.muted,
        speak: !n.muted && (n.target === 'both' || n.target === (student ? 'students' : 'screen')), recorded: Boolean(g.audio)};
    }
    if (step.type === 'questions') {
      const answers = byStudent(responses, 'answer', step.id);
      view.open = Boolean(state.open[step.id]);
      if (student) view.mine = answers[student] || {};
      const d = state.display[step.id];
      if (d) {
        const q = step.questions.find(x => x.id === d.question);
        if (d.mode === 'summary') view.display = {mode: 'summary', question: q.id, prompt: q.prompt, options: q.options, counts: q.options.map((_, i) => Object.values(answers).filter(a => a[q.id]?.choice === i).length)};
        else if (d.mode === 'correct') view.display = {mode: 'correct', question: q.id, prompt: q.prompt, options: q.options, answer: q.answer};
        else {
          const a = answers[d.student]?.[q.id];
          const shownAnswer = !a ? null : q.kind === 'choice' ? q.options[a.choice] : a.text;
          view.display = {mode: 'spotlight', question: q.id, prompt: q.prompt, answer: shownAnswer, name: d.named ? (studentNames[d.student] || '') : null, mine: student === d.student};
        }
      }
    }
  }
  if (state.narrate && state.narrate.step === step.id && shown && state.narrate.target === (student ? 'students' : 'screen')) view.narrate = state.narrate;
  const hw = homeworkStep(plan);
  if (hw && state.homework !== 'none') {
    view.homework = {status: state.homework, step: hw.id, title: hw.title};
    if (student) {
      const mine = byStudent(responses, 'homework', hw.id)[student] || {};
      view.homework.mine = mine;
      if (Object.keys(mine).length) Object.assign(view.homework, scoreOf(hw, mine));
    }
  }
  const ev = evaluationStep(plan);
  if (student && ev && state.evaluationPublished) {
    const mine = responses.find(r => r.kind === 'evaluation' && r.student === student);
    view.evaluation = mine ? {criteria: ev.criteria, ratings: mine.data.ratings.map(r => RATING[r] || 'لم يُقيّم'), note: mine.data.note} : {criteria: ev.criteria, ratings: null};
  }
  return view;
}

/** Content a student may fetch: the current shown step, or the homework while it is open. */
export function contentFor(state, plan, stepId) {
  const step = plan.steps.find(s => s.id === stepId);
  need(step, 'الخطوة غير موجودة.', 404);
  const isCurrent = step === current(state, plan) && state.live && state.shown;
  const isHomework = step.type === 'homework' && state.homework !== 'none';
  need(isCurrent || isHomework, 'هذه الخطوة غير معروضة الآن.', 403);
  return publicStep(step, state.revealed[step.id] || []);
}

export function segmentAudio(state, plan, stepId, index) {
  const step = plan.steps.find(s => s.id === stepId);
  need(step && step === current(state, plan) && step.type === 'interactive' && state.live && state.shown && state.narrator?.segment === index, 'هذا المقطع غير معروض الآن.', 403);
  const g = step.narrator.segments[index];
  return g.audio ? {mode: 'recorded', audio: g.audio} : {mode: 'speech', text: g.text};
}

export function narrationFor(state, plan, stepId) {
  const step = plan.steps.find(s => s.id === stepId);
  need(step && step === current(state, plan) && state.live && state.shown && step.narration.mode !== 'live', 'لا يوجد شرح صوتي معروض الآن.', 403);
  return step.narration;
}
