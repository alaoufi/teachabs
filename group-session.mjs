// Pure state machine for a live group lesson. The teacher controls sequence, visibility and what is shown to everyone.
import {publicStep, RATING} from './public/group-plan.js';
import {changeShadow, visibleShadow, initialShadow} from './shadow-activity.mjs';
import {UserError} from './store.mjs';

const need = (ok, message, status = 400) => { if (!ok) throw new UserError(message, status); };
export const MAX_STUDENTS = 40, MAX_STROKES = 300, MAX_POINTS = 400;
const COLORS = ['#173e34', '#c0392b', '#1f5fa8', '#e8890c'];

export function initialState(plan) {
  return {live: true, index: 0, shown: !plan.steps[0].startHidden, revealed: {}, open: {}, display: {}, strokes: {}, shadow: initialShadow(), explore: false, homework: 'none', evaluationPublished: false, narrate: null, seq: 0};
}

const current = (state, plan) => plan.steps[state.index];

export function teacherCommand(state, plan, cmd) {
  need(cmd && typeof cmd.op === 'string', 'أمر غير صالح.');
  const s = structuredClone(state), step = current(s, plan);
  s.seq++;
  switch (cmd.op) {
    case 'go': {
      need(Number.isInteger(cmd.index) && cmd.index >= 0 && cmd.index < plan.steps.length, 'خطوة غير موجودة.');
      s.index = cmd.index; s.shown = !plan.steps[cmd.index].startHidden; return s;
    }
    case 'show': need(typeof cmd.shown === 'boolean', 'قيمة غير صالحة.'); s.shown = cmd.shown; return s;
    case 'reveal': {
      need(step.type === 'board', 'هذه الخطوة ليست سبورة مجهزة.');
      const ids = step.items.map(i => i.id), list = new Set(s.revealed[step.id] || []);
      if (cmd.all === true) ids.forEach(id => list.add(id));
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
      need(['page', 'board', 'interactive'].includes(step.type), 'الكتابة متاحة على صفحة المنهج والسبورة والشرح.');
      need(Array.isArray(cmd.points) && cmd.points.length >= 2 && cmd.points.length <= MAX_POINTS && cmd.points.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p[0] >= 0 && p[0] <= 1000 && p[1] >= 0 && p[1] <= 600), 'خط غير صالح.');
      need(COLORS.includes(cmd.color), 'لون غير متاح.');
      const list = s.strokes[step.id] || [];
      need(list.length < MAX_STROKES, 'امتلأت مساحة الكتابة في هذه الخطوة. امسحها أولًا.', 409);
      s.strokes[step.id] = [...list, {color: cmd.color, points: cmd.points.map(([x, y]) => [Math.round(x), Math.round(y)])}]; return s;
    }
    case 'undo-stroke': s.strokes[step.id] = (s.strokes[step.id] || []).slice(0, -1); return s;
    case 'clear-strokes': s.strokes[step.id] = []; return s;
    case 'shadow': {
      need(step.type === 'interactive', 'هذه الخطوة ليست الشرح التفاعلي.');
      need(['set', 'reveal', 'reset'].includes(cmd.command?.op), 'أمر غير متاح في الحصة الجماعية.');
      s.shadow = changeShadow(s.shadow, 'teacher', cmd.command); return s;
    }
    case 'explore': need(typeof cmd.on === 'boolean', 'قيمة غير صالحة.'); s.explore = cmd.on; return s;
    case 'narrate': need(step.narration.mode !== 'live', 'هذه الخطوة شرحها مباشر بصوت المعلم.'); need(['here', 'screen', 'students'].includes(cmd.target), 'جهة غير صالحة.'); s.narrate = {step: step.id, target: cmd.target, seq: s.seq}; return s;
    case 'homework': need(['none', 'open', 'closed'].includes(cmd.status) && plan.steps.some(x => x.type === 'homework'), 'لا يوجد واجب في الدرس.'); s.homework = cmd.status; return s;
    case 'publish-evaluation': need(typeof cmd.on === 'boolean', 'قيمة غير صالحة.'); s.evaluationPublished = cmd.on; return s;
    case 'live': need(typeof cmd.on === 'boolean', 'قيمة غير صالحة.'); s.live = cmd.on; return s;
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
  return {role: 'teacher', state: {...state, shadow: visibleShadow(state.shadow, 'teacher')}, current: step.id, students, results, homework, evaluations};
}

export function publicView(state, plan, student, responses, studentNames = {}) {
  const step = current(state, plan), shown = state.live && state.shown;
  const view = {role: student ? 'student' : 'display', live: state.live, title: plan.title, index: state.index, total: plan.steps.length, shown, seq: state.seq};
  if (shown) {
    const revealed = state.revealed[step.id] || [];
    view.step = {id: step.id, type: step.type, title: step.title, key: `${step.id}:${revealed.join(',')}`};
    if (['page', 'board', 'interactive'].includes(step.type)) view.strokes = state.strokes[step.id] || [];
    if (step.type === 'interactive') { view.shadow = visibleShadow(state.shadow, 'student'); view.explore = state.explore; }
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

export function narrationFor(state, plan, stepId) {
  const step = plan.steps.find(s => s.id === stepId);
  need(step && step === current(state, plan) && state.live && state.shown && step.narration.mode !== 'live', 'لا يوجد شرح صوتي معروض الآن.', 403);
  return step.narration;
}
