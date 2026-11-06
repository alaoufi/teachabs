import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePlan, defaultPlan, publicStep, PlanError} from '../public/group-plan.js';
import {initialState, teacherCommand, publicView, teacherView, checkAnswer, contentFor, narrationFor} from '../group-session.mjs';
import {openStore} from '../store.mjs';
import {createApp} from '../server.mjs';

const plan = validatePlan(defaultPlan());
const step = id => plan.steps.findIndex(s => s.id === id);
const run = (state, ...cmds) => cmds.reduce((s, c) => teacherCommand(s, plan, c), state);

test('default plan follows the requested sequence and validates', () => {
  assert.deepEqual(plan.steps.map(s => s.type), ['page', 'interactive', 'board', 'questions', 'homework', 'evaluation']);
  const bad = structuredClone(defaultPlan());
  for (const mutate of [p => p.steps = [], p => p.grade = 9, p => p.steps[0].type = 'video', p => p.steps[3].questions[0].answer = 7,
    p => Object.assign(p.steps[0], {source: 'upload', image: 'data:image/svg+xml;base64,AAAA', rights: true}),
    p => Object.assign(p.steps[0], {source: 'upload', image: 'data:image/png;base64,AAAA', rights: false}),
    p => p.steps[1].narration = {mode: 'recorded'}, p => p.steps[1].narration = {mode: 'speech', text: ''}, p => p.steps[2].items[0].kind = 'html']) {
    const p = structuredClone(bad); mutate(p); assert.throws(() => validatePlan(p), PlanError);
  }
  const upload = structuredClone(defaultPlan()); Object.assign(upload.steps[0], {source: 'upload', image: 'data:image/png;base64,iVBORw0KGgo=', rights: true});
  assert.equal(validatePlan(upload).steps[0].source, 'upload');
});

test('students never receive answer keys or unrevealed items', () => {
  const q = publicStep(plan.steps[step('check')]);
  assert.ok(q.questions.every(x => !('answer' in x)));
  assert.deepEqual(publicStep(plan.steps[step('board-notes')], ['n2']).items.map(i => i.id), ['n2']);
  let s = initialState(plan);
  assert.throws(() => contentFor(s, plan, 'check'), e => e.status === 403);
  s = run(s, {op: 'go', index: step('board-notes')}, {op: 'reveal', item: 'n1', show: true});
  assert.deepEqual(contentFor(s, plan, 'board-notes').items.map(i => i.id), ['n1']);
  s = run(s, {op: 'show', shown: false});
  assert.throws(() => contentFor(s, plan, 'board-notes'), e => e.status === 403);
  assert.equal(publicView(s, plan, 'st', []).step, undefined);
});

test('answers only while the teacher has opened the current questions', () => {
  let s = run(initialState(plan), {op: 'go', index: step('check')});
  const answer = {step: 'check', question: 'q1', choice: 1};
  assert.throws(() => checkAnswer(s, plan, answer, 'answer'), e => e.status === 409);
  s = run(s, {op: 'open', open: true});
  assert.deepEqual(checkAnswer(s, plan, answer, 'answer').data, {choice: 1});
  assert.throws(() => checkAnswer(s, plan, {...answer, choice: 9}, 'answer'));
  assert.equal(checkAnswer(s, plan, {step: 'check', question: 'q3', text: ' لأن الجسم يحجب الضوء '}, 'answer').data.text, 'لأن الجسم يحجب الضوء');
  assert.throws(() => checkAnswer(s, plan, {step: 'homework', question: 'h1', choice: 1}, 'homework'), e => e.status === 409);
  s = run(s, {op: 'homework', status: 'open'});
  assert.equal(checkAnswer(s, plan, {step: 'homework', question: 'h1', choice: 1}, 'homework').data.choice, 1);
});

