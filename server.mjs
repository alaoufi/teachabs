import {replayAdmin,replayList} from './replay-views.mjs';
import {libraryHome,templatePage} from './library-views.mjs';
import { demoHub } from './demo.mjs';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { openStore, subjects, UserError } from './store.mjs';
import { databasePath } from './paths.mjs';
import * as ui from './views.mjs';
import { lessonService } from './lesson.mjs';
import { advancePlace } from './place-value.mjs';
import { progressPage, bookingResult } from './place-views.mjs';

const files={'/style.css':'text/css; charset=utf-8','/mark.svg':'image/svg+xml','/study.svg':'image/svg+xml','/app.webmanifest':'application/manifest+json','/icon-192.png':'image/png','/icon-512.png':'image/png'};
files['/saved-viewer.js']='text/javascript; charset=utf-8';
files['/depth.css']='text/css; charset=utf-8';
files['/lesson-client.js']='text/javascript; charset=utf-8';
files['/lesson.css']='text/css; charset=utf-8';
files['/place-client.js']='text/javascript; charset=utf-8';
async function fields(req){
  if(req.headers['content-type']?.split(';')[0]!=='application/x-www-form-urlencoded')throw new UserError('صيغة نموذج غير صالحة.',415);
  const chunks=[];let length=0;
  for await (const chunk of req){length+=chunk.length;if(length>(req.url?.includes('/send')?3000000:32768))throw new UserError('حجم الإدخال كبير.',413);chunks.push(chunk);}
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString()));
}

