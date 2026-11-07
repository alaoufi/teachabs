// Stage 053: natural voices (man or woman) for the explanations, made on the server; without a key, the device's voice.
import test from 'node:test';
import assert from 'node:assert/strict';
import {speech, SPEAKERS} from '../tts.mjs';
import {LESSON_TEMPLATES, validatePlan} from '../public/group-plan.js';
import {initialState, teacherCommand, publicView, speechText} from '../group-session.mjs';

test('no key: no natural voice (the pages use the device voice)', async () => {
  delete process.env.AZURE_SPEECH_KEY;
  assert.equal(await speech('مرحبا', 'male'), null);
});

test('with a key: Saudi neural voice by choice, SSML escaped, each text made once', async () => {
  process.env.AZURE_SPEECH_KEY = 'test-key'; process.env.AZURE_SPEECH_REGION = 'westeurope';
  const calls = [];
  const fake = async (url, opt) => { calls.push({url, opt}); return new Response(new Uint8Array([1, 2, 3]), {status: 200}); };
  const a = await speech('الماء < البخار & الجليد', 'female', {fetchImpl: fake});
  assert.deepEqual([...a], [1, 2, 3]);
  assert.equal(calls[0].url, 'https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1');
  assert.match(calls[0].opt.body, new RegExp(SPEAKERS.female.voice)); assert.match(calls[0].opt.body, /&lt; البخار &amp;/);
  assert.equal(calls[0].opt.headers['Ocp-Apim-Subscription-Key'], 'test-key');
  await speech('الماء < البخار & الجليد', 'female', {fetchImpl: fake}); assert.equal(calls.length, 1, 'cached');
  await speech('الماء < البخار & الجليد', 'male', {fetchImpl: fake}); assert.match(calls[1].opt.body, /HamedNeural/);
  await assert.rejects(speech('نص آخر', 'male', {fetchImpl: async () => new Response('', {status: 401})}), /401/);
  delete process.env.AZURE_SPEECH_KEY;
});

test('the plan and the class choose the narrator voice; texts come from the plan', () => {
  const raw = LESSON_TEMPLATES.cells.plan(); raw.speaker = 'female';
  const plan = validatePlan(raw);
  let s = initialState(plan);
  assert.equal(publicView(s, plan, 'a', []).speaker, 'female');
  s = teacherCommand(s, plan, {op: 'speaker', speaker: 'male'}); assert.equal(publicView(s, plan, 'a', []).speaker, 'male');
  assert.throws(() => teacherCommand(s, plan, {op: 'speaker', speaker: 'robot'}), /صوت غير معروف/);
  const page = plan.steps.find(x => x.type === 'page'), act = plan.steps.find(x => x.type === 'interactive');
  assert.match(speechText(plan, page.id, null), /درسنا اليوم/);
  assert.equal(speechText(plan, act.id, 0), act.narrator.segments[0].text);
  assert.equal(validatePlan(LESSON_TEMPLATES.cells.plan()).speaker, 'male', 'a man\'s voice by default');
});
