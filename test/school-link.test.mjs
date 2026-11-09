// Stage 075: the classroom linked to the school's administration data (INTEGRATION-040 shapes, made-up data only).
// A student enters their class's current period from the parent's account by choosing the subject; a student of another
// class, a suspended or moved student, or one whose period has ended is refused, also on reconnecting; a teacher starts only
// periods assigned to them; one room per period and date; the room survives a server restart.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {memoryDirectory, riyadh, momentOf, DirectoryError} from '../school-directory.mjs';

const DATE = '2026-11-15', WD = new Date(DATE + 'T00:00:00Z').getUTCDay(); // a school day; the periods are put on its weekday
const at = (h, m) => momentOf(DATE, h * 60 + m);

function school({a, b}) {
  const row = x => ({active: 1, ...x});
  return {
    scope: 'school-1', years: [row({id: 'y1'})], terms: [row({id: 't1', year_id: 'y1', start_date: '2026-08-23', end_date: '2027-01-14'})],
    grades: [{id: 'stage040:g4', grade: 4}], classes: [{id: 'c-4a', grade_id: 'stage040:g4', name: '٤/أ', state: 'active'}, {id: 'c-4b', grade_id: 'stage040:g4', name: '٤/ب', state: 'active'}],
    subjects: [{id: 'sub-1', name: 'العلوم'}, {id: 'sub-2', name: 'الرياضيات'}], subjectLinks: {'sub-1': 'science', 'sub-2': 'math'},
    students: [{id: a.child, parent: a.parent, name: 'نورة محمد العتيبي', status: 'active'}, {id: b.child, parent: b.parent, name: 'ليان خالد', status: 'active'}],
    enrollments: [row({id: 'e1', student_id: a.child, class_id: 'c-4a', year_id: 'y1'}), row({id: 'e2', student_id: b.child, class_id: 'c-4b', year_id: 'y1'})],
    assignments: [row({id: 'as-1', teacher_id: a.teacher, class_id: 'c-4a', subject_id: 'sub-1', term_id: 't1', year_id: 'y1'}),
      row({id: 'as-2', teacher_id: a.teacher, class_id: 'c-4b', subject_id: 'sub-1', term_id: 't1', year_id: 'y1'}),
      row({id: 'as-3', teacher_id: b.teacher, class_id: 'c-4a', subject_id: 'sub-2', term_id: 't1', year_id: 'y1'})],
    periods: [row({id: 'p-1', assignment_id: 'as-1', class_id: 'c-4a', subject_id: 'sub-1', teacher_id: a.teacher, term_id: 't1', year_id: 'y1', weekday: WD, start_minute: 480, end_minute: 525, period_order: 1}),
      row({id: 'p-2', assignment_id: 'as-2', class_id: 'c-4b', subject_id: 'sub-1', teacher_id: a.teacher, term_id: 't1', year_id: 'y1', weekday: WD, start_minute: 540, end_minute: 585, period_order: 2}),
      row({id: 'p-3', assignment_id: 'as-3', class_id: 'c-4a', subject_id: 'sub-2', teacher_id: b.teacher, term_id: 't1', year_id: 'y1', weekday: WD, start_minute: 540, end_minute: 585, period_order: 2})],
    lessonSessions: [{period_id: 'p-1', occurrence_date: DATE, lesson_id: 'adm-lesson-7', active: 1}], lessonLinks: {'adm-lesson-7': 's1-1-1'}
  };
}

