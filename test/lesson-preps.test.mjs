// Stage 061: a ready prep for every grade 4, term 1 lesson, each with its aids; the answer keys are checked by computing.
import test from 'node:test';
import assert from 'node:assert/strict';
import {LESSON_PREPS, LESSON_AIDS} from '../public/lesson-preps-g4.js';
import {curriculumLessons} from '../public/curriculum-g4.js';
import {LESSON_TEMPLATES, validatePlan, ORIGINAL_PAGES} from '../public/group-plan.js';
import {LIBRARY, toolsFor} from '../public/tool-library.js';
import {ACTIVITIES} from '../public/activities.js';

const lessons = curriculumLessons();
const num = s => Number(String(s).replace(/,/g, ''));

test('every lesson of the term has a ready prep that validates, with its aids pinned and its page', () => {
  for (const l of lessons) {
    assert.ok(l.template && LESSON_TEMPLATES[l.template], 'ready: ' + l.title);
    const plan = validatePlan(LESSON_TEMPLATES[l.template].plan());
    assert.equal(plan.lesson, l.id); assert.equal(plan.subject, l.subject); assert.ok(plan.tools.length >= 2, l.id + ' has aids');
    assert.deepEqual(plan.steps.map(s => s.type).filter(t => t !== 'interactive'), ['page', 'board', 'questions', 'homework', 'evaluation']);
    assert.ok(ORIGINAL_PAGES[plan.steps[0].page], l.id);
    if (l.template.startsWith('g4-')) assert.doesNotMatch(JSON.stringify(plan.steps), /"(prompt|text)":"[^"]*[0-9]/, l.id + ': Arabic-Indic digits only');
  }
  for (const [id, p] of Object.entries(LESSON_PREPS)) {
    assert.ok(p.aids.every(a => LIBRARY.some(t => t.id === a)), id + ' aids exist');
    if (p.act) assert.ok(ACTIVITIES[p.act], id + ' activity');
    assert.equal(p.pts.length, 4); assert.equal(p.q.length, 4); assert.equal(p.hw.length, 4);
    for (const [, opts, a] of [...p.q.slice(0, 3), p.hw[1], p.hw[2]]) { assert.ok(a >= 0 && a < opts.length); assert.equal(new Set(opts).size, opts.length, id + ' distinct options'); }
  }
  assert.equal(Object.keys(LESSON_AIDS).length, lessons.length);
});

test('answer keys of computation questions are right', () => {
  let checked = 0;
  const ops = {'+': (a, b) => a + b, '−': (a, b) => a - b, '×': (a, b) => a * b};
  for (const [id, p] of Object.entries(LESSON_PREPS)) for (const [prompt, opts, a] of [...p.q.slice(0, 3), p.hw[1], p.hw[2]]) {
    const m = prompt.match(/^([\d,]+) ([+−×]) ([\d,]+) =$/);
    if (m) { assert.equal(num(opts[a]), ops[m[2]](num(m[1]), num(m[3])), `${id}: ${prompt}`); checked++; }
  }
  assert.ok(checked >= 40, 'checked ' + checked);
});

test('the library lists each lesson\'s own aids first, in the prep\'s order', () => {
  const {forLesson} = toolsFor({subject: 'math', grade: 4, lesson: 'm5-6'});
  assert.deepEqual(forLesson.slice(0, 3).map(t => t.id), ['area', 'multtable', 'placechart']);
  assert.ok(toolsFor({subject: 'science', grade: 4, lesson: 's3-5-2'}).forLesson[0].id === 'digestive');
});

