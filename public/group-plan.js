// Lesson plan for the group class: the teacher arranges ordered steps before class.
// Shared by the server (validation) and the browser (planner and live views). Pure functions only.
import {NARRATOR_SCRIPTS} from './narrator-scripts.js';

export const STEP_TYPES = {
  page: {label: 'عرض المنهج على السبورة', short: 'المنهج'},
  interactive: {label: 'الشرح التفاعلي المطوّر', short: 'الشرح التفاعلي'},
  board: {label: 'أدوات السبورة المجهزة مسبقًا', short: 'السبورة المجهزة'},
  questions: {label: 'أسئلة يجيب عنها الطلاب', short: 'الأسئلة'},
  homework: {label: 'الواجب', short: 'الواجب'},
  evaluation: {label: 'تقييم الطلاب', short: 'التقييم'}
};
export const STEP_ORDER = ['page', 'interactive', 'board', 'questions', 'homework', 'evaluation'];

export const NARRATION = {
  live: 'شرح مباشر بصوت المعلم',
  recorded: 'تسجيل صوتي يجهزه المعلم مسبقًا',
  speech: 'نص يقرؤه الجهاز بالعربية'
};

export const SUBJECTS = {science: 'العلوم', math: 'الرياضيات', arabic: 'لغتي', english: 'الإنجليزية', islamic: 'الدراسات الإسلامية'};

// Original practice pages drawn by the project. They are NOT official textbook pages.
export const ORIGINAL_PAGES = {
  'science-4-light': {title: 'علوم ٤ — الضوء والظل (صفحة أصلية للتجربة)', lines: ['الضوء والظل', 'ينتقل الضوء في خطوط مستقيمة.', 'عندما يحجب جسمٌ الضوء يتكون خلفه ظل.', 'يتغير طول الظل واتجاهه بتغير موقع مصدر الضوء.', 'سؤال: لماذا يكون ظلك طويلًا في الصباح الباكر؟']},
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

const MATERIAL_IDS = ['wood', 'paper', 'glass'];
/** The narrated tour for the animation; a lesson without one gets the ready script. */
function narratorScript(raw) {
  const segments = raw?.segments ?? structuredClone(NARRATOR_SCRIPTS.shadows.segments);
  need(Array.isArray(segments) && segments.length >= 1 && segments.length <= LIMITS.segments, `جولة المتحدث من مقطع إلى ${LIMITS.segments} مقطعًا.`);
  const ids = new Set();
  return {segments: segments.map((g, i) => {
    need(g && ID.test(g.id) && !ids.has(g.id), 'معرّف مقطع غير صالح.'); ids.add(g.id);
    need(Number.isFinite(g.hour) && g.hour >= 7 && g.hour <= 17, `وقت المقطع ${i + 1} من ٧ إلى ١٧.`);
    need(Number.isFinite(g.height ?? 1.5) && (g.height ?? 1.5) >= 1 && (g.height ?? 1.5) <= 2, `طول اللوح في المقطع ${i + 1} من ١ إلى ٢ م.`);
    need(MATERIAL_IDS.includes(g.material ?? 'wood'), `مادة المقطع ${i + 1} غير معروفة.`);
    const out = {id: g.id, hour: Math.round(g.hour * 4) / 4, height: Math.round((g.height ?? 1.5) * 10) / 10, material: g.material ?? 'wood', text: text(g.text, 300, `نص المقطع ${i + 1}`)};
    if (g.audio !== undefined) { need(typeof g.audio === 'string' && g.audio.length <= LIMITS.audio && AUDIO.test(g.audio), `تسجيل المقطع ${i + 1} غير صالح.`); out.audio = g.audio; }
    return out;
  })};
}

export function validatePlan(raw) {
  need(raw && typeof raw === 'object', 'خطة غير صالحة.');
  need(JSON.stringify(raw).length <= LIMITS.plan, 'حجم الدرس كبير. قلل الصور أو التسجيلات.');
  const plan = {version: 1, title: text(raw.title, 80, 'عنوان الدرس'), subject: raw.subject, grade: raw.grade};
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
      need(s.activity === 'shadows', 'النشاط التفاعلي المتاح الآن: الضوء والظل.');
      step.activity = 'shadows';
      step.narrator = narratorScript(s.narrator);
    } else if (s.type === 'board') {
      need(Array.isArray(s.items) && s.items.length >= 1 && s.items.length <= LIMITS.items, `جهّز من عنصر إلى ${LIMITS.items} عناصر للسبورة.`);
      const itemIds = new Set();
      step.items = s.items.map((item, j) => {
        need(item && ID.test(item.id) && !itemIds.has(item.id), 'معرّف عنصر غير صالح.'); itemIds.add(item.id);
        if (item.kind === 'image') { need(validImage(item.image), `الصورة ${j + 1} يجب أن تكون PNG أو JPEG أو WebP صغيرة.`); return {id: item.id, kind: 'image', image: item.image, caption: text(item.caption, 100, 'وصف الصورة', {required: false})}; }
        need(item.kind === 'text', 'نوع عنصر غير معروف.');
        return {id: item.id, kind: 'text', text: text(item.text, 300, `نص العنصر ${j + 1}`)};
      });
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

/** What a student may receive for a step: no answer keys, only revealed board items. */
export function publicStep(step, revealed = []) {
  const base = {id: step.id, type: step.type, title: step.title};
  if (step.type === 'page') return {...base, source: step.source, page: step.page, image: step.source === 'upload' ? step.image : undefined};
  if (step.type === 'interactive') return {...base, activity: step.activity};
  if (step.type === 'board') return {...base, items: step.items.filter(i => revealed.includes(i.id))};
  if (step.type === 'questions' || step.type === 'homework') return {...base, instructions: step.instructions, questions: step.questions.map(({answer, ...q}) => q)};
  return {...base, criteria: step.criteria};
}

export const RATING = ['', 'يحتاج دعمًا', 'مقبول', 'جيد', 'متميز'];

export function defaultPlan() {
  return {version: 1, title: 'الضوء والظل', subject: 'science', grade: 4, steps: [
    {id: 'curriculum', type: 'page', title: 'نقرأ صفحة الدرس', source: 'original', page: 'science-4-light', narration: {mode: 'live'}, snippets: ['مصدر الضوء', 'جسم معتم', 'الظل', 'خط مستقيم']},
    {id: 'explain', type: 'interactive', title: 'نجرب: كيف يتغير الظل؟', activity: 'shadows', snippets: ['صباحًا: ظل طويل', 'ظهرًا: ظل قصير', 'الظل عكس الشمس'], narration: {mode: 'speech', text: 'انظروا إلى الشمس. عندما تكون منخفضة في الصباح يكون الظل طويلًا، وعندما ترتفع قرب الظهر يقصر الظل.'}},
    {id: 'board-notes', type: 'board', title: 'نلخص على السبورة', narration: {mode: 'live'}, items: [
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
