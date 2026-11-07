// Stage 058: «مكتبة الأدوات» — tools filtered by subject, grade and lesson; pinned in the lesson plan; laid on the board.
import test from 'node:test';
import assert from 'node:assert/strict';
import {LIBRARY, STAMPS, toolsFor, toolOf} from '../public/tool-library.js';
import {LESSON_TEMPLATES, validatePlan, SUBJECTS} from '../public/group-plan.js';
import {curriculumLessons} from '../public/curriculum-g4.js';
import {initialState, teacherCommand} from '../group-session.mjs';
import {ACTIVITIES} from '../public/activities.js';

test('every tool is complete: unique id, known subjects and grades, real lessons, a drawing or an activity', () => {
  const ids = new Set(), lessons = new Set(curriculumLessons().map(l => l.id));
  for (const t of LIBRARY) {
    assert.ok(!ids.has(t.id), 'unique ' + t.id); ids.add(t.id);
    assert.ok(t.title && t.desc && t.icon, t.id);
    assert.ok(t.subjects.every(s => s === '*' || Object.hasOwn(SUBJECTS, s)), t.id);
    assert.ok(t.grades.length && t.grades.every(g => g >= 1 && g <= 9), t.id);
    assert.ok(t.lessons.every(l => lessons.has(l)), 'lesson ids exist: ' + t.id);
    if (t.kind === 'stamp') assert.ok(STAMPS[t.id] && STAMPS[t.id].w <= 1000 && STAMPS[t.id].h <= 600, 'drawing fits the board: ' + t.id);
    if (t.kind === 'activity') assert.ok(ACTIVITIES[t.id], t.id);
  }
  assert.ok(LIBRARY.length >= 30, 'a large library');
  for (const s of Object.keys(SUBJECTS)) assert.ok(toolsFor({subject: s}).others.length >= 4, 'tools for ' + s);
});

test('filters: subject and grade narrow the list; the lesson\'s own tools come first; search', () => {
  const r = toolsFor({subject: 'math', grade: 4, lesson: 'm1-1'});
  assert.deepEqual(r.forLesson.map(t => t.id).sort(), ['placechart', 'placevalue']);
  assert.ok(r.others.every(t => !r.forLesson.includes(t)) && r.others.some(t => t.id === 'multtable'));
  assert.ok(!toolsFor({subject: 'math', grade: 1}).others.some(t => t.id === 'protractor'), 'protractor is for grades 4–6');
  assert.ok(toolsFor({subject: 'science', grade: 4}).others.every(t => t.subjects.includes('science') || t.subjects.includes('*')));
  assert.deepEqual(toolsFor({query: 'الضرب'}).others.map(t => t.id), ['multtable']);
});

test('the lesson plan keeps its curriculum lesson and pinned tools; the templates come with suitable tools', () => {
  const plan = validatePlan(LESSON_TEMPLATES.placevalue.plan());
  assert.equal(plan.lesson, 'm1-1'); assert.deepEqual(plan.tools, ['placevalue', 'placechart', 'numberline100']);
  const raw = LESSON_TEMPLATES.cells.plan(); raw.tools = ['kwl', 'kwl', 'venn'];
  assert.deepEqual(validatePlan(raw).tools, ['kwl', 'venn'], 'no duplicates');
  assert.throws(() => validatePlan({...raw, tools: ['flying-carpet']}), /أداة غير معروفة/);
  assert.throws(() => validatePlan({...raw, lesson: 'x y'}), /درس غير معروف/);
  assert.deepEqual(validatePlan({...raw, tools: undefined}).tools, []);
});

test('every board tool can be laid on the board and moved', () => {
  const plan = validatePlan(LESSON_TEMPLATES.placevalue.plan());
  let s = initialState(plan);
  for (const name of Object.keys(STAMPS)) s = teacherCommand(s, plan, {op: 'stamp', name, x: 10, y: 10});
  assert.equal(s.strokes[plan.steps[0].id].length, Object.keys(STAMPS).length);
  assert.ok(toolOf('clock') && !toolOf('nothing'));
});
