import {createSchoolIndividuals} from './school-individuals.mjs';
import {randomUUID} from 'node:crypto';
import {ensureSchoolSchema,ensureLegacySchoolTrack} from './school-schema.mjs';
import {SCHOOL_LEVELS,SCHOOL_TYPES,validSchoolLevel} from './school-catalog.mjs';
const validStudentId=value=>typeof value==='string'&&/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);
export const SCHOOL_PERMISSIONS={'school.individuals':'إسناد المعلمين للطلاب فرديًا أو جماعيًا','school.read':'عرض الصفوف والفصول','school.tracks':'إضافة المسارات التعليمية','school.capacity':'تعديل سعة الفصول','school.structure':'إنشاء الصفوف والفصول','school.lifecycle':'تعديل وأرشفة سجلات الفصول','school.teachers':'إسناد معلمي الفصول','school.students':'إسناد الطلاب للفصول','school.supervision':'إسناد المعلمين للمشرفين'};
export function createSchoolStore({db,one,all,run,transaction,requireAccess,audit,check,subjects}){
 ensureSchoolSchema({db,one,all,run,transaction});
 const {assertClassTeacherCompatible,assertStudentRemovable,assertStudentEnrollmentCompatible,...individuals}=createSchoolIndividuals({db,one,all,run,transaction,requireAccess,audit,check,subjects});
 const classSelect="SELECT c.*,g.grade,g.scope,g.stage,g.track_id,t.name trackName,t.education_type educationType,t.curriculum_name curriculumName,t.legacy legacyTrack,COALESCE(l.state,'active') state,COALESCE(l.revision,0) revision,k.capacity,(SELECT COUNT(*) FROM school_student_assignments x WHERE x.class_id=c.id) studentCount FROM school_classes c JOIN school_grades g ON g.id=c.grade_id JOIN school_tracks t ON t.id=g.track_id AND t.scope=g.scope LEFT JOIN school_class_lifecycle l ON l.class_id=c.id LEFT JOIN school_class_capacity k ON k.class_id=c.id";
 const classroom=(a,id)=>{const c=one(classSelect+' WHERE c.id=? AND g.scope=?',id,a.scope);check(c,'الفصل غير متاح.',404);return c;};
 const validCapacity=value=>Number.isSafeInteger(value)&&value>=1;
 const track=(a,id)=>{const row=one('SELECT * FROM school_tracks WHERE id=? AND scope=?',id,a.scope);check(row,'المسار غير متاح.',404);return row;};
 const legacyTrack=a=>{
  const existing=one('SELECT * FROM school_tracks WHERE scope=? AND legacy=1',a.scope);if(existing)return existing;
  requireAccess(a.id,'school.tracks');
  const row=ensureLegacySchoolTrack({one,run},a.scope);
  audit(a,'school.track.initialized',row.id,{source:'current-registration',stage:'primary',educationType:'unspecified',curriculumName:''});return row;
 };
 const eligible=c=>c.stage==='primary'&&c.legacyTrack===1;
 const requireCompatible=c=>check(eligible(c),'هذا المسار أو المرحلة يحتاج ربطًا صريحًا بملفات التسجيل وتخصصات المعلمين قبل الإسناد. لا يُعتد برقم الصف وحده.',409);
 const createGrade=(a,{grade,stage='primary',trackId},duplicateIsError=true)=>{
  check(validSchoolLevel(stage,grade),'اختر صفًا ثابتًا ضمن الابتدائي ١–٦ أو المتوسط ١–٣ أو الثانوي ١–٣.');
  check(trackId===undefined||(typeof trackId==='string'&&trackId.length>0),'اختر مسارًا صحيحًا.');
  const path=trackId?track(a,trackId):legacyTrack(a),existing=one('SELECT id FROM school_grades WHERE scope=? AND track_id=? AND stage=? AND grade=?',a.scope,path.id,stage,grade);
  if(existing){check(!duplicateIsError,'الصف مفتوح بالفعل.',409);return existing.id;}
  const id=randomUUID();run('INSERT INTO school_grades(id,scope,track_id,stage,grade) VALUES(?,?,?,?,?)',id,a.scope,path.id,stage,grade);audit(a,'school.grade.created',id,{trackId:path.id,stage,grade});return id;
 };
 const teacher=(a,id)=>{const t=one("SELECT u.* FROM users u LEFT JOIN account_status s ON s.user=u.id WHERE u.id=? AND u.scope=? AND u.role='teacher' AND COALESCE(s.status,'active')='active'",id,a.scope);check(t,'المعلم غير متاح.',404);return t;};
 const write=(actor,permission,fn)=>transaction(()=>{const a=requireAccess(actor,permission);return fn(a);});
 function school(actor){const a=requireAccess(actor,'school.read'),has=p=>a.permissions.includes(p);return {
  levels:SCHOOL_LEVELS,
  tracks:all('SELECT * FROM school_tracks WHERE scope=? ORDER BY legacy DESC,name,education_type',a.scope),
  grades:all('SELECT g.*,t.name trackName FROM school_grades g JOIN school_tracks t ON t.id=g.track_id AND t.scope=g.scope WHERE g.scope=? ORDER BY t.name,g.stage,g.grade',a.scope),
  classes:all(classSelect+' WHERE g.scope=? ORDER BY t.name,g.stage,g.grade,c.name',a.scope).map(c=>({...c,assignmentSupported:eligible(c),seatsAvailable:c.capacity===null?null:c.capacity-c.studentCount})),
  teachers:has('school.teachers')||has('school.supervision')?all("SELECT id,name FROM users WHERE scope=? AND role='teacher' ORDER BY name",a.scope):[],
  students:has('school.students')?all("SELECT c.id,c.name,c.grade,COALESCE(s.status,'active') status FROM children c JOIN users p ON p.id=c.parent LEFT JOIN child_status s ON s.child=c.id WHERE p.scope=? ORDER BY c.name",a.scope):[],
  supervisors:has('school.supervision')?all('SELECT u.id,u.name FROM users u JOIN admin_members m ON m.user=u.id WHERE u.scope=? AND m.active=1 ORDER BY u.name',a.scope):[],
  teacherAssignments:has('school.teachers')?all('SELECT t.*,u.name FROM school_teacher_assignments t JOIN school_classes c ON c.id=t.class_id JOIN school_grades g ON g.id=c.grade_id JOIN users u ON u.id=t.teacher WHERE g.scope=?',a.scope):[],
  studentAssignments:has('school.students')?all('SELECT s.*,ch.name FROM school_student_assignments s JOIN children ch ON ch.id=s.child JOIN users p ON p.id=ch.parent WHERE p.scope=?',a.scope):[],
  supervision:has('school.supervision')?all('SELECT s.*,u.name,t.name supervisorName FROM school_supervision s JOIN users u ON u.id=s.teacher JOIN users t ON t.id=s.supervisor WHERE u.scope=?',a.scope):[]
 };}
 function initializeSchoolLegacyTrack(actor){return write(actor,'school.tracks',a=>{
  const existing=one('SELECT id FROM school_tracks WHERE scope=? AND legacy=1',a.scope);
  if(existing)return {id:existing.id,created:false};
  const row=legacyTrack(a);return {id:row.id,created:true};
 });}
 function addSchoolTrack(actor,{name,educationType='unspecified',curriculumName=''}){return write(actor,'school.tracks',a=>{
  check(typeof name==='string'&&name.trim().length>0&&name.trim().length<=60,'اكتب اسم المسار حتى ٦٠ حرفًا.');
  check(Object.hasOwn(SCHOOL_TYPES,educationType),'نوع التعليم غير صالح.');
  check(typeof curriculumName==='string'&&curriculumName.trim().length<=80,'اسم المنهج حتى ٨٠ حرفًا.');
  name=name.trim();curriculumName=curriculumName.trim();
  check(!one('SELECT id FROM school_tracks WHERE scope=? AND name=? AND education_type=? AND curriculum_name=?',a.scope,name,educationType,curriculumName),'المسار موجود بالفعل.',409);
  const id=randomUUID();run('INSERT INTO school_tracks(id,scope,name,education_type,curriculum_name,legacy) VALUES(?,?,?,?,?,0)',id,a.scope,name,educationType,curriculumName);audit(a,'school.track.created',id,{name,educationType,curriculumName});return id;
 });}
 function addSchoolGrade(actor,values){return write(actor,'school.structure',a=>createGrade(a,values));}
 function addSchoolClass(actor,{gradeId,trackId,levelKey,name,capacity}){return write(actor,'school.structure',a=>{
  check(typeof name==='string'&&name.trim().length>0&&name.trim().length<=40,'اكتب اسم الفصل حتى 40 حرفًا.');
  check(validCapacity(capacity),'حدد الحد الأقصى للطلاب بعدد صحيح موجب.');name=name.trim();
  check(!gradeId||(!trackId&&!levelKey),'اختر مرجع صف واحدًا دون حقول متعارضة.');
  check(gradeId===undefined||(typeof gradeId==='string'&&gradeId.length>0),'اختر صفًا صحيحًا.');
  if(!gradeId){check(typeof levelKey==='string'&&SCHOOL_LEVELS.some(l=>l.key===levelKey),'اختر المرحلة والصف من القائمة الثابتة.');check(typeof trackId==='string'&&trackId.length>0,'اختر المسار التعليمي.');const [stage,value]=levelKey.split(':');gradeId=createGrade(a,{stage,grade:Number(value),trackId},false);}
  check(one('SELECT g.id FROM school_grades g JOIN school_tracks t ON t.id=g.track_id AND t.scope=g.scope WHERE g.id=? AND g.scope=?',gradeId,a.scope),'الصف غير متاح.',404);
  check(!one('SELECT id FROM school_classes WHERE grade_id=? AND name=?',gradeId,name),'الفصل موجود بالفعل.',409);
  const id=randomUUID();run('INSERT INTO school_classes VALUES(?,?,?)',id,gradeId,name);run('INSERT INTO school_class_capacity VALUES(?,?)',id,capacity);audit(a,'school.class.created',id,{gradeId,name,capacity});return id;
 });}
 function updateSchoolClassCapacity(actor,{classId,capacity,revision}){return write(actor,'school.capacity',a=>{
  const c=classroom(a,classId);check(Number.isInteger(revision)&&revision===c.revision,'تغير سجل الفصل. حدّث الصفحة قبل الحفظ.',409);
  check(validCapacity(capacity),'حدد الحد الأقصى للطلاب بعدد صحيح موجب.');
  check(capacity>=c.studentCount,'لا يمكن تخفيض السعة عن عدد الطلاب المسندين حاليًا. أزل الإسنادات أولًا.',409);
  if(capacity===c.capacity)return {id:c.id,revision:c.revision};
  run('INSERT INTO school_class_capacity VALUES(?,?) ON CONFLICT(class_id) DO UPDATE SET capacity=excluded.capacity',c.id,capacity);
  run('INSERT INTO school_class_lifecycle VALUES(?,?,?) ON CONFLICT(class_id) DO UPDATE SET state=excluded.state,revision=excluded.revision',c.id,c.state,c.revision+1);
  audit(a,'school.class.capacity_updated',c.id,{before:c.capacity,after:capacity,studentCount:c.studentCount});return {id:c.id,revision:c.revision+1};
 });}
 function updateSchoolClass(actor,{classId,name,state,revision}){return write(actor,'school.lifecycle',a=>{
  const c=classroom(a,classId);
  check(Number.isInteger(revision)&&revision===c.revision,'تغير سجل الفصل. حدّث الصفحة قبل الحفظ.',409);
  check(typeof name==='string'&&name.trim().length>0&&name.trim().length<=40,'اكتب اسم الفصل حتى 40 حرفًا.');
  name=name.trim();
  check(state==='active'||state==='archived','حالة الفصل غير صالحة.');
  check(!one('SELECT id FROM school_classes WHERE grade_id=? AND name=? AND id<>?',c.grade_id,name,c.id),'يوجد فصل بهذا الاسم في الصف نفسه.',409);
  if(state==='archived')check(!one('SELECT 1 FROM school_teacher_assignments WHERE class_id=?',c.id)&&!one('SELECT 1 FROM school_student_assignments WHERE class_id=?',c.id),'لا يمكن أرشفة فصل له إسنادات. اطلب من صاحب الصلاحية إزالة الإسنادات أولًا.',409);
  if(name===c.name&&state===c.state)return {id:c.id,revision:c.revision};
  run('UPDATE school_classes SET name=? WHERE id=?',name,c.id);
  run('INSERT INTO school_class_lifecycle VALUES(?,?,?) ON CONFLICT(class_id) DO UPDATE SET state=excluded.state,revision=excluded.revision',c.id,state,c.revision+1);
  audit(a,'school.class.updated',c.id,{before:{name:c.name,state:c.state},after:{name,state}});
  return {id:c.id,revision:c.revision+1};
 });}
 function assignSchoolTeacher(actor,{classId,teacherId,subject}){return write(actor,'school.teachers',a=>{const c=classroom(a,classId),t=teacher(a,teacherId);check(c.state==='active','الفصل مؤرشف. أعد إتاحته قبل الإسناد.',409);requireCompatible(c);check(Object.hasOwn(subjects,subject)&&JSON.parse(t.subjects||'[]').includes(subject)&&JSON.parse(t.grades||'[]').includes(c.grade),'المادة أو الصف خارج تخصص المعلم.');check(!one('SELECT teacher FROM school_teacher_assignments WHERE class_id=? AND subject=?',classId,subject),'يوجد إسناد لهذه المادة. أزله أولًا.',409);assertClassTeacherCompatible(classId,subject,teacherId);run('INSERT INTO school_teacher_assignments VALUES(?,?,?)',classId,subject,teacherId);audit(a,'school.teacher.assigned',classId,{subject,teacherId});});}
 function assignSchoolStudent(actor,{classId,childId}){return write(actor,'school.students',a=>{const c=classroom(a,classId),ch=one("SELECT ch.* FROM children ch JOIN users p ON p.id=ch.parent LEFT JOIN child_status s ON s.child=ch.id WHERE ch.id=? AND p.scope=? AND COALESCE(s.status,'active')='active'",childId,a.scope);check(c.state==='active','الفصل مؤرشف. أعد إتاحته قبل الإسناد.',409);check(ch,'الطالب غير متاح.',404);requireCompatible(c);check(ch.grade===c.grade,'صف الطالب لا يطابق الفصل.');check(!one('SELECT child FROM school_student_assignments WHERE child=?',childId),'الطالب مسند لفصل بالفعل. أزل الإسناد أولًا.',409);check(c.capacity!==null,'لم تُحدد سعة الفصل. اطلب من صاحب الصلاحية تحديدها قبل إسناد طالب جديد.',409);check(c.studentCount<c.capacity,'اكتملت سعة الفصل. لا يمكن إضافة طالب قبل تعديل الحد الأقصى أو إزالة إسناد.',409);assertStudentEnrollmentCompatible(childId,classId);run('INSERT INTO school_student_assignments VALUES(?,?)',childId,classId);audit(a,'school.student.assigned',childId,{classId});});}
 function assignSchoolSupervisor(actor,{teacherId,supervisorId}){return write(actor,'school.supervision',a=>{teacher(a,teacherId);check(one('SELECT u.id FROM users u JOIN admin_members m ON m.user=u.id WHERE u.id=? AND u.scope=? AND m.active=1',supervisorId,a.scope),'المشرف غير متاح.',404);check(!one('SELECT teacher FROM school_supervision WHERE teacher=?',teacherId),'المعلم مسند لمشرف بالفعل. أزل الإسناد أولًا.',409);run('INSERT INTO school_supervision VALUES(?,?)',teacherId,supervisorId);audit(a,'school.supervisor.assigned',teacherId,{supervisorId});});}
 function removeSchoolAssignment(actor,{kind,classId,subject,teacherId,childId,supervisorId}){const permission={teacher:'school.teachers',student:'school.students',supervisor:'school.supervision'}[kind];check(permission,'نوع الإسناد غير صالح.');return write(actor,permission,a=>{let result;if(kind==='teacher'){classroom(a,classId);result=run('DELETE FROM school_teacher_assignments WHERE class_id=? AND subject=? AND teacher=?',classId,subject,teacherId);}else if(kind==='student'){classroom(a,classId);assertStudentRemovable(childId,classId);result=run('DELETE FROM school_student_assignments WHERE child=? AND class_id=?',childId,classId);}else{teacher(a,teacherId);result=run('DELETE FROM school_supervision WHERE teacher=? AND supervisor=?',teacherId,supervisorId);}check(result.changes===1,'تغير الإسناد. حدّث الصفحة.',409);audit(a,'school.assignment.removed',classId||teacherId,{kind,subject,teacherId,childId,supervisorId});});}
 function assignSchoolStudents(actor,{classId,childIds}){return write(actor,'school.students',()=>{
  check(Array.isArray(childIds)&&childIds.length>=1&&childIds.length<=100&&Array.from(childIds).every(validStudentId)&&new Set(childIds).size===childIds.length,'اختر من طالب واحد إلى ١٠٠ طالب مختلف من القائمة.');
  // Nested writes reuse this transaction, including every per-child audit.
  for(const childId of childIds)assignSchoolStudent(actor,{classId,childId});
  return {assigned:childIds.length};
 });}
 return {...individuals,school,initializeSchoolLegacyTrack,addSchoolTrack,addSchoolGrade,addSchoolClass,updateSchoolClassCapacity,updateSchoolClass,assignSchoolTeacher,assignSchoolStudent,assignSchoolStudents,assignSchoolSupervisor,removeSchoolAssignment};
}