test('results stay with the teacher until shown; spotlight respects the name choice', () => {
  let s = run(initialState(plan), {op: 'go', index: step('check')}, {op: 'open', open: true});
  const responses = [
    {student: 'a', step: 'check', item: 'q1', kind: 'answer', data: {choice: 1}},
    {student: 'b', step: 'check', item: 'q1', kind: 'answer', data: {choice: 0}},
    {student: 'b', step: 'check', item: 'q3', kind: 'answer', data: {text: 'الجسم يحجب الضوء'}}];
  const t = teacherView(s, plan, [{id: 'a', name: 'سارة'}, {id: 'b', name: 'ليان'}], responses);
  assert.deepEqual(t.results.check.counts.q1, [1, 1, 0]);
  assert.equal(publicView(s, plan, 'a', responses).display, undefined);
  assert.deepEqual(publicView(s, plan, 'a', responses).mine, {q1: {choice: 1}});
  s = run(s, {op: 'display', mode: 'summary', question: 'q1'});
  assert.deepEqual(publicView(s, plan, null, responses).display.counts, [1, 1, 0]);
  s = run(s, {op: 'display', mode: 'spotlight', question: 'q3', student: 'b', named: false});
  const anon = publicView(s, plan, 'a', responses, {b: 'ليان'}).display;
  assert.equal(anon.answer, 'الجسم يحجب الضوء'); assert.equal(anon.name, null);
  s = run(s, {op: 'display', mode: 'spotlight', question: 'q3', student: 'b', named: true});
  assert.equal(publicView(s, plan, 'a', responses, {b: 'ليان'}).display.name, 'ليان');
  assert.throws(() => run(s, {op: 'display', mode: 'summary', question: 'q3'}));
});

test('teacher-only controls validate input; narration only for prepared steps', () => {
  let s = initialState(plan);
  for (const bad of [{op: 'go', index: 99}, {op: 'reveal', item: 'n1', show: true}, {op: 'stroke', points: [[0, 0]], color: '#173e34'}, {op: 'narrate', target: 'here'}, {op: 'nope'}])
    assert.throws(() => run(s, bad));
  s = run(s, {op: 'stroke', points: [[10, 10], [200, 300]], color: '#c0392b'});
  assert.equal(publicView(s, plan, 'a', []).strokes.length, 1);
  assert.throws(() => run(s, {op: 'stroke', points: [[10, 10], [2000, 300]], color: '#c0392b'}));
  s = run(s, {op: 'go', index: step('explain')}, {op: 'shadow', command: {op: 'reveal', show: false}}, {op: 'narrate', target: 'students'});
  assert.equal(publicView(s, plan, 'a', []).shadow.reveal, false);
  assert.equal('length' in publicView(s, plan, 'a', []).shadow, false);
  assert.equal(publicView(s, plan, 'a', []).narrate.target, 'students');
  assert.equal(publicView(s, plan, null, []).narrate, undefined);
  assert.equal(narrationFor(s, plan, 'explain').mode, 'speech');
  assert.throws(() => run(s, {op: 'shadow', command: {op: 'control', to: 'student'}}));
});

async function server(t) {
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  t.after(async () => { app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); });
  return {store, base: 'http://127.0.0.1:' + app.address().port};
}

