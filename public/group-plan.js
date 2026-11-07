// Lesson plan for the group class: the teacher arranges ordered steps before class.
// Shared by the server (validation) and the browser (planner and live views). Pure functions only.
import {ACTIVITIES, cleanValues} from './activities.js';

export const STEP_TYPES = {
  page: {label: 'صفحة المنهج على السبورة', short: 'المنهج'},
  interactive: {label: 'الشرح التفاعلي المطوّر', short: 'الشرح التفاعلي'},
  board: {label: 'نصوص وصور مجهزة قبل الحصة', short: 'النصوص المجهزة'},
  questions: {label: 'أسئلة يجيب عنها الطلاب', short: 'الأسئلة'},
  homework: {label: 'الواجب', short: 'الواجب'},
  evaluation: {label: 'تقييم الطلاب', short: 'التقييم'}
};
// The order of a lesson on the one board: the curriculum page, prepared texts, the interactive explanation, then questions.
export const STEP_ORDER = ['page', 'board', 'interactive', 'questions', 'homework', 'evaluation'];
/** Puts a template's steps in the lesson order (stable within a type). */
export function inLessonOrder(plan) { plan.steps.sort((a, b) => STEP_ORDER.indexOf(a.type) - STEP_ORDER.indexOf(b.type)); return plan; }

export const NARRATION = {
  live: 'شرح مباشر بصوت المعلم',
  recorded: 'تسجيل صوتي يجهزه المعلم مسبقًا',
  speech: 'نص يقرؤه الجهاز بالعربية'
};

export const SUBJECTS = {science: 'العلوم', math: 'الرياضيات', arabic: 'لغتي', english: 'الإنجليزية', islamic: 'الدراسات الإسلامية'};

// Original practice pages drawn by the project. They are NOT official textbook pages.
export const ORIGINAL_PAGES = {
  'science-4-light': {title: 'علوم ٤ — الضوء والظل (صفحة أصلية للتجربة)', lines: ['الضوء والظل', 'ينتقل الضوء في خطوط مستقيمة.', 'عندما يحجب جسمٌ الضوء يتكون خلفه ظل.', 'يتغير طول الظل واتجاهه بتغير موقع مصدر الضوء.', 'سؤال: لماذا يكون ظلك طويلًا في الصباح الباكر؟']},
  'science-4-matter': {title: 'علوم ٤ — حالات المادة (صفحة أصلية للتجربة)', lines: ['حالات المادة', 'للمادة ثلاث حالات: صلبة وسائلة وغازية.', 'الماء يكون جليدًا صلبًا، أو ماءً سائلًا، أو بخارًا غازيًا.', 'التسخين والتبريد يغيّران حالة المادة.', 'سؤال: ماذا يحدث لمكعب الجليد في يوم حار؟']},
  'science-4-cells': {title: 'علوم ٤ — الخلايا (صفحة أصلية للتجربة)', lines: ['الخلايا', 'كل مخلوق حي يتكون من خلية واحدة أو من خلايا كثيرة.', 'الخلية أصغر وحدة في بناء المخلوق الحي.', 'خلايا متشابهة ← نسيج ← عضو ← جهاز ← مخلوق حي.', 'سؤال: ما الذي تملكه الخلية النباتية ولا تملكه الحيوانية؟']},
  'math-4-placevalue': {title: 'رياضيات ٤ — القيمة المنزلية (صفحة أصلية للتجربة)', lines: ['القيمة المنزلية ضمن مئات الألوف', 'منزلة الرقم تحدد قيمته في العدد.', 'كل منزلة قيمتها عشرة أمثال المنزلة التي على يمينها.', 'نكتب العدد بالصيغة القياسية: ٣٤٥٬٦٧٨', 'وبالصيغة التحليلية: ٣٠٠٠٠٠ + ٤٠٠٠٠ + ٥٠٠٠ + ٦٠٠ + ٧٠ + ٨']},
  'math-1-p1': {title: 'رياضيات ١ — نبني عددًا (صفحة أصلية للتجربة)', lines: ['نبني عددًا', 'ارسم ثلاث دوائر ثم أضف دائرتين بلون آخر.', 'صف ما فعلته. كم دائرة ترى الآن؟']},
  'math-1-p2': {title: 'رياضيات ١ — نقارن مجموعتين (صفحة أصلية للتجربة)', lines: ['نقارن مجموعتين', 'ارسم أربعة مربعات وست دوائر.', 'صل كل مربع بدائرة واشرح ما تلاحظه.']}
};

