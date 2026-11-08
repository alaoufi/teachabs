// The classroom's view of the school's administration data (contract INTEGRATION-040 in alaoufi/khatwa-learning).
// The administration owns tracks, stages, grades, classes, students, teachers, subjects, assignments and the weekly
// schedule (class_periods); the classroom only READS them through this interface and never writes there.
//
// Two implementations are planned:
//  - memoryDirectory(data): the administration's tables as plain rows (same names and fields), for tests and for a
//    demonstration with made-up data only. It applies the same rules the administration's services apply.
//  - the real link to the administration's PostgreSQL (Neon): NOT built yet — it needs a server-to-server service and an
//    identity mapping agreed with the administration (see SCHOOL-LINK-075.md). Nothing here holds credentials.
//
// Conventions from the contract: identifiers are TEXT (not always UUIDs); dates 'YYYY-MM-DD'; weekday Sunday=0;
// times are minutes since midnight in Asia/Riyadh (UTC+3, no daylight saving).

const RIYADH = 3 * 3600_000;
/** The Riyadh date, weekday and minute of a moment. */
export function riyadh(at = Date.now()) {
  const d = new Date(at + RIYADH);
  return {date: d.toISOString().slice(0, 10), weekday: d.getUTCDay(), minute: d.getUTCHours() * 60 + d.getUTCMinutes()};
}
/** The UTC moment of a Riyadh date and minute. */
export const momentOf = (date, minute) => Date.parse(date + 'T00:00:00Z') - RIYADH + minute * 60_000;
const hhmm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
/** A teacher may open the class a little before the bell; students enter from the same moment. */
export const EARLY_MINUTES = 10;

export class DirectoryError extends Error { constructor(message, status = 403) { super(message); this.status = status; } }
const need = (ok, message, status) => { if (!ok) throw new DirectoryError(message, status); };

/**
 * data: {scope, years, terms, grades, classes, subjects, students, enrollments, teachers, assignments, periods,
 *        lessonSessions, subjectLinks: {subject_id: 'science'|…}, lessonLinks: {admin lesson_id: classroom lesson id}}
 * The links are explicit tables agreed with the administration — never a match of names.
 */
