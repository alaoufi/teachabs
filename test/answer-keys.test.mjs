// Review (stage 071): the answer keys of choice questions after the options are turned (stage 067), in new plans, in plans
// saved before, in a class started straight from a ready lesson, and when the teacher deletes an option in the planner.
import test from 'node:test';
import assert from 'node:assert/strict';
import {LESSON_TEMPLATES, validatePlan, removeOption, prepPlan} from '../public/group-plan.js';
import {ALL_PREPS, arDigits} from '../public/lesson-preps.js';

const choices = plan => plan.steps.flatMap(s => s.questions || []).filter(q => q.kind === 'choice');
const keyed = p => [...p.q.slice(0, 3), p.hw[1], p.hw[2]]; // [prompt, options with the right one at index answer, answer]

test('every ready lesson: the key points at the same right option after turning, and the right option moves around', () => {
  const places = [0, 0, 0, 0];
  for (const [id, p] of Object.entries(ALL_PREPS)) {
    const qs = choices(validatePlan(prepPlan(id))), src = keyed(p);
    assert.equal(qs.length, 5, id);
    qs.forEach((q, i) => {
      const [prompt, opts, a] = src[i];
      assert.equal(q.prompt, arDigits(prompt).trim(), id);
      assert.equal(q.options[q.answer], arDigits(opts[a]).trim(), `${id} ${q.id}: the key still names the right option`);
      assert.deepEqual([...q.options].sort(), opts.map(o => arDigits(o).trim()).sort(), `${id} ${q.id}: same options, only reordered`);
      places[q.answer]++;
    });
    assert.deepEqual(validatePlan(prepPlan(id)), validatePlan(prepPlan(id)), id + ': the same order every time');
  }
  const total = places.reduce((a, b) => a + b);
  assert.ok(total >= 1500, 'checked ' + total);
  for (const k of [0, 1, 2]) assert.ok(places[k] / total > 0.25 && places[k] / total < 0.42, `place ${k}: ${places[k]} of ${total}`);
});

test('deleting an option keeps the key on the same option; deleting the right one asks the teacher to choose again', () => {
  const q = () => ({id: 'q1', kind: 'choice', prompt: 'س', options: ['أ', 'ب', 'ج', 'د'], answer: 2});
  assert.deepEqual(removeOption(q(), 0), {...q(), options: ['ب', 'ج', 'د'], answer: 1}, 'before the answer: it moves up');
  assert.deepEqual(removeOption(q(), 3), {...q(), options: ['أ', 'ب', 'ج'], answer: 2}, 'after the answer: unchanged');
  const lost = removeOption(q(), 2); assert.equal(lost.answer, -1);
  assert.throws(() => validatePlan({version: 1, title: 'ت', subject: 'math', grade: 3, tools: [], steps: [{id: 'check', type: 'questions', title: 'أسئلة', narration: {mode: 'live'}, questions: [lost]}]}), /اختر الإجابة الصحيحة/);
  const two = {id: 'q', kind: 'choice', prompt: 'س', options: ['أ', 'ب'], answer: 1}; assert.deepEqual(removeOption(two, 0).options, ['أ', 'ب'], 'two options stay two');
});

test('grading in class: a ready lesson started straight away, and a plan saved before the options were turned', async t => {
  const {openStore} = await import('../store.mjs'), {createApp} = await import('../server.mjs');
  const store = openStore(':memory:'), app = createApp(store);
  await new Promise(r => app.listen(0, '127.0.0.1', r));
  t.after(async () => { app.closeAllConnections(); await new Promise(r => app.close(r)); store.close(); });
  const base = 'http://127.0.0.1:' + app.address().port, tour = store.tour(), teacher = 'ks=' + store.session(tour.teacher);
  const form = (cookie, body = {}) => ({method: 'POST', headers: {origin: base, cookie, 'content-type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams(body), redirect: 'manual'});
  const json = (cookie, body) => ({method: 'POST', headers: {origin: base, cookie, 'content-type': 'application/json'}, body: JSON.stringify(body)});
  const firstView = async (url, cookie) => {
    const r = await fetch(base + url, {headers: {cookie}}), reader = r.body.getReader(); let text = '';
    while (!text.includes('\n\n')) text += new TextDecoder().decode((await reader.read()).value);
    await reader.cancel(); return JSON.parse(text.split('data: ')[1]);
  };
  /** Starts the plan, two students answer every homework question (one right, one with the option before it), returns their scores. */
  async function classOf(planUrl) {
    const saved = await (await fetch(base + planUrl + '.json', {headers: {cookie: teacher}})).json();
    const code = (await fetch(base + planUrl + '/start', form(teacher))).headers.get('location').split('/').pop();
    const join = async name => (await fetch(base + '/join', form('', {code, name}))).headers.get('set-cookie').split(';')[0];
    const right = await join('سارة'), wrong = await join('ليان');
    assert.equal((await fetch(base + '/teach/live/' + code + '/command', json(teacher, {op: 'homework', status: 'open'}))).status, 200);
    const hw = saved.steps.find(s => s.type === 'homework');
    for (const q of hw.questions.filter(x => x.kind === 'choice')) {
      for (const [cookie, choice] of [[right, q.answer], [wrong, (q.answer + 1) % q.options.length]])
        assert.equal((await fetch(base + '/class/' + code + '/answer', json(cookie, {kind: 'homework', step: hw.id, question: q.id, choice}))).status, 200);
    }
    // what the student sees is the same order the key was made for, without the key
    const content = await (await fetch(base + '/class/' + code + '/content?step=' + hw.id, {headers: {cookie: right}})).json();
    assert.deepEqual(content.questions.filter(q => q.options).map(q => q.options), hw.questions.filter(q => q.kind === 'choice').map(q => q.options));
    assert.ok(content.questions.every(q => !('answer' in q)));
    return {saved, right: (await firstView('/class/' + code + '/events', right)).homework, wrong: (await firstView('/class/' + code + '/events', wrong)).homework};
  }
  // 1) a ready lesson, straight from «دروسي» to the class
  const made = await fetch(base + '/teach/plans/new', form(teacher, {template: 'ready-p3m21'}));
  const fresh = await classOf(made.headers.get('location'));
  assert.ok(choices(fresh.saved).some(q => q.answer !== 0), 'the turned order is what was saved');
  assert.deepEqual([fresh.right.correct, fresh.right.total, fresh.wrong.correct], [2, 2, 0]);
  // 2) a plan saved before stage 067: right option first, answer 0 — still graded by its own key
  const old = validatePlan(LESSON_TEMPLATES['ready-p3m21'].plan());
  for (const q of choices(old)) { const right = q.options[q.answer]; q.options = [right, ...q.options.filter(o => o !== right)]; q.answer = 0; }
  const oldId = store.group.createPlan(tour.teacher, old);
  const before = await classOf('/teach/plans/' + oldId);
  assert.ok(choices(before.saved).every(q => q.answer === 0), 'the old plan is kept as it was saved');
  assert.deepEqual([before.right.correct, before.right.total, before.wrong.correct], [2, 2, 0]);
});