const escapeXml = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);

export function renderOriginalPage(id) {
  const page = ORIGINAL_PAGES[id] || ORIGINAL_PAGES['science-4-light'];
  const lines = page.lines.map((line, i) => `<text x="940" y="${150 + i * 70}" font-size="${i ? 30 : 42}" font-weight="${i ? 400 : 700}">${escapeXml(line)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600" class="gl-page-svg" role="img" aria-label="${escapeXml(page.lines.join('. '))}"><rect width="1000" height="600" rx="14" fill="#fffdf5" stroke="#8baa9c" stroke-width="2"/><g font-family="system-ui, Arial, sans-serif" fill="#173e34" direction="rtl" text-anchor="start">${lines}<text x="940" y="565" font-size="18" fill="#7a5a00">مادة أصلية للتجربة — ليست صفحة من كتاب رسمي</text></g><path d="M60 470H940M60 520H940" stroke="#dae7df" stroke-dasharray="8 8"/></svg>`;
}

// ---------- validation ----------
export class PlanError extends Error {}
const need = (ok, message) => { if (!ok) throw new PlanError(message); };
const text = (value, max, label, {required = true} = {}) => {
  const v = typeof value === 'string' ? value.trim() : '';
  need(!required || v.length > 0, `اكتب ${label}.`);
  need(v.length <= max, `${label} أطول من ${max} حرفًا.`);
  return v;
};
const ID = /^[a-z0-9-]{1,40}$/;
const IMAGE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;
const AUDIO = /^data:audio\/(webm|ogg|mp4|mpeg)(;codecs=[a-z0-9.]+)?;base64,[A-Za-z0-9+/]+=*$/;
/** 🚦 work symbols shown to the class (an idea from Classroomscreen). */
export const WORK_MODES = {none: 'بلا', silent: '🤫 عمل بصمت', whisper: '🗣 همس', pairs: '👥 عمل ثنائي', groups: '👨‍👩‍👧 عمل في مجموعات', listen: '👂 استمعوا'};
export const LIMITS = {steps: 20, image: 900_000, audio: 1_500_000, plan: 9_000_000, items: 12, questions: 10, criteria: 6, snippets: 12, segments: 12};

export function validImage(value) { return typeof value === 'string' && value.length <= LIMITS.image && IMAGE.test(value); }

function questionList(raw, label) {
  need(Array.isArray(raw) && raw.length >= 1 && raw.length <= LIMITS.questions, `أضف من سؤال إلى ${LIMITS.questions} أسئلة في ${label}.`);
  const ids = new Set();
  return raw.map((q, i) => {
    need(q && ID.test(q.id) && !ids.has(q.id), 'معرّف سؤال غير صالح.'); ids.add(q.id);
    const prompt = text(q.prompt, 200, `نص السؤال ${i + 1}`);
    if (q.kind === 'text') return {id: q.id, kind: 'text', prompt};
    need(Array.isArray(q.options) && q.options.length >= 2 && q.options.length <= 4, `السؤال ${i + 1} يحتاج من خيارين إلى أربعة.`);
    const options = q.options.map((o, j) => text(o, 100, `الخيار ${j + 1} في السؤال ${i + 1}`));
    need(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < options.length, `اختر الإجابة الصحيحة للسؤال ${i + 1}.`);
    return {id: q.id, kind: 'choice', prompt, options, answer: q.answer};
  });
}

function narration(raw) {
  const mode = raw?.mode || 'live';
  need(Object.hasOwn(NARRATION, mode), 'طريقة شرح صوتي غير معروفة.');
  const out = {mode};
  if (mode === 'speech') out.text = text(raw.text, 600, 'نص الشرح الذي يقرؤه الجهاز');
  if (mode === 'recorded') { need(typeof raw.audio === 'string' && raw.audio.length <= LIMITS.audio && AUDIO.test(raw.audio), 'سجّل الشرح الصوتي (حتى دقيقة ونصف تقريبًا).'); out.audio = raw.audio; }
  return out;
}

/** The narrated tour for an activity; a lesson without one gets the activity's ready script. */
function narratorScript(activity, raw) {
  const a = ACTIVITIES[activity], segments = raw?.segments ?? a.narrator();
  need(Array.isArray(segments) && segments.length >= 1 && segments.length <= LIMITS.segments, `جولة المتحدث من مقطع إلى ${LIMITS.segments} مقطعًا.`);
  const ids = new Set();
  return {segments: segments.map((g, i) => {
    need(g && ID.test(g.id) && !ids.has(g.id), 'معرّف مقطع غير صالح.'); ids.add(g.id);
    // Older lessons stored the shadow values directly on the segment.
    const rawValues = g.values ?? Object.fromEntries(a.params.map(p => [p.key, g[p.key]]).filter(([, v]) => v !== undefined));
    let values;
    try { values = cleanValues(activity, rawValues); } catch (e) { throw new PlanError(`المقطع ${i + 1}: ${e.message}`); }
    for (const p of a.params) if (p.kind === 'range' && Object.hasOwn(rawValues, p.key)) need(Number(rawValues[p.key]) >= p.min && Number(rawValues[p.key]) <= p.max, `المقطع ${i + 1}: ${p.label} خارج المدى.`);
    const out = {id: g.id, values, text: text(g.text, 300, `نص المقطع ${i + 1}`)};
    if (g.audio !== undefined) { need(typeof g.audio === 'string' && g.audio.length <= LIMITS.audio && AUDIO.test(g.audio), `تسجيل المقطع ${i + 1} غير صالح.`); out.audio = g.audio; }
    return out;
  })};
}

export function validatePlan(raw) {
  need(raw && typeof raw === 'object', 'خطة غير صالحة.');
  need(JSON.stringify(raw).length <= LIMITS.plan, 'حجم الدرس كبير. قلل الصور أو التسجيلات.');
  const plan = {version: 1, title: text(raw.title, 80, 'عنوان الدرس'), subject: raw.subject, grade: raw.grade, speaker: raw.speaker === 'female' ? 'female' : 'male'}; // the narrator's voice
  need(Object.hasOwn(SUBJECTS, plan.subject), 'اختر المادة.');
  need(Number.isInteger(plan.grade) && plan.grade >= 1 && plan.grade <= 6, 'اختر الصف من الأول إلى السادس.');
  need(Array.isArray(raw.steps) && raw.steps.length >= 1 && raw.steps.length <= LIMITS.steps, `الدرس يحتاج من خطوة إلى ${LIMITS.steps} خطوة.`);
  const ids = new Set();
  plan.steps = raw.steps.map((s, i) => {
    need(s && ID.test(s.id) && !ids.has(s.id), 'معرّف خطوة غير صالح.'); ids.add(s.id);
    need(Object.hasOwn(STEP_TYPES, s.type), 'نوع خطوة غير معروف.');
    const step = {id: s.id, type: s.type, title: text(s.title, 80, `عنوان الخطوة ${i + 1}`), startHidden: s.startHidden === true, narration: narration(s.narration)};
    const snippets = s.snippets === undefined ? [] : s.snippets;
    need(Array.isArray(snippets) && snippets.length <= LIMITS.snippets, `حتى ${LIMITS.snippets} نصوص جاهزة لكل خطوة.`);
    step.snippets = snippets.map((t, j) => text(t, 200, `النص الجاهز ${j + 1}`));
    if (s.type === 'page') {
      if (s.source === 'upload') {
        need(validImage(s.image), 'ارفع صورة الصفحة بصيغة PNG أو JPEG أو WebP حتى ٦٥٠ كيلوبايت تقريبًا.');
        need(s.rights === true, 'أكّد أن لديك حق عرض هذه الصفحة على طلابك.');
        Object.assign(step, {source: 'upload', image: s.image, rights: true});
      } else {
        need(Object.hasOwn(ORIGINAL_PAGES, s.page), 'اختر صفحة أصلية.');
        Object.assign(step, {source: 'original', page: s.page});
      }
    } else if (s.type === 'interactive') {
      need(Object.hasOwn(ACTIVITIES, s.activity), 'اختر نشاطًا تفاعليًا من القائمة.');
      step.activity = s.activity;
      step.narrator = narratorScript(s.activity, s.narrator);
    } else if (s.type === 'board') {
      need(Array.isArray(s.items) && s.items.length >= 1 && s.items.length <= LIMITS.items, `جهّز من عنصر إلى ${LIMITS.items} عناصر للسبورة.`);
      const itemIds = new Set();
      step.items = s.items.map((item, j) => {
        need(item && ID.test(item.id) && !itemIds.has(item.id), 'معرّف عنصر غير صالح.'); itemIds.add(item.id);
        if (item.kind === 'image') { need(validImage(item.image), `الصورة ${j + 1} يجب أن تكون PNG أو JPEG أو WebP صغيرة.`); return {id: item.id, kind: 'image', image: item.image, caption: text(item.caption, 100, 'وصف الصورة', {required: false})}; }
        need(item.kind === 'text', 'نوع عنصر غير معروف.');
        return {id: item.id, kind: 'text', text: text(item.text, 300, `نص العنصر ${j + 1}`), ...placeOf(item.at)};
      }).map((it, j) => it.kind === 'image' ? {...it, ...placeOf(s.items[j].at)} : it);
    } else if (s.type === 'questions') {
      step.questions = questionList(s.questions, 'أسئلة الحصة');
    } else if (s.type === 'homework') {
      step.instructions = text(s.instructions, 300, 'تعليمات الواجب', {required: false});
      step.questions = questionList(s.questions, 'الواجب');
    } else {
      const criteria = Array.isArray(s.criteria) ? s.criteria : [];
      need(criteria.length >= 1 && criteria.length <= LIMITS.criteria, `اكتب من معيار إلى ${LIMITS.criteria} معايير للتقييم.`);
      step.criteria = criteria.map((c, j) => text(c, 40, `المعيار ${j + 1}`));
    }
    return step;
  });
  need(JSON.stringify(plan).length <= LIMITS.plan, 'حجم الدرس كبير. قلل الصور أو التسجيلات.');
  return plan;
}

/** A prepared card's planned place on the board (logical 1000×600): its top-left corner and width. */
function placeOf(at) {
  if (at === undefined || at === null) return {};
  need(typeof at === 'object' && Number.isFinite(at.x) && Number.isFinite(at.y) && at.x >= 0 && at.x <= 1000 && at.y >= 0 && at.y <= 600 && ['half', 'full'].includes(at.w ?? 'half'), 'مكان بطاقة غير صالح.');
  return {at: {x: Math.round(at.x), y: Math.round(at.y), w: at.w ?? 'half'}};
}
export const CARD = {top: 96, gap: 16, side: 20, half: 465, full: 960, font: 26, line: 36, pad: 34, perLine: {half: 30, full: 64}, image: 330};
/** Rough height of a card, so cards placed automatically never sit on each other. */
export function cardHeight(item, w = 'half') {
  if (item.kind === 'image') return CARD.image;
  const lines = String(item.text || '').split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / CARD.perLine[w])), 0);
  return CARD.pad + lines * CARD.line;
}
/**
 * Where every prepared card sits on the board. Cards the teacher placed keep their place; the others fill two
 * columns from the top right, each under the previous one, so nothing overlaps. Same result on every device.
 */
