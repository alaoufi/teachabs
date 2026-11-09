// Stage 076: the classroom against the administration's REAL services — its calendar module on an isolated PGlite
// PostgreSQL with its own schema (alaoufi/khatwa-learning, branch codex/admin-early-entry-047), made-up data only, no hosted
// database. Runs when ADMIN_NEON_DIR points at that repository's preview-admin-025/neon with its dev dependencies installed;
// otherwise it is skipped (the classroom's own checks are in school-link.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {adminDirectory} from '../admin-directory.mjs';

const ADMIN = process.env.ADMIN_NEON_DIR, skip = ADMIN ? false : 'set ADMIN_NEON_DIR to the administration\'s preview-admin-025/neon';
const DATE = '2026-11-09'; // a Monday; science 4/A 10:00–10:45, science 4/B 11:00–11:45, maths 4/A 11:00–11:45 (Riyadh)

async function adminFixture(t) {
  const mod = p => import(pathToFileURL(join(ADMIN, p)).href);
  const {PGlite} = await import(pathToFileURL(join(ADMIN, 'node_modules/@electric-sql/pglite/dist/index.js')).href);
  const {createNeonStore} = await mod('store.mjs'), {applyCurrentTestExtensions} = await mod('test/helpers/current-schema.mjs');
  let clock = Date.parse(DATE + 'T06:52:00Z'); t.mock.method(Date, 'now', () => clock); // 09:52 Riyadh
  const pg = new PGlite(); await pg.exec(await readFile(join(ADMIN, 'schema.sql'), 'utf8')); await applyCurrentTestExtensions(pg);
  const s = await createNeonStore({query: (...a) => pg.query(...a), connect: async () => ({query: (...a) => pg.query(...a), release() {}}), end: () => pg.close()});
  t.after(() => s.close()); const a = s.admin;
  const admin = (await a.bootstrap({name: 'Synthetic supervisor', email: 'link-admin@example.invalid'})).id;
  const trackId = await a.addSchoolTrack(admin, {name: 'Synthetic track'}), gradeId = await a.addSchoolGrade(admin, {trackId, stage: 'primary', grade: 4});
  const classA = await a.addSchoolClass(admin, {gradeId, name: '4/A', capacity: 30}), classB = await a.addSchoolClass(admin, {gradeId, name: '4/B', capacity: 30});
  const tA = (await a.createTeacher(admin, {name: 'Synthetic science', email: 'link-ta@example.invalid'})).id, tB = (await a.createTeacher(admin, {name: 'Synthetic maths', email: 'link-tb@example.invalid'})).id;
  const pA = (await a.registerParent(admin, {name: 'Synthetic parent A', email: 'link-pa@example.invalid'})).id, pB = (await a.registerParent(admin, {name: 'Synthetic parent B', email: 'link-pb@example.invalid'})).id;
  const sA = await a.registerStudent(admin, {parentId: pA, name: 'Noura Synthetic', gradeId, request: 'sa'}), sB = await a.registerStudent(admin, {parentId: pB, name: 'Layan Synthetic', gradeId, request: 'sb'});
  const sci = await a.addAcademicSubject(admin, {name: 'Science', request: 'sci'}), math = await a.addAcademicSubject(admin, {name: 'Math', request: 'math'});
  const cells = await a.addAcademicLesson(admin, {subjectId: sci, title: 'Cells', request: 'l-cells'}), place = await a.addAcademicLesson(admin, {subjectId: math, title: 'Place value', request: 'l-place'});
  for (const c of [classA, classB]) for (const sub of [sci, math]) await a.setAcademicClassSubject(admin, {classId: c, subjectId: sub});
  await a.setAcademicTeacherCoverage(admin, {teacherId: tA, gradeId, subjectId: sci}); await a.setAcademicTeacherCoverage(admin, {teacherId: tB, gradeId, subjectId: math});
  const yearId = await a.addAcademicYear(admin, {name: '2026', startDate: '2026-01-01', endDate: '2026-12-31', request: 'y'});
  const termId = await a.addAcademicTerm(admin, {yearId, name: 'Term', startDate: '2026-08-23', endDate: '2026-12-31', request: 't'});
  const cSci = await a.addAcademicCurriculum(admin, {subjectId: sci, name: 'Science 4', request: 'cs'}), cMath = await a.addAcademicCurriculum(admin, {subjectId: math, name: 'Math 4', request: 'cm'});
  await a.linkAcademicCurriculumLesson(admin, {curriculumId: cSci, lessonId: cells, request: 'k1'}); await a.linkAcademicCurriculumLesson(admin, {curriculumId: cMath, lessonId: place, request: 'k2'});
  await a.enrollCalendarStudent(admin, {studentId: sA, classId: classA, yearId, request: 'ea'}); await a.enrollCalendarStudent(admin, {studentId: sB, classId: classB, yearId, request: 'eb'});
  const asA = await a.assignTermTeacher(admin, {classId: classA, subjectId: sci, teacherId: tA, termId, curriculumId: cSci, request: 'x1'});
  const asB = await a.assignTermTeacher(admin, {classId: classB, subjectId: sci, teacherId: tA, termId, curriculumId: cSci, request: 'x2'});
  const asM = await a.assignTermTeacher(admin, {classId: classA, subjectId: math, teacherId: tB, termId, curriculumId: cMath, request: 'x3'});
  const p1 = await a.addClassPeriod(admin, {assignmentId: asA, weekday: 1, startMinute: 600, endMinute: 645, periodOrder: 1, request: 'p1'});
  const p2 = await a.addClassPeriod(admin, {assignmentId: asB, weekday: 1, startMinute: 660, endMinute: 705, periodOrder: 2, request: 'p2'});
  const p3 = await a.addClassPeriod(admin, {assignmentId: asM, weekday: 1, startMinute: 660, endMinute: 705, periodOrder: 2, request: 'p3'});
  await a.selectPeriodLesson(tA, {periodId: p1, date: DATE, lessonId: cells, request: 'sel'});
  return {s, a, admin, ids: {tA, tB, pA, pB, sA, sB, sci, math, cells, place, gradeId, classA, classB, asA, p1, p2, p3}, set: v => { clock = Date.parse(v); }};
}

