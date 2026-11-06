import {randomUUID} from 'node:crypto';

const validId=value=>typeof value==='string'&&/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);
const PAGE_SIZE=100;

export function createSchoolIndividuals({db,one,all,run,transaction,requireAccess,audit,check,subjects}){
 // Additive only: no existing class or student assignment is converted or deleted.
 db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS school_student_context ON school_student_assignments(child,class_id);
 CREATE TABLE IF NOT EXISTS school_teacher_students(
  id TEXT PRIMARY KEY,child TEXT NOT NULL,subject TEXT NOT NULL,teacher TEXT NOT NULL REFERENCES users(id),
  class_id TEXT NOT NULL REFERENCES school_classes(id),actor TEXT NOT NULL REFERENCES users(id),created INTEGER NOT NULL,
  UNIQUE(child,subject),FOREIGN KEY(child,class_id) REFERENCES school_student_assignments(child,class_id));
 CREATE INDEX IF NOT EXISTS school_teacher_students_context ON school_teacher_students(class_id,subject,teacher);`);
 const gradeSelect='SELECT g.*,t.name trackName,t.legacy legacyTrack FROM school_grades g JOIN school_tracks t ON t.id=g.track_id AND t.scope=g.scope';
 const grade=(a,id)=>{
  check(validId(id),'اختر الصف والمسار من القائمة.');
  const g=one(gradeSelect+' WHERE g.id=? AND g.scope=?',id,a.scope);check(g,'الصف غير متاح.',404);
  check(g.stage==='primary'&&g.legacyTrack===1,'هذا المسار أو المرحلة يحتاج ربطًا صريحًا بالتسجيل وتخصصات المعلمين قبل الإسناد.',409);return g;
 };
 const validateSubject=subject=>check(typeof subject==='string'&&Object.hasOwn(subjects,subject),'اختر مادة صحيحة.');
 const activeTeachers=a=>all("SELECT u.id,u.name,u.subjects,u.grades FROM users u LEFT JOIN account_status s ON s.user=u.id WHERE u.scope=? AND u.role='teacher' AND COALESCE(s.status,'active')='active' ORDER BY u.name,u.id",a.scope).map(t=>({...t,subjects:JSON.parse(t.subjects||'[]'),grades:JSON.parse(t.grades||'[]')}));
 const teacher=(a,g,subject,id)=>{
  check(validId(id),'اختر المعلم.');
  const t=activeTeachers(a).find(t=>t.id===id);check(t,'المعلم غير متاح.',404);
  check(t.subjects.includes(subject)&&t.grades.includes(g.grade),'المادة أو الصف خارج تخصص المعلم.');return t;
 };
 const roster=`SELECT ch.id,ch.name,ch.grade childGrade,c.id classId,c.name className,COALESCE(l.state,'active') classState,
  COALESCE(cs.status,'active') childStatus,COALESCE(ps.status,'active') parentStatus,
  d.id directAssignmentId,d.teacher directTeacherId,du.name directTeacherName,
  ct.teacher inheritedTeacherId,tu.name inheritedTeacherName
  FROM school_student_assignments membership JOIN children ch ON ch.id=membership.child JOIN users p ON p.id=ch.parent
  JOIN school_classes c ON c.id=membership.class_id JOIN school_grades g ON g.id=c.grade_id
  LEFT JOIN school_class_lifecycle l ON l.class_id=c.id LEFT JOIN child_status cs ON cs.child=ch.id LEFT JOIN account_status ps ON ps.user=p.id
  LEFT JOIN school_teacher_students d ON d.child=ch.id AND d.subject=? LEFT JOIN users du ON du.id=d.teacher
  LEFT JOIN school_teacher_assignments ct ON ct.class_id=c.id AND ct.subject=? LEFT JOIN users tu ON tu.id=ct.teacher`;
 function eligibility(row,g,teacherId){
  let reason='',code='available';
  if(row.directTeacherId&&row.inheritedTeacherId&&row.directTeacherId!==row.inheritedTeacherId){reason='تعارض بين الإسناد الفردي ومعلم الفصل؛ يلزم مراجعته قبل أي تغيير.';code='conflict';}
  else if(row.directTeacherId||row.inheritedTeacherId){const current=row.directTeacherId||row.inheritedTeacherId;reason=(row.directTeacherId?'مسند فرديًا إلى ':'مسند عبر معلم الفصل: ')+(row.directTeacherName||row.inheritedTeacherName)+(current===teacherId?' — مسند للمعلم المختار بالفعل.':' — لا يمكن اختيار معلم آخر للمادة نفسها.');code=current===teacherId?'same':'assigned';}
  else if(row.classState!=='active'){reason='الفصل مؤرشف؛ أعد إتاحته قبل الإسناد.';code='inactive';}
  else if(row.childStatus!=='active'||row.parentStatus!=='active'){reason='حساب الطالب أو ولي أمره غير نشط؛ يبقى الإسناد القائم محفوظًا.';code='inactive';}
  else if(row.childGrade!==g.grade){reason='صف ملف الطالب لا يطابق صف الفصل؛ راجع التسجيل.';code='mismatch';}
  else if(!teacherId){reason='اختر المعلم لعرض إتاحة الإسناد.';code='select-teacher';}
  return {...row,selectable:code==='available',reason,code};
 }
 function schoolTeacherStudents(actor,{gradeId='',subject='',teacherId='',page=1}={}){
  const a=requireAccess(actor,'school.individuals');
  check(typeof gradeId==='string'&&typeof subject==='string'&&typeof teacherId==='string','راجع حقول اختيار الإسناد.');
  check(Number.isSafeInteger(page)&&page>=1,'رقم الصفحة غير صالح.');
  if(subject)validateSubject(subject);
  check(!teacherId||(gradeId&&subject),'اختر الصف والمادة قبل المعلم.');
  const grades=all(gradeSelect+" WHERE g.scope=? AND g.stage='primary' AND t.legacy=1 ORDER BY g.grade",a.scope);
  const g=gradeId?grade(a,gradeId):null,teachers=g&&subject?activeTeachers(a).filter(t=>t.subjects.includes(subject)&&t.grades.includes(g.grade)):[];
  const t=teacherId?teacher(a,g,subject,teacherId):null;
  let total=0,pages=1,students=[];
  if(g&&subject){
   total=one('SELECT COUNT(*) n FROM school_student_assignments m JOIN school_classes c ON c.id=m.class_id JOIN children ch ON ch.id=m.child JOIN users p ON p.id=ch.parent WHERE c.grade_id=? AND p.scope=?',g.id,a.scope).n;
   pages=Math.max(1,Math.ceil(total/PAGE_SIZE));check(page<=pages,'تغيرت قائمة الطلاب. ارجع إلى الصفحة الأولى.',409);
   students=all(roster+' WHERE g.id=? AND g.scope=? AND p.scope=? ORDER BY ch.name,ch.id LIMIT ? OFFSET ?',subject,subject,g.id,a.scope,a.scope,PAGE_SIZE,(page-1)*PAGE_SIZE).map(row=>eligibility(row,g,t?.id));
  }
  return {grades,grade:g,subject,teachers,teacher:t,students,page,pages,total,pageSize:PAGE_SIZE};
 }
 function assignSchoolTeacherStudents(actor,{gradeId,subject,teacherId,childIds}){
  return transaction(()=>{
   const a=requireAccess(actor,'school.individuals'),g=grade(a,gradeId);validateSubject(subject);const t=teacher(a,g,subject,teacherId);
   check(Array.isArray(childIds)&&childIds.length>0&&childIds.length<=PAGE_SIZE&&Array.from(childIds).every(validId)&&new Set(childIds).size===childIds.length,'اختر من طالب واحد إلى ١٠٠ طالب مختلف من القائمة.');
   const candidates=childIds.map(id=>{
    const row=one(roster+' WHERE ch.id=? AND g.id=? AND g.scope=? AND p.scope=?',subject,subject,id,g.id,a.scope,a.scope);
    check(row,'الطالب غير ملحق بفصل في الصف والمسار المختارين أو غير متاح.',404);
    // Even no-op replays must still satisfy current enrollment/status eligibility.
    check(row.classState==='active'&&row.childStatus==='active'&&row.parentStatus==='active','حساب الطالب أو ولي أمره أو الفصل غير متاح للإسناد.',409);
    check(row.childGrade===g.grade,'صف ملف الطالب لا يطابق صف الفصل. راجع التسجيل.',409);
    const result=eligibility(row,g,t.id);check(result.selectable||result.code==='same',result.reason,409);return result;
   });
   const fresh=candidates.filter(c=>c.code!=='same');
   for(const c of fresh)run('INSERT INTO school_teacher_students VALUES(?,?,?,?,?,?,?)',randomUUID(),c.id,subject,t.id,c.classId,a.id,Date.now());
   if(fresh.length)audit(a,'school.individuals.assigned',t.id,{gradeId:g.id,subject,teacherId:t.id,childIds:fresh.map(c=>c.id)});
   return {assigned:fresh.length};
  });
 }
 function removeSchoolTeacherStudent(actor,{assignmentId}){
  return transaction(()=>{
   const a=requireAccess(actor,'school.individuals');check(validId(assignmentId),'اختر إسنادًا صحيحًا.');
   const row=one('SELECT d.* FROM school_teacher_students d JOIN children ch ON ch.id=d.child JOIN users p ON p.id=ch.parent JOIN school_classes c ON c.id=d.class_id JOIN school_grades g ON g.id=c.grade_id WHERE d.id=? AND p.scope=? AND g.scope=?',assignmentId,a.scope,a.scope);
   check(row,'تغير الإسناد أو لم يعد متاحًا. حدّث الصفحة.',409);
   run('DELETE FROM school_teacher_students WHERE id=?',row.id);audit(a,'school.individuals.removed',row.id,{childId:row.child,subject:row.subject,teacherId:row.teacher,classId:row.class_id});
  });
 }
 const classTeacherCompatible=(classId,subject,teacherId)=>!one('SELECT id FROM school_teacher_students WHERE class_id=? AND subject=? AND teacher<>? LIMIT 1',classId,subject,teacherId);
 const assertClassTeacherCompatible=(classId,subject,teacherId)=>check(classTeacherCompatible(classId,subject,teacherId),'يوجد طالب مسند فرديًا لمعلم آخر في المادة نفسها. أزل الإسناد الفردي صراحة قبل تغيير معلم الفصل.',409);
 const assertStudentRemovable=(childId,classId)=>check(!one('SELECT id FROM school_teacher_students WHERE child=? AND class_id=? LIMIT 1',childId,classId),'للطالب إسنادات فردية مرتبطة بهذا الفصل. أزلها من «إسناد المعلمين للطلاب» أولًا ثم أزل عضويته؛ لن تُحذف تلقائيًا.',409);
 const assertStudentEnrollmentCompatible=(childId,classId)=>check(!one('SELECT d.id FROM school_teacher_students d LEFT JOIN school_teacher_assignments t ON t.class_id=? AND t.subject=d.subject WHERE d.child=? AND (d.class_id<>? OR (t.teacher IS NOT NULL AND t.teacher<>d.teacher)) LIMIT 1',classId,childId,classId),'إسنادات الطالب الفردية لا تطابق الفصل أو معلم مادته. راجعها قبل تغيير عضويته.',409);
 return {schoolTeacherStudents,assignSchoolTeacherStudents,removeSchoolTeacherStudent,classTeacherCompatible,assertClassTeacherCompatible,assertStudentRemovable,assertStudentEnrollmentCompatible};
}
