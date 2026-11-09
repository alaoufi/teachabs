// The classroom's school directory on top of the administration's own services (contract INTEGRATION-040 with the
// 047 entry extension in alaoufi/khatwa-learning): studentPeriodEntry, studentCalendarMaterials, teacherCalendarPeriods,
// teacherCalendarClasses and dateLessonSession, called with the server-authenticated parent or teacher ID only (never an
// administrator, never an ID from the browser). Every call is a fresh read, so suspension, removal, a moved student or a
// changed assignment take effect at the next request. Nothing is cached and nothing is written to the administration.
//
// links (the classroom's table classroom_links, set up by the operator, never by matching names):
//   user:    administration users.id → classroom users.id   (identity is the same when both run in one server)
//   subject: subjects.id → science|math|…
//   lesson:  lessons.id → curriculum lesson id (p5m07, s1-1-1 …)
//   grade:   education_grades.id → 1…9
import {riyadh, momentOf, EARLY_MINUTES, DirectoryError} from './school-directory.mjs';

const hhmm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const firstName = n => String(n || '').trim().split(/\s+/)[0];
const dayOf = date => new Date(date + 'T00:00:00Z').getUTCDay();
const addDays = (date, k) => new Date(Date.parse(date + 'T00:00:00Z') + k * 86400_000).toISOString().slice(0, 10);

/**
 * admin: the administration's service object (store.admin of its server, or a client with the same async functions).
 * links(): returns the current link maps; now(): the clock the administration itself uses (Date.now in production).
 */
