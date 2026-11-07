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
  for (const bad of [{op: 'go', index: 99}, {op: 'reveal', item: 'n1', show: true}, {op: 'stroke', points: [[0, 0]], color: '#173e34'}, {op: 'narrate', target: 'nowhere'}, {op: 'nope'}])
    assert.throws(() => run(s, bad));
  assert.throws(() => run(run(s, {op: 'go', index: step('check')}), {op: 'narrate', target: 'students'}), /مباشر/, 'a live-voice step has no prepared narration');
  assert.equal(run(s, {op: 'narrate', target: 'students'}).narrate.target, 'students', 'the curriculum page has a prepared audio explanation');
  s = run(s, {op: 'stroke', points: [[10, 10], [200, 300]], color: '#c0392b'});
  assert.equal(publicView(s, plan, 'a', []).strokes.length, 1);
  assert.throws(() => run(s, {op: 'stroke', points: [[10, 10], [2000, 300]], color: '#c0392b'}));
  s = run(s, {op: 'go', index: step('explain')}, {op: 'shadow', command: {op: 'reveal', show: false}}, {op: 'narrate', target: 'students'});
  assert.equal(publicView(s, plan, 'a', []).activity.reveal, false);
  assert.equal(publicView(s, plan, 'a', []).activity.values.hour, 8, 'the sun stays visible; the board hides the shadow');
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

test('board ink: tools, typed text, moving, erasing and a camera students follow', async () => {
  const {clampCamera, zoomAround, smoothPath} = await import('../public/group-ink.js');
  let s = initialState(plan);
  s = run(s, {op: 'stroke', tool: 'marker', size: 'l', color: '#f4d03f', points: [[10, 10], [300, 12], [500, 14]]},
    {op: 'text', text: ' جسم معتم ', x: 600, y: 120, color: '#c0392b', size: 'l'});
  const [mark, text] = s.strokes.curriculum;
  assert.equal(mark.tool, 'marker'); assert.equal(text.text, 'جسم معتم'); assert.notEqual(mark.id, text.id);
  for (const bad of [{op: 'stroke', tool: 'laser', color: '#c0392b', points: [[0, 0], [1, 1]]}, {op: 'stroke', tool: 'pen', size: 'xl', color: '#c0392b', points: [[0, 0], [1, 1]]},
    {op: 'stroke', tool: 'pen', color: 'red', points: [[0, 0], [1, 1]]}, {op: 'text', text: '', x: 1, y: 1, color: '#c0392b'}, {op: 'text', text: 'x'.repeat(601), x: 1, y: 1, color: '#c0392b'},
    {op: 'text', text: 'a', x: 5000, y: 1, color: '#c0392b'}, {op: 'move', id: mark.id, x: 1, y: 1}, {op: 'erase', id: 'nope'}])
    assert.throws(() => run(s, bad));
  s = run(s, {op: 'move', id: text.id, x: 2000, y: -5});
  assert.deepEqual([s.strokes.curriculum[1].x, s.strokes.curriculum[1].y], [1000, 0]);
  s = run(s, {op: 'erase', id: mark.id});
  assert.deepEqual(s.strokes.curriculum.map(i => i.kind), ['text']);
  s = run(s, {op: 'camera', z: 9, x: 999, y: -40});
  assert.deepEqual(publicView(s, plan, 'a', []).camera, {z: 4, x: 750, y: 0});
  assert.deepEqual(clampCamera({z: 0.2}), {z: 1, x: 0, y: 0});
  const z = zoomAround({z: 1, x: 0, y: 0}, 2, 500, 300);
  assert.deepEqual(z, {z: 2, x: 250, y: 150}, 'zooming keeps the point under the cursor');
  assert.match(smoothPath([[0, 0], [10, 10], [20, 0]]), /^M0 0 Q10 10 15\.0 5\.0 L20 0$/);
  // Prepared texts stay with the teacher's plan, not in student content.
  assert.ok(plan.steps[0].snippets.length > 0);
  s = run(initialState(plan));
  assert.equal('snippets' in contentFor(s, plan, 'curriculum'), false);
  const bad = structuredClone(defaultPlan()); bad.steps[0].snippets = Array(13).fill('x');
  assert.throws(() => validatePlan(bad), PlanError);
});

