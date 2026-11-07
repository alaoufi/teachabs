// Stage 064: «مكتبة الكتب المدرسية» — book metadata and source links in the database (no files), the relay that passes
// only the requested parts to signed-in teachers and academic affairs, lessons linked to printed pages, and a book page
// shown in a class kept in memory only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {BOOKS, LESSON_PAGES, lessonBookPage, bookOf} from '../public/book-catalog.js';
import {curriculumLessons} from '../public/curriculum-g4.js';
import {fakeBookSource} from './fake-book.mjs';

test('the catalogue: 12 elementary science and math books, sources and lesson pages that make sense', () => {
  assert.equal(BOOKS.length, 12);
  for (const b of BOOKS) { assert.match(b.pdf, /^https:\/\/learnatdolphin\.com\/wp-content\/uploads\/textbooks\/primary-\d\/term-1\/(science|math)\.pdf\?v=[0-9a-f]{8}$/); assert.match(b.source, /^https:\/\/learnatdolphin\.com\/textbooks\//); assert.equal(b.offset, 1); }
  const lessons = curriculumLessons();
  assert.equal(Object.keys(LESSON_PAGES).length, lessons.length, 'every grade 4 term 1 lesson has its page');
  for (const subject of ['science', 'math']) {
    const pages = lessons.filter(l => l.subject === subject).map(l => lessonBookPage(l.id));
    assert.ok(pages.every((p, i) => p && bookOf(p.book).subject === subject && p.page < bookOf(p.book).pages && (!i || p.page > pages[i - 1].page)), subject + ': in book order');
  }
});

test('books in the database, the relay, access, and a class book page kept in memory only', async t => {
  const src = await fakeBookSource(30); process.env.BOOKS_SOURCE_ORIGIN = src.origin;
  const {openStore} = await import('../store.mjs'), {createApp} = await import('../server.mjs');
  const {LESSON_TEMPLATES, validatePlan} = await import('../public/group-plan.js'), {initialState} = await import('../group-session.mjs');
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  t.after(async () => { delete process.env.BOOKS_SOURCE_ORIGIN; app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); await src.close(); });
  const base = 'http://127.0.0.1:' + app.address().port;
  const get = (p, id, headers = {}) => fetch(base + p, {headers: {cookie: id ? 'ks=' + store.session(id) : '', ...headers}, redirect: 'manual'});
  // the catalogue is in the database, with no stored file
  const rows = store.group.books(); assert.equal(rows.length, 12); assert.ok(rows.every(r => r.stored === 0));
  assert.equal(store.group.bookLessons('g4-t1-math').length, 39); assert.equal(store.group.bookLessons('g4-t1-science')[0].page, 26);
  const ids = store.admin.demo(), tour = store.tour();
  assert.equal((await get('/teach/books')).headers.get('location'), '/login');
  const list = await (await get('/teach/books', tour.teacher)).text();
  assert.equal((list.match(/data-book="/g) || []).length, 12); assert.match(list, /طبعة ١٤٤٧/);
  assert.equal((await get('/teach/books', ids.education)).status, 200); assert.equal((await get('/teach/books', ids.finance)).status, 403); assert.equal((await get('/teach/books', tour.parent)).status, 403);
  // the relay: only the asked range, not cached
  const r = await get('/teach/books/g4-t1-math/file', tour.teacher, {range: 'bytes=0-99'});
  assert.equal(r.status, 206); assert.equal((await r.arrayBuffer()).byteLength, 100); assert.match(r.headers.get('content-range'), /^bytes 0-99\//); assert.match(r.headers.get('cache-control'), /no-store/);
  assert.equal(src.hits.at(-1).range, 'bytes=0-99'); assert.equal(src.hits.at(-1).url, '/wp-content/uploads/textbooks/primary-4/term-1/math.pdf?v=5aca93c8');
  assert.equal((await get('/teach/books/g4-t1-math/file', tour.parent)).status, 403);
  assert.equal((await get('/teach/books/nope/file', tour.teacher)).status, 404);
  const viewer = await (await get('/teach/books/g4-t1-science?page=26', tour.teacher)).text();
  assert.match(viewer, /data-page="26"/); assert.match(viewer, /الخلايا — ص ٢٦/);
  // a book page in a class: everyone in the class gets it, nothing is saved
  const plan = validatePlan(LESSON_TEMPLATES['g4-m1-2'].plan()), code = store.group.startSession(tour.teacher, plan, initialState(plan));
  const t1 = 'ks=' + store.session(tour.teacher), image = 'data:image/jpeg;base64,' + Buffer.alloc(300).toString('base64');
  const post = await fetch(base + `/teach/live/${code}/book-page`, {method: 'POST', headers: {cookie: t1, origin: base, 'content-type': 'application/json'}, body: JSON.stringify({step: 'curriculum', book: 'g4-t1-math', page: 18, image})});
  assert.equal(post.status, 200);
  const shown = (await (await get(`/teach/live/${code}/plan`, tour.teacher)).json()).steps.find(s => s.id === 'curriculum');
  assert.equal(shown.image, image); assert.deepEqual(shown.book, {id: 'g4-t1-math', page: 18});
  assert.equal(store.group.session(code).plan.steps.find(s => s.id === 'curriculum').image, undefined, 'never saved');
  assert.equal(store.group.session(code).state.pageVer, 1);
  // «دروسي» for any grade: each lesson with its book page and «حضّر هذا الدرس»
  assert.equal(store.group.bookLessons('g5-t1-math').length, 42);
  const g5 = await (await get('/teach/plans?grade=5', tour.teacher)).text();
  assert.equal((g5.match(/data-lesson="p5/g) || []).length, 54); assert.match(g5, /href="\/teach\/books\/g5-t1-math\?page=38"/);
  const made = await fetch(base + '/teach/plans/new', {method: 'POST', headers: {cookie: t1, origin: base, 'content-type': 'application/x-www-form-urlencoded'}, body: 'template=cur-p5m07', redirect: 'manual'});
  assert.equal(made.status, 303); const planId = made.headers.get('location').split('/').pop();
  const saved = store.group.plan(tour.teacher, planId).plan;
  assert.equal(saved.lesson, 'p5m07'); assert.deepEqual([saved.steps[0].source, saved.steps[0].book, saved.steps[0].page], ['book', 'g5-t1-math', 38]);
});

test('every elementary lesson (grades 1–6, term 1) is linked to its book page and starts a valid prep', async () => {
  const {allLessons} = await import('../public/book-catalog.js'), {curriculumPlan, validatePlan} = await import('../public/group-plan.js');
  const all = allLessons();
  assert.equal(all.length, 314);
  const count = (g, s) => all.filter(l => l.grade === g && l.subject === s).length;
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(g => [count(g, 'science'), count(g, 'math')]), [[11, 41], [12, 51], [12, 35], [12, 39], [12, 42], [12, 35]]);
  assert.equal(new Set(all.map(l => l.id)).size, all.length, 'unique ids');
  for (const g of [1, 2, 3, 4, 5, 6]) for (const s of ['science', 'math']) {
    const list = all.filter(l => l.grade === g && l.subject === s), book = BOOKS.find(b => b.grade === g && b.subject === s);
    assert.ok(list.every((l, i) => l.page >= 1 && l.page < book.pages && (!i || l.page > list[i - 1].page)), `grade ${g} ${s}: pages in book order`);
  }
  for (const l of all.filter(l => l.grade !== 4)) { const p = validatePlan(curriculumPlan(l.id)); assert.equal(p.steps[0].source, 'book'); assert.equal(p.steps[0].page, l.page); assert.equal(p.grade, l.grade); }
  assert.equal(lessonBookPage('p5m07').page, 38); assert.equal(lessonBookPage('p6s04').page, 62); assert.equal(lessonBookPage('p1s01').book, 'g1-t1-science');
});