export function adminDirectory(admin, links, {now = Date.now} = {}) {
  const L = () => links();
  const toAdmin = localId => Object.entries(L().user).find(([, local]) => local === localId)?.[0] || localId;
  const toLocal = adminId => L().user[adminId] || adminId;
  const code = (kind, id) => L()[kind][id] || null;
  /** Calls the administration; its refusals become the classroom's DirectoryError with the same status. */
  async function call(fn, actor, input) {
    if (typeof admin[fn] !== 'function') throw new DirectoryError('خدمة الإدارة غير متاحة: ' + fn, 503);
    try { return await admin[fn](toAdmin(actor), input); }
    catch (e) { throw new DirectoryError(e?.message || 'تعذّر التحقق من بيانات الإدارة.', Number.isInteger(e?.status) ? e.status : 503); }
  }
  const materials = (parent, studentId) => call('studentCalendarMaterials', parent, studentId ? {studentId} : {});
  async function describe(teacher, p, date, classes) {
    const c = classes?.find(x => x.id === (p.class_id ?? p.classId));
    let lesson = null;
    if (teacher) { try { const ls = await call('dateLessonSession', teacher, {periodId: p.id, date}); lesson = ls ? code('lesson', ls.lesson_id ?? ls.lessonId) : null; } catch {} }
    const start = p.start_minute ?? p.startMinute, end = p.end_minute ?? p.endMinute;
    return {periodId: p.id, date, classId: p.class_id ?? p.classId, className: c?.name || '', gradeId: c?.gradeId ?? c?.grade_id ?? null, grade: Number(code('grade', c?.gradeId ?? c?.grade_id)) || null,
      subjectId: p.subject_id ?? p.subjectId, subject: code('subject', p.subject_id ?? p.subjectId), teacherId: toLocal(p.teacher_id ?? p.teacherId), order: p.period_order ?? p.periodOrder,
      startMinute: start, endMinute: end, starts: hhmm(start), ends: hhmm(end), opensAt: momentOf(date, start - EARLY_MINUTES), endsAt: momentOf(date, end), lesson};
  }
  /** The occurrences of these periods from `at` on, for `days` days, in time order. */
  function occurrences(periods, at, days) {
    const out = [], {date: today} = riyadh(at);
    for (let k = 0; k < days; k++) { const date = addDays(today, k); for (const p of periods) if ((p.weekday) === dayOf(date) && momentOf(date, p.end_minute ?? p.endMinute) > at) out.push({p, date}); }
    return out.sort((a, b) => momentOf(a.date, a.p.start_minute ?? a.p.startMinute) - momentOf(b.date, b.p.start_minute ?? b.p.startMinute));
  }
  return {
    kind: 'administration',
    /** The parent's students: needs the administration's list of a parent's profiles (requested from the administration). */
    async childrenOf(parentId) {
      if (typeof admin.parentStudents === 'function') return (await call('parentStudents', parentId, {})).map(s => ({studentId: s.id, firstName: firstName(s.firstName ?? s.name), classId: s.classId ?? null, className: s.className ?? ''}));
      // until then: a parent with exactly one active profile is derived by the administration itself
      const m = await materials(parentId); return [{studentId: '', firstName: 'الطالب', classId: m[0]?.classId ?? null, className: ''}];
    },
    async studentSubjects(parentId, studentId) {
      let m; try { m = await materials(parentId, studentId); } catch (e) { if (e.status === 403) return []; throw e; }
      return [...new Set(m.map(x => code('subject', x.subject?.id)).filter(Boolean))];
    },
    async studentNow(parentId, studentId, subject, at = now()) {
      const m = await materials(parentId, studentId), periods = m.filter(x => !subject || code('subject', x.subject?.id) === subject).flatMap(x => x.periods || []);
      let current = null, next = null, canonical = studentId;
      for (const {p, date} of occurrences(periods, at, 14)) {
        const start = momentOf(date, (p.start_minute ?? p.startMinute) - EARLY_MINUTES);
        if (!current && start <= at) {
          try { const e = await call('studentPeriodEntry', parentId, {periodId: p.id, date, ...(studentId ? {studentId} : {})}); canonical = e.studentId; current = await describe(null, p, date); } catch (e) { if (e.status !== 403) throw e; }
        } else if (start > at && !next) next = await describe(null, p, date);
        if (current && next) break;
      }
      return {student: {id: canonical, firstName: ''}, now: current, next};
    },
    /** The administration's own eligibility read (047): canonical student, period, class, teacher and date. */
    async studentEntry(parentId, studentId, periodId, date) {
      const e = await call('studentPeriodEntry', parentId, {periodId, date, ...(studentId ? {studentId} : {})});
      if (!e?.eligible) throw new DirectoryError('الدخول غير متاح في هذا الوقت.', 403);
      return {...e, teacherId: toLocal(e.teacherId)};
    },
    async studentInClass(parentId, studentId, classId) {
      try { return (await materials(parentId, studentId)).some(x => x.classId === classId); } catch { return false; }
    },
    async teacherAssigned(teacherId, periodId, date) {
      try { return (await call('teacherCalendarPeriods', teacherId, {date})).some(p => p.id === periodId); } catch { return false; }
    },
    async teacherToday(teacherId, at = now()) {
      const {date} = riyadh(at), [periods, classes] = await Promise.all([call('teacherCalendarPeriods', teacherId, {date}), call('teacherCalendarClasses', teacherId, {})]);
      const out = []; for (const {p, date: d} of occurrences(periods, at, 1)) if (d === date) out.push(await describe(teacherId, p, d, classes));
      return out;
    },
    async teacherOccurrence(teacherId, periodId, date, at = now()) {
      const [periods, classes] = await Promise.all([call('teacherCalendarPeriods', teacherId, {date}), call('teacherCalendarClasses', teacherId, {})]);
      const p = periods.find(x => x.id === periodId); if (!p) throw new DirectoryError('هذه الحصة ليست مسندة إليك.', 403);
      if (dayOf(date) !== p.weekday) throw new DirectoryError('ليس يوم هذه الحصة.', 409);
      if (at < momentOf(date, (p.start_minute ?? p.startMinute) - EARLY_MINUTES)) throw new DirectoryError(`تبدأ الحصة الساعة ${hhmm(p.start_minute ?? p.startMinute)}.`, 409);
      if (at >= momentOf(date, p.end_minute ?? p.endMinute)) throw new DirectoryError('انتهى وقت الحصة.', 409);
      return describe(teacherId, p, date, classes);
    }
  };
}
