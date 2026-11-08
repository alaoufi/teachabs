// «مكتبة الكتب المدرسية»: the Saudi Ministry of Education textbooks for science and mathematics, elementary grades, as
// METADATA AND SOURCE LINKS ONLY. No book file is stored in this repository or on the server: when a teacher opens a book,
// the server relays only the requested parts from the source to that teacher, and a rendered page reaches the current
// class in memory (never saved). Checked 2026-11-07:
//  - the source pages and PDF links below answered 200 (application/pdf), with the page counts shown on the source page;
//  - every PDF begins with one page added by the hosting site (an advertisement), so PDF page = printed page + 1
//    (verified on real pages: grade 4 math 1-1 printed 13 / PDF 14, science «الخلايا» 26 / 27; grade 5 math p. 38, grade 1
//    science p. 48 and grade 6 math p. 140 open exactly at their lessons);
//  - the books print «طبعة ١٤٤٧هـ – 2025» (the 1448 AH edition was not found at the source; term 2 is not published yet);
//  - the links on sa.afedne.com answered error 520 and ien.edu.sa could not be reached from the checking machine.
// Source: learnatdolphin.com (a copy of the Ministry books); the official source is the «عين» portal (ien.edu.sa).

import {curriculumLessons} from './curriculum-g4.js';
import {primaryLessons} from './curriculum-primary.js';

export const BOOK_SOURCE = {name: 'منصة الدلفين (نسخة غير رسمية من كتب وزارة التعليم)', official: 'بوابة عين — وزارة التعليم', officialUrl: 'https://ien.edu.sa'};
const GRADE = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس'];
const SUBJECT = {science: 'العلوم', math: 'الرياضيات'};
const V = {
  'g1-t1-science': ['9f69e8a4', 120], 'g1-t1-math': ['ea9d7c2d', 138], 'g2-t1-science': ['4afc3a23', 178], 'g2-t1-math': ['64c6d72a', 162],
  'g3-t1-science': ['90d18c55', 205], 'g3-t1-math': ['9e095b58', 174], 'g4-t1-science': ['63ceef59', 219], 'g4-t1-math': ['5aca93c8', 200],
  'g5-t1-science': ['13de43ba', 207], 'g5-t1-math': ['801be46c', 210], 'g6-t1-science': ['3552c5b9', 214], 'g6-t1-math': ['66a042c2', 206]
};
/** Each book: where it comes from and how its printed page numbers map to the PDF. */
export const BOOKS = Object.entries(V).map(([id, [v, pages]]) => {
  const [, grade, term, subject] = id.match(/^g(\d)-t(\d)-(\w+)$/);
  return {id, track: 'general', stage: 'primary', grade: Number(grade), term: Number(term), subject,
    title: `${SUBJECT[subject]} — الصف ${GRADE[grade]} الابتدائي — الفصل الدراسي الأول`, edition: '١٤٤٧هـ – 2025', pages, offset: 1,
    offsetChecked: ['g4-t1-math', 'g4-t1-science', 'g5-t1-math', 'g1-t1-science', 'g6-t1-math'].includes(id), source: `https://learnatdolphin.com/textbooks/primary-${grade}/term-${term}/${subject}/`,
    pdf: `https://learnatdolphin.com/wp-content/uploads/textbooks/primary-${grade}/term-${term}/${subject}.pdf?v=${v}`, checked: '2026-11-07'};
});
export const bookOf = id => BOOKS.find(b => b.id === id);
export const bookFor = (subject, grade, term = 1) => BOOKS.find(b => b.subject === subject && b.grade === Number(grade) && b.term === term);

/** The printed page where each curriculum lesson starts (read from the books' contents pages). Grade 4, term 1 for now. */
export const LESSON_PAGES = {
  's1-1-1': 26, 's1-1-2': 38, 's1-2-1': 56, 's1-2-2': 66, 's1-2-3': 76, 's2-3-1': 98, 's2-3-2': 108, 's2-3-3': 120,
  's3-4-1': 140, 's3-4-2': 150, 's3-5-1': 164, 's3-5-2': 172,
  'm1-1': 13, 'm1-2': 18, 'm1-3': 22, 'm1-4': 24, 'm1-5': 29, 'm1-6': 33, 'm1-7': 37,
  'm2-1': 47, 'm2-2': 50, 'm2-3': 54, 'm2-4': 56, 'm2-5': 63, 'm2-6': 67,
  'm3-1': 79, 'm3-2': 82, 'm3-3': 84, 'm3-4': 87, 'm3-5': 90, 'm3-6': 93,
  'm4-1': 107, 'm4-2': 110, 'm4-3': 114, 'm4-4': 116, 'm4-5': 120, 'm4-6': 125, 'm4-7': 127,
  'm5-1': 139, 'm5-2': 142, 'm5-3': 145, 'm5-4': 147, 'm5-5': 151, 'm5-6': 157, 'm5-7': 161, 'm5-8': 163,
  'm6-1': 175, 'm6-2': 179, 'm6-3': 183, 'm6-4': 188, 'm6-5': 191
};
/** Every lesson of the elementary books (term 1), in book order: grade 4 from curriculum-g4.js, the others from curriculum-primary.js. */
export function allLessons() {
  const g4 = curriculumLessons().map(l => ({id: l.id, grade: 4, subject: l.subject, unit: l.unit, chapter: l.chapter, title: l.title, page: LESSON_PAGES[l.id], ready: Boolean(l.template)}));
  return [...primaryLessons().filter(l => l.grade < 4), ...g4, ...primaryLessons().filter(l => l.grade > 4)].sort((a, b) => a.grade - b.grade);
}
const LESSONS = new Map(allLessons().map(l => [l.id, l]));
export const lessonOf = id => LESSONS.get(id);
/** The book and printed page of a curriculum lesson. */
export function lessonBookPage(lessonId) {
  const l = LESSONS.get(lessonId); if (!l?.page) return null;
  const book = bookFor(l.subject, l.grade); return book ? {book: book.id, page: l.page} : null;
}
