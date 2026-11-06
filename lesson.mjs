import {allowedLessons} from './lesson-catalog.mjs';
import {aids} from './board-ui/aids.js';
const visibleBoard=(state,context)=>{const {lessonScenes,...visible}=state;const lesson=allowedLessons(context).find(l=>l.id===state.activeLesson);return {...visible,serverNow:Date.now(),resources:aids.filter(a=>lesson?.aidIds.includes(a.id))};};
import { changeBoard, emptyBoard } from './board.mjs';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { subjects, UserError } from './store.mjs';
import { e } from './views.mjs';
import { advancePlace, initialPlace, visiblePlace } from './place-value.mjs';
import { placeBoard, resultCard } from './place-views.mjs';

const EARLY_ENTRY = 10 * 60_000;
const isOpen = row => row?.status==='confirmed' && row.childStatus!=='suspended' && row.parentStatus!=='suspended' && Date.now()>=row.start-EARLY_ENTRY &&
  Date.now()<row.start+row.minutes*60_000;
const requireState = (ok, message, status=400) => { if (!ok) throw new UserError(message,status); };
const opposite = role => role === 'teacher' ? 'student' : 'teacher';
const idPattern = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

function lobby(user, teacherEntry=false) {
  const parentAtTeacherEntry=teacherEntry && user?.role==='parent';
  const bookingsLink=user?'/bookings':'/login';
  const bookingLabel=user?(user.scope?'عرض حجوزات الجولة':'عرض حجوزاتي'):(teacherEntry?'دخول المعلم بحسابه':'تسجيل الدخول للحصة');
  return `<section class="narrow"><div class="section-head"><div class="eyebrow"><i></i>الفصل المباشر</div>
    <h1>${teacherEntry?'مدخل المعلم':'دخول الحصة مع المعلم'}</h1></div>
    <div class="panel"><h2>الحصة المحجوزة</h2><p>${parentAtTeacherEntry?'أنت في حساب ولي الأمر. لدخول حصتك بصفتك معلمًا، سجّل الخروج ثم ادخل بحساب المعلم.':
      teacherEntry?'ادخل بحساب المعلم المفعّل، وافتح حجز الطالب ثم اختر «دخول الحصة». يفتح الفصل قبل الموعد بعشر دقائق.':
      'يدخل المعلم من حسابه، والطالب من حساب ولي أمره. افتح الحجز واختر «دخول الحصة» قبل الموعد بعشر دقائق أو أثناء الحصة.'}</p>
    <a class="btn" href="${bookingsLink}">${bookingLabel}</a>
    <div class="below"><h2>جرّب الفصل على هذا الكمبيوتر</h2><p>تتحكم أنت في المقعدين. ابدأ من أحدهما، ثم افتح نافذة الطرف الآخر لتجربة الحصة.</p>
    <div class="actions"><form method="post" action="/lesson/preview/start?seat=teacher"><button class="outline">جرّب مقعد المعلم</button></form>
    <form method="post" action="/lesson/preview/start"><button class="outline">جرّب مقعد الطالب</button></form></div></div></div></section>`;
}
function classroom({seat, booking, preview}) {
  const name = seat === 'teacher' ? 'المعلم' : 'الطالب';
  const back = preview ? '/lesson' : '/booking/' + booking.id;
  return `<link rel="stylesheet" href="/lesson.css?v=lessons1"><section id="classroom" data-seat="${seat}" data-grade="${preview?0:booking.grade}" data-subject="${preview?'preview':e(booking.subject)}">
    <div class="lesson-head"><div><div class="eyebrow"><i></i>${preview?'تجربة محلية بمقعدين':'الحصة الفردية'}</div>
    <h1>${preview?'الفصل التجريبي':'حصة '+e(subjects[booking.subject])}</h1>
    <p>${preview?'أنت في مقعد '+name:e(booking.childName)+' مع '+e(booking.teacherName)+' · مقعد '+name} · التسجيل متوقف</p></div>
    <a class="outline" id="leave" href="${back}">مغادرة الحصة</a></div>
    <noscript><p class="error">افتح الحصة في المتصفح مع تفعيل جافاسكربت لتشغيل السبورة والاتصال.</p></noscript>
    <div class="lesson-status"><strong id="status" role="status">جارٍ فتح الفصل…</strong>
    ${preview?'<a class="textlink" target="_blank" rel="noopener" href="/lesson/preview?seat='+opposite(seat)+'">فتح نافذة '+(seat==='teacher'?'الطالب':'المعلم')+'</a>':''}</div>
    <div class="lesson-grid"><section class="panel"><div class="lesson-head"><h2>السبورة المشتركة</h2>
    ${seat==='teacher'?'<button type="button" class="quiet" id="erase" hidden disabled>مسح السبورة</button>':''}</div>
    <p>أدوات الرسم والأشكال والنص والصور، مع مكتبة وسائل ومحرر معادلات. يستخدم الطالب العرض حتى يسمح المعلم بالتحرير.</p>
    <link rel="stylesheet" href="/board-assets/board.css"><div id="board-pro"></div><svg id="board" hidden viewBox="0 0 1000 600"></svg></section>
    <section class="panel"><details><summary>نشاط الآحاد والعشرات</summary>${preview||booking.subject==='math'?placeBoard(seat,preview):'هذا النشاط لحصص الرياضيات.'}</details></section>
    <section class="panel"><details><summary>الصوت والصورة — اختياريان</summary><div class="screen"><video id="remote" autoplay playsinline></video><span>الطرف الآخر</span></div>
    <video id="local" muted autoplay playsinline hidden></video><div class="devices"><button id="mic" class="outline" disabled aria-pressed="false">تشغيل الميكروفون</button>
    <button id="cam" class="outline" disabled aria-pressed="false">تشغيل الكاميرا</button></div>
    <button id="play" class="quiet" hidden>سماع الطرف الآخر</button><p id="hint" aria-live="polite">يظل الميكروفون والكاميرا مغلقين حتى تشغّلهما بنفسك.</p>
    ${preview?'<small>عند التجربة على جهاز واحد، استخدم سماعات وجرّب الكاميرا من نافذة واحدة كل مرة.</small>':''}</details></section></div>
    </section><script type="module" src="/lesson-client.js?v=board1"></script>`;
}

