// Registry and index page for standalone interactive lessons (original content, not an official curriculum mapping).
import {SCIENCE_SHADOW_ROUTE} from './science-lesson.mjs';

const SUBJECTS = {science: 'العلوم', math: 'الرياضيات', arabic: 'لغتي', english: 'الإنجليزية', islamic: 'الدراسات الإسلامية'};
const GRADES = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس'];

export const interactiveLessons = [
  {id: 'science-g4-shadows', subject: 'science', grade: 4, title: 'الضوء والظل', question: 'لماذا يتغير ظلّي خلال اليوم؟',
    summary: 'حرّك الشمس وغيّر طول اللوح ومادته، وشاهد الظل يتغير فورًا. خمسة تحديات وثلاثة أسئلة تصحَّح مباشرة.',
    href: SCIENCE_SHADOW_ROUTE, status: 'نموذج للمراجعة'}
];

export const LESSONS_ROUTE = '/lessons';

export function lessonsIndex() {
  const groups = new Map();
  for (const lesson of interactiveLessons) {
    const key = `${lesson.subject}-${lesson.grade}`;
    if (!groups.has(key)) groups.set(key, {subject: lesson.subject, grade: lesson.grade, items: []});
    groups.get(key).items.push(lesson);
  }
  const sections = [...groups.values()].sort((a, b) => a.grade - b.grade || a.subject.localeCompare(b.subject)).map(g => `<section class="lessons-group" aria-labelledby="lessons-${g.subject}-${g.grade}">
  <h2 id="lessons-${g.subject}-${g.grade}">${SUBJECTS[g.subject]} · الصف ${GRADES[g.grade]} الابتدائي</h2>
  <div class="cards">${g.items.map(l => `<article class="panel lesson-card" id="${l.id}"><span class="lesson-status">${l.status}</span><h3>${l.title}</h3><p class="lesson-question">${l.question}</p><p>${l.summary}</p><a class="btn" href="${l.href}">ابدأ الدرس</a></article>`).join('')}</div>
 </section>`).join('');
  return `<section class="lessons-page" dir="rtl"><div class="section-head welcome-panel"><div class="eyebrow">دروس تفاعلية</div><h1>الدروس</h1><p>دروس يتحكم فيها الطالب ويرى النتيجة فورًا، تعمل على الجوال والحاسب ولا تحفظ بيانات. المحتوى أصلي من إعداد المشروع، ولم تُطابَق الدروس بعدُ مع الكتب المعتمدة.</p></div>
 ${sections}
 <p>يمكن للمعلم أيضًا فتح الدرس من قائمة «الدرس» داخل الحصة. <a class="textlink" href="/lesson/teacher">مدخل المعلم</a> · <a class="textlink" href="/demo">أقسام التجربة</a></p>
</section>`;
}
