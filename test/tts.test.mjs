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

test('Google voices with the Gmail account: most natural voice first, WaveNet when the account lacks it', async () => {
  delete process.env.AZURE_SPEECH_KEY; process.env.GOOGLE_TTS_KEY = 'g-key';
  const calls = [];
  const fake = async (url, opt) => { const b = JSON.parse(opt.body); calls.push({url, b, key: opt.headers['X-Goog-Api-Key']});
    return b.voice.name.includes('Chirp3') ? new Response('{}', {status: 400}) : new Response(JSON.stringify({audioContent: Buffer.from([7, 8]).toString('base64')}), {status: 200}); };
  const a = await speech('صوت امرأة من غوغل', 'female', {fetchImpl: fake});
  assert.deepEqual([...a], [7, 8]);
  assert.equal(calls[0].url, 'https://texttospeech.googleapis.com/v1/text:synthesize'); assert.equal(calls[0].key, 'g-key');
  assert.deepEqual(calls.map(c => c.b.voice.name), ['ar-XA-Chirp3-HD-Aoede', 'ar-XA-Wavenet-A']);
  assert.equal(calls[0].b.voice.languageCode, 'ar-XA'); assert.equal(calls[0].b.input.text, 'صوت امرأة من غوغل');
  await speech('صوت رجل من غوغل', 'male', {fetchImpl: fake}); assert.equal(calls[2].b.voice.name, 'ar-XA-Chirp3-HD-Charon');
  await assert.rejects(speech('مفتاح خطأ', 'male', {fetchImpl: async () => new Response('', {status: 403})}), /403/);
  delete process.env.GOOGLE_TTS_KEY;
});