export function boardLayout(items) {
  const cols = [{x: 1000 - CARD.side - CARD.half, y: CARD.top}, {x: CARD.side, y: CARD.top}], out = {};
  for (const it of items) {
    if (it.at) { out[it.id] = {...it.at, h: cardHeight(it, it.at.w)}; continue; }
    const c = cols[0].y <= cols[1].y ? cols[0] : cols[1], h = cardHeight(it);
    out[it.id] = {x: c.x, y: c.y, w: 'half', h, auto: true}; c.y += h + CARD.gap;
  }
  return out;
}

/** What a student may receive for a step: no answer keys, only revealed board items. */
export function publicStep(step, revealed = []) {
  const base = {id: step.id, type: step.type, title: step.title};
  if (step.type === 'page') return {...base, source: step.source, page: step.page, image: step.source === 'upload' ? step.image : undefined};
  if (step.type === 'interactive') return {...base, activity: step.activity};
  if (step.type === 'board') { const at = boardLayout(step.items); return {...base, items: step.items.filter(i => revealed.includes(i.id)).map(i => ({...i, place: at[i.id]}))}; } // each card with its place among all cards
  if (step.type === 'questions' || step.type === 'homework') return {...base, instructions: step.instructions, questions: step.questions.map(({answer, ...q}) => q)};
  return {...base, criteria: step.criteria};
}

