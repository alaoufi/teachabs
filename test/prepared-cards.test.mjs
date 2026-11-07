// Stage 050: prepared texts have a place on the board; they appear one after another and never overlap.
import test from 'node:test';
import assert from 'node:assert/strict';
import {LESSON_TEMPLATES, validatePlan, boardLayout, publicStep} from '../public/group-plan.js';
import {initialState, teacherCommand, publicView} from '../group-session.mjs';
import {shapePoints, TOOLS} from '../public/group-ink.js';

const overlap = (a, b) => a.x < b.x + (b.w === 'full' ? 960 : 465) && b.x < a.x + (a.w === 'full' ? 960 : 465) && a.y < b.y + b.h && b.y < a.y + a.h;

test('automatic places: every lesson template fits its cards on the board without overlap', () => {
  for (const [name, t] of Object.entries(LESSON_TEMPLATES)) {
    const plan = validatePlan(t.plan());
    for (const step of plan.steps.filter(s => s.type === 'board')) {
      const at = Object.values(boardLayout(step.items));
      at.forEach((a, i) => at.forEach((b, j) => { if (j > i) assert.ok(!overlap(a, b), `${name}: cards ${i + 1} and ${j + 1} overlap`); }));
      assert.ok(at.every(a => a.y + a.h <= 600), `${name}: a card leaves the board`);
    }
  }
});

test('planned places are kept and validated; students get each revealed card with its place among all cards', () => {
  const raw = LESSON_TEMPLATES.cells.plan(), b = raw.steps.find(s => s.type === 'board');
  b.items[1].at = {x: 30, y: 400, w: 'full'};
  const plan = validatePlan(raw), step = plan.steps.find(s => s.type === 'board');
  assert.deepEqual(step.items[1].at, {x: 30, y: 400, w: 'full'});
  assert.throws(() => validatePlan({...raw, steps: raw.steps.map(s => s.type === 'board' ? {...s, items: [{...s.items[0], at: {x: 5000, y: 1}}]} : s)}), /مكان بطاقة غير صالح/);
  const all = boardLayout(step.items), pub = publicStep(step, [step.items[2].id]);
  assert.equal(pub.items.length, 1);
  assert.deepEqual(pub.items[0].place, all[step.items[2].id], 'same place as on the teacher board, though the earlier cards are still hidden');
});

test('«النص التالي» shows the cards in the prepared order, then says all are shown', () => {
  const plan = validatePlan(LESSON_TEMPLATES.cells.plan()), i = plan.steps.findIndex(s => s.type === 'board'), ids = plan.steps[i].items.map(x => x.id);
  let s = teacherCommand(initialState(plan), plan, {op: 'go', index: i});
  for (let n = 1; n <= ids.length; n++) { s = teacherCommand(s, plan, {op: 'reveal', next: true}); assert.deepEqual(publicView(s, plan, 'a', []).content?.items?.map(x => x.id) ?? s.revealed[plan.steps[i].id], ids.slice(0, n)); }
  assert.throws(() => teacherCommand(s, plan, {op: 'reveal', next: true}), /ظهرت كل النصوص/);
});

test('rectangle and circle tools: outlines made of points, accepted as ink', () => {
  assert.ok(TOOLS.rect && TOOLS.ellipse);
  assert.deepEqual(shapePoints('rect', [10, 20], [110, 70]), [[10, 20], [110, 20], [110, 70], [10, 70], [10, 20]]);
  const o = shapePoints('ellipse', [0, 0], [100, 50]);
  assert.equal(o.length, 49); assert.deepEqual(o[0], [100, 25]);
  const plan = validatePlan(LESSON_TEMPLATES.cells.plan()), i = plan.steps.findIndex(s => s.type === 'board');
  let s = teacherCommand(initialState(plan), plan, {op: 'go', index: i});
  s = teacherCommand(s, plan, {op: 'stroke', tool: 'ellipse', size: 'm', color: '#173e34', points: o});
  assert.equal(s.strokes[plan.steps[i].id][0].tool, 'ellipse');
});

