import {registrationDashboard,registrationAdmin} from './registration-views.mjs';
import { adminService } from './admin-service.mjs';
import { groupService } from './group-lesson.mjs';
import {serveAsset} from './asset-response.mjs';
import { demoHub } from './demo.mjs';
import { classroomLab } from './classroom-lab.mjs';
import { scienceShadowLesson, SCIENCE_SHADOW_ROUTE } from './science-lesson.mjs';
import { lessonsIndex, LESSONS_ROUTE } from './interactive-lessons.mjs';
import { guideHTML, GUIDE_TITLE } from './public/class-guide.js';
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
files['/board-loader.js']='text/javascript; charset=utf-8';
files['/depth.css']='text/css; charset=utf-8';
files['/admin.css']='text/css; charset=utf-8';
files['/lesson-client.js']='text/javascript; charset=utf-8';
files['/lesson.css']='text/css; charset=utf-8';
files['/place-client.js']='text/javascript; charset=utf-8';
files['/classroom-lab.js']='text/javascript; charset=utf-8';
files['/classroom-lab-model.js']='text/javascript; charset=utf-8';
files['/classroom-lab.css']='text/css; charset=utf-8';
files['/science-shadow.js']='text/javascript; charset=utf-8';
files['/shadow-client.js']='text/javascript; charset=utf-8';
for(const f of ['activities.js','matter-model.js','cells-model.js','placevalue-model.js','curriculum-g4.js','class-guide.js','group-plan.js','group-view.js','group-ink.js','group-board-tools.js','group-plans.js','text-library.js','explain-texts.js','narrator-scripts.js','group-planner.js','group-teacher.js','group-student.js'])files['/'+f]='text/javascript; charset=utf-8';
files['/group-lesson.css']='text/css; charset=utf-8';
files['/science-shadow-model.js']='text/javascript; charset=utf-8';
files['/science-shadow.css']='text/css; charset=utf-8';
async function fields(req){
  if(req.headers['content-type']?.split(';')[0]!=='application/x-www-form-urlencoded')throw new UserError('صيغة نموذج غير صالحة.',415);
  const chunks=[];let length=0;
  for await (const chunk of req){length+=chunk.length;if(length>(req.url?.includes('/send')?3000000:32768))throw new UserError('حجم الإدخال كبير.',413);chunks.push(chunk);}
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString()));
}

