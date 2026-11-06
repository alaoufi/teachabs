// Live voice in the class: each student's device opens one audio connection to the teacher (WebRTC).
// The teacher's microphone is heard by every student; a student's microphone is heard by the teacher.
// The teacher decides: their own microphone on or off, and whether students may open theirs.
// Signalling goes through the class server (/rtc) and is never stored. Without a TURN server some networks
// may block the audio; the board and everything else keep working.

const ICE = [{urls: 'stun:stun.l.google.com:19302'}];

async function post(url, body) {
  const r = await fetch(url, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)});
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'تعذّر الاتصال الصوتي.'); }
  return r.json().catch(() => ({}));
}

async function microphone() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('هذا الجهاز لا يتيح المايك في المتصفح.');
  const stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: false}});
  return stream.getAudioTracks()[0];
}

function player(stream) {
  const a = document.createElement('audio');
  a.autoplay = true; a.setAttribute('playsinline', ''); a.hidden = true; a.srcObject = stream;
  document.body.append(a);
  a.play?.().catch(() => {});
  return a;
}

/** Teacher side: one connection per student, created when the student says hello. */
export function teacherVoice({base, onChange = () => {}}) {
  const peers = new Map(), speaking = new Set();
  let track = null;
  const send = (to, type, data) => post(base + '/rtc', {to, type, data}).catch(() => {});
  function close(id) { const p = peers.get(id); if (!p) return; p.pc.close(); p.audio?.remove(); peers.delete(id); speaking.delete(id); onChange(); }
  async function connect(id) {
    close(id);
    const pc = new RTCPeerConnection({iceServers: ICE}), tr = pc.addTransceiver('audio', {direction: 'sendrecv'}), p = {pc, tr, audio: null};
    peers.set(id, p);
    if (track) await tr.sender.replaceTrack(track);
    pc.onicecandidate = e => { if (e.candidate) send(id, 'ice', e.candidate.toJSON()); };
    pc.ontrack = e => { p.audio?.remove(); p.audio = player(e.streams[0] || new MediaStream([e.track])); };
    pc.onconnectionstatechange = () => onChange();
    await pc.setLocalDescription(await pc.createOffer());
    send(id, 'offer', pc.localDescription.toJSON());
  }
  async function message(m) {
    if (m.type === 'hello') return connect(m.from);
    const p = peers.get(m.from);
    if (m.type === 'bye') return close(m.from);
    if (m.type === 'mic') { if (m.data) speaking.add(m.from); else speaking.delete(m.from); return onChange(); }
    if (!p) return;
    if (m.type === 'answer') await p.pc.setRemoteDescription(m.data);
    if (m.type === 'ice') await p.pc.addIceCandidate(m.data).catch(() => {});
  }
  async function setMic(on) {
    if (on && !track) track = await microphone();
    if (!on && track) { track.stop(); track = null; }
    for (const p of peers.values()) await p.tr.sender.replaceTrack(track);
    onChange();
  }
  return {
    message, setMic,
    get on() { return Boolean(track); },
    speaking: () => [...speaking],
    connected: () => [...peers.entries()].filter(([, p]) => p.pc.connectionState === 'connected').map(([id]) => id),
    stats: async id => { const p = peers.get(id); if (!p) return null; let bytes = 0; (await p.pc.getStats()).forEach(r => { if (r.type === 'inbound-rtp' && r.kind === 'audio') bytes += r.bytesReceived || 0; }); return {state: p.pc.connectionState, bytesIn: bytes}; }
  };
}

/** Student side: answers the teacher's offer; the microphone is off until the student opens it. */
export function studentVoice({base, onChange = () => {}}) {
  let pc = null, tr = null, track = null, audio = null;
  const send = (type, data) => post(base + '/rtc', {type, data});
  async function message(m) {
    if (m.type === 'offer') {
      pc?.close(); audio?.remove(); audio = null;
      pc = new RTCPeerConnection({iceServers: ICE});
      pc.onicecandidate = e => { if (e.candidate) send('ice', e.candidate.toJSON()).catch(() => {}); };
      pc.ontrack = e => { audio?.remove(); audio = player(e.streams[0] || new MediaStream([e.track])); };
      pc.onconnectionstatechange = () => onChange();
      await pc.setRemoteDescription(m.data);
      tr = pc.getTransceivers()[0]; tr.direction = 'sendrecv';
      if (track) await tr.sender.replaceTrack(track);
      await pc.setLocalDescription(await pc.createAnswer());
      await send('answer', pc.localDescription.toJSON());
      onChange();
    } else if (m.type === 'ice' && pc) await pc.addIceCandidate(m.data).catch(() => {});
  }
  async function setMic(on) {
    if (on) { if (!track) track = await microphone(); await send('mic', true); }
    else { if (track) { track.stop(); track = null; } send('mic', false).catch(() => {}); }
    if (tr) await tr.sender.replaceTrack(track);
    onChange();
  }
  return {
    message, setMic,
    hello: () => send('hello', null).catch(() => {}),
    resume: () => audio?.play?.().catch(() => {}),
    get on() { return Boolean(track); },
    get state() { return pc?.connectionState || 'new'; },
    stats: async () => { if (!pc) return null; let bytes = 0; (await pc.getStats()).forEach(r => { if (r.type === 'inbound-rtp' && r.kind === 'audio') bytes += r.bytesReceived || 0; }); return {state: pc.connectionState, bytesIn: bytes}; }
  };
}
