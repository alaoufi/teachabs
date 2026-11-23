import {randomUUID} from 'node:crypto';
import {e} from './views.mjs';
import {adminShell} from './admin-views.mjs';
import {schoolLevelLabel} from './school-catalog.mjs';
const base='/admin/school/academics';
const can=(p,key)=>p.adminRole==='supervisor'||p.permissions.includes(key);
const hidden=(name,value)=>`<input type="hidden" name="${e(name)}" value="${e(value)}">`;
const request=()=>hidden('request',randomUUID());
const field=(label,control)=>`<label class="adm-field">${e(label)}${control}</label>`;
const input=(name,attrs='')=>`<input name="${e(name)}" ${attrs}>`;
const select=(name,rows,label,selected='')=>field(label,`<select name="${e(name)}" required><option value="">اختر ${e(label)}</option>${rows.map(([id,text])=>`<option value="${e(id)}"${id===selected?' selected':''}>${e(text)}</option>`).join('')}</select>`);
const button=title=>`<button class="btn" type="submit">${e(title)}</button>`;
const form=(path,body)=>`<form method="post" action="${base}/${path}" class="adm-form">${body}</form>`;
const panel=(title,body)=>`<section class="adm-panel"><div class="adm-panel-head"><h2>${e(title)}</h2></div>${body}</section>`;
const note=text=>`<p class="adm-note">${e(text)}</p>`;
const records=items=>items.length?`<div class="adm-records">${items.join('')}</div>`:note('لا توجد سجلات بعد.');
const row=(title,body='')=>`<article class="adm-record"><div class="adm-record-main"><h3>${e(title)}</h3>${body}</div></article>`;
const date=n=>new Intl.DateTimeFormat('ar-SA-u-ca-gregory',{timeZone:'Asia/Riyadh',dateStyle:'medium',timeStyle:'short'}).format(n);
export function adminAcademics(p,d,hierarchy,{classId='',error=''}={}){
 const c=d.classes.find(x=>x.id===classId),ctx=c?hidden('classId',c.id):'',subjectName=id=>d.subjects.find(x=>x.id===id)?.name||'مادة',teacherName=id=>d.teachers.find(x=>x.id===id)?.name||'المعلم المسند',lessonName=id=>d.lessons.find(x=>x.id===id)?.title||'درس',studentName=id=>d.students.find(x=>x.id===id)?.name||'طالب';
 const gradeLabel=id=>{const g=hierarchy.grades.find(x=>x.id===id);return g?g.trackName+' · '+schoolLevelLabel(g.stage,g.grade):'صف غير متاح';};
 const classLabel=x=>gradeLabel(x.gradeId)+' · فصل '+x.name;
 const activeSubjects=d.subjects.filter(x=>x.active),activeTeachers=d.teachers.filter(x=>x.status==='active');
 const remove=()=>'';
 const catalog=can(p,'school.structure')?`<details class="adm-disclosure"><summary>إدارة قائمة المواد</summary>${form('subjects',ctx+request()+field('اسم المادة',input('name','required maxlength="100"'))+button('إنشاء المادة'))}${records(d.subjects.map(s=>row(s.name,form('subjects/update',ctx+hidden('id',s.id)+hidden('revision',s.revision)+field('اسم المادة',input('name',`required maxlength="100" value="${e(s.name)}"`))+field('الحالة',`<select name="active"><option value="1"${s.active?' selected':''}>متاحة</option><option value="0"${s.active?'':' selected'}>موقوفة</option></select>`)+button('حفظ المادة')))))}</details>`:'';
 const teacherCreate=can(p,'education.write')?`<p><a class="btn" href="/admin/education/teachers/new">تسجيل المعلم</a></p>`:'';
 const chooser=`<form method="get" action="${base}" class="adm-form">${select('classId',d.classes.map(x=>[x.id,classLabel(x)+(x.state==='archived'?' · مؤرشف':'')]),'الفصل',classId)}${button('فتح مواد الفصل وجدوله')}</form><p><a href="/admin/school" class="textlink">إنشاء المسارات والصفوف والفصول أو تعديل السعة ←</a></p>`;
 let content='';
 if(c){
  const classSubjects=d.classSubjects.filter(x=>x.classId===c.id),subjectIds=new Set(classSubjects.map(x=>x.subjectId)),assignments=d.teacherAssignments.filter(x=>x.classId===c.id),enrollments=d.enrollments.filter(x=>x.classId===c.id),enrolledIds=new Set(enrollments.map(x=>x.studentId)),active=c.state==='active';
  content+=panel(classLabel(c),note('السعة: '+(c.capacity??'غير محددة')+' · الطلاب: '+c.studentCount+' · الحالة: '+(active?'نشط':'مؤرشف'))+note('الحصة تتبع الفصل والدرس؛ معلمها من إسناد مادة الفصل، وطلابها من عضوية الفصل. هذا إعداد إداري ولا يفتح غرفة افتراضية.'));
  const subjectAdd=active&&can(p,'school.structure')?form('class-subjects',ctx+select('subjectId',activeSubjects.filter(x=>!subjectIds.has(x.id)).map(x=>[x.id,x.name]),'مادة الفصل')+button('إضافة المادة للفصل')):'';
  const subjectRows=classSubjects.map(link=>{const s=d.subjects.find(x=>x.id===link.subjectId);const lessons=d.lessons.filter(x=>x.subjectId===link.subjectId);const create=active&&can(p,'education.write')?form('lessons',ctx+hidden('subjectId',link.subjectId)+request()+field('عنوان الدرس',input('title','required maxlength="160"'))+button('إضافة درس للمادة')):'';return row(s?.name||'مادة',`<details><summary>دروس المادة (${lessons.length})</summary>${create}${records(lessons.map(l=>row(l.title,can(p,'education.write')?form('lessons/update',ctx+hidden('id',l.id)+hidden('revision',l.revision)+field('عنوان الدرس',input('title',`required maxlength="160" value="${e(l.title)}"`))+field('الحالة',`<select name="active"><option value="1"${l.active?' selected':''}>متاح</option><option value="0"${l.active?'':' selected'}>موقوف</option></select>`)+button('حفظ الدرس')):note(l.active?'متاح':'موقوف'))))}</details>${can(p,'school.structure')?remove('classSubject',link.id):''}`);});
  content+=panel('مواد الفصل ودروسها',note('المادة والدروس لها مراجع ثابتة؛ يمكن إتاحة المادة نفسها لأكثر من فصل. إزالتها من فصل لا تحذف محتواها من الفصول الأخرى.')+subjectAdd+records(subjectRows));
  if(can(p,'school.teachers')){
   const coverage=d.coverage.filter(x=>x.gradeId===c.gradeId),coverageCreate=active?form('coverage',ctx+hidden('gradeId',c.gradeId)+select('teacherId',activeTeachers.map(x=>[x.id,x.name]),'المعلم')+select('subjectId',activeSubjects.filter(x=>subjectIds.has(x.id)).map(x=>[x.id,x.name]),'المادة')+button('اعتماد المعلم للصف والمادة')):'';
   content+=panel('اعتماد المعلم للصف والمادة',coverageCreate+records(coverage.map(x=>row(teacherName(x.teacherId)+' · '+subjectName(x.subjectId),note('اعتماد لهذا الصف والمسار')))));
  }
  content+=panel('التسجيل السنوي وتكليفات التدريس والجدول',note('تُدار الإسنادات بحسب العام والفصل الدراسي. لا ينشأ إسناد مستقل للطالب إلى المعلم.')+`<a class="btn" href="/admin/school/calendar?classId=${e(c.id)}">فتح الأعوام والإسنادات وجدول الحصص الأسبوعي</a>`);
 }else content=note('اختر الفصل لإدارة مواده ودروسه، وإسناد المعلمين والطلاب، ثم إنشاء جدوله.');
 return adminShell(p,'school','المواد والدروس والجدول','من الفصل إلى المادة والدرس، بمراجع قابلة لإعادة الاستخدام.',(error?note(error):'')+note('المسار ← المرحلة ← الصف ← الفصل ← المادة ← الدرس. المعلم مرتبط بتدريس مادة الفصل، والطالب بعضوية الفصل.')+panel('الفصل الذي تريد إدارته',chooser)+catalog+teacherCreate+content);
}
