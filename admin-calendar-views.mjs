import {schoolLevelLabel} from './school-catalog.mjs';
import {randomUUID} from 'node:crypto';
import {e} from './views.mjs';
import {adminShell} from './admin-views.mjs';
const base='/admin/school/calendar';
const can=(p,key)=>p.permissions.includes(key);
const hidden=(name,value)=>`<input type="hidden" name="${e(name)}" value="${e(value)}">`;
const field=(label,control)=>`<label class="adm-field">${e(label)}${control}</label>`;
const input=(name,label,attrs='')=>field(label,`<input name="${e(name)}" ${attrs}>`);
const select=(name,label,rows,value='',required=true)=>field(label,`<select name="${e(name)}"${required?' required':''}><option value="">اختر ${e(label)}</option>${rows.map(x=>`<option value="${e(x.id)}"${x.id===value?' selected':''}>${e(x.name)}</option>`).join('')}</select>`);
const button=title=>`<button class="btn" type="submit">${e(title)}</button>`;
const form=(path,body)=>`<form method="post" action="${base}/${path}" class="adm-form">${hidden('request',randomUUID())}${body}</form>`;
const note=s=>`<p class="adm-note">${e(s)}</p>`;
const panel=(title,body)=>`<section class="adm-panel"><div class="adm-panel-head"><h2>${e(title)}</h2></div>${body}</section>`;
const row=(title,body='')=>`<article class="adm-record"><div class="adm-record-main"><h3>${e(title)}</h3>${body}</div></article>`;
const records=rows=>rows.length?`<div class="adm-records">${rows.join('')}</div>`:note('لا توجد سجلات بعد.');
const active=x=>x.state==='active';
const days=['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const time=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
export function adminCalendar(p,d,catalog,hierarchy,{classId='',yearId='',termId='',error=''}={}){
 const cls=catalog.classes.find(x=>x.id===classId),year=d.years.find(x=>x.id===yearId),term=d.terms.find(x=>x.id===termId&&x.yearId===yearId);
 const ctx=hidden('classId',classId)+hidden('yearId',yearId)+hidden('termId',termId);
 const name=(rows,id,f='name')=>rows.find(x=>x.id===id)?.[f]||'غير متاح';
 const subject=id=>name(catalog.subjects,id),teacher=id=>name(catalog.teachers,id),student=r=>name(catalog.students,r.studentId||r.schoolStudentId||r.childId);
 const archive=(kind,r)=>form('archive',ctx+hidden('kind',kind)+hidden('id',r.id)+hidden('revision',r.revision)+button('أرشفة مع حفظ التاريخ'));
 const classRows=catalog.classes.map(x=>({id:x.id,name:hierarchy.grades.find(g=>g.id===x.gradeId)?.trackName+' · '+schoolLevelLabel(x.stage,x.grade)+' · '+x.name}));
 let body=(error?note(error):'')+note('المسار ← المرحلة ← الصف ← الفصل ← مواد الفصل. المعلم يتبع تكليف المادة والحصة، والطالب يتبع تسجيله السنوي للفصل. لا يوجد إسناد مستقل للطالب إلى المعلم.');
 body+='<div id="student-registration"></div>';
 body+=panel('السياق الدراسي',`<form method="get" action="${base}" class="adm-form">${select('classId','الفصل',classRows,classId,false)}${select('yearId','العام الدراسي',d.years,yearId,false)}${select('termId','الفصل الدراسي',d.terms.filter(x=>!yearId||x.yearId===yearId),termId,false)}${button('عرض الإسنادات والجدول')}</form><p><a href="/admin/school">إدارة المسارات والصفوف والفصول والسعة</a> · <a href="/admin/school/academics${classId?'?classId='+e(classId):''}">إدارة المواد والدروس واعتمادات المعلمين</a></p>`);
 const dates=input('startDate','تاريخ البداية','type="date" required')+input('endDate','تاريخ النهاية','type="date" required');
 body+=panel('الأعوام والفصول الدراسية',(can(p,'school.structure')?form('years',ctx+input('name','اسم العام','required maxlength="100"')+dates+button('إنشاء العام الدراسي')):'')+records(d.years.map(x=>row(x.name,note(x.startDate+' إلى '+x.endDate+' · '+x.state)+(active(x)&&can(p,'school.structure')?archive('year',x):''))))+(year&&active(year)&&can(p,'school.structure')?form('terms',ctx+input('name','اسم الفصل الدراسي','required maxlength="100"')+dates+button('إنشاء الفصل الدراسي')):'')+records(d.terms.filter(x=>!yearId||x.yearId===yearId).map(x=>row(x.name,note(x.startDate+' إلى '+x.endDate+' · '+x.state)+(active(x)&&can(p,'school.structure')?archive('term',x):'')))));
 body+=panel('المناهج والدروس القابلة لإعادة الاستخدام',(can(p,'education.write')?form('curricula',ctx+select('subjectId','المادة',catalog.subjects.filter(x=>x.active))+input('name','اسم المنهج','required maxlength="100"')+button('إضافة المنهج')):'')+records(d.curricula.map(x=>row(subject(x.subjectId)+' · '+x.name,note(x.state)+(active(x)&&can(p,'education.write')?form('curriculum-lessons',ctx+hidden('curriculumId',x.id)+select('lessonId','درس المادة',catalog.lessons.filter(l=>l.active&&l.subjectId===x.subjectId).map(l=>({id:l.id,name:l.title})))+button('ربط الدرس بالمنهج')):'')+records(d.curriculumLessons.filter(l=>l.curriculumId===x.id).map(l=>row(name(catalog.lessons,l.lessonId,'title'))))+(active(x)&&can(p,'education.write')?archive('curriculum',x):'')))));
 if(cls&&year){
  if(can(p,'school.students')&&active(year)&&cls.state==='active')body+=panel('تسجيل طالب جديد في الفصل',form('students',ctx+input('name','اسم الطالب','required maxlength="40"')+select('parentId','ولي الأمر',hierarchy.parents||[])+button('تسجيل الطالب وإضافته للفصل')));
  const enrolled=d.enrollments.filter(x=>x.classId===classId&&x.yearId===yearId),memberIds=new Set(d.enrollments.filter(x=>x.yearId===yearId&&active(x)).map(x=>x.studentId||x.schoolStudentId||x.childId));
  const choices=catalog.students.filter(x=>x.gradeId===cls.gradeId&&x.status==='active'&&!memberIds.has(x.id)).map(x=>({id:x.profileType+':'+x.id,name:x.name}));
  body+=panel('تسجيل الطلاب في الفصل والعام',note('السعة: '+(cls.capacity??'غير محددة')+' · المسجلون النشطون هذا العام: '+enrolled.filter(active).length+' · غير الملحقين بهذا العام: '+choices.length)+(can(p,'school.students')&&active(year)&&cls.state==='active'?form('enrollments',ctx+select('student','الطالب غير الملحق',choices)+button('تسجيل الطالب في الفصل والعام')):'')+records(enrolled.map(x=>row(student(x),note(x.state)+(active(x)&&can(p,'school.students')?archive('enrollment',x):'')))));
 }
 if(cls&&term&&year){
  const assignments=d.teacherAssignments.filter(x=>x.classId===classId&&x.termId===termId),classSubjects=catalog.classSubjects.filter(x=>x.classId===classId),subjects=new Set(classSubjects.map(x=>x.subjectId));
  const choices=catalog.coverage.filter(x=>x.gradeId===cls.gradeId&&subjects.has(x.subjectId)&&catalog.teachers.some(t=>t.id===x.teacherId&&t.status==='active')).flatMap(c=>d.curricula.filter(x=>active(x)&&x.subjectId===c.subjectId).map(x=>({id:c.id+':'+x.id,name:subject(c.subjectId)+' · '+teacher(c.teacherId)+' · '+x.name})));
  body+=panel('تكليف المعلمين بالفصل والمادة',note('يمكن تكليف أكثر من معلم بالمادة. لكل حصة معلم محدد من هذه التكليفات. لا تُستنتج السنة من سجلات قديمة غير مؤرخة.')+(can(p,'school.teachers')&&active(term)&&active(year)&&cls.state==='active'?form('assignments',ctx+select('coverageCurriculum','المعلم والمادة والمنهج',choices)+button('إضافة تكليف لهذا الفصل الدراسي')):'')+records(assignments.map(x=>row(subject(x.subjectId)+' · '+teacher(x.teacherId),note(name(d.curricula,x.curriculumId)+' · '+x.state)+(active(x)&&can(p,'school.teachers')?archive('assignment',x):'')))));
  const periods=d.periods.filter(x=>x.classId===classId&&x.termId===termId).sort((a,b)=>a.weekday-b.weekday||a.startMinute-b.startMinute);
  body+=panel('جدول الحصص الأسبوعي',note('الأوقات بتوقيت الرياض. لا يسمح بأي تداخل للمعلم أو الفصل، حتى لو كانت المادة والدرس متطابقين. اختيار الدرس من المعلم لاحقاً ولا يغيّر الموعد.')+(can(p,'education.write')&&active(term)&&active(year)&&cls.state==='active'?form('periods',ctx+select('assignmentId','تكليف المعلم',assignments.filter(active).map(x=>({id:x.id,name:subject(x.subjectId)+' · '+teacher(x.teacherId)})))+select('weekday','اليوم',days.map((name,id)=>({id:String(id),name})))+input('starts','وقت البداية','type="time" required')+input('ends','وقت النهاية','type="time" required')+input('periodOrder','ترتيب الحصة','type="number" min="1" max="20" step="1" required')+button('اعتماد الحصة الأسبوعية')):'')+records(periods.map(x=>row(days[x.weekday]+' · الحصة '+x.periodOrder+' · '+subject(x.subjectId),note(time(x.startMinute)+' إلى '+time(x.endMinute)+' · '+teacher(x.teacherId)+' · '+x.state)+(active(x)&&can(p,'education.write')?archive('period',x):'')))));
  const periodIds=new Set(periods.map(x=>x.id));body+=panel('سجل تنفيذ الدروس',note('ينشئ المعلم سجل اختيار الدرس للحصة المسندة من خدمة الربط. لا ينشئ ذلك غرفة أو حضوراً وهمياً.')+records(d.sessions.filter(x=>periodIds.has(x.periodId)).map(x=>row(x.date||x.occurrenceDate,note(name(catalog.lessons,x.lessonId,'title')+' · '+x.state)))));
 }
 body+=note('السجلات القديمة غير المرتبطة بعام أو فصل دراسي محفوظة للتاريخ، ولا تُعتمد تلقائياً في خدمات دخول المعلم والطالب.');
 return adminShell(p,'school','الأعوام والإسنادات والجدول','إدارة الهيكل الدراسي والتكليفات من قاعدة البيانات.',body);
}
