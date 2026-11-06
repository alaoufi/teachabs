import test from 'node:test';
import assert from 'node:assert/strict';
import * as m from '../public/science-shadow-model.js';
import {openStore} from '../store.mjs';
import {createApp} from '../server.mjs';
import {SCIENCE_SHADOW_ROUTE} from '../science-lesson.mjs';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

test('sun climbs 15° per hour and shadow follows height / tan(elevation)', () => {
  assert.equal(m.sunElevation(12), 90);
  assert.equal(m.sunElevation(9), 45);
  assert.equal(m.sunElevation(15), 45);
  assert.equal(m.sunElevation(7), 15);
  near(m.shadowLength(1.5, 45), 1.5);
  assert.equal(m.shadowLength(2, 90), 0);
  near(m.shadowLength(1, 15), 1 / Math.tan(Math.PI / 12));
  // Longer shadow when the sun is lower; taller object casts a proportionally longer shadow.
  assert.ok(m.lessonState({hour: 7}).length > m.lessonState({hour: 10}).length);
  near(m.lessonState({hour: 8, height: 2}).length, 2 * m.lessonState({hour: 8, height: 1}).length, 1e-9);
});

test('shadow points away from the sun: west in the morning, east in the afternoon', () => {
  assert.deepEqual([m.sunSide(8), m.shadowSide(8)], ['east', 'west']);
  assert.deepEqual([m.sunSide(16), m.shadowSide(16)], ['west', 'east']);
  assert.equal(m.shadowSide(12), 'none');
  const morning = m.sceneGeometry(m.lessonState({hour: 8})), afternoon = m.sceneGeometry(m.lessonState({hour: 16}));
  assert.ok(morning.sunX > m.SCENE.cx && morning.tipX < m.SCENE.cx, 'east drawn on the right, shadow to the left');
  assert.ok(afternoon.sunX < m.SCENE.cx && afternoon.tipX > m.SCENE.cx);
});

test('inputs are clamped and snapped; unknown materials fall back safely', () => {
  assert.equal(m.normalizeHour(3), m.HOUR_MIN);
  assert.equal(m.normalizeHour(30), m.HOUR_MAX);
  assert.equal(m.normalizeHour('9.13'), 9.25);
  assert.equal(m.normalizeHour('x'), 9);
  assert.equal(m.normalizeHeight(5), m.HEIGHT_MAX);
  assert.equal(m.normalizeHeight(1.234), 1.2);
  assert.equal(m.normalizeMaterial('<script>'), 'wood');
  assert.equal(m.normalizeMaterial('__proto__'), 'wood');
  assert.equal(m.lessonState({hour: 9.1, exact: true}).hour, 9.1);
});

test('the whole scene stays inside the drawing for every allowed value', () => {
  for (let hour = m.HOUR_MIN; hour <= m.HOUR_MAX; hour += m.HOUR_STEP) for (const height of [m.HEIGHT_MIN, m.HEIGHT_MAX]) {
    const g = m.sceneGeometry(m.lessonState({hour, height}));
    for (const x of [g.sunX, g.tipX]) assert.ok(x >= 0 && x <= m.SCENE.width, `x=${x} at ${hour}`);
    assert.ok(g.sunY >= 0 && g.top > 0);
    near(m.hourFromSceneX(g.sunX), m.normalizeHour(hour), 1e-9);
  }
});

test('materials change shadow darkness from opaque to transparent', () => {
  const dark = name => m.lessonState({hour: 8, material: name}).darkness;
  assert.ok(dark('wood') > dark('paper') && dark('paper') > dark('glass'));
  assert.deepEqual(Object.values(m.MATERIALS).map(x => x.kind), ['معتم', 'شبه شفاف', 'شفاف']);
});

test('challenges and quiz give immediate, specific feedback', () => {
  const s = input => m.lessonState(input);
  assert.equal(m.judgeChallenge('equal', s({hour: 9})).done, true);
  assert.match(m.judgeChallenge('equal', s({hour: 8})).message, /ارفع الشمس/);
  assert.match(m.judgeChallenge('equal', s({hour: 10})).message, /أنزل الشمس/);
  assert.equal(m.judgeChallenge('longest', s({hour: 17, height: 2})).done, true);
  assert.match(m.judgeChallenge('longest', s({hour: 7, height: 1})).message, /طول اللوح/);
  assert.equal(m.judgeChallenge('vanish', s({hour: 12})).done, true);
  assert.equal(m.judgeChallenge('east', s({hour: 14})).done, true);
  assert.equal(m.judgeChallenge('east', s({hour: 10})).done, false);
  assert.equal(m.judgeChallenge('faint', s({hour: 8, material: 'paper'})).done, true);
  assert.equal(m.judgeChallenge('faint', s({hour: 12, material: 'paper'})).done, false);
  assert.equal(m.judgeChallenge('faint', s({hour: 8, material: 'glass'})).done, false);
  assert.throws(() => m.judgeChallenge('nope', s({})));
  // The lesson's default starting state completes none of the challenges.
  const start = s({hour: 8, height: 1.5, material: 'wood'});
  assert.deepEqual(m.CHALLENGES.filter(c => c.check(start)).map(c => c.id), []);
  for (const q of m.QUIZ) {
    assert.equal(m.judgeQuiz(q.id, q.answer).correct, true);
    const wrong = Object.keys(q.options).find(k => k !== q.answer);
    assert.equal(m.judgeQuiz(q.id, wrong).correct, false);
    assert.ok(m.judgeQuiz(q.id, wrong).why.length > 20);
  }
  assert.throws(() => m.judgeQuiz('q1', 'z'));
});

test('Arabic formatting of time and numbers', () => {
  assert.equal(m.formatHour(8), '٨:٠٠ صباحًا');
  assert.equal(m.formatHour(12), '١٢:٠٠ ظهرًا');
  assert.equal(m.formatHour(15.5), '٣:٣٠ مساءً');
  assert.equal(m.formatNumber(1.5), '١٫٥');
});

test('lesson page is discoverable, self-contained and stores nothing', async t => {
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  t.after(async () => { app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); });
  const base = 'http://127.0.0.1:' + app.address().port;
  const response = await fetch(base + SCIENCE_SHADOW_ROUTE), html = await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.match(response.headers.get('content-security-policy'), /connect-src 'none'/);
  assert.match(response.headers.get('content-security-policy'), /script-src 'self'/);
  assert.match(response.headers.get('permissions-policy'), /microphone=\(\)/);
  for (const part of ['id="sl-scene"', 'id="sl-hour"', 'id="sl-height"', 'name="sl-material"', 'sl-challenge-list', 'sl-quiz', 'محتوى أصلي', 'لم تُطابَق', '<svg'])
    assert.ok(html.includes(part), part);
  assert.ok(!/<iframe|https?:\/\/(?!www\.w3\.org)/.test(html.split('<main>')[1]), 'no external resources in the lesson body');
  assert.match(await (await fetch(base + '/demo')).text(), new RegExp(`href="${SCIENCE_SHADOW_ROUTE}"`));
  for (const asset of ['science-shadow.js', 'science-shadow-model.js', 'science-shadow.css']) {
    const r = await fetch(base + '/' + asset);
    assert.equal(r.status, 200, asset);
  }
});