export function memoryDirectory(data) {
  const rows = k => data[k] || [];
  const by = (k, id) => rows(k).find(r => r.id === id);
  // the schedule must never put a teacher or a class in two periods at once (no combined-period exception yet)
  for (const [i, a] of rows('periods').entries()) for (const b of rows('periods').slice(i + 1)) {
    if (!a.active || !b.active || a.weekday !== b.weekday || a.term_id !== b.term_id) continue;
    const overlap = a.start_minute < b.end_minute && b.start_minute < a.end_minute;
    if (overlap && (a.teacher_id === b.teacher_id || a.class_id === b.class_id)) throw new DirectoryError(`تعارض في الجدول بين ${a.id} و${b.id}.`, 409);
  }
  const subjectCode = id => data.subjectLinks?.[id] || null;
  const termOn = (p, date) => { const t = by('terms', p.term_id), y = by('years', p.year_id); return t && y && t.active && y.active && t.start_date <= date && date <= t.end_date; };
  const classActive = id => (by('classes', id)?.state || 'active') === 'active';
  const assignmentActive = p => { const a = by('assignments', p.assignment_id); return a && a.active && a.teacher_id === p.teacher_id && a.class_id === p.class_id && a.subject_id === p.subject_id; };
  const livePeriod = (p, date) => p && p.active && termOn(p, date) && classActive(p.class_id) && assignmentActive(p);
  const enrolled = (studentId, p) => rows('enrollments').some(e => e.student_id === studentId && e.class_id === p.class_id && e.year_id === p.year_id && e.active);
  const describe = (p, date) => {
    const c = by('classes', p.class_id), g = by('grades', c?.grade_id), s = by('subjects', p.subject_id), ls = rows('lessonSessions').find(x => x.period_id === p.id && x.occurrence_date === date && x.active !== 0);
    return {periodId: p.id, date, classId: p.class_id, className: c?.name || '', grade: g?.grade ?? null, subjectId: p.subject_id, subject: subjectCode(p.subject_id), subjectName: s?.name || '',
      teacherId: p.teacher_id, order: p.period_order, startMinute: p.start_minute, endMinute: p.end_minute, starts: hhmm(p.start_minute), ends: hhmm(p.end_minute),
      opensAt: momentOf(date, p.start_minute - EARLY_MINUTES), endsAt: momentOf(date, p.end_minute), lesson: ls ? (data.lessonLinks?.[ls.lesson_id] || null) : null};
  };
  /** The parent's own active student profile (derived when there is exactly one; a supplied ID must be owned). */
  function ownedStudent(parentId, studentId) {
    const mine = rows('students').filter(s => s.parent === parentId && s.status === 'active');
    if (!studentId) { need(mine.length === 1, mine.length ? 'اختر الطالب.' : 'لا يوجد طالب نشط في هذا الحساب.', mine.length ? 400 : 404); return mine[0]; }
    const s = mine.find(x => x.id === studentId); need(s, 'هذا الطالب ليس من أبنائك.', 403); return s;
  }
  /** The occurrences of a list of periods from a moment on, the first `days` days. */
  function occurrences(periods, at, days) {
    const out = [], {date: today} = riyadh(at);
    for (let k = 0; k < days; k++) {
      const date = new Date(Date.parse(today + 'T00:00:00Z') + k * 86400_000).toISOString().slice(0, 10), weekday = new Date(date + 'T00:00:00Z').getUTCDay();
      for (const p of periods) if (p.weekday === weekday && livePeriod(p, date) && momentOf(date, p.end_minute) > at) out.push(describe(p, date));
    }
    return out.sort((a, b) => a.opensAt - b.opensAt);
  }
  return {
    kind: 'memory',
    ownedStudent,
    /** The parent's active children with their current class: [{studentId, firstName, classId, className}]. */
    childrenOf(parentId, at = Date.now()) {
      const {date} = riyadh(at);
      return rows('students').filter(s => s.parent === parentId && s.status === 'active').map(s => {
        const e = rows('enrollments').find(x => x.student_id === s.id && x.active && by('years', x.year_id)?.active && classActive(x.class_id));
        return {studentId: s.id, firstName: String(s.name).trim().split(/\s+/)[0], classId: e?.class_id || null, className: e ? by('classes', e.class_id)?.name || '' : '', date};
      });
    },
    /** The subjects a student studies this term (from the class's active assignments), as classroom subject codes. */
    studentSubjects(parentId, studentId, at = Date.now()) {
      const s = ownedStudent(parentId, studentId), {date} = riyadh(at), codes = new Set();
      for (const p of rows('periods')) if (enrolled(s.id, p) && livePeriod(p, date) && subjectCode(p.subject_id)) codes.add(subjectCode(p.subject_id));
      return [...codes];
    },
    /** The student's class period of a subject open now, and the next one: {student, now, next}. */
    studentNow(parentId, studentId, subject, at = Date.now()) {
      const s = ownedStudent(parentId, studentId), mine = rows('periods').filter(p => enrolled(s.id, p) && (!subject || subjectCode(p.subject_id) === subject));
      const list = occurrences(mine, at, 14), now = list.find(o => o.opensAt <= at && at < o.endsAt) || null;
      return {student: {id: s.id, firstName: String(s.name).trim().split(/\s+/)[0]}, now, next: list.find(o => o !== now && o.opensAt > at) || null};
    },
    /** Whether this student may be in this occurrence now: active profile, enrolled in the period's class, period live. */
    studentMayAttend(studentId, periodId, date, at = Date.now()) {
      const s = by('students', studentId), p = by('periods', periodId);
      if (!s || s.status !== 'active' || !p || !livePeriod(p, date) || !enrolled(s.id, p)) return false;
      return momentOf(date, p.start_minute - EARLY_MINUTES) <= at && at < momentOf(date, p.end_minute) && riyadh(momentOf(date, p.start_minute)).weekday === p.weekday;
    },
    /** Whether this student belongs to this occurrence's class at all (active profile, enrolled, period live); used after
     *  the period ends, when only the homework stays open. */
    studentEnrolledIn(studentId, periodId, date) {
      const s = by('students', studentId), p = by('periods', periodId);
      return Boolean(s && s.status === 'active' && p && livePeriod(p, date) && enrolled(s.id, p));
    },
    /** A teacher's periods today (from the moment on): [{periodId, className, subject, starts, ends, lesson, …}]. */
    teacherToday(teacherId, at = Date.now()) {
      const {date} = riyadh(at);
      return occurrences(rows('periods').filter(p => p.teacher_id === teacherId), at, 1).filter(o => o.date === date);
    },
    /** The occurrence this teacher may open now, or an error saying why not. */
    teacherOccurrence(teacherId, periodId, date, at = Date.now()) {
      const p = by('periods', periodId); need(p && p.teacher_id === teacherId, 'هذه الحصة ليست مسندة إليك.', 403);
      need(livePeriod(p, date), 'الحصة غير نشطة في هذا الفصل الدراسي.', 409);
      need(new Date(date + 'T00:00:00Z').getUTCDay() === p.weekday, 'ليس يوم هذه الحصة.', 409);
      need(at >= momentOf(date, p.start_minute - EARLY_MINUTES), `تبدأ الحصة الساعة ${hhmm(p.start_minute)}.`, 409);
      need(at < momentOf(date, p.end_minute), 'انتهى وقت الحصة.', 409);
      return describe(p, date);
    },
    /** For a class room: is this occurrence still running? */
    occurrenceOpen: (periodId, date, at = Date.now()) => { const p = by('periods', periodId); return Boolean(p && livePeriod(p, date) && at < momentOf(date, p.end_minute)); }
  };
}
