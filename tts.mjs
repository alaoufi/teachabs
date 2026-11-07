// Natural Arabic voices for the lesson explanations (Microsoft Azure neural voices, Saudi Arabic).
// The key stays on the server (environment variable AZURE_SPEECH_KEY, region AZURE_SPEECH_REGION); each text is
// generated once per voice and kept in memory, so a class plays it instantly. Without a key the pages fall back to
// the device's own voice, as before.
import {createHash} from 'node:crypto';

export const SPEAKERS = {male: {voice: 'ar-SA-HamedNeural', name: 'حامد (رجل)'}, female: {voice: 'ar-SA-ZariyahNeural', name: 'زارية (امرأة)'}};
const cache = new Map(), pending = new Map(), MAX = 400;
const escapeXml = t => t.replace(/[<>&'"]/g, c => ({'<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'})[c]);

export const ttsReady = () => Boolean(process.env.AZURE_SPEECH_KEY);

/** MP3 audio of `text` in the chosen voice; null when no key is configured. */
export async function speech(text, speaker = 'male', {fetchImpl = fetch} = {}) {
  if (!ttsReady()) return null;
  const voice = (SPEAKERS[speaker] || SPEAKERS.male).voice, clean = String(text || '').trim().slice(0, 1500);
  if (!clean) return null;
  const key = createHash('sha256').update(voice + '\n' + clean).digest('hex');
  if (cache.has(key)) return cache.get(key);
  if (pending.has(key)) return pending.get(key);
  const job = (async () => {
    const region = process.env.AZURE_SPEECH_REGION || 'westeurope';
    const ssml = `<speak version="1.0" xml:lang="ar-SA"><voice name="${voice}"><prosody rate="-6%">${escapeXml(clean)}</prosody></voice></speak>`;
    const r = await fetchImpl(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {method: 'POST',
      headers: {'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3', 'User-Agent': 'teachabs'},
      body: ssml, signal: AbortSignal.timeout(15000)});
    if (!r.ok) throw new Error('voice service ' + r.status);
    const audio = Buffer.from(await r.arrayBuffer());
    if (cache.size >= MAX) cache.delete(cache.keys().next().value);
    cache.set(key, audio); return audio;
  })().finally(() => pending.delete(key));
  pending.set(key, job); return job;
}
