import {validateQualificationImage} from './teacher-images.mjs';
import {randomUUID} from 'node:crypto';
import {normalizeTeacherRegistration,assertSyntheticTeacher,teacherRequestKey} from './teacher-registration.mjs';
export function createTeacherProfiles({db,one,all,run,transaction,requireAccess,audit,UserError}){
 db.exec(`CREATE TABLE IF NOT EXISTS teacher_profiles(
 id TEXT PRIMARY KEY REFERENCES users(id),scope TEXT NOT NULL,legal_name TEXT NOT NULL,common_name TEXT NOT NULL,phone TEXT NOT NULL,specialization TEXT NOT NULL,qualification TEXT NOT NULL,university TEXT NOT NULL,teachable_subjects TEXT NOT NULL,teachable_levels TEXT NOT NULL,max_weekly_classes INTEGER NOT NULL CHECK(max_weekly_classes BETWEEN 1 AND 100),actor TEXT NOT NULL REFERENCES users(id),request TEXT NOT NULL,payload TEXT NOT NULL,created INTEGER NOT NULL,UNIQUE(actor,request));
 CREATE TABLE IF NOT EXISTS teacher_qualifications(id TEXT PRIMARY KEY,teacher_id TEXT NOT NULL REFERENCES teacher_profiles(id),scope TEXT NOT NULL,mime TEXT NOT NULL CHECK(mime IN('image/png','image/jpeg')),bytes BLOB NOT NULL,size INTEGER NOT NULL CHECK(size BETWEEN 1 AND 5242880),sha256 TEXT NOT NULL,actor TEXT NOT NULL REFERENCES users(id),request TEXT NOT NULL,created INTEGER NOT NULL,UNIQUE(actor,request));`);
 const check=(ok,message,status=400)=>{if(!ok)throw new UserError(message,status);};
 function get(a,id){const r=one('SELECT p.*,u.pass FROM teacher_profiles p JOIN users u ON u.id=p.id AND u.scope=p.scope AND u.role=\'teacher\' WHERE p.id=? AND p.scope=?',id,a.scope);check(r,'ملف المعلم غير متاح.',404);return r;}
 const view=r=>({id:r.id,name:r.common_name,legalName:r.legal_name,commonName:r.common_name,phone:r.phone,specialization:r.specialization,qualification:r.qualification,university:r.university,subjects:JSON.parse(r.teachable_subjects),levels:JSON.parse(r.teachable_levels),maxWeeklyClasses:r.max_weekly_classes,activated:!!r.pass,registered:true,created:r.created});
 function registerTeacher(actorId,values){return transaction(()=>{
  const a=requireAccess(actorId,'education.write'),v=normalizeTeacherRegistration(values,UserError);assertSyntheticTeacher(a.scope,v,UserError);
  const payload=JSON.stringify({...v,request:undefined}),old=one('SELECT id,payload FROM teacher_profiles WHERE actor=? AND request=? AND scope=?',a.id,v.request,a.scope);
  if(old){check(old.payload===payload,'تغير محتوى الطلب. افتح نموذجًا جديدًا.',409);return {id:old.id};}
  const id=randomUUID();
  run("INSERT INTO users(id,role,name,scope,subjects,grades,language) VALUES(?,'teacher',?,?,'[]','[]','ar')",id,v.commonName,a.scope);
  run('INSERT INTO teacher_profiles VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',id,a.scope,v.legalName,v.commonName,v.phone,v.specialization,v.qualification,v.university,JSON.stringify(v.subjects),JSON.stringify(v.levels),v.maxWeeklyClasses,a.id,v.request,payload,Date.now());
  audit(a,'teacher.registered',id,{});return {id};
 });}
 function teacherProfile(actorId,id){const a=requireAccess(actorId,'education.read'),r=get(a,id);return {...view(r),qualifications:all('SELECT id,mime,size,created FROM teacher_qualifications WHERE teacher_id=? AND scope=? ORDER BY created,id',id,a.scope)};}
 function listTeacherProfiles(actorId){const a=requireAccess(actorId,'education.read');return all("SELECT p.*,u.pass FROM teacher_profiles p JOIN users u ON u.id=p.id AND u.role='teacher' AND u.scope=p.scope WHERE p.scope=? ORDER BY p.common_name,p.id",a.scope).map(view);}
 async function addTeacherQualification(actorId,id,input){
  const before=requireAccess(actorId,'education.write');get(before,id);check(!before.scope,'لا يمكن رفع صور مؤهلات في المعاينة التجريبية.',403);check(input&&Object.keys(input).every(k=>['request','file'].includes(k))&&teacherRequestKey(input.request),'حدّث نموذج الصورة ثم أعد المحاولة.');
  const image=await validateQualificationImage(input.file,UserError);
  return transaction(()=>{const a=requireAccess(actorId,'education.write');get(a,id);check(!a.scope,'الرفع غير متاح في المعاينة.',403);
   const old=one('SELECT id,teacher_id,sha256 FROM teacher_qualifications WHERE actor=? AND request=? AND scope=?',a.id,input.request,a.scope);
   if(old){check(old.teacher_id===id&&old.sha256===image.sha256,'تغير محتوى طلب الصورة.',409);return {id:old.id};}
   check(!one('SELECT id FROM teacher_qualifications WHERE teacher_id=? AND sha256=?',id,image.sha256),'الصورة مسجلة بالفعل.',409);
   check(one('SELECT count(*) n FROM teacher_qualifications WHERE teacher_id=?',id).n<5,'الحد الأقصى خمس صور للمؤهلات.',409);
   const imageId=randomUUID();run('INSERT INTO teacher_qualifications VALUES(?,?,?,?,?,?,?,?,?,?)',imageId,id,a.scope,image.mime,image.bytes,image.size,image.sha256,a.id,input.request,Date.now());audit(a,'teacher.qualification_added',id,{imageId});return {id:imageId};
  });
 }
 function teacherQualification(actorId,id,imageId){const a=requireAccess(actorId,'education.read');get(a,id);const image=one('SELECT id,mime,bytes,size,sha256 FROM teacher_qualifications WHERE id=? AND teacher_id=? AND scope=?',imageId,id,a.scope);check(image,'الصورة غير متاحة.',404);return image;}
 function updateSpecialization(actorId,id,previous,value){return transaction(()=>{
  const a=requireAccess(actorId,'education.write'),teacher=get(a,id);
  const specialization=typeof value==='string'?value.trim():'';
  check(specialization.length>0&&specialization.length<=160,'أدخل تخصص المعلم حتى ١٦٠ حرفًا.');
  if(teacher.specialization===specialization)return;
  check(teacher.specialization===previous,'تغير تخصص المعلم. حدّث الصفحة قبل الحفظ.',409);
  run('UPDATE teacher_profiles SET specialization=? WHERE id=? AND scope=?',specialization,id,a.scope);
  audit(a,'teacher.specialization_updated',id,{});
 });}
 return {updateSpecialization,registerTeacher,teacherProfile,listTeacherProfiles,addTeacherQualification,teacherQualification};
}