test('narrator tour: teacher leads segments, moves the scene, mutes and hides; students get captions and voice only when chosen', async () => {
  const {segmentAudio} = await import('../group-session.mjs');
  const idx = plan.steps.findIndex(s => s.type === 'interactive'), stepId = plan.steps[idx].id;
  assert.equal(plan.steps[idx].narrator.segments.length, 7, 'ready script fills the lesson');
  let s = run(initialState(plan), {op: 'go', index: idx});
  assert.equal(publicView(s, plan, 'a', []).narrator, undefined);
  assert.throws(() => run(run(initialState(plan)), {op: 'narrator', action: 'start'}), 'only on the interactive step');
  s = run(s, {op: 'shadow', command: {op: 'reveal', show: false}}, {op: 'explore', on: true}, {op: 'narrator', action: 'start'});
  let v = publicView(s, plan, 'a', []);
  assert.equal(v.narrator.segment, 0); assert.equal(v.explore, false); assert.equal(v.activity.reveal, true);
  assert.equal(v.narrator.speak, true, 'by default the explanation is heard on the students\' devices and the display screen');
  assert.equal(publicView(s, plan, null, []).narrator.speak, true);
  assert.equal(publicView(run(s, {op: 'narrator', action: 'target', to: 'screen'}), plan, 'a', []).narrator.speak, false, 'display screen only');
  s = run(s, {op: 'narrator', action: 'goto', segment: 3});
  assert.equal(publicView(s, plan, 'a', []).activity.values.hour, 12);
  s = run(s, {op: 'narrator', action: 'target', to: 'both'}, {op: 'narrator', action: 'mute', on: true});
  assert.equal(publicView(s, plan, 'a', []).narrator.speak, false, 'muted');
  assert.equal(publicView(s, plan, 'a', []).narrator.text, plan.steps[idx].narrator.segments[3].text, 'caption stays when muted');
  assert.deepEqual(segmentAudio(s, plan, stepId, 3), {mode: 'speech', text: plan.steps[idx].narrator.segments[3].text});
  assert.throws(() => segmentAudio(s, plan, stepId, 4), e => e.status === 403);
  s = run(s, {op: 'narrator', action: 'visible', on: false});
  assert.equal(publicView(s, plan, 'a', []).narrator, undefined);
  for (const bad of [{op: 'narrator', action: 'goto', segment: 99}, {op: 'narrator', action: 'dance'}, {op: 'narrator', action: 'target', to: 'parents'}])
    assert.throws(() => run(s, bad));
  s = run(s, {op: 'narrator', action: 'goto', segment: 6});
  assert.throws(() => run(s, {op: 'narrator', action: 'next'}));
  const bad = structuredClone(defaultPlan()); bad.steps[1].narrator = {segments: [{id: 'x', hour: 3, text: 'a'}]};
  assert.throws(() => validatePlan(bad), PlanError);
});