test('the directory: Riyadh time, the schedule refuses double booking, current and next periods, the 10-minute early entry', () => {
  assert.deepEqual(riyadh(at(8, 5)), {date: DATE, weekday: WD, minute: 485});
  const ids = {a: {parent: 'pa', teacher: 'ta', child: 'ca'}, b: {parent: 'pb', teacher: 'tb', child: 'cb'}}, data = school(ids);
  const clash = {...data, periods: [...data.periods, {...data.periods[2], id: 'p-x', teacher_id: 'ta'}]}; // the science teacher also in 4/a maths at 9:00 while teaching 4/b
  assert.throws(() => memoryDirectory(clash), e => e instanceof DirectoryError && e.status === 409);
  const sameClass = {...data, periods: [...data.periods, {...data.periods[0], id: 'p-y', teacher_id: 'tz', subject_id: 'sub-2', start_minute: 500, end_minute: 540}]};
  assert.throws(() => memoryDirectory(sameClass), /تعارض/);
  const d = memoryDirectory(data);
  assert.equal(d.studentNow('pa', 'ca', 'science', at(7, 49)).now, null, 'more than 10 minutes before');
  assert.equal(d.studentNow('pa', 'ca', 'science', at(7, 50)).now.periodId, 'p-1');
  assert.equal(d.studentNow('pa', 'ca', 'science', at(8, 45)).now, null, 'ended');
  const r = d.studentNow('pa', 'ca', 'math', at(8, 10)); assert.equal(r.now, null); assert.equal(r.next.periodId, 'p-3'); assert.equal(r.next.starts, '09:00');
  assert.equal(d.studentNow('pa', 'ca', 'science', at(8, 50)).next.date > DATE, true, 'next week');
  assert.deepEqual(d.studentSubjects('pa', 'ca', at(8, 0)).sort(), ['math', 'science']);
  assert.throws(() => d.studentNow('pa', 'cb', 'science', at(8, 0)), /ليس من أبنائك/);
  assert.equal(d.studentNow('pa', undefined, 'science', at(8, 0)).student.firstName, 'نورة', 'one child: derived; the first name only');
  assert.deepEqual(d.teacherToday('ta', at(8, 0)).map(o => [o.periodId, o.className, o.lesson]), [['p-1', '٤/أ', 's1-1-1'], ['p-2', '٤/ب', null]]);
  assert.throws(() => d.teacherOccurrence('tb', 'p-1', DATE, at(8, 0)), /ليست مسندة إليك/);
  assert.throws(() => d.teacherOccurrence('ta', 'p-2', DATE, at(8, 0)), /تبدأ الحصة الساعة 09:00/);
  assert.throws(() => d.teacherOccurrence('ta', 'p-1', DATE, at(8, 45)), /انتهى وقت الحصة/);
  data.terms[0].end_date = '2026-11-14'; // the term ended
  assert.equal(memoryDirectory(data).teacherToday('ta', at(8, 0)).length, 0);
});

