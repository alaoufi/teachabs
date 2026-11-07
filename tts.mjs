// Natural Arabic voices for the lesson explanations, a man or a woman.
// Google Cloud Text-to-Speech (GOOGLE_TTS_KEY) or Microsoft Azure (AZURE_SPEECH_KEY, AZURE_SPEECH_REGION). The key
// stays on the server; each text is generated once per voice and kept in memory, so a class plays it instantly.
// Without a key the pages fall back to the device's own voice, as before.
import {createHash} from 'node:crypto';

export const SPEAKERS = {male: {voice: 'ar-SA-HamedNeural', name: 'حامد (رجل)'}, female: {voice: 'ar-SA-ZariyahNeural', name: 'زارية (امرأة)'}};
const cache = new Map(), pending = new Map(), MAX = 400;
const escapeXml = t => t.replace(/[<>&'"]/g, c => ({'<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'})[c]);

export const ttsReady = () => Boolean(process.env.GOOGLE_TTS_KEY || process.env.AZURE_SPEECH_KEY);
// Google: the most natural voices first (Chirp 3 HD), then WaveNet if the first is not available on the account.
export const GOOGLE_VOICES = {male: [process.env.GOOGLE_TTS_MALE || 'ar-XA-Chirp3-HD-Charon', 'ar-XA-Wavenet-B'], female: [process.env.GOOGLE_TTS_FEMALE || 'ar-XA-Chirp3-HD-Aoede', 'ar-XA-Wavenet-A']};

async function google(text, speaker, fetchImpl) {
  let last;
  for (const name of GOOGLE_VOICES[speaker] || GOOGLE_VOICES.male) {
    const r = await fetchImpl('https://texttospeech.googleapis.com/v1/text:synthesize', {method: 'POST',
      headers: {'X-Goog-Api-Key': process.env.GOOGLE_TTS_KEY, 'Content-Type': 'application/json'},
      body: JSON.stringify({input: {text}, voice: {languageCode: 'ar-XA', name}, audioConfig: {audioEncoding: 'MP3', speakingRate: 0.95}}), signal: AbortSignal.timeout(20000)});
    if (r.ok) return Buffer.from((await r.json()).audioContent, 'base64');
    last = new Error('voice service ' + r.status);
    if (r.status !== 400 && r.status !== 404) throw last; // a voice the account lacks: try the next one
  }
  throw last;
}

/** MP3 audio of `text` in the chosen voice; null when no key is configured. */
export async function speech(text, speaker = 'male', {fetchImpl = fetch} = {}) {
  if (!ttsReady()) return null;
  const clean = String(text || '').trim().slice(0, 1500), provider = process.env.GOOGLE_TTS_KEY ? 'google' : 'azure';
  if (!clean) return null;
  const who = SPEAKERS[speaker] ? speaker : 'male', voice = provider + ':' + who + ':' + (provider === 'google' ? GOOGLE_VOICES[who][0] : SPEAKERS[who].voice);
  const key = createHash('sha256').update(voice + '\n' + clean).digest('hex');
  if (cache.has(key)) return cache.get(key);
  if (pending.has(key)) return pending.get(key);
  const job = (async () => {
    const audio = provider === 'google' ? await google(clean, who, fetchImpl) : await azure(clean, who, fetchImpl);
    if (cache.size >= MAX) cache.delete(cache.keys().next().value);
    cache.set(key, audio); return audio;
  })().finally(() => pending.delete(key));
  pending.set(key, job); return job;
}

async function azure(text, speaker, fetchImpl) {
  const region = process.env.AZURE_SPEECH_REGION || 'westeurope';
  const ssml = `<speak version="1.0" xml:lang="ar-SA"><voice name="${SPEAKERS[speaker].voice}"><prosody rate="-6%">${escapeXml(text)}</prosody></voice></speak>`;
  const r = await fetchImpl(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {method: 'POST',
    headers: {'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3', 'User-Agent': 'teachabs'},
    body: ssml, signal: AbortSignal.timeout(15000)});
  if (!r.ok) throw new Error('voice service ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}
