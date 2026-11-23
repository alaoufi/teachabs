import {randomUUID} from 'node:crypto';
import {e} from './views.mjs';
import {GUARDIAN_RELATIONSHIPS} from './registration-intake.mjs';
const hidden=(k,v)=>`<input type="hidden" name="${e(k)}" value="${e(v)}">`;
const field=(label,name,value='',extra='')=>`<label class="adm-field">${e(label)}<input name="${e(name)}" value="${e(value)}" ${extra}></label>`;
const phone=(label,name,value,required=false)=>field(label,name,value,`type="tel" inputmode="tel" dir="ltr" maxlength="40" autocomplete="off"${required?' required':''}`);
const choices=(rows,selected,empty)=>`<option value="">${e(empty)}</option>`+rows.map(r=>`<option value="${e(r.id)}"${r.id===selected?' selected':''}>${e(r.name)}</option>`).join('');
const status=text=>`<p class="adm-help">${e(text)}</p>`;
const panel=(title,content)=>`<section class="adm-panel"><h2>${e(title)}</h2>${content}</section>`;
const form=(path,content)=>`<form class="adm-form" method="post" action="${path}">${content}</form>`;
const button=label=>`<button class="btn" type="submit">${label}</button>`;
const actions=label=>`<div class="adm-actions">${button(label)}<a class="outline" href="/admin/registration">إلغاء وفتح نموذج جديد</a></div>`;
const number=n=>Number(n).toLocaleString('ar-SA');
export function registrationIntakePanel(profile,{parents=[],students=[],grades=[],subjects=[]},values={},error=''){
 const canWrite=profile.adminRole==='supervisor'||profile.permissions?.includes('registration.write');
 const selectedParent=parents.find(p=>p.id===values.parentId);
 const p=values.form==='parent'?values:{},s=values.form==='student'?values:{parentId:values.parentId||''};
 const warning=profile.scope?'<div class="adm-note adm-warning">معاينة ببيانات وهمية فقط. استخدم اسمًا يتضمن «تجريبي» والجوال 0000000000. لا تدخل بيانات شخصية حقيقية.</div>':'';
 const info='<div class="adm-note">سجل طلبات التسجيل للإدارة. لا يمنح التسجيل حساب دخول أو قبولًا في الحصص تلقائيًا. العدد الذي يذكره ولي الأمر مستقل عن عدد الأبناء المسجلين، ويمكن إكمال بياناتهم لاحقًا.</div>';
 const parentForm=panel('تسجيل ولي أمر',form('/admin/registration/parents',hidden('request',p.request||randomUUID())+'<div class="adm-form-grid">'+field('اسم ولي الأمر','name',p.name||'','required maxlength="60" autocomplete="off"')+phone('جوال ولي الأمر','mobile',p.mobile||'',true)+field('عدد الأبناء المؤهلين للحصص','eligibleChildrenCount',p.eligibleChildrenCount??'','type="number" min="0" max="50" step="1" required')+'</div>'+status('عدد يصرّح به ولي الأمر من ٠ إلى ٥٠. لا يلزم تسجيل جميع الأبناء الآن.')+actions('حفظ ولي الأمر')));
 const subjectsHtml=`<fieldset class="adm-permissions"><legend>المواد المطلوب الانضمام لها</legend><div class="adm-agent-capabilities">${subjects.map(row=>`<label class="adm-check"><input type="checkbox" name="subject_${e(row.id)}" value="1"${(s.requestedSubjects||[]).includes(row.id)?' checked':''}><span>${e(row.name)}${row.id.startsWith('legacy:')?' · مادة أساسية':''}</span></label>`).join('')}</div></fieldset>`;
 // Two independently validated modes avoid requiring a mobile for a parent's
 // child, while never silently making it optional for a standalone student.
 const parentChoice=`<form class="adm-form" method="get" action="/admin/registration"><label class="adm-field">تسجيل ابن أو ابنة لولي أمر مسجل<select name="parentId">${choices(parents,values.parentId,'طالب مستقل')}</select></label>${button('اختيار طريقة التسجيل')}</form>`;
 const guardianFields=selectedParent?hidden('parentId',selectedParent.id)+status('مرتبط بولي الأمر: '+selectedParent.name+' · '+selectedParent.mobile):phone('جوال ولي الأمر (اختياري)','guardianMobile',s.guardianMobile||'');
 const studentForm=panel(selectedParent?'تسجيل ابن أو ابنة: '+selectedParent.name:'تسجيل طالب / طالبة مستقل',parentChoice+(!grades.length?status('افتح الصفوف من قسم الصفوف أولًا لإتاحة تسجيل الطلاب.'):!subjects.length?status('أضف المواد من قسم المواد والمعلمين أولًا لإتاحة تسجيل الطلاب.'):
 form('/admin/registration/students',hidden('request',s.request||randomUUID())+guardianFields+'<div class="adm-form-grid">'+field('اسم الطالب / الطالبة','name',s.name||'','required maxlength="60" autocomplete="off"')+phone(selectedParent?'جوال الطالب (اختياري)':'جوال الطالب','studentMobile',s.studentMobile||'',!selectedParent)+`<label class="adm-field">صلة ولي الأمر بالطالب (اختياري)<select name="guardianRelationship">${choices(Object.entries(GUARDIAN_RELATIONSHIPS).map(([id,name])=>({id,name})),s.guardianRelationship,'غير محددة')}</select></label><label class="adm-field">الصف<select name="gradeId" required>${choices(grades,s.gradeId,'اختر المسار والمرحلة والصف')}</select></label></div>`+status(selectedParent?'يمكن إضافة الأبناء واحدًا بعد الآخر، ولا يلزم أن يطابق عددهم العدد المصرّح به.':'جوال الطالب مطلوب. جوال ولي الأمر وصلة قرابته اختياريان.')+subjectsHtml+actions('حفظ طلب تسجيل الطالب'))));
 const parentRows=parents.map(p=>`<article class="adm-panel"><h3>${e(p.name)}</h3><p><bdi>${e(p.mobile)}</bdi></p><p>الأبناء المؤهلون حسب التصريح: ${number(p.eligibleChildrenCount)} · الملفات المسجلة: ${number(p.registeredChildrenCount)}</p>${canWrite?`<a class="outline" href="/admin/registration?parentId=${encodeURIComponent(p.id)}#registration-students">إضافة ابن أو ابنة</a>`:''}</article>`).join('');
 const studentRows=students.map(s=>`<article class="adm-panel"><h3>${e(s.name)}</h3><p>${e(s.trackName)} · ${e(s.levelLabel)}</p><p>جوال الطالب: <bdi>${e(s.studentMobile||'غير مسجل')}</bdi></p><p>ولي الأمر: ${e(s.parentName||'غير مرتبط بسجل ولي أمر')} · <bdi>${e(s.guardianMobile||'غير مسجل')}</bdi>${s.guardianRelationship?' · '+e(GUARDIAN_RELATIONSHIPS[s.guardianRelationship]):''}</p><p>المواد المطلوبة: ${s.requestedSubjects.map(v=>e(v.name)).join('، ')}</p></article>`).join('');
 return `<section data-registration-intake>${warning}${info}${error?`<div class="adm-note adm-warning" role="alert">${e(error)} يمكنك تصحيح البيانات والمحاولة مجددًا.</div>`:''}${canWrite?parentForm+`<div id="registration-students">${studentForm}</div>`:''}${panel('أولياء الأمور المسجلون',parentRows||status('لا توجد طلبات تسجيل أولياء أمور بعد.'))}${panel('طلبات تسجيل الطلاب',studentRows||status('لا توجد طلبات تسجيل طلاب بعد.'))}</section>`;
}