import {studentHand, teacherView} from '../group-session.mjs';
test('✋ hands: raised in order, seen by the teacher, lowered by the teacher; ⭐ stars reach only that student', () => {
  const plan = validatePlan(LESSON_TEMPLATES.cells.plan());
  let s = studentHand(initialState(plan), 'b', true);
  s = studentHand(s, 'a', true);
  assert.deepEqual(teacherView(s, plan, [], []).hands, ['b', 'a'], 'first raised first');
  assert.equal(publicView(s, plan, 'a', []).hand, true);
  s = teacherCommand(s, plan, {op: 'hand-down', student: 'b'});
  assert.deepEqual(teacherView(s, plan, [], []).hands, ['a']);
  s = studentHand(s, 'a', false); assert.deepEqual(teacherView(s, plan, [], []).hands, []);
  assert.throws(() => studentHand(s, 'a', 'yes'), /قيمة غير صالحة/);
  s = teacherCommand(s, plan, {op: 'star', student: 'a'}); s = teacherCommand(s, plan, {op: 'star', student: 'a'});
  assert.equal(publicView(s, plan, 'a', []).stars, 2); assert.ok(publicView(s, plan, 'a', []).starSeq);
  assert.equal(publicView(s, plan, 'c', []).stars, 0); assert.equal(publicView(s, plan, 'c', []).starSeq, undefined, 'others do not see the star pop');
  s = studentHand(studentHand(s, 'a', true), 'c', true); s = teacherCommand(s, plan, {op: 'hand-down', all: true});
  assert.deepEqual(teacherView(s, plan, [], []).hands, []);
});

test('«next / previous» are steps from where the class is, so two quick presses both count', () => {
  const plan = validatePlan(LESSON_TEMPLATES.cells.plan());
  let s = initialState(plan);
  s = teacherCommand(s, plan, {op: 'go', by: 1}); s = teacherCommand(s, plan, {op: 'go', by: 1});
  assert.equal(s.index, 2);
  s = teacherCommand(s, plan, {op: 'go', by: -1}); assert.equal(s.index, 1);
  const first = teacherCommand(teacherCommand(s, plan, {op: 'go', by: -1}), plan, {op: 'go', by: -1});
  assert.equal(first.index, 0, 'stays on the first step');
  assert.throws(() => teacherCommand(s, plan, {op: 'go', by: 3}), /خطوة غير موجودة/);
});

import {classExtras} from '../group-session.mjs';
test('⏱ timer, 🎭 curtain and 📏📐 measuring tools', () => {
  const plan = validatePlan(LESSON_TEMPLATES.placevalue.plan());
  let s = teacherCommand(initialState(plan), plan, {op: 'timer', seconds: 180});
  const t = classExtras(s, plan).timer; assert.equal(t.total, 180); assert.ok(t.remaining > 170000 && t.remaining <= 180000);
  assert.throws(() => teacherCommand(s, plan, {op: 'timer', seconds: 5}), /مدة غير صالحة/);
  s = teacherCommand(s, plan, {op: 'timer', stop: true}); assert.equal(classExtras(s, plan).timer, undefined);
  s = teacherCommand(s, plan, {op: 'curtain', level: 75}); assert.equal(classExtras(s, plan).curtain, 75);
  s = teacherCommand(s, plan, {op: 'go', by: 1}); assert.equal(classExtras(s, plan).curtain, undefined, 'each step has its own curtain');
  s = teacherCommand(s, plan, {op: 'stamp', name: 'ruler', x: 100, y: 200});
  const id = s.strokes[plan.steps[s.index].id][0].id;
  s = teacherCommand(s, plan, {op: 'move', id, dx: 50, dy: -20});
  assert.deepEqual(s.strokes[plan.steps[s.index].id][0], {id, kind: 'stamp', name: 'ruler', x: 150, y: 180});
  assert.throws(() => teacherCommand(s, plan, {op: 'stamp', name: 'compass', x: 1, y: 1}), /أداة غير معروفة/);
});

test('🧭 class management: random pick without repeats, attention lock, work mode', () => {
  const plan = validatePlan(LESSON_TEMPLATES.cells.plan());
  let s = teacherCommand(initialState(plan), plan, {op: 'pick', student: 'a', name: 'سارة'});
  assert.deepEqual(classExtras(s, plan).pick.name, 'سارة'); assert.deepEqual(s.picked, ['a']);
  s = teacherCommand(s, plan, {op: 'pick', student: 'b', name: 'نورة'}); assert.deepEqual(s.picked, ['a', 'b']);
  s = teacherCommand(s, plan, {op: 'pick-reset'}); assert.deepEqual(s.picked, []); assert.equal(classExtras(s, plan).pick, undefined);
  s = teacherCommand(s, plan, {op: 'attention', on: true}); assert.equal(classExtras(s, plan).attention, true);
  assert.equal(publicView(s, plan, 'a', []).me, 'a');
  s = teacherCommand(s, plan, {op: 'work-mode', mode: 'pairs'}); assert.equal(classExtras(s, plan).workMode, 'pairs');
  s = teacherCommand(s, plan, {op: 'work-mode', mode: 'none'}); assert.equal(classExtras(s, plan).workMode, undefined);
  assert.throws(() => teacherCommand(s, plan, {op: 'work-mode', mode: 'party'}), /وضع غير معروف/);
});
