// Live voice and picture in the class: each student's device opens one connection to the teacher (WebRTC).
// The teacher's microphone is heard and the teacher's camera is seen by every student; a student's microphone is
// heard by the teacher.
// The teacher decides: their own microphone on or off, and whether students may open theirs.
// Signalling goes through the class server (/rtc) and is never stored. Without a TURN server some networks
// may block the audio; the board and everything else keep working.

const ICE = [{urls: 'stun:stun.l.google.com:19302'}];

async function post(url, body) {
  const r = await fetch(url, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)});
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'تعذّر الاتصال الصوتي.'); }
  return r.json().catch(() => ({}));
}

/** Messages of one connection must arrive in order (offer before its network candidates), so they go one by one. */
function ordered(fn) { let chain = Promise.resolve(); return (...a) => (chain = chain.then(() => fn(...a), () => fn(...a))); }

/** Network candidates that arrive before the description they belong to wait until it is set. */
function candidates(pc) {
  const early = [];
  return {
    add: c => pc.remoteDescription ? pc.addIceCandidate(c).catch(() => {}) : early.push(c),
    flush: async () => { while (early.length) await pc.addIceCandidate(early.shift()).catch(() => {}); }
  };
}

async function microphone() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('هذا الجهاز لا يتيح المايك في المتصفح.');
  const stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: false}});
  return stream.getAudioTracks()[0];
}

async function camera() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('هذا الجهاز لا يتيح الكاميرا في المتصفح.');
  const stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'user', width: {ideal: 640}, height: {ideal: 480}, frameRate: {ideal: 15, max: 24}}});
  return stream.getVideoTracks()[0];
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
  let track = null, cam = null;
  const lines = new Map(); // one ordered line of messages per student
  const send = (to, type, data, cid) => { if (!lines.has(to)) lines.set(to, ordered((t, d, c) => post(base + '/rtc', {to, type: t, data: d, cid: c}).catch(() => {}))); return lines.get(to)(type, data, cid); };
  function close(id) { const p = peers.get(id); if (!p) return; p.pc.close(); p.audio?.remove(); peers.delete(id); speaking.delete(id); onChange(); }
  async function connect(id) {
    close(id);
    const pc = new RTCPeerConnection({iceServers: ICE}), tr = pc.addTransceiver('audio', {direction: 'sendrecv'}), vt = pc.addTransceiver('video', {direction: 'sendonly'}), cid = Math.random().toString(36).slice(2, 12), p = {pc, tr, vt, cid, audio: null, ice: candidates(pc)};
    peers.set(id, p);
    if (track) await tr.sender.replaceTrack(track);
    if (cam) await vt.sender.replaceTrack(cam);
    pc.onicecandidate = e => { if (e.candidate) send(id, 'ice', e.candidate.toJSON(), cid); };
    pc.ontrack = e => { if (e.track.kind !== 'audio') return; p.audio?.remove(); p.audio = player(new MediaStream([e.track])); };
    pc.onconnectionstatechange = () => onChange();
    await pc.setLocalDescription(await pc.createOffer());
    send(id, 'offer', pc.localDescription.toJSON(), cid);
  }
  async function message(m) {
    if (m.type === 'hello') return connect(m.from);
    const p = peers.get(m.from);
    if (m.type === 'bye') return close(m.from);
    if (m.type === 'mic') { if (m.data) speaking.add(m.from); else speaking.delete(m.from); return onChange(); }
    if (!p || (m.cid && m.cid !== p.cid)) return; // a reply to an older connection attempt
    if (m.type === 'answer') { await p.pc.setRemoteDescription(m.data); await p.ice.flush(); }
    if (m.type === 'ice') await p.ice.add(m.data);
  }
  async function setMic(on) {
    if (on && !track) track = await microphone();
    if (!on && track) { track.stop(); track = null; }
    for (const p of peers.values()) await p.tr.sender.replaceTrack(track);
    onChange();
  }
  async function setCamera(on) {
    if (on && !cam) cam = await camera();
    if (!on && cam) { cam.stop(); cam = null; }
    for (const p of peers.values()) await p.vt.sender.replaceTrack(cam);
    onChange();
  }
  /** Emergency: the teacher's microphone and camera off at once. */
  async function stopAll() { await setMic(false); await setCamera(false); }
  return {
    message: ordered(message), setMic, setCamera, stopAll,
    get on() { return Boolean(track); },
    get camera() { return cam; },
    speaking: () => [...speaking],
    connected: () => [...peers.entries()].filter(([, p]) => p.pc.connectionState === 'connected').map(([id]) => id),
    stats: async id => { const p = peers.get(id); if (!p) return null; let bytes = 0; (await p.pc.getStats()).forEach(r => { if (r.type === 'inbound-rtp' && r.kind === 'audio') bytes += r.bytesReceived || 0; }); return {state: p.pc.connectionState, bytesIn: bytes}; }
  };
}