export const RATING = ['', 'يحتاج دعمًا', 'مقبول', 'جيد', 'متميز'];

/** Ready lesson templates for grade 4 (original content). Cells and place value follow the 1447 AH Ministry book order; light and matter are not in term 1. */
export const LESSON_TEMPLATES = {
  cells: {title: 'الخلايا', subject: 'science', plan: () => inLessonOrder(cellsPlan())},
  placevalue: {title: 'القيمة المنزلية ضمن مئات الألوف', subject: 'math', plan: () => inLessonOrder(placeValuePlan())},
  light: {title: 'الضوء والظل', subject: 'science', plan: () => inLessonOrder(defaultPlan())},
  matter: {title: 'حالات المادة', subject: 'science', plan: () => inLessonOrder(matterPlan())}
};

/** Science 4, term 1, unit 1, chapter 1, lesson 1 (order from the 1447 AH Ministry book; content is original). */
export function cellsPlan() {
  return {version: 1, title: 'الخلايا', subject: 'science', grade: 4, steps: [
    {id: 'curriculum', type: 'page', title: 'نقرأ صفحة الدرس', source: 'original', page: 'science-4-cells', narration: {mode: 'speech', text: 'درسنا اليوم: الخلايا. كل مخلوق حي، نباتًا كان أو حيوانًا أو إنسانًا، يتكون من خلية واحدة أو من خلايا كثيرة. والخلية هي أصغر وحدة في بناء المخلوق الحي. الخلايا المتشابهة تكوّن نسيجًا، والأنسجة تكوّن عضوًا، والأعضاء تكوّن جهازًا حيويًا. فكّروا معي: ما الذي تملكه الخلية النباتية ولا تملكه الحيوانية؟'}, snippets: ['الخلية', 'النسيج', 'العضو', 'الجهاز الحيوي', 'النواة', 'جدار الخلية']},
    {id: 'explain', type: 'interactive', title: 'نجرب: نكبّر حتى نرى الخلية', activity: 'cells', snippets: ['خلايا ← نسيج ← عضو ← جهاز', 'النباتية فقط: جدار وبلاستيدات خضراء'], narration: {mode: 'live'}},
    {id: 'board-notes', type: 'board', title: 'النقاط الأساسية', narration: {mode: 'speech', text: 'لنثبّت النقاط الأساسية: الخلية أصغر وحدة في بناء المخلوق الحي. خلايا متشابهة تكوّن نسيجًا، ثم عضوًا، ثم جهازًا حيويًا، ثم مخلوقًا حيًا. في الخليتين غشاء خلوي ونواة وسيتوبلازم وميتوكندريا، وتنفرد الخلية النباتية بجدار الخلية والبلاستيدات الخضراء وفجوة كبيرة.'}, items: [
      {id: 'n1', kind: 'text', text: 'الخلية أصغر وحدة في بناء المخلوق الحي.'},
      {id: 'n2', kind: 'text', text: 'خلايا متشابهة ← نسيج ← عضو ← جهاز حيوي ← مخلوق حي.'},
      {id: 'n3', kind: 'text', text: 'في الخليتين: غشاء خلوي ونواة وسيتوبلازم وميتوكندريا.'},
      {id: 'n4', kind: 'text', text: 'النباتية فقط: جدار خلية وبلاستيدات خضراء وفجوة كبيرة.'}]},
    {id: 'check', type: 'questions', title: 'أسئلة سريعة', narration: {mode: 'live'}, questions: [
      {id: 'q1', kind: 'choice', prompt: 'أي جزء يتحكم في أنشطة الخلية؟', options: ['النواة', 'الفجوة', 'جدار الخلية'], answer: 0},
      {id: 'q2', kind: 'choice', prompt: 'أي جزء يوجد في الخلية النباتية ولا يوجد في الحيوانية؟', options: ['الغشاء الخلوي', 'البلاستيدات الخضراء', 'الميتوكندريا'], answer: 1},
      {id: 'q3', kind: 'choice', prompt: 'رتّب من الأصغر إلى الأكبر:', options: ['خلية ← نسيج ← عضو ← جهاز', 'عضو ← خلية ← جهاز ← نسيج', 'نسيج ← خلية ← عضو ← جهاز'], answer: 0},
      {id: 'q4', kind: 'text', prompt: 'بكلماتك: لماذا تحتاج الخلية النباتية إلى البلاستيدات الخضراء؟'}]},
    {id: 'homework', type: 'homework', title: 'واجب الدرس', instructions: 'ارسم خلية نباتية وخلية حيوانية، واكتب اسم كل جزء، ثم أجب.', narration: {mode: 'live'}, questions: [
      {id: 'h1', kind: 'choice', prompt: 'ما الذي يدعم الخلية النباتية ويحميها؟', options: ['جدار الخلية', 'النواة', 'السيتوبلازم'], answer: 0},
      {id: 'h2', kind: 'choice', prompt: 'القلب في جسم الإنسان:', options: ['خلية', 'نسيج', 'عضو'], answer: 2},
      {id: 'h3', kind: 'text', prompt: 'اذكر شيئين تتشابه فيهما الخلية النباتية والحيوانية، وشيئًا تختلفان فيه.'}]},
    {id: 'evaluate', type: 'evaluation', title: 'تقييم الطلاب', narration: {mode: 'live'}, criteria: ['المشاركة', 'فهم الدرس', 'الواجب']}
  ]};
}