export function createApp(store,{origin=process.env.APP_ORIGIN}={}) {
  const lessons=lessonService(store);
  const limits=new Map();
  function limit(req,key,max){
    const now=Date.now();
    for(const [k,v] of limits) if(v.until<=now)limits.delete(k);
    const address=key+req.socket.remoteAddress;
    const entry=limits.get(address)||{count:0,until:now+600000};
    if(++entry.count>max)throw new UserError('طلبات كثيرة. حاول مجددًا بعد دقائق.',429);
    limits.set(address,entry);
  }
  return http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Referrer-Policy','strict-origin');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'");
    const cookie=(req.headers.cookie||'').match(/(?:^|;\s*)ks=([a-f0-9]{64})(?:;|$)/)?.[1];
    let u=null,back='/app',data=null,route='';
    const html=(title,body,status=200)=>{res.writeHead(status,{'Content-Type':'text/html; charset=utf-8'});res.end(ui.page(title,body,u));};
    const redirect=(to)=>{res.writeHead(303,{Location:to});res.end();};
    const setCookie=(value,age)=>{
      const secure=origin?.startsWith('https://')?'; Secure':'';
      res.setHeader('Set-Cookie','ks='+value+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+age+secure);
    };
    const enter=id=>{store.logout(cookie);setCookie(store.session(id),604800);return redirect('/app');};
    const role=expected=>{if(u?.role!==expected)throw new UserError('هذا الإجراء غير متاح لهذا الحساب.',403);};
    const booking=id=>{const row=store.bookings(u.id).find(b=>b.id===id);if(!row)throw new UserError('الحجز غير متاح.',404);return row;};
    try {
      const host=req.headers.host||'';
      if(origin?host!==new URL(origin).host: !/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host))throw new UserError('عنوان الخدمة غير معتمد.',403);
      const base=origin || 'http://'+host;
      const url=new URL(req.url,base);
      route=url.pathname;const q=Object.fromEntries(url.searchParams);
      const uid=store.resolve(cookie);u=uid?store.user(uid):null;
      if(lessons.matches(route))return await lessons.handle({req,res,url,u,cookie,base,html,redirect,fields,limit});
      if(req.method==='GET'){
        if(route==='/demo')return html('شاشات التجربة',demoHub(u,q.role));
        if(/^\/board-assets\/[A-Za-z0-9_./-]+$/.test(route)&&!route.includes('..')){
          const ext=route.split('.').pop();const type={js:'text/javascript',css:'text/css',woff2:'font/woff2',png:'image/png'}[ext];if(!type)throw new UserError('Not found',404);
          const asset=await readFile(new URL('./public'+route,import.meta.url));res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-cache'});return res.end(asset);
        }
        if(Object.hasOwn(files,route)){
          const asset=await readFile(new URL('./public'+route,import.meta.url));
          res.writeHead(200,{'Content-Type':files[route],'Cache-Control':'public, max-age=300'});return res.end(asset);
        }
        if(route==='/')return u?redirect('/app'):html('التعليم الفردي',ui.landing());
        if(['/login','/register','/activate'].includes(route))return html('الحساب',ui.auth(route.slice(1),q.code||''));
        if(!u)return redirect('/login');
        if(route==='/admin/replays'||(route==='/app'&&u.role==='admin')){role('admin');return html('إذن إعادة الدرس',replayAdmin(store.replays.list(uid)));}
        if(route==='/replays'){role('parent');return html('مراجعة الدروس',replayList(store.replays.available(uid)));}
        if(route==='/replay'){
          role('parent');const template=store.replays.read(uid,q.id,q.child),index=Number(q.page||0);if(!Number.isInteger(index)||index<0||index>=template.pages.length)throw new UserError('صفحة غير متاحة',404);
          res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'");
          const body=templatePage(template,q.id,index).replaceAll('/lesson-library/template?id=', '/replay?child='+encodeURIComponent(q.child)+'&id=').replaceAll('href="/lesson-library"','href="/replays"');return html('إعادة الدرس بإذن الإدارة',body);
        }
        if(route.startsWith('/lesson-library')){
          role('teacher');const library=store.savedLessons;
          if(route==='/lesson-library')return html('مكتبة دروسي',libraryHome(library.listTemplates(uid),store.bookings(uid)));
          if(route==='/lesson-library/export'){const data=library.exportTemplate(uid,q.id);res.writeHead(200,{'Content-Type':'application/json','Content-Disposition':'attachment; filename="teacher-lesson.json"'});return res.end(JSON.stringify(data));}
          if(route==='/lesson-library/template'||route==='/lesson-library/instance'){const instance=route.endsWith('/instance');const template=instance?library.readInstance(uid,q.id):library.readTemplate(uid,q.id),index=instance?template.pageIndex:Number(q.page||0);if(!Number.isInteger(index)||index<0||index>=template.pages.length)throw new UserError('صفحة غير متاحة.',404);res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'");return html('صفحات الدرس',templatePage(template,q.id,index,instance?'instance':'template',template.rev||0));}
          throw new UserError('صفحة غير متاحة.',404);
        }
        if(route==='/app')return html('لوحتي',ui.home(u,store));
        if(route==='/bookings')return html('الحجوزات',ui.bookingsList(store.bookings(uid)));
        if(route==='/progress'){
          role('parent');return html('نتائج الطفل',progressPage(store.childResults(uid,q.child||'')));
        }
        if(route.startsWith('/booking/')){
          const b=booking(route.slice(9));
          return html('تفاصيل الحجز',ui.booking(b)+bookingResult(b,store.placeActivity(b.id),u.role));
        }
        if(route==='/cancel')return html('إلغاء الحجز',ui.cancelPrompt(booking(q.id)));
        if(route==='/teacher/new'){role('teacher');return html('إضافة موعد',ui.slotForm(u));}
        if(['/child/new','/subjects','/offers','/review'].includes(route)){
          role('parent');
          if(route==='/child/new')return html('إضافة طفل',ui.childForm());
          const c=store.ownedChild(uid,q.child||'');
          if(route==='/subjects')return html('مواد الطفل',ui.catalog(c,store,uid));
          if(!Object.hasOwn(subjects,q.subject))throw new UserError('المادة غير متاحة.',404);
          const rows=store.offers(uid,c.id,q.subject);
          if(route==='/offers')return html('المعلمون والمواعيد',ui.teacherList(c,q.subject,rows));
          back='/offers?child='+c.id+'&subject='+q.subject;
          const offer=rows.find(s=>s.id===q.slot);
          if(!offer)throw new UserError('لم يعد الموعد متاحًا. يمكنك اختيار موعد آخر.',409);
          return html('مراجعة الحجز',ui.review(c,offer));
        }
      }else if(req.method==='POST'){
        if(req.headers.origin!==base)throw new UserError('تعذّر التحقق من مصدر الطلب. افتح التطبيق مجددًا.',403);
        data=await fields(req);
        if(route==='/demo/start'){
          if(!['parent','teacher'].includes(data.role))throw new UserError('اختر تجربة متاحة.');
          if(u && !u.scope)throw new UserError('سجّل الخروج من الحساب الفعلي قبل بدء تجربة.',409);
          limit(req,'demo',15);
          if(u)return enter(u.role===data.role?u.id:store.switchTour(u.id));
          const tour=store.tour();return enter(tour[data.role]);
        }
        if(['/login','/register','/activate','/tour'].includes(route))limit(req,route,route==='/login'?25:15);
        if(route==='/tour')return enter(store.tour().parent);
        if(route==='/register')return enter(store.parent(data.name,data.email,data.password));
        if(route==='/login')return enter(store.login(data.email,data.password));
        if(route==='/activate')return enter(store.activate(data.code,data.password));
        if(!u)return redirect('/login');
        if(route==='/admin/replays'){role('admin');if(!['allow','deny'].includes(data.decision))throw new UserError('قرار غير صالح');const days=Number(data.days);if(data.decision==='allow'&&(!Number.isInteger(days)||days<1||days>30))throw new UserError('المدة من يوم إلى 30 يومًا');store.replays.decide(uid,data.instance,{enabled:data.decision==='allow',expires:Date.now()+days*86400000,rev:Number(data.rev)});return redirect('/admin/replays');}
        if(route==='/lesson-library/new-instance'){role('teacher');const instance=store.savedLessons.instantiate(uid,data.template,data.booking);return redirect('/lesson-library/instance?id='+instance.id);}
        if(route==='/lesson-library/page'){role('teacher');store.savedLessons.navigate(uid,data.id,Number(data.rev),Number(data.page));return redirect('/lesson-library/instance?id='+data.id);}
        if(route==='/lesson-library/save'){role('teacher');const id=store.savedLessons.fromBooking(uid,data.booking,data.title,data.base||null);return redirect('/lesson-library/template?id='+id);}
        if(route==='/logout'){store.logout(cookie);setCookie('',0);return redirect('/');}
        const gradePath=route.match(/^\/booking\/([\da-f-]{36})\/grade$/i);
        if(gradePath){
          role('teacher');const b=booking(gradePath[1]);
          if(b.subject!=='math'||b.status!=='confirmed'||Date.now()<b.start+b.minutes*60000)throw new UserError('التقييم اللاحق متاح بعد نهاية الحصة.',403);
          back='/booking/'+b.id;
          store.changePlace(b.id,current=>advancePlace(current,'teacher',{op:'grade',rev:Number(data.rev),rating:data.rating,note:data.note||''},true));
          return redirect(back);
        }
        if(route==='/tour/switch')return enter(store.switchTour(uid));
        if(route==='/child'){role('parent');const id=store.child(uid,{...data,grade:Number(data.grade)});return redirect('/subjects?child='+id);}
        if(route==='/book'){
          role('parent');const c=store.ownedChild(uid,data.child||'');
          back=Object.hasOwn(subjects,data.subject)?'/offers?child='+c.id+'&subject='+data.subject:'/subjects?child='+c.id;
          const id=store.book(uid,c.id,data.slot||'',data.key);return redirect('/booking/'+id);
        }
        if(route==='/cancel'){store.cancel(uid,data.id||'');return redirect('/booking/'+data.id);}
        if(route==='/teacher/withdraw'){role('teacher');store.withdraw(uid,data.id||'');return redirect('/app');}
        if(route==='/teacher/slots'){
          role('teacher');back='/teacher/new';
          const start=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(data.start)?Date.parse(data.start+':00+03:00'):NaN;
          store.slot(uid,{...data,start,minutes:Number(data.minutes)});return redirect('/app');
        }
      }
      throw new UserError('الصفحة غير موجودة.',404);
    } catch(err){
      if(!(err instanceof UserError))console.error('Request failed',err.name,err.code||'');
      const status=err instanceof UserError?err.status:500;
      const msg=err instanceof UserError?err.message:'تعذّر إكمال الطلب. أعد المحاولة من لوحتك.';
      if(data && ['/login','/register','/activate'].includes(route))return html('مراجعة البيانات',ui.auth(route.slice(1),data.code,msg,data),status);
      return html('مراجعة الطلب',ui.errorPage(msg,back),status);
    }
  });
}
if(process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url){
  const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||4817);
  const store=openStore(databasePath()),server=createApp(store);
  server.listen(port,host,()=>console.log('Khatwa running on '+(process.env.APP_ORIGIN || 'http://'+host+':'+port)));
  const stop=()=>server.close(()=>{store.close();process.exit(0);});
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
