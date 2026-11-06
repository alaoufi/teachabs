import test from 'node:test';
import assert from 'node:assert/strict';
import {changeShadow, visibleShadow, initialShadow, shadowAllowed} from '../shadow-activity.mjs';
import {openStore} from '../store.mjs';
import {createApp} from '../server.mjs';

const denied = (fn, status) => assert.throws(fn, e => e.status === status);

test('teacher leads; the student drives only after an explicit handover', () => {
  let s = initialShadow();
  denied(() => changeShadow(s, 'student', {op: 'set', hour: 12}), 403);
  s = changeShadow(s, 'teacher', {op: 'set', hour: 9.1, height: 9, material: 'paper'});
  assert.deepEqual([s.hour, s.height, s.material], [9, 2, 'paper']);
  for (const op of [{op: 'control', to: 'student'}, {op: 'reveal', show: false}, {op: 'challenge', id: 'equal'}, {op: 'reset'}])
    denied(() => changeShadow(s, 'student', op), 403);
  s = changeShadow(s, 'teacher', {op: 'control', to: 'student'});
  s = changeShadow(s, 'student', {op: 'set', hour: 15});
  assert.equal(s.hour, 15);
  s = changeShadow(s, 'teacher', {op: 'set', hour: 10}); // the teacher can always step in
  assert.equal(s.hour, 10);
  s = changeShadow(s, 'teacher', {op: 'control', to: 'teacher'});
  denied(() => changeShadow(s, 'student', {op: 'set', hour: 12}), 403);
});

test('invalid commands are rejected without changing state', () => {
  const s = initialShadow();
  for (const bad of [null, {}, {op: 'set'}, {op: 'set', hour: 'x'}, {op: 'set', material: '__proto__'}, {op: 'control', to: 'parent'}, {op: 'reveal', show: 'yes'}, {op: 'challenge', id: 'nope'}, {op: 'unknown'}])
    assert.throws(() => changeShadow(s, 'teacher', bad), e => e.status === 400);
  denied(() => changeShadow(s, 'parent', {op: 'set', hour: 9}), 403);
  assert.deepEqual(s, initialShadow());
});

test('hidden results are withheld from the student, not only hidden on screen', () => {
  let s = changeShadow(initialShadow(), 'teacher', {op: 'challenge', id: 'equal'});
  s = changeShadow(s, 'teacher', {op: 'reveal', show: false});
  const student = visibleShadow(s, 'student'), teacher = visibleShadow(s, 'teacher');
  for (const key of ['length', 'elevation', 'shadow', 'result']) assert.equal(key in student, false, key);
  assert.ok(teacher.length > 0 && teacher.result);
  s = changeShadow(s, 'teacher', {op: 'reveal', show: true});
  assert.ok('length' in visibleShadow(s, 'student'));
  assert.equal(changeShadow(s, 'teacher', {op: 'set', hour: 9}).step > s.step, true);
  assert.equal(shadowAllowed({preview: true}), true);
  assert.equal(shadowAllowed({subject: 'science'}), true);
  assert.equal(shadowAllowed({subject: 'math'}), false);
});

test('classroom page shows voice controls first and the activity before the board', async t => {
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  t.after(async () => { app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); });
  const base = 'http://127.0.0.1:' + app.address().port;
  const start = await fetch(base + '/lesson/preview/start?seat=teacher', {method: 'POST', headers: {origin: base}, redirect: 'manual'});
  const cookie = start.headers.get('set-cookie').split(';')[0];
  const html = await (await fetch(base + '/lesson/preview?seat=teacher', {headers: {cookie}})).text();
  const at = id => html.indexOf(id);
  for (const id of ['id="mic"', 'id="cam"', 'id="remote"', 'id="local"', 'id="play"', 'id="hint"', 'id="shadow-activity"', 'id="place-activity"', 'id="board-pro"', 'id="erase"', 'id="sa-handover"', 'نقاط تشرحها بصوتك']) assert.ok(at(id) > 0, id);
  assert.ok(at('id="mic"') < at('id="shadow-activity"') && at('id="shadow-activity"') < at('id="board-pro"'));
  assert.ok(!html.slice(0, at('id="mic"')).includes('<details'), 'microphone is not inside a collapsed section');
  const student = await (await fetch(base + '/lesson/preview', {headers: {cookie}})).text();
  assert.equal(student.includes('id="sa-handover"'), false);
  assert.equal(student.includes('نقاط تشرحها بصوتك'), false);
  assert.equal((await fetch(base + '/shadow-client.js')).status, 200);
});