/** Math 4, term 1, chapter 1, lesson 1 (order from the 1447 AH Ministry book; content is original). */
export function placeValuePlan() {
  return {version: 1, title: 'القيمة المنزلية ضمن مئات الألوف', subject: 'math', grade: 4, steps: [
    {id: 'curriculum', type: 'page', title: 'نقرأ صفحة الدرس', source: 'original', page: 'math-4-placevalue', narration: {mode: 'speech', text: 'درسنا اليوم: القيمة المنزلية ضمن مئات الألوف. منزلة الرقم في العدد هي التي تحدد قيمته، فالرقم أربعة في منزلة عشرات الألوف قيمته أربعون ألفًا. وكل منزلة قيمتها عشرة أمثال المنزلة التي على يمينها. نكتب العدد بالصيغة القياسية بالأرقام، وبالصيغة التحليلية مجموعًا لقيم أرقامه.'}, snippets: ['المنزلة', 'القيمة', 'الصيغة القياسية', 'الصيغة التحليلية', 'الألوف', 'الآحاد']},
    {id: 'explain', type: 'interactive', title: 'نجرب: لوحة المنازل', activity: 'placevalue', snippets: ['كل منزلة = ١٠ أمثال التي على يمينها', 'الصفر يحفظ المنزلة الفارغة'], narration: {mode: 'live'}},
    {id: 'board-notes', type: 'board', title: 'النقاط الأساسية', narration: {mode: 'speech', text: 'النقاط الأساسية: دورة الألوف فيها مئات الألوف وعشرات الألوف وآحاد الألوف، ودورة الآحاد فيها المئات والعشرات والآحاد. وإذا كانت منزلة فارغة نكتب فيها صفرًا ليحفظ مكانها.'}, items: [
      {id: 'n1', kind: 'text', text: 'منزلة الرقم تحدد قيمته: ٤ في عشرات الألوف = ٤٠٬٠٠٠'},
      {id: 'n2', kind: 'text', text: 'الألوف: مئات الألوف · عشرات الألوف · آحاد الألوف'},
      {id: 'n3', kind: 'text', text: 'الآحاد: المئات · العشرات · الآحاد'},
      {id: 'n4', kind: 'text', text: 'الصيغة التحليلية: ٢٠٠٠٠٠ + ٦٠٠٠ + ٣٠ = ٢٠٦٬٠٣٠'}]},
    {id: 'check', type: 'questions', title: 'أسئلة سريعة', narration: {mode: 'live'}, questions: [
      {id: 'q1', kind: 'choice', prompt: 'ما قيمة الرقم ٦ في العدد ٤٦٢٬٠٥١؟', options: ['٦٠٠', '٦٠٬٠٠٠', '٦٬٠٠٠'], answer: 1},
      {id: 'q2', kind: 'choice', prompt: 'في أي منزلة يقع الرقم ٨ في العدد ٨٠٣٬٢١٤؟', options: ['مئات الألوف', 'عشرات الألوف', 'المئات'], answer: 0},
      {id: 'q3', kind: 'choice', prompt: 'الصيغة القياسية للعدد ٧٠٠٠٠٠ + ٣٠٠٠ + ٥ هي:', options: ['٧٣٬٠٠٥', '٧٠٣٬٠٠٥', '٧٠٣٬٠٥٠'], answer: 1},
      {id: 'q4', kind: 'text', prompt: 'اكتب عددًا من ستة أرقام فيه الرقم ٩ في منزلة عشرات الألوف.'}]},
    {id: 'homework', type: 'homework', title: 'واجب الدرس', instructions: 'ابحث في البيت عن عدد كبير (فاتورة، كتاب، خبر) واكتبه، ثم أجب.', narration: {mode: 'live'}, questions: [
      {id: 'h1', kind: 'choice', prompt: 'ما قيمة الرقم ٣ في العدد ١٣٥٬٧٢٠؟', options: ['٣٬٠٠٠', '٣٠٬٠٠٠', '٣٠٠'], answer: 1},
      {id: 'h2', kind: 'choice', prompt: 'أي عدد فيه الرقم ٥ قيمته خمسمئة؟', options: ['٥٢٬٠١٠', '٢٠٥٬١٠٠', '١٠٢٬٥٠٠'], answer: 2},
      {id: 'h3', kind: 'text', prompt: 'اكتب العدد الذي وجدته بالصيغة التحليلية.'}]},
    {id: 'evaluate', type: 'evaluation', title: 'تقييم الطلاب', narration: {mode: 'live'}, criteria: ['المشاركة', 'فهم الدرس', 'الواجب']}
  ]};
}

