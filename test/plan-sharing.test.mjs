// Stage 058: a lesson prep is kept with its board arrangement, a teacher sends a copy to a colleague of the same school,
// and academic affairs reads every prep of the school and assigns a copy to another teacher.
import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from '../store.mjs';
import {createApp} from '../server.mjs';

async function setup(t) {
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  t.after(async () => { app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); });
  const base = 'http://127.0.0.1:' + app.address().port;
  const get = (p, cookie = '') => fetch(base + p, {headers: {cookie}, redirect: 'manual'});
  const post = (p, data = {}, cookie = '') => fetch(base + p, {method: 'POST', headers: {cookie, origin: base}, body: new URLSearchParams(data), redirect: 'manual'});
  const cookie = id => 'ks=' + store.session(id);
  const ids = store.admin.demo();
  const teacher = (name, email) => store.activate(store.admin.createTeacher(ids.education, {name, email, subjects: ['math', 'science'], grades: [4], language: 'ar'}).token, 'test-password-123');
  return {store, get, post, cookie, ids, a: teacher('معلم أول', 'first.share@example.invalid'), b: teacher('معلم ثان', 'second.share@example.invalid')};
}
const newPlan = async (post, c, template = 'cells') => (await post('/teach/plans/new', {template}, c)).headers.get('location').split('/').pop();

test('a teacher sends a copy of a prep (with tools and board) to a colleague; the original stays', async t => {
  const {store, get, post, cookie, a, b} = await setup(t), ca = cookie(a), cb = cookie(b);
  const id = await newPlan(post, ca);
  const list = await (await get('/teach/plans', ca)).text();
  assert.match(list, new RegExp(`action="/teach/plans/${id}/send"`)); assert.match(list, /معلم ثان/);
  const r = await post(`/teach/plans/${id}/send`, {to: b}, ca);
  assert.equal(r.status, 303); assert.equal(r.headers.get('location'), '/teach/plans?sent=1');
  assert.match(await (await get('/teach/plans?sent=1', ca)).text(), /أُرسلت نسخة/);
  const theirs = store.group.plans(b); assert.equal(theirs.length, 1); assert.match(theirs[0].origin, /أرسله إليك معلم أول/);
  const copy = store.group.plan(b, theirs[0].id), mine = store.group.plan(a, id);
  assert.deepEqual(copy.plan, mine.plan); assert.deepEqual(copy.plan.tools, ['cells', 'vertebrates', 'kwl']);
  assert.match(await (await get('/teach/plans', cb)).text(), /📥 أرسله إليك معلم أول/);
  // the colleague's edits do not touch the original
  assert.equal((await post(`/teach/plans/${theirs[0].id}/delete`, {}, cb)).status, 303);
  assert.ok(store.group.plan(a, id));
  // only teachers of the same school; not oneself; not someone else's prep
  assert.equal((await post(`/teach/plans/${id}/send`, {to: a}, ca)).status, 400);
  const other = store.admin.demo(), outsider = store.activate(store.admin.createTeacher(other.education, {name: 'خارج المدرسة', email: 'out.share@example.invalid', subjects: ['math'], grades: [4], language: 'ar'}).token, 'test-password-123');
  assert.equal((await post(`/teach/plans/${id}/send`, {to: outsider}, ca)).status, 400);
  assert.equal((await post(`/teach/plans/${id}/send`, {to: a}, cb)).status, 404);
});

test('academic affairs reads every prep of the school and assigns a copy; other departments cannot', async t => {
  const {store, get, post, cookie, ids, a, b} = await setup(t), ce = cookie(ids.education);
  const id = await newPlan(post, cookie(a), 'placevalue');
  assert.match(await (await get('/admin/education', ce)).text(), /href="\/teach\/review"/);
  const list = await (await get('/teach/review', ce)).text();
  assert.match(list, /القيمة المنزلية/); assert.match(list, /معلم أول/); assert.match(list, /الرياضيات/);
  const page = await (await get('/teach/review/' + id, ce)).text();
  assert.match(page, /ترتيب الدرس/); assert.match(page, /لوحة المنازل|القيمة المنزلية/); assert.match(page, new RegExp(`action="/teach/review/${id}/assign"`));
  assert.doesNotMatch(page.match(/<form[^]*?<\/form>/)[0], new RegExp(`value="${a}"`)); // not back to its owner
  const r = await post(`/teach/review/${id}/assign`, {to: b}, ce);
  assert.equal(r.status, 303); assert.equal(r.headers.get('location'), '/teach/review?assigned=1');
  const theirs = store.group.plans(b); assert.equal(theirs.length, 1); assert.match(theirs[0].origin, /من الشؤون التعليمية .* تحضير معلم أول/);
  // finance has no education permission; teachers cannot open the review
  assert.equal((await get('/teach/review', cookie(ids.finance))).status, 403);
  assert.equal((await get('/teach/review', cookie(a))).status, 403);
  // another school's academic affairs cannot see this prep
  const other = store.admin.demo();
  assert.equal((await get('/teach/review/' + id, cookie(other.education))).status, 404);
  assert.doesNotMatch(await (await get('/teach/review', cookie(other.education))).text(), /القيمة المنزلية/);
});
