import {sectionIcon} from './section-icons.mjs';
import { randomUUID } from 'node:crypto';
import { subjects, grades, duration } from './store.mjs';
export const e = v => String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const aNum=n=>Number(n).toLocaleString('ar-SA');
const lng=k=>k==='ar'?'العربية':'الإنجليزية';
const fmt=(n,options)=>new Intl.DateTimeFormat('ar-SA-u-ca-gregory',{timeZone:'Asia/Riyadh',...options}).format(n);
const date=n=>fmt(n,{weekday:'long',day:'numeric',month:'long'});
const time=n=>fmt(n,{hour:'numeric',minute:'2-digit'});
const spanTime=(start,minutes)=>time(start)+' – '+time(start+minutes*60000);
const hidden=(k,v)=>`<input type="hidden" name="${k}" value="${e(v)}">`;
const btn=(label,cl='btn')=>`<button class="${cl}" type="submit">${label}</button>`;
const post=(url,content,cl='')=>`<form class="${cl}" method="post" action="${url}">${content}</form>`;
const link=(url,label,cl='btn')=>`<a class="${cl}" href="${e(url)}">${label}</a>`;
const empty=(title,body)=>`<div class="empty"><strong>${title}</strong><p>${body}</p></div>`;
const kicker=t=>`<div class="eyebrow"><i></i>${t}</div>`;
const heading=(over,title,desc='')=>`<div class="section-head">${kicker(over)}<h1>${title}</h1>${desc?'<p>'+desc+'</p>':''}</div>`;
const opt=(v,t)=>`<option value="${e(v)}">${e(t)}</option>`;
const field=(label,control)=>`<label>${label}${control}</label>`;
const input=(name,attrs)=>`<input name="${name}" ${attrs} required>`;
const steps=(current)=>`<ol class="steps">${['الطفل','المادة','المعلم والموعد','التأكيد'].map((x,i)=>`<li class="${i<=current?'on':''}"><b>${aNum(i+1)}</b> ${x}</li>`).join('')}</ol>`;
const role=u=>u.role==='registration_agent'?'وكيل التسجيل':u.role==='admin'?'الإدارة':u.role==='teacher'?'المعلم':'ولي الأمر';
export function page(title,body,u=null) {
  const nav=u?`${link('/app','لوحتي','navlink')} ${u.role==='admin'?link('/admin','الإدارة','navlink')+link('/admin/registration-agents','وكلاء التسجيل','navlink'):link('/bookings','الحجوزات','navlink')+(u.role==='teacher'?link('/teach/plans','الحصة الجماعية','navlink'):'')} ${post('/logout',btn('خروج','quiet'),'inline')}`:`${link('/lesson/teacher','مدخل المعلم','navlink')} ${link('/login','تسجيل الدخول','navlink')} ${link('/register','إنشاء حساب','small-btn')}`;
  const banner=u?.scope?`<aside class="demo"><div><strong>جولة توضيحية</strong> <span>· بيانات ومواعيد معزولة عن الحجوزات الفعلية</span></div>${u.role==='registration_agent'?'<span>جولة وكيل التسجيل</span>':u.role==='admin'?link('/admin','الجولة الإدارية','switch'):post('/tour/switch',btn(u.role==='parent'?'عرض حساب المعلم':'عرض حساب ولي الأمر','switch'),'inline')}</aside>`:'';
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#155c4d"><link rel="icon" href="/mark.svg"><link rel="manifest" href="/app.webmanifest"><link rel="apple-touch-icon" href="/icon-192.png"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/depth.css">${u?.role==='admin'?'<link rel="stylesheet" href="/admin.css">':''}<title>${e(title)} | احتراف التدريس</title></head><body><header><nav><a class="brand" href="${u?'/app':'/'}"><img alt="" src="/mark.svg"><span>احتراف التدريس<small>للتعليم الفردي</small></span></a><div class="nav-actions"><a class="navlink" href="/demo">أقسام التجربة</a>${nav}</div></nav></header><main>${banner}${body}</main><footer><div><b>احتراف التدريس</b> للتعليم الفردي</div><span>${u?'مساحة '+role(u):'المرحلة الابتدائية'} &nbsp;·&nbsp; بتوقيت الرياض</span></footer></body></html>`;
}
export function landing(){
  return `<section class="hero"><div class="hero-copy">${kicker('مساحة التعلّم الفردي')}<h1>حصة لطفلك،<br><em>بخطوة منك.</em></h1><p>اختر المادة والمعلم والموعد المناسب لطفلك، وتابع حجوزات أبنائك في مكان واحد.</p><div class="actions">${link('/register','ابدأ بحساب ولي أمر ←')}${post('/tour',btn('استكشف الجولة التوضيحية','outline'))}${link('/lesson','دخول الحصة','textlink')}</div><small>الصف الأول إلى السادس الابتدائي</small></div><figure><img src="/study.svg" alt="رسم لكتاب مفتوح وقلم"><figcaption><span class="dot"></span> حصص فردية عن بُعد</figcaption></figure></section>
  <section class="guide"><div class="section-head">${kicker('رحلة الأسرة')}<h2>من اختيار الطفل إلى تأكيد الموعد</h2></div><div class="cards">${[
    ['٠١','ملف لكل طفل','أضف الصف والمنهج ولغة التدريس ليظهر ما يناسب طفلك.'],
    ['٠٢','مواعيد من المعلم','اختر المادة واستعرض الفترات التي أتاحها المعلم بنفسه.'],
    ['٠٣','حجز واحد للطرفين','تابع الموعد وتعليمات الانضمام من حسابك بعد التأكيد.']
  ].map(([n,t,d])=>`<article class="guide-card"><b class="index">${n}</b><h3>${t}</h3><p>${d}</p></article>`).join('')}</div></section>`;
}
export function auth(kind,code='',error='',values={}) {
  const register=kind==='register',activate=kind==='activate';
  const title=register?'إنشاء حساب ولي أمر':activate?'تفعيل الحساب':'تسجيل الدخول';
  const fields=(register?field('اسم ولي الأمر',input('name','autocomplete="name" maxlength="60" value="'+e(values.name)+'"')):'')+
    (!activate?field('البريد الإلكتروني',input('email','type="email" dir="ltr" autocomplete="username" maxlength="180" value="'+e(values.email)+'"')):hidden('code',code))+
    field(register||activate?'كلمة المرور · ١٠ أحرف على الأقل':'كلمة المرور',input('password','type="password" maxlength="128" autocomplete="'+(kind==='login'?'current-password':'new-password')+'"'+(kind==='login'?'':' minlength="10"')));
  return `<section class="narrow auth-welcome">${sectionIcon('teacher')}<p class="welcome-greeting">أهلًا بك في احتراف التدريس</p>${heading('مساحة الحساب',title,activate?'اختر كلمة مرور لدخولك لاحقًا بالبريد المسجل في الدعوة.':'يمكنك العودة إلى حسابك بالبريد وكلمة المرور.')}<div class="panel">${error?'<p role="alert" class="error">'+e(error)+'</p>':''}${post('/'+kind,fields+btn(title),'form')}<div class="below">${link(register?'/login':'/register',register?'لدي حساب بالفعل':'إنشاء حساب ولي أمر','textlink')}</div></div></section>`;
}
const childInfo=c=>'الصف '+grades[c.grade]+' · المنهج السعودي · '+lng(c.language);
function bookingRow(b) {
  return `<a class="row" href="/booking/${b.id}"><div><span class="tag ${b.status==='confirmed'?'':'muted'}">${b.status==='confirmed'?'مؤكد':'ملغى'}</span> <strong>${e(subjects[b.subject])} · ${e(b.childName)}</strong><small>${e(b.teacherName)} · ${date(b.start)} · ${time(b.start)}</small></div><b class="arrow">←</b></a>`;
}
export function home(u,s) {
  const all=s.bookings(u.id);
  const upcoming=all.filter(b=>b.status==='confirmed'&&b.start>Date.now()).sort((a,b)=>a.start-b.start);
  const next=`<div class="sectitle"><h2>الحجز القادم</h2>${link('/bookings','كل الحجوزات ←','textlink')}</div>${upcoming.length?bookingRow(upcoming[0]):empty('لا يوجد حجز قادم',u.role==='parent'?'اختر طفلًا ثم مادة للعثور على الموعد المناسب.':'ستظهر هنا أول حصة تؤكدها الأسرة من مواعيدك.')}`;
  const top=sectionIcon(u.role)+link('/lesson','دخول الحصة','textlink')+heading('لوحة '+role(u),'أهلًا، '+e(u.name),u.role==='parent'?'ابدأ باختيار الطفل الذي تريد الحجز له.':'انشر مواعيدك وتابع الحجوزات المؤكدة للأسر.');
  if(u.role==='teacher') {
    const slots=s.schedule(u.id);
    return top+next+`<div class="sectitle"><h2>مواعيدي المتاحة والمحجوزة</h2>${link('/teacher/new','+ إضافة موعد')}</div>${slots.length?slots.map(v=>`<div class="row"><div><strong>${e(subjects[v.subject])} · ${date(v.start)}</strong><small>${spanTime(v.start,v.minutes)} · ${aNum(v.minutes)} دقيقة</small></div>${v.booked?'<span class="tag">محجوز</span>':post('/teacher/withdraw',hidden('id',v.id)+btn('سحب الموعد','quiet'))}</div>`).join(''):empty('لم تُضف أي مواعيد','حدّد مادة ووقتًا قبل فتح حجزك الأول.')}`;
  }
  const children=s.children(u.id);
  return top+`<div class="sectitle"><h2>أبنائي <span class="count">${aNum(children.length)}</span></h2>${link('/child/new','+ إضافة طفل','small-btn')}</div>${children.length?'<div class="cards children">'+children.map(c=>`<article class="child-card"><span class="avatar">${e(c.name[0])}</span><h3>${e(c.name)}</h3><p>${childInfo(c)}</p>${link('/subjects?child='+c.id,'عرض المواد ←','textlink')}${link('/progress?child='+c.id,'نتائج الحصص ←','textlink')}</article>`).join('')+'</div>':empty('أضف طفلك الأول','لكل طفل ملف مستقل يحدد المواد المناسبة ومدة الحصة.')}`+next;
}
export function childForm(){
  return steps(0)+`<section class="narrow">${heading('ملف تعليمي جديد','إضافة طفل','أدخل البيانات التعليمية التي يحتاجها المعلم لمطابقة الحصة.')}<div class="panel">${post('/child',field('اسم الطفل',input('name','maxlength="40"'))+field('الصف الدراسي','<select name="grade" required><option value="">اختر الصف</option>'+grades.slice(1).map((g,i)=>opt(i+1,'الصف '+g)).join('')+'</select>')+field('المنهج','<select name="curriculum">'+opt('sa','المنهج السعودي')+'</select>')+field('لغة التدريس','<select name="language">'+opt('ar','العربية')+opt('en','الإنجليزية')+'</select>')+btn('حفظ وعرض المواد ←'),'form')}</div></section>`;
}
export function catalog(c,s,uid) {
  return steps(1)+heading('مواد الطفل','مواد '+e(c.name),childInfo(c)+' · '+aNum(duration(c.grade))+' دقيقة للحصة')+`<div class="cards">${Object.entries(subjects).map(([k,v])=>{
    const n=s.offers(uid,c.id,k).length;
    return `<a class="subject-card" href="/offers?child=${c.id}&amp;subject=${k}"><span class="subject-icon">${({math:'∑',arabic:'ض',science:'◈',english:'Aa',islamic:'۞'})[k]}</span><h3>${v}</h3><p>${n?'المواعيد المتاحة · '+aNum(n):'لا توجد مواعيد متاحة حاليًا'}</p><span class="textlink">عرض المعلمين والمواعيد ←</span></a>`}).join('')}</div>`;
}
export function teacherList(c,subject,rows) {
  const grouped=Map.groupBy(rows,r=>r.teacher);
  return steps(2)+heading('المعلم والموعد',e(subjects[subject])+' مع معلم مناسب',e(c.name)+' · '+childInfo(c)+' · جميع الأوقات بتوقيت الرياض')+
    (rows.length?[...grouped.values()].map(list=>`<section class="panel teacher"><div class="teacher-title"><div class="avatar">${e(list[0].teacherName[0])}</div><div><h2>${e(list[0].teacherName)}</h2><p>معلم معتمد لهذه المادة والصف ولغة التدريس</p></div></div><div class="slotgrid">${list.map(o=>link('/review?child='+c.id+'&slot='+o.id+'&subject='+subject,'<strong>'+date(o.start)+'</strong><small>'+spanTime(o.start,o.minutes)+'</small>','slot')).join('')}</div></section>`).join(''):empty('لا توجد مواعيد مطابقة حاليًا','يمكنك اختيار مادة أخرى أو العودة عند فتح المعلم مواعيد جديدة.'))+
    link('/subjects?child='+c.id,'العودة إلى المواد','textlink back');
}
export function review(c,offer) {
  return steps(3)+`<section class="narrow">${heading('الخطوة الأخيرة','مراجعة الحجز','لن يُحجز الموعد إلا بعد الضغط على زر التأكيد.')}<div class="panel">${details([['الطفل',c.name+' · الصف '+grades[c.grade]],['المادة والمعلم',subjects[offer.subject]+' · '+offer.teacherName],['الموعد',date(offer.start)+' · '+spanTime(offer.start,offer.minutes)],['المدة',aNum(offer.minutes)+' دقيقة · بتوقيت الرياض'],['التحصيل','دون رسوم أو خصم رصيد']])}${post('/book',hidden('child',c.id)+hidden('slot',offer.id)+hidden('subject',offer.subject)+hidden('key',randomUUID())+btn('تأكيد الموعد التجريبي'),'form')}${link('/offers?child='+c.id+'&subject='+offer.subject,'تغيير الموعد','textlink back')}</div></section>`;
}
function details(entries){return '<dl>'+entries.map(([l,v])=>`<div><dt>${e(l)}</dt><dd>${e(v)}</dd></div>`).join('')+'</dl>';}
export function bookingsList(rows){return heading('سجل المواعيد','الحجوزات')+(rows.length?rows.map(bookingRow).join(''):empty('لا توجد حجوزات بعد','يمكنك بدء الرحلة من لوحتك.'))+link('/app','العودة إلى لوحتي','textlink back');}
export function booking(b) {
  const active=b.status==='confirmed';
  return `<section class="narrow">${heading('تفاصيل الحصة',active?'الموعد مؤكد':'أُلغي الموعد','مرجع الحجز '+e(b.id.slice(0,8).toUpperCase()))}<div class="panel">${details([['الطفل',b.childName+' · الصف '+grades[b.grade]],['المادة والمعلم',subjects[b.subject]+' · '+b.teacherName],['الموعد',date(b.start)+' · '+spanTime(b.start,b.minutes)+' بتوقيت الرياض'],['مدة الحصة',aNum(b.minutes)+' دقيقة'],...(active?[['تعليمات الانضمام',b.instructions]]:[['ألغاه',b.cancelled_by==='teacher'?'المعلم':'ولي الأمر']])])}${active&&Date.now()<b.start+b.minutes*60000?`<div class="below"><p>يفتح الفصل قبل الموعد بعشر دقائق وحتى نهاية الحصة.</p>${link('/lesson/'+b.id,'دخول الحصة')}</div>`:''}${active&&b.start>Date.now()?link('/cancel?id='+b.id,'إلغاء هذا الحجز','danger'):''}${link('/app','العودة إلى لوحتي','textlink back')}</div></section>`;
}
export function cancelPrompt(b){
  return `<section class="narrow">${heading('إلغاء موعد','هل تريد إلغاء الحجز؟',e(subjects[b.subject])+' · '+e(b.childName)+' · '+date(b.start)+' · '+time(b.start))}<div class="panel">${post('/cancel',hidden('id',b.id)+btn('نعم، إلغاء الحجز','danger'),'form')}${link('/booking/'+b.id,'الاحتفاظ بالحجز','textlink back')}</div></section>`;
}
export function slotForm(u){
  return `<section class="narrow">${heading('جدول المعلم','إتاحة موعد للحجز','عند نشر هذا الموعد تستطيع أسرة مطابقة لشروط اعتمادك تأكيده مباشرة.')}<div class="panel">${post('/teacher/slots',field('المادة','<select name="subject">'+u.subjects.map(k=>opt(k,subjects[k])).join('')+'</select>')+field('التاريخ والوقت بتوقيت الرياض',input('start','type="datetime-local"'))+field('المدة','<select name="minutes">'+[...new Set(u.grades.map(duration))].map(n=>opt(n,aNum(n)+' دقيقة')).join('')+'</select>')+field('ملاحظات للأسرة (اختياري)','<textarea name="instructions" maxlength="350" placeholder="مثل تجهيز كتاب الرياضيات قبل دخول الفصل."></textarea>')+btn('نشر الموعد للحجز'),'form')}</div></section>`;
}
export function errorPage(message,back='/app'){
  return `<section class="narrow">${heading('مراجعة الطلب','تعذّر إكمال الخطوة',e(message))}${link(back,'العودة والمتابعة')}</section>`;
}