test('the classroom with the administration\'s real services: entry, refusals, revocation, assignment and lesson checks', {skip}, async t => {
  const f = await adminFixture(t), {ids} = f;
  const {openStore} = await import('../store.mjs'), {createApp} = await import('../server.mjs');
  const store = openStore(':memory:'), tA = store.tour(), tB = store.tour(); // classroom accounts, linked explicitly to the administration's
  for (const [kind, adminId, code] of [['user', ids.tA, tA.teacher], ['user', ids.tB, tB.teacher], ['user', ids.pA, tA.parent], ['user', ids.pB, tB.parent],
    ['subject', ids.sci, 'science'], ['subject', ids.math, 'math'], ['lesson', ids.cells, 's1-1-1'], ['lesson', ids.place, 'm1-1'], ['grade', ids.gradeId, '4']]) store.group.link(kind, adminId, code);
  const directory = adminDirectory(f.a, () => store.group.links()); // the classroom never holds an administrator, a database URL or a secret
  const app = createApp(store, {directory, recheckMs: 40}); await new Promise(r => app.listen(0, '127.0.0.1', r));
  t.after(async () => { app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); });
  const base = 'http://127.0.0.1:' + app.address().port, ks = id => 'ks=' + store.session(id);
  const get = (p, cookie) => fetch(base + p, {headers: {cookie}, redirect: 'manual'});
  const post = (p, cookie, body) => fetch(base + p, {method: 'POST', headers: {cookie, origin: base, 'content-type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams(body), redirect: 'manual'});
  const text = async r => (await r.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const sciTeacher = ks(tA.teacher), mathTeacher = ks(tB.teacher), parentA = ks(tA.parent), parentB = ks(tB.parent);

  // 09:52: the teacher's day from the administration; the lesson the teacher picked there arrives as its ready prep
  const today = await (await get('/teach/today', sciTeacher)).text();
  assert.match(today, new RegExp(`data-period="${ids.p1}"[^]*ابدأ الحصة`)); assert.match(today, new RegExp(`data-period="${ids.p2}"[^]*تبدأ 11:00`));
  assert.match(today, /value="ready:s1-1-1"/);
  assert.equal((await post('/teach/today/start', mathTeacher, {period: ids.p1, plan: 'ready:s1-1-1'})).status, 403, 'not the assigned teacher');
  assert.match(await text(await post('/teach/today/start', sciTeacher, {period: ids.p1, plan: 'ready:m1-1'})), /لمادة أخرى/, 'a maths prep for science');
  assert.match(await text(await post('/teach/today/start', sciTeacher, {period: ids.p1, plan: 'ready:p5s01'})), /لصف آخر/, 'a grade 5 prep for grade 4');
  const started = await post('/teach/today/start', sciTeacher, {period: ids.p1, plan: 'ready:s1-1-1'}); assert.equal(started.status, 303);
  const code = started.headers.get('location').split('/').pop();

  // the student of 4/A chooses science ten minutes early and is in, under her first name, bound to the canonical student
  const enter = await post('/school/enter', parentA, {student: ids.sA, subject: 'science'});
  assert.equal(enter.headers.get('location'), '/class/' + code, await text(enter)); const nora = enter.headers.get('set-cookie').split(';')[0];
  assert.equal((await get('/class/' + code, nora)).status, 200);
  const seat = store.group.students(code); assert.equal(seat.length, 1);
  // the student of 4/B: refused for 4/A's science; a forged student ID from 4/A's parent is refused by the administration
  assert.equal((await post('/school/enter', parentB, {student: ids.sB, subject: 'science'})).status === 303, false);
  assert.equal((await post('/school/enter', parentA, {student: ids.sB, subject: 'science'})).status, 403);
  assert.equal((await post('/join', parentB, {code, name: 'Layan'})).status, 403, 'a school room is never entered by code and name');

  // revoked during the live stream: the administration suspends her, the classroom closes her stream within the recheck
  const stream = await fetch(base + '/class/' + code + '/events', {headers: {cookie: nora}}), reader = stream.body.getReader();
  let got = ''; const until = async re => { while (!re.test(got)) { const {value, done} = await reader.read(); if (done) return got + '<closed>'; got += new TextDecoder().decode(value); } return got; };
  await until(/event: view/);
  await f.s.run("UPDATE students SET status='suspended' WHERE id=?", ids.sA);
  assert.match(await until(/event: revoked/), /event: revoked/);
  assert.equal((await get('/class/' + code + '/content?step=lesson-title', nora)).status, 403, 'reconnecting is refused too');
  await f.s.run("UPDATE students SET status='active' WHERE id=?", ids.sA);
  assert.equal((await get('/class/' + code + '/content?step=lesson-title', nora)).status, 200);

  // moved to another class mid-period: refused; moved back: admitted again
  await f.s.run('UPDATE student_enrollments SET active=0 WHERE student_id=?', ids.sA);
  assert.equal((await get('/class/' + code + '/content?step=lesson-title', nora)).status, 403);
  await f.s.run('UPDATE student_enrollments SET active=1 WHERE student_id=?', ids.sA);

  // the assignment is removed: the teacher loses the room at the next request
  const cmd = cookie => fetch(base + '/teach/live/' + code + '/command', {method: 'POST', headers: {cookie, origin: base, 'content-type': 'application/json'}, body: JSON.stringify({op: 'go', by: 1})});
  assert.equal((await cmd(sciTeacher)).status, 200);
  await f.s.run('UPDATE teacher_assignments SET active=0 WHERE id=?', ids.asA);
  assert.equal((await cmd(sciTeacher)).status, 403);
  await f.s.run('UPDATE teacher_assignments SET active=1 WHERE id=?', ids.asA);

  // 10:45 exactly: the period is over for the student
  f.set(DATE + 'T07:45:00Z');
  assert.equal((await get('/class/' + code + '/content?step=lesson-title', nora)).status, 403);
  // 10:51: maths for 4/A opens early, but its teacher has not started it yet
  f.set(DATE + 'T07:51:00Z');
  assert.match(await text(await post('/school/enter', parentA, {student: ids.sA, subject: 'math'})), /والمعلم لم يبدأها بعد/);
  // the administration's records were only read: no classroom data was written there
  assert.equal((await f.s.all('SELECT COUNT(*)::int n FROM lesson_sessions'))[0].n, 1);
});
