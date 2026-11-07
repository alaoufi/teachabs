// Order of grade 4 lessons, term 1, taken from the contents pages of the Ministry of Education books (1447 AH / 2025
// edition). Only unit, chapter and lesson TITLES and their ORDER are recorded here, to plan lessons in the same
// sequence the students follow. No textbook text, exercises or images are copied; lesson content in the app is original.
// `template` names a ready lesson in LESSON_TEMPLATES (group-plan.js) when one exists.

import {LESSON_PREPS} from './lesson-preps-g4.js';

export const CURRICULUM_SOURCE = 'ترتيب الدروس من فهرس كتابي وزارة التعليم للصف الرابع، الفصل الدراسي الأول، طبعة ١٤٤٧هـ. العناوين والترتيب فقط؛ محتوى الدروس في التطبيق أصلي.';

export const CURRICULUM_G4_T1 = {
  science: {name: 'العلوم', units: [
    {title: 'الوحدة الأولى: المخلوقات الحية', chapters: [
      {title: 'الفصل الأول: ممالك المخلوقات الحية', lessons: [
        {id: 's1-1-1', title: 'الخلايا', template: 'cells'},
        {id: 's1-1-2', title: 'تصنيف المخلوقات الحية'}]},
      {title: 'الفصل الثاني: المملكة الحيوانية', lessons: [
        {id: 's1-2-1', title: 'الحيوانات اللافقارية'},
        {id: 's1-2-2', title: 'الحيوانات الفقارية'},
        {id: 's1-2-3', title: 'أجهزة أجسام الحيوانات'}]}]},
    {title: 'الوحدة الثانية: الأنظمة البيئية', chapters: [
      {title: 'الفصل الثالث: استكشاف الأنظمة البيئية', lessons: [
        {id: 's2-3-1', title: 'مقدمة في الأنظمة البيئية'},
        {id: 's2-3-2', title: 'العلاقات في الأنظمة البيئية'},
        {id: 's2-3-3', title: 'التغيرات في الأنظمة البيئية'}]}]},
    {title: 'الوحدة الثالثة: صحة الإنسان', chapters: [
      {title: 'الفصل الرابع: الأمراض والعدوى', lessons: [
        {id: 's3-4-1', title: 'الأمراض'},
        {id: 's3-4-2', title: 'العدوى وانتقالها'}]},
      {title: 'الفصل الخامس: التغذية والصحة', lessons: [
        {id: 's3-5-1', title: 'المحافظة على الصحة'},
        {id: 's3-5-2', title: 'الغذاء والتغذية'}]}]}
  ]},
  math: {name: 'الرياضيات', units: [
    {title: 'الفصل ١: القيمة المنزلية', chapters: [{title: '', lessons: [
      {id: 'm1-1', title: 'القيمة المنزلية ضمن مئات الألوف', template: 'placevalue'},
      {id: 'm1-2', title: 'القيمة المنزلية ضمن الملايين'},
      {id: 'm1-3', title: 'مهارة حل المسألة: استعمال الخطوات الأربع'},
      {id: 'm1-4', title: 'المقارنة بين الأعداد'},
      {id: 'm1-5', title: 'ترتيب الأعداد'},
      {id: 'm1-6', title: 'تقريب الأعداد'},
      {id: 'm1-7', title: 'استقصاء حل المسألة: اختيار الخطة المناسبة'}]}]},
    {title: 'الفصل ٢: الجمع والطرح', chapters: [{title: '', lessons: [
      {id: 'm2-1', title: 'الجبر: خصائص الجمع وقواعد الطرح'},
      {id: 'm2-2', title: 'تقدير المجموع والفرق'},
      {id: 'm2-3', title: 'مهارة حل المسألة: التقدير أو الإجابة الدقيقة'},
      {id: 'm2-4', title: 'الجمع'},
      {id: 'm2-5', title: 'الطرح'},
      {id: 'm2-6', title: 'الطرح مع وجود الأصفار'}]}]},
    {title: 'الفصل ٣: تنظيم البيانات وعرضها وتفسيرها', chapters: [{title: '', lessons: [
      {id: 'm3-1', title: 'جمع البيانات وتنظيمها'},
      {id: 'm3-2', title: 'خطة حل المسألة: إنشاء جدول'},
      {id: 'm3-3', title: 'التمثيل بالأعمدة'},
      {id: 'm3-4', title: 'التمثيل بالخطوط'},
      {id: 'm3-5', title: 'التمثيل بالقطاعات الدائرية'},
      {id: 'm3-6', title: 'الاحتمال'}]}]},
    {title: 'الفصل ٤: الأنماط والجبر', chapters: [{title: '', lessons: [
      {id: 'm4-1', title: 'العبارات والجمل العددية'},
      {id: 'm4-2', title: 'تمثيل الجمل العددية وكتابتها'},
      {id: 'm4-3', title: 'خطة حل المسألة: الاستدلال المنطقي'},
      {id: 'm4-4', title: 'اكتشاف قاعدة من جدول'},
      {id: 'm4-5', title: 'جداول الدوال: جداول الجمع والطرح'},
      {id: 'm4-6', title: 'استقصاء حل المسألة: اختيار الخطة المناسبة'},
      {id: 'm4-7', title: 'جداول الدوال: جداول الضرب والقسمة'}]}]},
    {title: 'الفصل ٥: الضرب في عدد من رقم واحد', chapters: [{title: '', lessons: [
      {id: 'm5-1', title: 'القواسم والمضاعفات'},
      {id: 'm5-2', title: 'الضرب في مضاعفات ١٠ و١٠٠ و١٠٠٠'},
      {id: 'm5-3', title: 'مهارة حل المسألة: تقدير معقولية الإجابة'},
      {id: 'm5-4', title: 'تقدير نواتج الضرب'},
      {id: 'm5-5', title: 'ضرب عدد من رقمين في عدد من رقم واحد دون إعادة التجميع'},
      {id: 'm5-6', title: 'ضرب عدد من رقمين في عدد من رقم واحد مع إعادة التجميع'},
      {id: 'm5-7', title: 'استقصاء حل المسألة: اختيار الخطة المناسبة'},
      {id: 'm5-8', title: 'ضرب عدد من ثلاثة أرقام في عدد من رقم واحد'}]}]},
    {title: 'الفصل ٦: الضرب في عدد من رقمين', chapters: [{title: '', lessons: [
      {id: 'm6-1', title: 'الضرب في مضاعفات العشرة'},
      {id: 'm6-2', title: 'تقدير نواتج الضرب'},
      {id: 'm6-3', title: 'خطة حل المسألة: تمثيل المسألة'},
      {id: 'm6-4', title: 'ضرب عدد من رقمين في عدد من رقمين'},
      {id: 'm6-5', title: 'ضرب عدد من ثلاثة أرقام في عدد من رقمين'}]}]}
  ]}
};

// Every lesson with a ready prep in lesson-preps-g4.js starts from it in one click.
for (const sub of Object.values(CURRICULUM_G4_T1)) for (const u of sub.units) for (const c of u.chapters) for (const l of c.lessons) if (!l.template && LESSON_PREPS[l.id]) l.template = 'g4-' + l.id;

/** Every lesson in order with its subject, for counting and lookups. */
export function curriculumLessons() {
  return Object.entries(CURRICULUM_G4_T1).flatMap(([subject, s]) => s.units.flatMap(u => u.chapters.flatMap(c => c.lessons.map(l => ({...l, subject, unit: u.title, chapter: c.title})))));
}