test('«مكتبة الوسائل الدراسية»: teachers and academic affairs open it; other departments cannot', async t => {
  const {openStore} = await import('../store.mjs'), {createApp} = await import('../server.mjs');
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  t.after(async () => { app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); });
  const base = 'http://127.0.0.1:' + app.address().port, get = (p, id) => fetch(base + p, {headers: {cookie: id ? 'ks=' + store.session(id) : ''}, redirect: 'manual'});
  const ids = store.admin.demo(), teacher = store.activate(store.admin.createTeacher(ids.education, {name: 'معلم المكتبة', email: 'aids.t@example.invalid', subjects: ['math'], grades: [4], language: 'ar'}).token, 'test-password-123');
  assert.equal((await get('/teach/aids')).headers.get('location'), '/login');
  const page = await (await get('/teach/aids?subject=math&grade=4', teacher)).text();
  assert.match(page, /مكتبة الوسائل الدراسية/); assert.equal((page.match(/data-lesson="m/g) || []).length, 39);
  assert.match(page, /value="g4-m5-6"/); assert.match(page, /data-aid="area"[^]*?<svg/);
  assert.doesNotMatch(page, /data-lesson="s/, 'filtered to math');
  const admin = await get('/teach/aids', ids.education); assert.equal(admin.status, 200); assert.doesNotMatch(await admin.text(), /ابدأ من الدرس الجاهز/);
  assert.equal((await get('/teach/aids', ids.technical)).status, 200, 'the libraries section');
  assert.equal((await get('/teach/aids', ids.finance)).status, 403);
  assert.match(await (await get('/teach/plans', teacher)).text(), /href="\/teach\/aids"/);
});

// Stage 066 on: ready preps of the other elementary grades, one file per grade, gathered in lesson-preps.js.
test('every ready prep of grades 1, 2, 3, 5 and 6 validates, opens its book page, and its computation keys are right', async () => {
  const {READY_PREPS, ALL_AIDS} = await import('../public/lesson-preps.js');
  const {primaryLessons} = await import('../public/curriculum-primary.js');
  const {lessonBookPage} = await import('../public/book-catalog.js');
  const ops = {'+': (a, b) => a + b, '−': (a, b) => a - b, '×': (a, b) => a * b};
  const byGrade = {}; let checked = 0;
  for (const [id, p] of Object.entries(READY_PREPS)) {
    const l = primaryLessons().find(x => x.id === id); assert.ok(l, id + ' is a curriculum lesson');
    byGrade[l.grade] = (byGrade[l.grade] || 0) + 1;
    assert.ok(p.aids.length >= 2 && p.aids.every(a => LIBRARY.some(t => t.id === a)), id + ' aids exist');
    assert.ok(p.aids.every(a => LIBRARY.find(t => t.id === a).grades.includes(l.grade) || LIBRARY.find(t => t.id === a).kind === 'class'), id + ' aids fit the grade');
    if (p.act) assert.ok(ACTIVITIES[p.act] && (!LIBRARY.find(t => t.id === p.act) || LIBRARY.find(t => t.id === p.act).grades.includes(l.grade)), id + ' activity fits the grade');
    assert.equal(p.pts.length, 4); assert.equal(p.q.length, 4); assert.equal(p.hw.length, 4); assert.equal(p.sn.length, 6, id);
    for (const [prompt, opts, a] of [...p.q.slice(0, 3), p.hw[1], p.hw[2]]) {
      assert.ok(a >= 0 && a < opts.length, id); assert.equal(new Set(opts).size, opts.length, id + ' distinct options');
      const m = prompt.match(/^([\d,]+) ([+−×]) ([\d,]+) =$/);
      if (m) { assert.equal(num(opts[a]), ops[m[2]](num(m[1]), num(m[3])), `${id}: ${prompt}`); checked++; }
    }
    const plan = validatePlan(LESSON_TEMPLATES['ready-' + id].plan());
    assert.equal(plan.lesson, id); assert.equal(plan.grade, l.grade); assert.deepEqual(plan.tools, p.aids);
    const page = plan.steps[0], at = lessonBookPage(id);
    assert.equal(page.source, 'book'); assert.equal(page.book, at.book); assert.equal(page.page, at.page);
    assert.doesNotMatch(JSON.stringify(plan.steps), /"(prompt|text|instructions)":"[^"]*[0-9]/, id + ': Arabic-Indic digits only');
    assert.deepEqual(ALL_AIDS[id], p.aids);
  }
  for (const g of Object.keys(byGrade)) assert.equal(byGrade[g], primaryLessons().filter(l => l.grade === Number(g)).length, `grade ${g}: every lesson has a prep`);
  assert.ok(byGrade[1] === 52, 'grade 1 done');
  assert.ok(checked >= 20, 'checked ' + checked);
  assert.equal(toolsFor({subject: 'math', grade: 1, lesson: 'p1m26'}).forLesson[0].id, READY_PREPS.p1m26.aids[0]);
});

test('«دروسي» of grade 1 starts a lesson from its ready prep, at its book page', async t => {
  const {openStore} = await import('../store.mjs'), {createApp} = await import('../server.mjs');
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  t.after(async () => { app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); });
  const base = 'http://127.0.0.1:' + app.address().port, ids = store.admin.demo();
  const teacher = store.activate(store.admin.createTeacher(ids.education, {name: 'معلم الأول', email: 'g1.t@example.invalid', subjects: ['math'], grades: [1], language: 'ar'}).token, 'test-password-123');
  const cookie = 'ks=' + store.session(teacher);
  const page = await (await fetch(base + '/teach/plans?grade=1', {headers: {cookie}})).text();
  assert.equal(new Set(page.match(/value="ready-p1[sm]\d\d"/g)).size, 52); assert.match(page, /٤١ جاهز من ٤١ درسًا/);
  const made = await fetch(base + '/teach/plans/new', {method: 'POST', headers: {cookie, origin: base, 'content-type': 'application/x-www-form-urlencoded'}, body: 'template=ready-p1m26', redirect: 'manual'});
  assert.equal(made.status, 303); const id = made.headers.get('location').split('/').pop();
  const saved = store.group.plan(teacher, id); assert.equal(saved.plan.lesson, 'p1m26'); assert.equal(saved.plan.steps[0].source, 'book');
  assert.match(await (await fetch(base + '/teach/aids?grade=1', {headers: {cookie}})).text(), /value="ready-p1m26"/);
});
