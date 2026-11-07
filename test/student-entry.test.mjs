// Stage 062: two ways into the class — a parent's account lists their children to choose from, or the student's name.
import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from '../store.mjs';
import {createApp} from '../server.mjs';
import {LESSON_TEMPLATES, validatePlan} from '../public/group-plan.js';
import {initialState} from '../group-session.mjs';

test('a parent chooses one of their children; the student\'s name still works; nobody uses another family\'s child', async t => {
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  t.after(async () => { app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); });
  const base = 'http://127.0.0.1:' + app.address().port;
  const get = (p, c = '') => fetch(base + p, {headers: {cookie: c}, redirect: 'manual'});
  const post = (p, data, c = '') => fetch(base + p, {method: 'POST', headers: {cookie: c, origin: base}, body: new URLSearchParams(data), redirect: 'manual'});
  const family = store.tour(), other = store.tour(), parent = 'ks=' + store.session(family.parent);
  store.child(family.parent, {name: 'سلمان أحمد', grade: 6, curriculum: 'sa', language: 'ar'});
  const plan = validatePlan(LESSON_TEMPLATES.cells.plan()), code = store.group.startSession(family.teacher, plan, initialState(plan));
  const page = await (await get('/join?code=' + code, parent)).text();
  assert.match(page, /من سيدخل الحصة؟/); assert.match(page, /<b>نورة<\/b>/); assert.match(page, /<b>سلمان<\/b>/, 'first name only'); assert.match(page, /أو ادخل باسم الطالب/);
  assert.doesNotMatch(await (await get('/join?code=' + code)).text(), /من سيدخل الحصة؟/, 'without a parent account: by name only');
  // the parent enters as نورة
  const r = await post('/join', {code, child: family.child}, parent);
  assert.equal(r.status, 303); assert.equal(r.headers.get('location'), '/class/' + code);
  assert.deepEqual(store.group.students(code).map(s => s.name), ['نورة']);
  // again from another device: the same place in class, not a second نورة
  await post('/join', {code, child: family.child}, parent);
  assert.equal(store.group.students(code).length, 1);
  // by the student's name, as before
  assert.equal((await post('/join', {code, name: 'ليان'})).status, 303);
  assert.deepEqual(store.group.students(code).map(s => s.name), ['نورة', 'ليان']);
  // a child of another family, or a child without a parent account: refused
  assert.equal((await post('/join', {code, child: other.child}, parent)).status, 404);
  assert.equal((await post('/join', {code, child: family.child})).status, 403);
  assert.equal(store.group.students(code).length, 2);
});