test('teacher text library and lesson import over HTTP', async t => {
  const {store, base} = await server(t);
  const tour = store.tour(), teacher = 'ks=' + store.session(tour.teacher), other = 'ks=' + store.session(store.tour().teacher);
  const json = (cookie, body) => ({method: 'POST', headers: {origin: base, cookie, 'content-type': 'application/json'}, body: JSON.stringify(body)});
  const created = await (await fetch(base + '/teach/texts', json(teacher, {title: 'ما الظل؟ — بأسلوبي', body: 'الظل مكان مظلم خلف الجسم.', origin: 'ls-idea-2'}))).json();
  assert.match(created.id, /^[0-9a-f-]{36}$/);
  assert.equal((await fetch(base + '/teach/texts', json(teacher, {title: '', body: 'x'}))).status, 400);
  assert.equal((await fetch(base + '/teach/texts', json(teacher, {title: 'a', body: 'x'.repeat(601)}))).status, 400);
  assert.equal((await fetch(base + '/teach/texts/' + created.id, json(other, {title: 'سرقة', body: 'x'}))).status, 404, 'another teacher cannot edit it');
  assert.equal((await fetch(base + '/teach/texts/' + created.id, json(teacher, {title: 'معدّل', body: 'نص معدّل'}))).status, 200);
  const mine = await (await fetch(base + '/teach/texts', {headers: {cookie: teacher}})).json();
  assert.deepEqual(mine.map(x => [x.title, x.body, x.origin]), [['معدّل', 'نص معدّل', 'ls-idea-2']]);
  assert.deepEqual(await (await fetch(base + '/teach/texts', {headers: {cookie: other}})).json(), []);
  assert.equal((await fetch(base + '/teach/texts/' + created.id + '/delete', json(teacher, {}))).status, 200);
  const imported = await fetch(base + '/teach/plans/import', json(teacher, defaultPlan()));
  assert.equal(imported.status, 200);
  assert.equal((await fetch(base + '/teach/plans/import', json(teacher, {...defaultPlan(), steps: []}))).status, 400);
  assert.equal(store.group.plans(tour.teacher).length, 1);
});

test('moving: any ink item by an offset kept on the board, and prepared cards placed only by the teacher plan', () => {
  let s = run(initialState(plan), {op: 'stroke', tool: 'brush', color: '#c0392b', points: [[100, 100], [200, 150]]}, {op: 'text', text: 'نص', x: 500, y: 300, color: '#c0392b'});
  const [line, word] = s.strokes.curriculum;
  s = run(s, {op: 'move', id: line.id, dx: 50, dy: -20}, {op: 'move', id: word.id, dx: -600, dy: 10});
  assert.deepEqual(s.strokes.curriculum[0].points, [[150, 80], [250, 130]]);
  assert.deepEqual([s.strokes.curriculum[1].x, s.strokes.curriculum[1].y], [0, 310]);
  s = run(s, {op: 'move', id: line.id, dx: 5000, dy: 0});
  assert.equal(Math.max(...s.strokes.curriculum[0].points.map(p => p[0])), 1000, 'stays inside the board');
  assert.throws(() => run(s, {op: 'move', id: 'nope', dx: 1, dy: 1}));
  const bi = plan.steps.findIndex(x => x.type === 'board');
  assert.throws(() => run(s, {op: 'place', item: 'n1', x: 10, y: 10}), 'only on the board step');
  s = run(s, {op: 'go', index: bi}, {op: 'place', item: 'n2', x: 600, y: 400});
  assert.equal(publicView(s, plan, 'a', []).places.n2, undefined, 'a hidden card position is not sent');
  s = run(s, {op: 'reveal', item: 'n2', show: true});
  assert.deepEqual(publicView(s, plan, 'a', []).places, {n2: {x: 600, y: 400}});
  for (const bad of [{op: 'place', item: 'zz', x: 1, y: 1}, {op: 'place', item: 'n2', x: 2000, y: 1}]) assert.throws(() => run(s, bad));
  s = run(s, {op: 'place', item: 'n2', reset: true});
  assert.deepEqual(publicView(s, plan, 'a', []).places, {});
});

test('user guide page is served and the markdown copy is in sync', async t => {
  const {guideMarkdown, GUIDE} = await import('../public/class-guide.js');
  const {readFileSync} = await import('node:fs');
  assert.equal(readFileSync(new URL('../CLASS-BOARD-GUIDE.md', import.meta.url), 'utf8'), guideMarkdown(), 'regenerate CLASS-BOARD-GUIDE.md from public/class-guide.js');
  const {base} = await server(t);
  const html = await (await fetch(base + '/guide')).text();
  for (const s of GUIDE) assert.ok(html.includes(`id="${s.id}"`), s.id);
  assert.match(html, /<kbd>PageDown<\/kbd>/);
});