test('a student enters their class by subject; another class, a moved or suspended student, and an ended period are refused; the room survives a restart', async t => {
  const dirPath = mkdtempSync(join(tmpdir(), 'school-link-')); t.after(() => rmSync(dirPath, {recursive: true, force: true}));
  const {openStore} = await import('../store.mjs'), {createApp} = await import('../server.mjs');
  let clock = at(7, 55), store = openStore(join(dirPath, 'class.db'));
  const a = store.tour(), b = store.tour(), data = school({a, b}), directory = memoryDirectory(data);
  let app = createApp(store, {directory, now: () => clock}); await new Promise(r => app.listen(0, '127.0.0.1', r));
  let base = 'http://127.0.0.1:' + app.address().port;
  t.after(async () => { app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); });
  const ks = id => 'ks=' + store.session(id);
  const get = (p, cookie) => fetch(base + p, {headers: {cookie}, redirect: 'manual'});
  const post = (p, cookie, body) => fetch(base + p, {method: 'POST', headers: {cookie, origin: base, 'content-type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams(body), redirect: 'manual'});
  const teacherA = ks(a.teacher), teacherB = ks(b.teacher), parentA = ks(a.parent), parentB = ks(b.parent);

  // the teacher's periods today; the first opens 10 minutes early, the second not yet
  const today = await (await get('/teach/today', teacherA)).text();
  assert.match(today, /data-period="p-1"[^]*ابدأ الحصة/); assert.match(today, /data-period="p-2"[^]*تبدأ 09:00/);
  assert.match(today, /value="ready:s1-1-1"/, 'the period\'s lesson, linked by id, offers its ready prep');
  assert.match(await (await get('/teach/plans', teacherA)).text(), /href="\/teach\/today"/);
  assert.equal((await post('/teach/today/start', teacherB, {period: 'p-1', plan: 'ready:s1-1-1'})).status, 403, 'not assigned to this teacher');
  assert.equal((await post('/teach/today/start', teacherA, {period: 'p-2', plan: 'ready:s1-1-1'})).status, 409, 'too early');
  const started = await post('/teach/today/start', teacherA, {period: 'p-1', plan: 'ready:s1-1-1'});
  assert.equal(started.status, 303); const code = started.headers.get('location').split('/').pop();
  assert.equal((await post('/teach/today/start', teacherA, {period: 'p-1', plan: 'ready:s1-1-1'})).headers.get('location'), '/teach/live/' + code, 'one room per period and date');
  const room = store.group.session(code);
  assert.deepEqual([room.period_id, room.occurrence_date, room.class_id], ['p-1', DATE, 'c-4a']); assert.equal(room.plan.steps[0].type, 'title');

  // the student of 4/a chooses science and is in
  assert.match(await (await get('/school', parentA)).text(), /value="science"[^]*value="math"|value="math"[^]*value="science"/);
  const enter = await post('/school/enter', parentA, {student: a.child, subject: 'science'});
  assert.equal(enter.status, 303); assert.equal(enter.headers.get('location'), '/class/' + code);
  const nora = enter.headers.get('set-cookie').split(';')[0];
  assert.equal((await get('/class/' + code, nora)).status, 200);
  assert.deepEqual(store.group.students(code).map(s => s.name), ['نورة'], 'only the first name in class');
  assert.match(await (await post('/school/enter', parentA, {student: a.child, subject: 'math'})).text(), /لا توجد حصة الرياضيات الآن[^]*09:00/);

  // the student of 4/b: no science now for her class; and no way into 4/a's room
  assert.match(await (await post('/school/enter', parentB, {student: b.child, subject: 'science'})).text(), /لا توجد حصة العلوم الآن[^]*09:00/);
  assert.equal((await post('/join', parentB, {code, child: b.child})).status, 403, 'another class');
  assert.equal((await post('/join', '', {code, name: 'خالد'})).status, 403, 'a name alone is not enough for a school room');
  assert.equal((await post('/school/enter', parentA, {student: b.child, subject: 'science'})).status, 403, 'not the parent\'s child');
  assert.ok([403, 404].includes((await post('/join', parentA, {code, child: b.child})).status), 'another parent\'s child: refused (404 hides that it exists)');

  // reconnecting is checked again: suspended, then moved to another class
  data.students[0].status = 'suspended'; assert.equal((await get('/class/' + code + '/content?step=lesson-title', nora)).status, 403);
  data.students[0].status = 'active'; assert.equal((await get('/class/' + code + '/content?step=lesson-title', nora)).status, 200);
  data.enrollments[0].active = 0; data.enrollments.push({id: 'e3', student_id: a.child, class_id: 'c-4b', year_id: 'y1', active: 1});
  assert.match(await (await get('/class/' + code + '/content?step=lesson-title', nora)).text(), /ليست لفصلك/);
  data.enrollments.pop(); data.enrollments[0].active = 1;

  // the room and the student's place survive a server restart (the database is a file)
  app.closeAllConnections(); await new Promise(r => app.close(r)); store.close();
  store = openStore(join(dirPath, 'class.db')); app = createApp(store, {directory, now: () => clock}); await new Promise(r => app.listen(0, '127.0.0.1', r)); base = 'http://127.0.0.1:' + app.address().port;
  assert.equal((await get('/class/' + code, nora)).status, 200, 'the same student, after the restart');
  assert.equal(store.group.occurrenceRoom('p-1', DATE).code, code);

  // the period ends: the room closes to students, except an open homework for the class's own students
  clock = at(8, 46);
  assert.match(await (await get('/class/' + code + '/content?step=lesson-title', nora)).text(), /انتهى وقت هذه الحصة/);
  const cmd = await fetch(base + '/teach/live/' + code + '/command', {method: 'POST', headers: {cookie: 'ks=' + store.session(a.teacher), origin: base, 'content-type': 'application/json'}, body: JSON.stringify({op: 'homework', status: 'open'})});
  assert.equal(cmd.status, 200);
  assert.equal((await get('/class/' + code, nora)).status, 200, 'the homework stays open to her');

  // 9:00: maths for 4/a has not been started by its teacher yet
  clock = at(9, 2);
  assert.match(await (await post('/school/enter', 'ks=' + store.session(a.parent), {student: a.child, subject: 'math'})).text(), /والمعلم لم يبدأها بعد/);
});

test('without the link the school pages say so, and the code entry keeps working', async t => {
  const {openStore} = await import('../store.mjs'), {createApp} = await import('../server.mjs');
  const store = openStore(':memory:'), app = createApp(store); await new Promise(r => app.listen(0, '127.0.0.1', r));
  t.after(async () => { app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); });
  const base = 'http://127.0.0.1:' + app.address().port, tour = store.tour();
  assert.match(await (await fetch(base + '/school', {headers: {cookie: 'ks=' + store.session(tour.parent)}})).text(), /غير مفعّل بعد/);
  assert.match(await (await fetch(base + '/teach/today', {headers: {cookie: 'ks=' + store.session(tour.teacher)}})).text(), /غير مفعّل بعد/);
  assert.doesNotMatch(await (await fetch(base + '/teach/plans', {headers: {cookie: 'ks=' + store.session(tour.teacher)}})).text(), /href="\/teach\/today"/);
  assert.equal((await fetch(base + '/school', {headers: {cookie: 'ks=' + store.session(tour.teacher)}, redirect: 'manual'})).status, 403, 'parents only');
});

// Stage 076: the assignment changes during class, a prep outside the period's subject or grade, a student revoked while the
// stream is open, and the one-to-one links between classroom and administration identifiers.
test('assignment change, prep checks, revocation during the stream, links', async t => {
  const {openStore} = await import('../store.mjs'), {createApp} = await import('../server.mjs');
  let clock = at(8, 0); const store = openStore(':memory:'), a = store.tour(), b = store.tour(), data = school({a, b}), directory = memoryDirectory(data);
  const app = createApp(store, {directory, now: () => clock, recheckMs: 40}); await new Promise(r => app.listen(0, '127.0.0.1', r));
  t.after(async () => { app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); });
  const base = 'http://127.0.0.1:' + app.address().port, ks = id => 'ks=' + store.session(id);
  const post = (p, cookie, body) => fetch(base + p, {method: 'POST', headers: {cookie, origin: base, 'content-type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams(body), redirect: 'manual'});
  const cmd = (code, cookie, body) => fetch(base + '/teach/live/' + code + '/command', {method: 'POST', headers: {cookie, origin: base, 'content-type': 'application/json'}, body: JSON.stringify(body)});
  const text = async r => (await r.text()).replace(/<[^>]+>/g, ' ');

  // a prep must follow the period's subject and its class's grade (4/a science, grade 4)
  assert.match(await text(await post('/teach/today/start', ks(a.teacher), {period: 'p-1', plan: 'ready:p5m07'})), /لمادة أخرى/, 'grade 5 maths for a science period');
  assert.match(await text(await post('/teach/today/start', ks(a.teacher), {period: 'p-1', plan: 'ready:p1s01'})), /لصف آخر/, 'grade 1 science for grade 4');
  const mine = store.group.createPlan(a.teacher, {...(await import('../public/group-plan.js')).LESSON_TEMPLATES['ready-p3s01'].plan(), grade: 4});
  assert.match(await text(await post('/teach/today/start', ks(a.teacher), {period: 'p-1', plan: 'plan:' + mine})), /لا يتبع مادة الحصة أو صفها/, 'a grade-3 lesson relabelled as grade 4');
  const code = (await post('/teach/today/start', ks(a.teacher), {period: 'p-1', plan: 'ready:s1-1-1'})).headers.get('location').split('/').pop();
  assert.match(code, /^[A-Z0-9]{6}$/);

  // the student is in; her open stream is closed as soon as she is suspended
  const nora = (await post('/school/enter', ks(a.parent), {student: a.child, subject: 'science'})).headers.get('set-cookie').split(';')[0];
  const stream = await fetch(base + '/class/' + code + '/events', {headers: {cookie: nora}}), reader = stream.body.getReader();
  let got = ''; const until = async re => { while (!re.test(got)) { const {value, done} = await reader.read(); if (done) return got + '<closed>'; got += new TextDecoder().decode(value); } return got; };
  await until(/event: view/);
  data.students[0].status = 'suspended';
  assert.match(await until(/event: revoked/), /event: revoked/, 'disconnected while the stream was open');
  data.students[0].status = 'active';

  // the administration moves the period to another teacher: the first loses the room, the new one takes it over
  data.assignments[0].teacher_id = b.teacher; data.periods[0].teacher_id = b.teacher;
  assert.equal((await cmd(code, ks(a.teacher), {op: 'go', by: 1})).status, 403, 'no longer assigned');
  const take = await post('/teach/today/start', ks(b.teacher), {period: 'p-1', plan: 'ready:s1-1-1'});
  assert.equal(take.headers.get('location'), '/teach/live/' + code, 'the same room, now led by the assigned teacher');
  assert.equal((await cmd(code, ks(b.teacher), {op: 'go', by: 1})).status, 200);
  assert.equal(store.group.session(code).teacher, b.teacher);

  // links are one-to-one in both directions; never a second code for an id nor a second id for a code
  store.group.link('subject', 'sub-1', 'science');
  assert.throws(() => store.group.link('subject', 'sub-1', 'math'));
  assert.throws(() => store.group.link('subject', 'sub-9', 'science'));
  assert.throws(() => store.group.link('room', 'x', 'y'), 'only known kinds');
  assert.deepEqual(store.group.links().subject, {'sub-1': 'science'});
});
