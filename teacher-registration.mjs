import {SCHOOL_LEVELS} from './school-catalog.mjs';
export const TEACHER_LIMITS=Object.freeze({legalName:120,commonName:60,specialization:160,qualification:160,university:180,maxWeeklyClasses:100});
const scalarKeys=['legalName','commonName','phone','specialization','qualification','university','maxWeeklyClasses','request'];
const validLevels=new Set(SCHOOL_LEVELS.map(l=>l.key));
export const teacherRequestKey=value=>typeof value==='string'&&/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(value);
export function teacherRegistrationFields(data,UserError=Error){
 const allowed=new Set([...scalarKeys,'subjectsText']);
 const levels=[];
 for(const [key,value] of Object.entries(data)){
  if(key.startsWith('teacher_level_')){const level=key.slice(14);if(!validLevels.has(level)||value!=='1')throw new UserError('راجع الصفوف المختارة.',400);levels.push(level);}
  else if(!allowed.has(key))throw new UserError('حقل غير مسموح في تسجيل المعلم.',400);
 }
 return {...Object.fromEntries(scalarKeys.map(k=>[k,data[k]])),subjects:String(data.subjectsText??'').split(/[,،\n]/).map(s=>s.trim()).filter(Boolean),levels};
}
export function normalizeTeacherRegistration(values,UserError=Error){
 const fail=message=>{throw new UserError(message,400);};
 if(!values||typeof values!=='object'||Array.isArray(values))fail('راجع بيانات المعلم.');
 const allowed=new Set([...scalarKeys,'subjects','levels']);
 if(Object.keys(values).some(k=>!allowed.has(k)))fail('حقل غير مسموح في تسجيل المعلم.');
 const out={};
 for(const key of ['legalName','commonName','specialization','qualification','university']){
  const value=values[key];if(typeof value!=='string'||!value.trim()||value.trim().length>TEACHER_LIMITS[key]||/[\u0000-\u001f\u007f]/.test(value))fail('أكمل بيانات المعلم المطلوبة بالنصوص المحددة.');out[key]=value.trim();
 }
 if(typeof values.phone!=='string'||values.phone.length>40)fail('أدخل رقم جوال صحيحًا.');
 out.phone=values.phone.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[ ()-]/g,'');
 if(!/^\+?\d{7,15}$/.test(out.phone))fail('أدخل رقم جوال صحيحًا من ٧ إلى ١٥ رقمًا.');
 if(!Array.isArray(values.subjects)||!values.subjects.length||values.subjects.length>40||values.subjects.some(s=>typeof s!=='string'||!s.trim()||s.trim().length>100||/[\u0000-\u001f\u007f]/.test(s)))fail('أدخل مادة واحدة على الأقل، وافصل المواد بفاصلة.');
 out.subjects=[...new Set(values.subjects.map(s=>s.trim()))];
 if(!Array.isArray(values.levels)||!values.levels.length||values.levels.length>12||values.levels.some(l=>!validLevels.has(l)))fail('اختر صفًا واحدًا على الأقل من الصفوف المتاحة.');
 out.levels=[...new Set(values.levels)];
 const max=values.maxWeeklyClasses;
 out.maxWeeklyClasses=typeof max==='string'&&/^\d{1,3}$/.test(max)?Number(max):max;
 if(!Number.isInteger(out.maxWeeklyClasses)||out.maxWeeklyClasses<1||out.maxWeeklyClasses>100)fail('عدد الحصص الأسبوعية يجب أن يكون عددًا صحيحًا من ١ إلى ١٠٠.');
 if(!teacherRequestKey(values.request))fail('حدّث نموذج التسجيل ثم أعد المحاولة.');out.request=values.request;
 return out;
}
export function assertSyntheticTeacher(scope,values,UserError=Error){
 if(!scope){if(/^0+$/.test(values.phone)||values.phone.startsWith('+')&&!/^\+[1-9]\d{7,14}$/.test(values.phone))throw new UserError('أدخل رقم جوال صحيحًا؛ الرقم الوهمي خاص بالمعاينة فقط.',400);return;}
 if(values.phone!=='0000000000'||![values.legalName,values.commonName].every(n=>/(تجريبي|تجريبية|synthetic|demo)/i.test(n)))throw new UserError('هذه تجربة مؤقتة: استخدم اسمًا يتضمن «تجريبي» والجوال 0000000000 فقط. لا تدخل بيانات حقيقية.',400);
}