test('activity engine: states of matter values, phases, hidden prediction and a full lesson template', async () => {
  const {ACTIVITIES, cleanValues, tweenValues, segmentLabel} = await import('../public/activities.js');
  const {phaseOf, renderMatter} = await import('../public/matter-model.js');
  const {matterPlan, LESSON_TEMPLATES} = await import('../public/group-plan.js');
  assert.deepEqual([-5, 0, 40, 100, 115].map(phaseOf), ['solid', 'melting', 'liquid', 'boiling', 'gas']);
  assert.deepEqual(cleanValues('matter', {temp: 300}), {temp: 120});
  assert.deepEqual(cleanValues('matter', {temp: 12.6}), {temp: 13});
  assert.throws(() => cleanValues('matter', {temp: 'hot'}));
  assert.throws(() => cleanValues('shadows', {material: 'steel'}));
  assert.throws(() => cleanValues('rockets', {}));
  assert.deepEqual(tweenValues('matter', {temp: 0}, {temp: 100}, 0.5), {temp: 50});
  assert.match(segmentLabel('matter', {temp: 100}), /١٠٠°س/);
  assert.match(renderMatter({temp: 110}), /p-fly/);
  const hidden = renderMatter({temp: 110}, {hidden: true});
  assert.ok(!/particle/.test(hidden) && /توقّع/.test(hidden), 'prediction hides the state');
  assert.ok(!/style=/.test(renderMatter({temp: -10})), 'no inline styles (strict CSP)');
  const plan2 = validatePlan(matterPlan());
  assert.deepEqual(Object.keys(LESSON_TEMPLATES), ['cells', 'placevalue', 'light', 'matter']);
  const i = plan2.steps.findIndex(s => s.type === 'interactive');
  assert.equal(plan2.steps[i].activity, 'matter');
  let s = run2(plan2, initialState(plan2), {op: 'go', index: i}, {op: 'activity', action: 'set', values: {temp: 100}});
  assert.equal(publicView(s, plan2, 'a', []).activity.values.temp, 100);
  s = run2(plan2, s, {op: 'narrator', action: 'start'});
  assert.equal(publicView(s, plan2, 'a', []).activity.values.temp, -10, 'narrator segment moves the scene');
  assert.deepEqual(publicView(run2(plan2, s, {op: 'activity', action: 'set', values: {hour: 9}}), plan2, 'a', []).activity.values, {temp: -10}, 'keys of another activity are ignored');
  // «a step forward» three times in a row, as quick taps: each counts from what the server holds; clamped at the ends
  let q = run2(plan2, initialState(plan2), {op: 'go', index: i}, {op: 'activity', action: 'set', values: {temp: 0}});
  q = run2(plan2, q, {op: 'activity', action: 'nudge', key: 'temp', by: 10}, {op: 'activity', action: 'nudge', key: 'temp', by: 10}, {op: 'activity', action: 'nudge', key: 'temp', by: 10});
  assert.equal(publicView(q, plan2, 'a', []).activity.values.temp, 30);
  q = run2(plan2, q, {op: 'activity', action: 'nudge', key: 'temp', by: 130});
  assert.ok(publicView(q, plan2, 'a', []).activity.values.temp === 120, 'never past the end');
  assert.throws(() => run2(plan2, q, {op: 'activity', action: 'nudge', key: 'nope', by: 1}), /قيمة غير صالحة/);
  // An old lesson saved before the engine (segment values on the segment itself) still loads.
  const old = structuredClone(defaultPlan()); old.steps[1].narrator = {segments: [{id: 'o1', hour: 9, height: 1.5, material: 'paper', text: 'مقطع قديم'}]};
  assert.deepEqual(validatePlan(old).steps[1].narrator.segments[0].values, {hour: 9, height: 1.5, material: 'paper'});
  assert.equal(Object.keys(ACTIVITIES).length, 4);
});
function run2(p, state, ...cmds) { return cmds.reduce((s, c) => teacherCommand(s, p, c), state); }
