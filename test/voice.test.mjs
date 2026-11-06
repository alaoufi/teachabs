// Stage 044/049: the teacher alone controls live voice and camera; students see the setting in their view.
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState, teacherCommand, publicView, teacherView, voiceOf} from '../group-session.mjs';
import {LESSON_TEMPLATES, validatePlan} from '../public/group-plan.js';

test('voice: defaults, teacher toggles, validation, visible to students and teacher', () => {
  const plan = validatePlan(LESSON_TEMPLATES.cells.plan());
  let s = initialState(plan);
  assert.deepEqual(voiceOf(s), {teacher: false, mics: true, camera: false});
  s = teacherCommand(s, plan, {op: 'voice', teacher: true});
  s = teacherCommand(s, plan, {op: 'voice', mics: false});
  assert.deepEqual(voiceOf(s), {teacher: true, mics: false, camera: false});
  assert.throws(() => teacherCommand(s, plan, {op: 'voice', mics: 'yes'}), /قيمة غير صالحة/);
  assert.deepEqual(publicView(s, plan, 'st1', []).voice, {teacher: true, mics: false, camera: false});
  assert.deepEqual(teacherView(s, plan, [], []).voice, {teacher: true, mics: false, camera: false});
  s = teacherCommand(s, plan, {op: 'voice', camera: true});
  assert.equal(publicView(s, plan, 'st1', []).voice.camera, true, 'students know the teacher camera is on');
  s = teacherCommand(s, plan, {op: 'voice', teacher: false, camera: false, mics: false}); // emergency stop in one command
  assert.deepEqual(voiceOf(s), {teacher: false, mics: false, camera: false});
  assert.throws(() => teacherCommand(s, plan, {op: 'voice', camera: 1}), /قيمة غير صالحة/);
  assert.deepEqual(voiceOf({}), {teacher: false, mics: true, camera: false}, 'older sessions without voice settings');
});
