import {randomUUID} from 'node:crypto';
import {schoolLevelLabel} from './school-catalog.mjs';

// These academic records are deliberately separate from children, whose numeric
// grade still means a primary booking grade. No booking or classroom authority
// is inferred from an administrative stage or track.
export function schoolRegistration(db,{one,run,need,managed,audit}) {
 db.exec(`CREATE TABLE IF NOT EXISTS registration_school_students(
  id TEXT PRIMARY KEY,parent TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,
  grade_id TEXT NOT NULL REFERENCES school_grades(id),
  status TEXT NOT NULL CHECK(status IN ('active','suspended')),created INTEGER NOT NULL,
  actor TEXT NOT NULL REFERENCES users(id),request TEXT NOT NULL,UNIQUE(actor,request));
 CREATE INDEX IF NOT EXISTS registration_school_parent ON registration_school_students(parent);`);
 const academicGrades=`SELECT g.id,g.scope,g.track_id,g.stage,g.grade,t.name trackName,t.legacy legacyTrack,
  t.education_type educationType,t.curriculum_name curriculumName
  FROM school_grades g JOIN school_tracks t ON t.id=g.track_id AND t.scope=g.scope`;
 const supported=g=>g.stage!=='primary'||g.legacyTrack!==1;
 const label=g=>({...g,levelLabel:schoolLevelLabel(g.stage,g.grade)});
 function grades(scope) {
  return db.prepare(academicGrades+' WHERE g.scope=? ORDER BY t.name,g.stage,g.grade').all(scope).filter(supported).map(label);
 }
 function add(actor,u,{parent,name,schoolGradeId,grade,stage,trackId,request}) {
  managed(actor,parent);
  need(typeof name==='string'&&name.trim().length>0&&name.length<=40,'اكتب اسم الطالب حتى ٤٠ حرفًا.',400);
  need(typeof schoolGradeId==='string'&&/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(schoolGradeId),'اختر الصف المفتوح والمسار من القائمة.',400);
  need(typeof request==='string'&&/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(request),'حدّث نموذج التسجيل قبل الحفظ.',400);
  // The shared HTTP handler converts an absent legacy grade to NaN. Any actual
  // numeric grade or extra context is conflicting input, not an override.
  need((grade===undefined||Number.isNaN(grade))&&stage===undefined&&trackId===undefined,'اختر مرجع صف واحدًا دون حقول متعارضة.',400);
  const g=one(academicGrades+' WHERE g.id=? AND g.scope=?',schoolGradeId,u.scope);
  need(g,'الصف أو المسار غير متاح.',404);
  need(supported(g),'استخدم نموذج التسجيل الابتدائي الحالي لهذا الصف.',409);
  const prior=one('SELECT id,parent,name,grade_id FROM registration_school_students WHERE actor=? AND request=?',actor,request);
  if(prior){need(prior.parent===parent&&prior.name===name.trim()&&prior.grade_id===g.id,'تغير محتوى الطلب المحفوظ. افتح نموذجًا جديدًا.',409);return prior.id;}
  const id=randomUUID();
  run("INSERT INTO registration_school_students VALUES(?,?,?,?,'active',?,?,?)",id,parent,name.trim(),g.id,Date.now(),actor,request);
  audit(actor,'register-school-student-profile',id,{parent,gradeId:g.id,trackId:g.track_id,stage:g.stage,grade:g.grade});
  return id;
 }
 function rows(actor) {
  return db.prepare(`SELECT s.id,s.parent,s.name,s.status,s.grade_id,g.grade,g.stage,g.track_id,t.name trackName
   FROM registration_school_students s JOIN registration_parents r ON r.parent=s.parent
   JOIN users p ON p.id=s.parent JOIN users a ON a.id=r.agent
   JOIN school_grades g ON g.id=s.grade_id JOIN school_tracks t ON t.id=g.track_id AND t.scope=g.scope
   WHERE r.agent=? AND p.scope=a.scope AND g.scope=a.scope ORDER BY s.name,s.id`).all(actor).map(label);
 }
 function setStatus(actor,id,status) {
  const s=one('SELECT s.parent,g.scope FROM registration_school_students s JOIN school_grades g ON g.id=s.grade_id WHERE s.id=?',id);
  need(s,'ملف الطالب غير متاح.',404);const p=managed(actor,s.parent);
  need(p.scope===s.scope,'ملف الطالب غير متاح.',404);
  run('UPDATE registration_school_students SET status=? WHERE id=?',status,id);
 }
 return {grades,add,rows,setStatus};
}
