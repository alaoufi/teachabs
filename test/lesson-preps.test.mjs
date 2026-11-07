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