export function lessonService(store) {
  const rooms = new Map();
  const output = (peer,type,data) => {
    if (peer && !peer.res.destroyed) peer.res.write('event: '+type+'\ndata: '+JSON.stringify(data)+'\n\n');
  };
  function detach(room, seat, peer) {
    if (room.peers[seat] !== peer) return;
    clearInterval(peer.timer);
    delete room.peers[seat];
    room.pair = null;
    const remaining = room.peers[opposite(seat)];
    if (remaining) {
      output(remaining,'presence',{pair:null});
    } else {
      // A reload or short network interruption can briefly disconnect both seats.
      room.expiry=setTimeout(()=>rooms.delete(room.key),30_000);
      room.expiry.unref();
    }
  }
  function close(room,seat,message) {
    const peer=room.peers[seat];
    if (!peer) return;
    output(peer,'closed',message);
    detach(room,seat,peer);
    peer.res.end();
  }
  function subscribe(key,seat,client,res,canStay,math,preview,context) {
    let room = rooms.get(key);
    if (room?.peers[seat]) {
      close(room,seat,'فُتح مقعدك في نافذة أخرى.');
      room=rooms.get(key);
    }
    if (!room) {
      room={key,peers:{},strokes:[],pair:null};
      rooms.set(key,room);
    }
    clearTimeout(room.expiry);
    res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','X-Accel-Buffering':'no'});
    const peer={client,res,canStay};
    room.peers[seat]=peer;
    res.on('close',()=>detach(room,seat,peer));
    output(peer,'snapshot',room.strokes);
    output(peer,'boardstate',{state:visibleBoard(store.readBoard(key)||emptyBoard(),context),sender:null});
    if(math){
      const state=(preview?room.place:store.placeActivity(key))??initialPlace();
      output(peer,'place',visiblePlace(state,seat));
    }
    const other=room.peers[opposite(seat)];
    room.pair=other?randomUUID():null;
    output(peer,'presence',{pair:room.pair});
    output(other,'presence',{pair:room.pair});
    peer.timer=setInterval(()=>{
      if (!canStay()) return close(room,seat,'انتهى إذن الدخول لهذه الحصة.');
      res.write(': heartbeat\n\n');
    },5000);
    peer.timer.unref();
  }
  function deliver(key,seat,data,math,preview,context) {
    const room=rooms.get(key);
    if(!room || room.peers[seat]?.client!==data.client) throw new UserError('أعد فتح نافذة الفصل.',409);
    let payload;
    try { payload=JSON.parse(data.payload); } catch { throw new UserError('رسالة غير صالحة.'); }
    if(data.kind==='board'){
      const next=changeBoard(store.readBoard(key),seat,payload,context);store.writeBoard(key,next);
      for(const peer of Object.values(room.peers))output(peer,'boardstate',{state:visibleBoard(next,context),sender:data.client});return visibleBoard(next,context);
    }
    if(data.kind==='place'){
      requireState(math,'هذا النشاط لحصة الرياضيات فقط.',403);
      const update=current=>advancePlace(current,seat,payload);
      const next=preview?(room.place=update(room.place)):store.changePlace(key,update);
      for(const [role,peer] of Object.entries(room.peers))output(peer,'place',visiblePlace(next,role));
      return visiblePlace(next,seat);
    }
    if (data.kind==='stroke') {
      requireState(Array.isArray(payload) && payload.length>0 && payload.length<=256 &&
        payload.every(p=>Array.isArray(p)&&p.length===2&&Number.isInteger(p[0])&&Number.isInteger(p[1])&&p[0]>=0&&p[0]<=1000&&p[1]>=0&&p[1]<=600),'رسمة غير صالحة.');
      requireState(room.strokes.length<1000,'السبورة ممتلئة. يستطيع المعلم مسحها.',409);
      const stroke={seat,points:payload};room.strokes.push(stroke);
      for(const target of Object.values(room.peers)) output(target,'stroke',stroke);
    } else if(data.kind==='erase') {
      requireState(seat==='teacher','المسح للمعلم فقط.',403);
      room.strokes=[];
      for(const target of Object.values(room.peers)) output(target,'snapshot',[]);
    } else {
      requireState(data.kind==='sdp' && payload && payload.type===(seat==='teacher'?'offer':'answer') &&
        typeof payload.sdp==='string' && payload.sdp.length<14000,'إشارة اتصال غير صالحة.');
      requireState(room.pair && data.pair===room.pair,'تغيّر الطرف المتصل.',409);
      output(room.peers[opposite(seat)],'sdp',{pair:room.pair,description:{type:payload.type,sdp:payload.sdp}});
    }
  }
  return {
    matches: path=>path==='/lesson' || path.startsWith('/lesson/'),
    async handle({req,res,url,u,cookie,base,html,redirect,fields,limit}) {
      const path=url.pathname;
      if (path==='/lesson' && req.method==='GET') return html('دخول الحصة',lobby(u));
      if (path==='/lesson/teacher' && req.method==='GET') return html('مدخل المعلم',lobby(u,true));
      if(req.method==='POST'){
        requireState(req.headers.origin===base,'مصدر الطلب غير معتمد.',403);
      }
      const ticket=(req.headers.cookie||'').match(/(?:^|;\s*)lesson_preview=([a-f0-9]{64})(?:;|$)/)?.[1];
      if(path==='/lesson/preview/start' && req.method==='POST'){
        const seat=url.searchParams.get('seat')??'student';
        requireState(['teacher','student'].includes(seat),'مقعد غير صالح.');
        limit(req,'lesson-preview',40);
        if(!ticket)res.setHeader('Set-Cookie','lesson_preview='+randomBytes(32).toString('hex')+'; Path=/lesson/preview; Max-Age=7200; HttpOnly; SameSite=Strict'+(base.startsWith('https:')?'; Secure':''));
        return redirect(seat==='teacher'?'/lesson/preview?seat=teacher':'/lesson/preview');
      }
      if(path==='/lesson/preview/result' && req.method==='GET'){
        const state=ticket && rooms.get('preview-'+createHash('sha256').update(ticket).digest('hex'))?.place;
        requireState(state?.phase==='graded','اعتمد النتيجة أولًا من مقعد المعلم في الفصل التجريبي.',403);
        return html('نتيجة ولي الأمر التجريبية','<section class="narrow panel"><div class="eyebrow">معاينة ولي الأمر · بيانات التجربة فقط</div>'+resultCard(state)+'</section>');
      }
      const match=path.match(/^\/lesson\/(preview|[\da-f-]{36})(?:\/(events|send|clear))?$/i);
      requireState(match,'الفصل غير متاح.',404);
      const [,id,action]=match, preview=id==='preview';
      let key,seat,booking;
      const requestedSeat=url.searchParams.get('seat');
      if(preview){
        seat=requestedSeat||'student';
        requireState(['teacher','student'].includes(seat),'مقعد غير صالح.');
        if(!ticket) return redirect(seat==='teacher'?'/lesson/teacher':'/lesson');
        key='preview-'+createHash('sha256').update(ticket).digest('hex');
      }else{
        if(!u)return redirect('/login');
        booking=store.bookings(u.id,id)[0];
        requireState(booking,'الحجز غير متاح.',404);
        requireState(booking.status==='confirmed','هذا الحجز ملغى.',403);
        requireState(action==='clear'||isOpen(booking),'يفتح الفصل قبل الموعد بعشر دقائق ويغلق بانتهاء وقت الحصة.',403);
        seat=u.role==='teacher'?'teacher':'student';
        requireState(!requestedSeat || requestedSeat===seat,'لا يمكنك دخول مقعد الطرف الآخر.',403);
        key=id;
      }
      if(action==='clear'&&req.method==='POST'){
        requireState(seat==='teacher','مسح الدرس للمعلم فقط.',403);
        const data=await fields(req);let payload;try{payload=JSON.parse(data.payload);}catch{throw new UserError('طلب غير صالح.');}
        requireState(payload.op==='clear','طلب غير صالح.');
        const context={preview,subject:booking?.subject,grade:booking?.grade};
        const next=changeBoard(store.readBoard(key),seat,payload,context);store.writeBoard(key,next);
        for(const peer of Object.values(rooms.get(key)?.peers||{}))output(peer,'boardstate',{state:visibleBoard(next,context),sender:data.client});
        res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify(visibleBoard(next,context)));
      }
      if (!action && req.method==='GET'){
        res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self'; media-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'");
        return html('الفصل المباشر',classroom({seat,booking,preview}));
      }
      if(action==='events' && req.method==='GET'){
        const client=url.searchParams.get('client')||'';
        requireState(idPattern.test(client),'معرّف اتصال غير صالح.');
        return subscribe(key,seat,client,res,()=>preview ||
          (store.resolve(cookie)===u.id && isOpen(store.bookings(u.id,id)[0])),preview||booking.subject==='math',preview,{preview,subject:booking?.subject,grade:booking?.grade});
      }
      if(action==='send' && req.method==='POST'){
        const data=await fields(req);
        if(!preview)requireState(store.resolve(cookie)===u.id && isOpen(store.bookings(u.id,id)[0]),'انتهى إذن الدخول للحصة.',403);
        const result=deliver(key,seat,data,preview||booking.subject==='math',preview,{preview,subject:booking?.subject,grade:booking?.grade});
        if(result){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify(result));}
        res.writeHead(204);return res.end();
      }
      throw new UserError('إجراء غير متاح.',405);
    }
  };
}