export function createApp(store,{origin=process.env.APP_ORIGIN}={}) {
  const lessons=lessonService(store);
  const administration=adminService(store);
  const groups=groupService(store);
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
      if(administration.matches(route)&&route!=='/admin/registration-agents')return await administration.handle({req,url,u,base,html,redirect,fields,limit,enter});
      if(groups.matches(route))return await groups.handle({req,res,url,u,base,html,redirect,fields});
      if(lessons.matches(route))return await lessons.handle({req,res,url,u,cookie,base,html,redirect,fields,limit});
      if(req.method==='GET'){
        if(route==='/classroom-lab'){
          res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; connect-src 'none'; img-src 'self' data: blob:; frame-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'");
          res.setHeader('Permissions-Policy','camera=(), microphone=(), display-capture=()');
          return html('مختبر الفصل التعليمي',classroomLab());
        }
        if(route===LESSONS_ROUTE)return html('الدروس التفاعلية',lessonsIndex());
        if(route==='/guide')return html(GUIDE_TITLE,'<link rel="stylesheet" href="/group-lesson.css?v=2">'+guideHTML());
        if(route===SCIENCE_SHADOW_ROUTE){
          res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; connect-src 'none'; img-src 'self' data:; frame-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'");
          res.setHeader('Permissions-Policy','camera=(), microphone=(), display-capture=(), geolocation=()');
          return html('الضوء والظل · علوم الصف الرابع',scienceShadowLesson());
        }
        if(route==='/demo')return html('شاشات التجربة',demoHub(u,q.role));
        if(/^\/board-assets\/[A-Za-z0-9_./-]+$/.test(route)&&!route.includes('..')){
          const ext=route.split('.').pop();const type={js:'text/javascript',css:'text/css',woff2:'font/woff2',png:'image/png'}[ext];if(!type)throw new UserError('Not found',404);
          const asset=await readFile(new URL('./public'+route,import.meta.url));return await serveAsset(req,res,asset,type,/^\/board-assets\/(chunks|assets)\/[^/]+-[A-Z0-9]{8}\.[a-z0-9]+$/.test(route));
        }
        if(Object.hasOwn(files,route)){
          const asset=await readFile(new URL('./public'+route,import.meta.url));
          return await serveAsset(req,res,asset,files[route]);
        }
        if(route==='/')return u?redirect('/app'):html('التعليم الفردي',ui.landing());
        if(['/login','/register','/activate'].includes(route))return html('الحساب',ui.auth(route.slice(1),q.code||''));
        if(!u)return redirect('/login');
                if(route==='/registration'||(route==='/app'&&u.role==='registration_agent')){role('registration_agent');const demo=store.admin.isDemoAgent(uid);try{return html('وكيل التسجيل',registrationDashboard(store.registration.dashboard(uid),demo));}catch(err){if(!demo||err.status!==403)throw err;return html('وكيل التسجيل',registrationDashboard({permissions:{},parents:[],children:[]},true));}}
        if(route==='/admin/registration-agents'){role('admin');return html('صلاحيات التسجيل',registrationAdmin(store.registration.agents(uid)));}
        if(route==='/app'&&u.role==='admin')return redirect('/admin');
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
          if(!['parent','teacher','admin'].includes(data.role))throw new UserError('اختر تجربة متاحة.');
          if(u && !u.scope)throw new UserError('سجّل الخروج من الحساب الفعلي قبل بدء تجربة.',409);
          limit(req,'demo',15);
          if(data.role==='admin')return enter(store.admin.demo().supervisor);
          if(u&&['parent','teacher'].includes(u.role))return enter(u.role===data.role?u.id:store.switchTour(u.id));
          const tour=store.tour();return enter(tour[data.role]);
        }
        if(['/login','/register','/activate','/tour'].includes(route))limit(req,route,route==='/login'?25:15);
        if(route==='/tour')return enter(store.tour().parent);
        if(route==='/register')return enter(store.parent(data.name,data.email,data.password));
        if(route==='/login')return enter(store.login(data.email,data.password));
                if(route==='/activate'){const id=store.activate(data.code,data.password);return store.registration.active(id)?enter(id):html('بانتظار التفعيل','<section class="panel"><h1>تم إعداد كلمة المرور</h1><p>الحساب بانتظار تفعيل وكيل التسجيل. بعد التفعيل يمكنك تسجيل الدخول.</p><a href="/login">تسجيل الدخول</a></section>');}
        if(route==='/admin/registration-agents'){role('admin');store.registration.setPermissions(uid,data.agent,{register_parent:data.register_parent==='on',register_child:data.register_child==='on',manage_status:data.manage_status==='on'},Number(data.rev));return redirect('/admin/registration-agents');}
        if(route==='/registration/parent'){role('registration_agent');const result=store.registration.addParent(uid,data);return html('رابط إعداد الحساب','<section class="panel"><h1>تم تسجيل ولي الأمر</h1><p>الحساب بانتظار التفعيل. رابط إعداد كلمة المرور خاص وصالح 24 ساعة ويستخدم مرة واحدة. لم يُرسل تلقائيًا.</p><a href="/activate?code='+ui.e(result.activationToken)+'">إعداد كلمة المرور</a><p><a href="/registration">العودة للتسجيل</a></p></section>');}
        if(route==='/registration/child'){role('registration_agent');store.registration.addChild(uid,{...data,grade:Number(data.grade)});return redirect('/registration');}
        if(route==='/registration/status'){role('registration_agent');store.registration.setStatus(uid,data);return redirect('/registration');}
        if(!u)return redirect('/login');
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
