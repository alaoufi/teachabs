import {attachProfessionalBoard} from '/board-assets/board.js';
import { attachPlaceBoard } from './place-client.js?v=place2';
const $ = id => document.getElementById(id);
const seat=$('classroom').dataset.seat;
const client=crypto.randomUUID();
const path=location.pathname;
const params=new URLSearchParams(location.search);
params.set('client',client);
const signals=new EventSource(path+'/events?'+params);
const tracks={audio:null,video:null};
const controls={audio:$('mic'),video:$('cam')};
const pendingDevices=new Set();
let present=false, ended=false, connection=null, pair=null;
let mediaEpoch=0;
const status=text=>{$('status').textContent=text;};
const hint=text=>{$('hint').textContent=text;};

async function send(kind,payload,generation=''){
  const response=await fetch(path+'/send?'+params,{
    method:'POST',redirect:'error',body:new URLSearchParams({client,kind,payload:JSON.stringify(payload),pair:generation})
  });
  if(!response.ok)throw new Error(response.status===409?'تغيّرت اللوحة. راجعها قبل إعادة المحاولة.':'تعذّر إرسال التحديث. تحقّق من الاتصال أو أعد فتح الفصل.');
  if(response.headers.get('content-type')?.startsWith('application/json'))return response.json();
}
const placeConnected=attachPlaceBoard(seat,signals,send);
attachProfessionalBoard(seat,signals,send,client,$('classroom').dataset.subject,Number($('classroom').dataset.grade));
function resetPeer(){
  if(connection){connection.onconnectionstatechange=null;connection.ontrack=null;connection.close();}
  connection=null;pair=null;$('remote').srcObject=null;$('play').hidden=true;
}
function controlState(kind){
  const track=tracks[kind];
  controls[kind].textContent=(track?'إيقاف ':'تشغيل ')+(kind==='audio'?'الميكروفون':'الكاميرا');
  controls[kind].setAttribute('aria-pressed',String(Boolean(track)));
  controls[kind].disabled=!present || pendingDevices.has(kind);
}
function stopDevices(){
  mediaEpoch++;
  for(const kind of ['audio','video']){
    tracks[kind]?.stop();tracks[kind]=null;controlState(kind);
  }
  $('local').srcObject=null;$('local').hidden=true;
}
function closeLesson(message){
  placeConnected(false);
  ended=true;present=false;signals.close();resetPeer();stopDevices();status(message);
  if($('erase'))$('erase').disabled=true;
}
window.addEventListener('pagehide',()=>closeLesson('غادرت الحصة.'));
window.addEventListener('pageshow',ev=>{if(ev.persisted && ended)location.reload();});
document.addEventListener('khatwa-pause',stopDevices);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopDevices();});
function sender(pc,kind){return pc?.getTransceivers().find(t=>t.receiver.track.kind===kind)?.sender;}
async function toggle(kind){
  const epoch=mediaEpoch;
  if(document.hidden)return;
  if(pendingDevices.has(kind))return;
  pendingDevices.add(kind);
  const button=controls[kind];button.disabled=true;
  try{
    if(tracks[kind]){
      tracks[kind].stop(); tracks[kind]=null;
      await sender(connection,kind)?.replaceTrack(null);
    }else{
      if(!navigator.mediaDevices?.getUserMedia) throw new Error('unavailable');
      const stream=await navigator.mediaDevices.getUserMedia({[kind]:true});
      const track=stream.getTracks()[0];
      if(!present || ended || document.hidden || epoch!==mediaEpoch){track.stop();return;}
      tracks[kind]=track;
      track.onended=()=>{
        if(tracks[kind]!==track)return;
        tracks[kind]=null;controlState(kind);
        if(kind==='video'){$('local').srcObject=null;$('local').hidden=true;}
        hint('توقف الجهاز عن الإرسال. يمكنك تشغيله مجددًا. عند التجربة من نفس الكمبيوتر جرّب الكاميرا في نافذة واحدة كل مرة.');
      };
      await sender(connection,kind)?.replaceTrack(track);
    }
    hint('يمكنك تغيير أجهزة الصوت والصورة في أي وقت أثناء الحصة.');
  }catch(error){
    tracks[kind]?.stop(); tracks[kind]=null;
    const reasons={NotAllowedError:'لم يُمنح إذن استخدام الجهاز. يمكنك تغييره من إعدادات المتصفح.',
      NotFoundError:'لم يجد المتصفح هذا الجهاز. تأكد من توصيله.',
      NotReadableError:'الجهاز مشغول أو غير متاح. أغلق التطبيق الآخر الذي يستخدمه ثم أعد المحاولة.'};
    hint((reasons[error.name]||'تعذّر تشغيل الجهاز. حاول مجددًا.')+' تبقى السبورة متاحة.');
  }finally{
    pendingDevices.delete(kind);
    if(kind==='video'){
      $('local').srcObject=tracks.video?new MediaStream([tracks.video]):null;
      $('local').hidden=!tracks.video;
    }
    controlState(kind);
  }
}
for(const kind of ['audio','video']) controls[kind].addEventListener('click',()=>toggle(kind));
$('play').addEventListener('click',async()=>{
  try{await $('remote').play();$('play').hidden=true;}catch{hint('تعذّر تشغيل صوت الطرف الآخر. تحقق من إعدادات المتصفح.');}
});