test('HTTP flow: plan, start, join, answer, results, homework and evaluation', async t => {
  const {store, base} = await server(t);
  const tour = store.tour(), teacher = 'ks=' + store.session(tour.teacher), parent = 'ks=' + store.session(tour.parent);
  const form = (cookie, body = {}) => ({method: 'POST', headers: {origin: base, cookie, 'content-type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams(body), redirect: 'manual'});
  const json = (cookie, body) => ({method: 'POST', headers: {origin: base, cookie, 'content-type': 'application/json'}, body: JSON.stringify(body)});
  assert.equal((await fetch(base + '/teach/plans', {headers: {cookie: parent}})).status, 403);
  assert.equal((await fetch(base + '/teach/plans', {redirect: 'manual'})).status, 303);
  const created = await fetch(base + '/teach/plans/new', form(teacher));
  const planUrl = created.headers.get('location'); assert.match(planUrl, /^\/teach\/plans\/[0-9a-f-]{36}$/);
  const page = await fetch(base + planUrl, {headers: {cookie: teacher}});
  assert.match(page.headers.get('content-security-policy'), /script-src 'self'/);
  assert.match(page.headers.get('permissions-policy'), /microphone=\(self\)/);
  const saved = await (await fetch(base + planUrl + '.json', {headers: {cookie: teacher}})).json();
  saved.title = 'الضوء والظل — الفصل ٤أ';
  assert.equal((await fetch(base + planUrl, json(teacher, saved))).status, 200);
  const invalid = await fetch(base + planUrl, json(teacher, {...saved, steps: []}));
  assert.equal(invalid.status, 400); assert.match((await invalid.json()).error, /خطوة/);
  assert.equal((await fetch(base + planUrl, {...json(teacher, saved), headers: {origin: 'https://evil.test', cookie: teacher, 'content-type': 'application/json'}})).status, 403);
  const start = await fetch(base + planUrl + '/start', form(teacher));
  const code = start.headers.get('location').split('/').pop(); assert.match(code, /^[A-Z0-9]{6}$/);
  // Another teacher cannot open this session.
  const other = store.tour(); assert.equal((await fetch(base + '/teach/live/' + code, {headers: {cookie: 'ks=' + store.session(other.teacher)}})).status, 404);

  const join = async name => { const r = await fetch(base + '/join', form('', {code, name})); assert.equal(r.status, 303, name); return r.headers.get('set-cookie').split(';')[0]; };
  const sara = await join('سارة'), layan = await join('ليان');
  assert.equal((await fetch(base + '/join', form('', {code: 'AAAAAA', name: 'خالد'}))).status, 404);
  assert.equal((await fetch(base + '/class/' + code, {redirect: 'manual'})).status, 303);
  assert.equal((await fetch(base + '/class/' + code, {headers: {cookie: sara}})).status, 200);

  const cmd = body => fetch(base + '/teach/live/' + code + '/command', json(teacher, body));
  const answer = (cookie, body) => fetch(base + '/class/' + code + '/answer', json(cookie, body));
  assert.equal((await answer(sara, {step: 'check', question: 'q1', choice: 1})).status, 409);
  assert.equal((await cmd({op: 'go', index: 3})).status, 200);
  assert.equal((await cmd({op: 'open', open: true})).status, 200);
  assert.equal((await answer(sara, {step: 'check', question: 'q1', choice: 1})).status, 200);
  assert.equal((await answer(layan, {step: 'check', question: 'q1', choice: 0})).status, 200);
  assert.equal((await fetch(base + '/teach/live/' + code + '/command', json(sara, {op: 'go', index: 0}))).status, 401);
  const content = await (await fetch(base + '/class/' + code + '/content?step=check', {headers: {cookie: sara}})).json();
  assert.ok(content.questions.every(q => !('answer' in q)));
  assert.equal((await fetch(base + '/class/' + code + '/content?step=homework', {headers: {cookie: sara}})).status, 403);

  assert.equal((await cmd({op: 'homework', status: 'open'})).status, 200);
  assert.equal((await answer(layan, {kind: 'homework', step: 'homework', question: 'h1', choice: 1})).status, 200);
  const students = store.group.students(code);
  assert.equal((await fetch(base + '/teach/live/' + code + '/evaluate', json(teacher, {student: students[1].id, ratings: [4, 3, 4], note: 'مشاركة ممتازة'}))).status, 200);
  assert.equal((await fetch(base + '/teach/live/' + code + '/evaluate', json(teacher, {student: students[1].id, ratings: [9], note: ''}))).status, 400);
  assert.equal((await cmd({op: 'publish-evaluation', on: true})).status, 200);

  // Read each seat's live view from the event stream.
  const firstView = async (url, cookie) => {
    const r = await fetch(base + url, {headers: {cookie}}), reader = r.body.getReader(); let text = '';
    while (!text.includes('\n\n')) text += new TextDecoder().decode((await reader.read()).value);
    await reader.cancel(); return JSON.parse(text.split('data: ')[1]);
  };
  const layanView = await firstView('/class/' + code + '/events', layan);
  assert.deepEqual(layanView.mine, {q1: {choice: 0}});
  assert.equal(layanView.homework.correct, 1);
  assert.deepEqual(layanView.evaluation.ratings, ['متميز', 'جيد', 'متميز']);
  const teacherViewData = await firstView('/teach/live/' + code + '/events', teacher);
  assert.deepEqual(teacherViewData.results.check.counts.q1, [1, 1, 0]);
  assert.equal(teacherViewData.students.length, 2);

  assert.equal((await fetch(base + '/teach/live/' + code + '/remove', json(teacher, {student: students[0].id}))).status, 200);
  assert.equal((await answer(sara, {kind: 'homework', step: 'homework', question: 'h1', choice: 1})).status, 401);
  for (const asset of ['group-plan.js', 'group-view.js', 'group-planner.js', 'group-teacher.js', 'group-student.js', 'group-lesson.css']) assert.equal((await fetch(base + '/' + asset)).status, 200, asset);
});