export function matterPlan() {
  return {version: 1, title: 'حالات المادة', subject: 'science', grade: 4, steps: [
    {id: 'curriculum', type: 'page', title: 'نقرأ صفحة الدرس', source: 'original', page: 'science-4-matter', narration: {mode: 'speech', text: 'درسنا اليوم: حالات المادة. للمادة ثلاث حالات: صلبة وسائلة وغازية. والماء مثال رائع: يكون جليدًا صلبًا، أو ماءً سائلًا، أو بخارًا. التسخين والتبريد يغيّران حالة المادة.'}, snippets: ['صلب', 'سائل', 'غاز', 'انصهار', 'تجمد', 'تبخر', 'تكاثف']},
    {id: 'explain', type: 'interactive', title: 'نجرب: نسخّن الماء ونبرّده', activity: 'matter', snippets: ['التسخين ← انصهار ثم غليان', 'التبريد ← تكاثف ثم تجمد'], narration: {mode: 'live'}},
    {id: 'board-notes', type: 'board', title: 'النقاط الأساسية', narration: {mode: 'speech', text: 'النقاط الأساسية: الصلب له شكل ثابت وحجم ثابت. السائل له حجم ثابت ويأخذ شكل الإناء. الغاز ينتشر ويملأ المكان كله. التسخين ينقل المادة من صلب إلى سائل إلى غاز، والتبريد يعكس الطريق.'}, items: [
      {id: 'n1', kind: 'text', text: 'الصلب له شكل ثابت وحجم ثابت.'},
      {id: 'n2', kind: 'text', text: 'السائل له حجم ثابت ويأخذ شكل الإناء.'},
      {id: 'n3', kind: 'text', text: 'الغاز ينتشر ويملأ المكان كله.'},
      {id: 'n4', kind: 'text', text: 'صلب ← (تسخين) ← سائل ← (تسخين) ← غاز، والتبريد يعكس الطريق.'}]},
    {id: 'check', type: 'questions', title: 'أسئلة سريعة', narration: {mode: 'live'}, questions: [
      {id: 'q1', kind: 'choice', prompt: 'ماذا يحدث للجليد عندما نسخّنه؟', options: ['ينصهر ويصبح سائلًا', 'يصبح أصلب', 'لا يتغير'], answer: 0},
      {id: 'q2', kind: 'choice', prompt: 'الفقاعات في الماء المغلي هي:', options: ['هواء', 'بخار ماء', 'جليد'], answer: 1},
      {id: 'q3', kind: 'text', prompt: 'بكلماتك: لماذا تظهر قطرات ماء على كأس بارد؟'}]},
    {id: 'homework', type: 'homework', title: 'واجب الدرس', instructions: 'ضع مكعب جليد في صحن وراقبه كل عشر دقائق، ثم أجب.', narration: {mode: 'live'}, questions: [
      {id: 'h1', kind: 'choice', prompt: 'أي تغيير يحدث عندما يتحول البخار إلى ماء؟', options: ['الانصهار', 'التكاثف', 'التجمد'], answer: 1},
      {id: 'h2', kind: 'text', prompt: 'صف ما حدث لمكعب الجليد، ولماذا.'}]},
    {id: 'evaluate', type: 'evaluation', title: 'تقييم الطلاب', narration: {mode: 'live'}, criteria: ['المشاركة', 'فهم الدرس', 'الواجب']}
  ]};
}