function newPeer(generation){
  resetPeer();pair=generation;
  if(!window.RTCPeerConnection){hint('هذا المتصفح لا يدعم الاتصال المباشر. يمكنك استخدام السبورة.');return null;}
  const pc=new RTCPeerConnection();
  connection=pc;
  const stream=new MediaStream();$('remote').srcObject=stream;
  pc.ontrack=event=>{
    stream.addTrack(event.track);
    const play=()=>$('remote').play().catch(()=>{if(connection===pc)$('play').hidden=false;});
    event.track.onunmute=play;play();
  };
  pc.onconnectionstatechange=()=>{
    if(connection!==pc)return;
    if(pc.connectionState==='connected')status('الطالب والمعلم متصلان');
    if(['failed','disconnected'].includes(pc.connectionState))status('توقف اتصال الصوت والصورة. أعد فتح الفصل للمحاولة. السبورة ما زالت متاحة.');
  };
  return pc;
}
// Both descriptions carry gathered local ICE candidates. No external relay is used.
async function describe(pc,description,generation){
  await pc.setLocalDescription(description);
  if(pc.iceGatheringState!=='complete'){
    await new Promise(resolve=>{
      const finish=()=>{clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',check);resolve();};
      const check=()=>{if(pc.iceGatheringState==='complete')finish();};
      const timer=setTimeout(finish,4000);pc.addEventListener('icegatheringstatechange',check);check();
    });
  }
  if(connection===pc && pair===generation)await send('sdp',pc.localDescription.toJSON(),generation);
}
async function connect(generation){
  if(!generation){resetPeer();status('بانتظار دخول '+(seat==='teacher'?'الطالب':'المعلم')+'…');return;}
  status('دخل الطرف الآخر · جارٍ توصيل الصوت والصورة');
  const pc=newPeer(generation);
  if(!pc || seat!=='teacher')return;
  for(const kind of ['audio','video']){
    const transceiver=pc.addTransceiver(kind,{direction:'sendrecv'});
    if(tracks[kind])await transceiver.sender.replaceTrack(tracks[kind]);
  }
  await describe(pc,await pc.createOffer(),generation);
}
async function receive({pair:generation,description}){
  const pc=connection;
  if(!pc || generation!==pair)return;
  await pc.setRemoteDescription(description);
  if(description.type==='offer' && connection===pc){
    for(const transceiver of pc.getTransceivers()){
      transceiver.direction='sendrecv';
      const track=tracks[transceiver.receiver.track.kind];
      if(track)await transceiver.sender.replaceTrack(track);
    }
    await describe(pc,await pc.createAnswer(),generation);
  }
}
const mediaError=()=>hint('تعذّر اتصال الصوت والصورة. يمكنك متابعة العمل على السبورة أو إعادة فتح الفصل.');
signals.addEventListener('presence',ev=>{
  placeConnected(true);
  present=true;for(const kind of ['audio','video'])controlState(kind);
  if($('erase'))$('erase').disabled=false;
  connect(JSON.parse(ev.data).pair).catch(mediaError);
});
signals.addEventListener('sdp',ev=>receive(JSON.parse(ev.data)).catch(mediaError));
signals.addEventListener('closed',ev=>closeLesson(JSON.parse(ev.data)));
signals.onerror=()=>{
  if(ended)return;
  placeConnected(false);
  present=false;resetPeer();stopDevices();if($('erase'))$('erase').disabled=true;
  status('انقطع الاتصال بالفصل. جارٍ إعادة الاتصال…');
};

const board=$('board'),ns='http://www.w3.org/2000/svg';
let draft=null;
function line(author,points){
  const el=document.createElementNS(ns,'polyline');el.setAttribute('class','ink '+author);
  const first=points[0];
  el.setAttribute('points',points.length===1?first.join(',')+' '+(first[0]+0.3)+','+first[1]:points.map(p=>p.join(',')).join(' '));
  board.append(el);return el;
}
signals.addEventListener('snapshot',ev=>{
  board.replaceChildren();draft=null;
  for(const stroke of JSON.parse(ev.data))line(stroke.seat,stroke.points);
});
signals.addEventListener('stroke',ev=>{const stroke=JSON.parse(ev.data);line(stroke.seat,stroke.points);});
function point(ev){
  const r=board.getBoundingClientRect();
  return [Math.round(Math.min(1,Math.max(0,(ev.clientX-r.left)/r.width))*1000),Math.round(Math.min(1,Math.max(0,(ev.clientY-r.top)/r.height))*600)];
}
let drawingQueue=Promise.resolve();
function commit(points){drawingQueue=drawingQueue.then(()=>send('stroke',points)).catch(err=>hint(err.message));}
board.addEventListener('pointerdown',ev=>{
  if(!present || draft || ev.button!==0)return;
  board.setPointerCapture(ev.pointerId);
  const points=[point(ev)];draft={id:ev.pointerId,points,el:line(seat,points)};
});
board.addEventListener('pointermove',ev=>{
  if(!draft || draft.id!==ev.pointerId)return;
  const p=point(ev);
  if(String(p)===String(draft.points.at(-1)))return;
  draft.points.push(p);draft.el.setAttribute('points',draft.points.map(v=>v.join(',')).join(' '));
  if(draft.points.length>=240){commit(draft.points);draft.el.remove();draft={id:ev.pointerId,points:[p],el:line(seat,[p])};}
});
function finish(ev){
  if(!draft || draft.id!==ev.pointerId)return;
  const stroke=draft;draft=null;stroke.el.remove();
  if(present)commit(stroke.points);
}
board.addEventListener('pointerup',finish);board.addEventListener('pointercancel',finish);
$('erase')?.addEventListener('click',()=>{drawingQueue=drawingQueue.then(()=>send('erase',null)).catch(err=>hint(err.message));});
