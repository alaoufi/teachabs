// Stage 072: the lesson's title is the class's first view; any section can be hidden from or shown on the students' board.
import test from 'node:test';
import assert from 'node:assert/strict';
import {LESSON_TEMPLATES, validatePlan, classPlan, publicStep} from '../public/group-plan.js';
import {initialState, teacherCommand, publicView} from '../group-session.mjs';

test('a class starts with the lesson title (its topic), without changing the saved plan', () => {
  const saved = validatePlan(LESSON_TEMPLATES['ready-p5m07'].plan()), plan = classPlan(saved);
  assert.equal(saved.steps[0].type, 'page', 'the saved plan is unchanged');
  assert.equal(plan.steps[0].type, 'title'); assert.equal(plan.steps.length, saved.steps.length + 1);
  assert.deepEqual(publicStep(plan.steps[0]), {id: 'lesson-title', type: 'title', title: saved.title, meta: 'الرياضيات — الصف الخامس', where: 'الفصل ١: القيمة المنزلية'});
  assert.equal(classPlan(plan), plan, 'added once');
  const clash = classPlan({...saved, steps: [{...saved.steps[0], id: 'lesson-title'}, ...saved.steps.slice(1)]});
  assert.equal(clash.steps[0].id, 'lesson-title-2', 'its id never clashes with a step of the plan');
  assert.throws(() => validatePlan({...saved, steps: [{id: 'x', type: 'title', title: 'ت', narration: {mode: 'live'}}]}), /نوع خطوة/, 'not a planner step');
  const s = initialState(plan), v = publicView(s, plan, 'st1', []);
  assert.equal(v.step.type, 'title'); assert.equal(v.index, 0); assert.ok(v.shown);
});

test('any section can be hidden or shown, and stays so when the class moves', () => {
  const plan = classPlan(validatePlan(LESSON_TEMPLATES['ready-p3m21'].plan())), run = (s, c) => teacherCommand(s, plan, c);
  const [, page, , , , hw] = plan.steps;
  let s = initialState(plan);
  s = run(s, {op: 'show', step: page.id, shown: false}); // hide the curriculum page before getting there
  assert.equal(s.index, 0); assert.ok(s.shown, 'the current section is unchanged');
  s = run(s, {op: 'go', by: 1}); assert.equal(s.index, 1); assert.equal(s.shown, false, 'arrives hidden');
  assert.equal(publicView(s, plan, 'st1', []).step, undefined, 'students see nothing of it');
  s = run(s, {op: 'show', shown: true}); assert.ok(s.shown); // the current section, as before
  s = run(s, {op: 'go', index: 0}); s = run(s, {op: 'go', index: 1}); assert.ok(s.shown, 'kept as the teacher left it');
  s = run(s, {op: 'show', step: plan.steps[0].id, shown: false}); s = run(s, {op: 'go', index: 0}); assert.equal(s.shown, false, 'the title too');
  assert.ok(run(s, {op: 'go', index: 5}).shown, hw.title + ' shown by default');
  assert.throws(() => run(s, {op: 'show', step: 'nope', shown: false}), e => e.status === 404);
});