export function defaultPlan() {
  return {version: 1, title: 'الضوء والظل', subject: 'science', grade: 4, steps: [
    {id: 'curriculum', type: 'page', title: 'نقرأ صفحة الدرس', source: 'original', page: 'science-4-light', narration: {mode: 'speech', text: 'درسنا اليوم: الضوء والظل. ينتقل الضوء في خطوط مستقيمة، وعندما يحجبه جسم معتم يتكوّن خلفه ظل. ويتغير طول الظل واتجاهه كلما تغيّر موقع مصدر الضوء. سؤال للتفكير: لماذا يكون ظلك طويلًا في الصباح الباكر؟'}, snippets: ['مصدر الضوء', 'جسم معتم', 'الظل', 'خط مستقيم']},
    {id: 'explain', type: 'interactive', title: 'نجرب: كيف يتغير الظل؟', activity: 'shadows', snippets: ['صباحًا: ظل طويل', 'ظهرًا: ظل قصير', 'الظل عكس الشمس'], narration: {mode: 'speech', text: 'انظروا إلى الشمس. عندما تكون منخفضة في الصباح يكون الظل طويلًا، وعندما ترتفع قرب الظهر يقصر الظل.'}},
    {id: 'board-notes', type: 'board', title: 'النقاط الأساسية', narration: {mode: 'speech', text: 'النقاط الأساسية: الضوء ينتقل في خطوط مستقيمة. الظل منطقة لا يصلها الضوء لأن جسمًا معتمًا حجبه. عندما تكون الشمس منخفضة يكون الظل طويلًا، وعندما ترتفع يقصر.'}, items: [
      {id: 'n1', kind: 'text', text: 'الضوء ينتقل في خطوط مستقيمة.'},
      {id: 'n2', kind: 'text', text: 'الظل منطقة لا يصلها الضوء لأن جسمًا معتمًا حجبه.'},
      {id: 'n3', kind: 'text', text: 'الشمس منخفضة ← ظل طويل. الشمس مرتفعة ← ظل قصير.'}]},
    {id: 'check', type: 'questions', title: 'أسئلة سريعة', narration: {mode: 'live'}, questions: [
      {id: 'q1', kind: 'choice', prompt: 'متى يكون الظل أقصر؟', options: ['في الصباح الباكر', 'قرب منتصف النهار', 'قبيل الغروب'], answer: 1},
      {id: 'q2', kind: 'choice', prompt: 'الشمس في الشرق. أين يكون الظل؟', options: ['في الغرب', 'في الشرق'], answer: 0},
      {id: 'q3', kind: 'text', prompt: 'بكلماتك: لماذا يتكون الظل؟'}]},
    {id: 'homework', type: 'homework', title: 'واجب الدرس', instructions: 'راقب ظلك في البيت مرتين في اليوم ثم أجب.', narration: {mode: 'live'}, questions: [
      {id: 'h1', kind: 'choice', prompt: 'أي مادة تصنع ظلًا داكنًا؟', options: ['الزجاج الصافي', 'الخشب', 'الورق المشمّع'], answer: 1},
      {id: 'h2', kind: 'text', prompt: 'صف ظلك في الصباح وقرب الظهر.'}]},
    {id: 'evaluate', type: 'evaluation', title: 'تقييم الطلاب', narration: {mode: 'live'}, criteria: ['المشاركة', 'فهم الدرس', 'الواجب']}
  ]};
}