/** Student side: answers the teacher's offer; the microphone is off until the student opens it. */
export function studentVoice({base, onChange = () => {}, onVideo = () => {}}) {
  let pc = null, tr = null, track = null, audio = null, video = null, ice = null, early = [], cid = null, lastHello = 0;
  const line = ordered((type, data, c) => post(base + '/rtc', {type, data, cid: c}));
  const send = (type, data, c = cid) => line(type, data, c); // tagged with the connection it belongs to
  async function message(m) {
    if (m.type === 'offer') {
      pc?.close(); audio?.remove(); audio = null; cid = m.cid || null;
      early = early.filter(c => c.cid === cid).map(c => c.data);
      pc = new RTCPeerConnection({iceServers: ICE}); ice = candidates(pc); const mine = cid;
      pc.onicecandidate = e => { if (e.candidate) send('ice', e.candidate.toJSON(), mine).catch(() => {}); };
      pc.ontrack = e => {
        if (e.track.kind === 'video') { video = new MediaStream([e.track]); onVideo(video); return; }
        audio?.remove(); audio = player(new MediaStream([e.track]));
      };
      pc.onconnectionstatechange = () => onChange();
      await pc.setRemoteDescription(m.data);
      for (const c of early.splice(0)) ice.add(c); await ice.flush();
      const all = pc.getTransceivers();
      tr = all.find(t => t.receiver.track.kind === 'audio') || all[0]; tr.direction = 'sendrecv';
      for (const t of all) if (t !== tr && t.receiver.track.kind === 'video') t.direction = 'recvonly';
      if (track) await tr.sender.replaceTrack(track);
      await pc.setLocalDescription(await pc.createAnswer());
      await send('answer', pc.localDescription.toJSON(), mine);
      onChange();
    } else if (m.type === 'ice') { if (ice && (!m.cid || m.cid === cid)) await ice.add(m.data); else if (m.cid !== cid) early.push({cid: m.cid, data: m.data}); }
  }
  async function setMic(on) {
    if (on) { if (!track) track = await microphone(); await send('mic', true); }
    else { if (track) { track.stop(); track = null; } send('mic', false).catch(() => {}); }
    if (tr) await tr.sender.replaceTrack(track);
    onChange();
  }
  return {
    message: ordered(message), setMic,
    hello: () => { if (Date.now() - lastHello < 2500) return; lastHello = Date.now(); return send('hello', null).catch(() => {}); }, // one hello is enough
    resume: () => audio?.play?.().catch(() => {}),
    get on() { return Boolean(track); },
    get state() { return pc?.connectionState || 'new'; },
    get video() { return video; },
    stats: async () => { if (!pc) return null; let bytes = 0, videoBytes = 0; (await pc.getStats()).forEach(r => { if (r.type === 'inbound-rtp' && r.kind === 'audio') bytes += r.bytesReceived || 0; if (r.type === 'inbound-rtp' && r.kind === 'video') videoBytes += r.bytesReceived || 0; }); return {state: pc.connectionState, bytesIn: bytes, videoIn: videoBytes}; }
  };
}
