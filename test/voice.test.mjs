// Stage 044: the teacher alone controls live voice; students see the setting in their view.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState, teacherCommand, publicView, teacherView, voiceOf} from '../group-session.mjs';
import {LESSON_TEMPLATES, validatePlan} from '../public/group-plan.js';

test('voice: defaults, teacher toggles, validation, visible to students and teacher', () => {
  const plan = validatePlan(LESSON_TEMPLATES.cells.plan());
  let s = initialState(plan);
  assert.deepEqual(voiceOf(s), {teacher: false, mics: true});
  s = teacherCommand(s, plan, {op: 'voice', teacher: true});
  s = teacherCommand(s, plan, {op: 'voice', mics: false});
  assert.deepEqual(voiceOf(s), {teacher: true, mics: false});
  assert.throws(() => teacherCommand(s, plan, {op: 'voice', mics: 'yes'}), /قيمة غير صالحة/);
  assert.deepEqual(publicView(s, plan, 'st1', []).voice, {teacher: true, mics: false});
  assert.deepEqual(teacherView(s, plan, [], []).voice, {teacher: true, mics: false});
  assert.deepEqual(voiceOf({}), {teacher: false, mics: true}, 'older sessions without voice settings');
});
