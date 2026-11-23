import {randomUUID} from 'node:crypto';
import {priceValues,pricingRow,chooseLessonPrice} from './lesson-pricing-values.mjs';
export function createLessonPricing({db,one,all,run,transaction,requireAccess,audit,check}){
 db.exec(`CREATE TABLE IF NOT EXISTS lesson_price_rules(id TEXT PRIMARY KEY,scope TEXT NOT NULL,grade_id TEXT NOT NULL REFERENCES school_grades(id),subject_id TEXT NOT NULL REFERENCES academic_subjects(id),teacher_id TEXT REFERENCES users(id),teacher_key TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>=0),CHECK(teacher_key=COALESCE(teacher_id,'')),UNIQUE(scope,grade_id,subject_id,teacher_key));
 CREATE TABLE IF NOT EXISTS lesson_price_revisions(id TEXT PRIMARY KEY,rule_id TEXT NOT NULL REFERENCES lesson_price_rules(id),revision INTEGER NOT NULL CHECK(revision>0),amount_cents INTEGER CHECK(amount_cents IS NULL OR (typeof(amount_cents)='integer' AND amount_cents BETWEEN 0 AND 99999999)),effective_from INTEGER NOT NULL CHECK(effective_from>=0),created INTEGER NOT NULL,actor TEXT NOT NULL REFERENCES users(id),request TEXT NOT NULL,payload TEXT NOT NULL,UNIQUE(rule_id,revision),UNIQUE(actor,request));
 CREATE INDEX IF NOT EXISTS lesson_price_effective ON lesson_price_revisions(rule_id,effective_from,revision);
 CREATE TRIGGER IF NOT EXISTS lesson_price_identity_no_update BEFORE UPDATE OF id,scope,grade_id,subject_id,teacher_id,teacher_key ON lesson_price_rules BEGIN SELECT RAISE(ABORT,'Price identity is immutable'); END;
 CREATE TRIGGER IF NOT EXISTS lesson_price_history_no_update BEFORE UPDATE ON lesson_price_revisions BEGIN SELECT RAISE(ABORT,'Price history is immutable'); END;
 CREATE TRIGGER IF NOT EXISTS lesson_price_history_no_delete BEFORE DELETE ON lesson_price_revisions BEGIN SELECT RAISE(ABORT,'Price history is immutable'); END;`);
 const history=a=>all(`SELECT v.*,r.scope,r.grade_id,r.subject_id,r.teacher_id FROM lesson_price_revisions v JOIN lesson_price_rules r ON r.id=v.rule_id WHERE r.scope=? ORDER BY v.created DESC,v.revision DESC,v.id`,a.scope).map(pricingRow);
 function lessonPricing(id){const a=requireAccess(id,'education.read');return {grades:all('SELECT g.*,t.name trackName FROM school_grades g JOIN school_tracks t ON t.id=g.track_id WHERE g.scope=? ORDER BY t.name,g.stage,g.grade',a.scope),subjects:all('SELECT id,name,active FROM academic_subjects WHERE scope=? ORDER BY name',a.scope),teachers:all("SELECT u.id,u.name,COALESCE(s.status,'active') status FROM users u LEFT JOIN account_status s ON s.user=u.id WHERE u.role='teacher' AND u.scope=? ORDER BY u.name",a.scope),coverage:all('SELECT teacher_id teacherId,grade_id gradeId,subject_id subjectId FROM academic_teacher_coverage WHERE scope=?',a.scope),rules:all('SELECT * FROM lesson_price_rules WHERE scope=?',a.scope),history:history(a)};}
 function resolveLessonPrice(id,i){const a=requireAccess(id,'education.read');check(Number.isSafeInteger(i.at??Date.now())&&(i.at??Date.now())>=0,'راجع وقت التسعير.');return chooseLessonPrice(history(a),i);}
 function setLessonPrice(id,input){return transaction(()=>{
  const a=requireAccess(id,'education.write'),now=Date.now(),v=priceValues(input,check,now),payload=JSON.stringify(v);
  const old=one('SELECT v.id,v.payload FROM lesson_price_revisions v JOIN lesson_price_rules r ON r.id=v.rule_id WHERE r.scope=? AND v.actor=? AND v.request=?',a.scope,a.id,v.request);
  if(old){check(old.payload===payload,'استُخدم النموذج لتسعير مختلف. حدّث الصفحة.',409);return old.id;}
  check(v.effectiveFrom===null||v.effectiveFrom>=now,'لا يمكن تعديل الأسعار بأثر رجعي. اختر وقتًا مستقبليًا.');
  check(one('SELECT id FROM school_grades WHERE id=? AND scope=?',v.gradeId,a.scope),'الصف غير متاح.',404);
  check(one('SELECT id FROM academic_subjects WHERE id=? AND scope=? AND (active=1 OR ?=1)',v.subjectId,a.scope,v.mode==='inherit'?1:0),'المادة غير متاحة.',404);
  if(v.teacherId){
   check(one("SELECT u.id FROM users u LEFT JOIN account_status s ON s.user=u.id WHERE u.id=? AND u.scope=? AND u.role='teacher' AND (COALESCE(s.status,'active')='active' OR ?=1)",v.teacherId,a.scope,v.mode==='inherit'?1:0),'المعلم غير متاح.',404);
   if(v.mode==='price')check(one('SELECT id FROM academic_teacher_coverage WHERE scope=? AND teacher_id=? AND grade_id=? AND subject_id=?',a.scope,v.teacherId,v.gradeId,v.subjectId),'الصف والمادة خارج اعتماد المعلم.',409);
  }
  let rule=one('SELECT * FROM lesson_price_rules WHERE scope=? AND grade_id=? AND subject_id=? AND teacher_key=?',a.scope,v.gradeId,v.subjectId,v.teacherId);
  check(v.revision===(rule?.revision??0),'تغيّر التسعير. حدّث الصفحة قبل الحفظ.',409);
  check(v.mode!=='inherit'||rule,'لا يوجد سعر خاص لإلغائه.',409);
  if(!rule){rule={id:randomUUID(),revision:0};run('INSERT INTO lesson_price_rules VALUES(?,?,?,?,?,?,?)',rule.id,a.scope,v.gradeId,v.subjectId,v.teacherId||null,v.teacherId,0);}
  const revision=rule.revision+1,rid=randomUUID(),effective=v.effectiveFrom??now;
  run('INSERT INTO lesson_price_revisions VALUES(?,?,?,?,?,?,?,?,?)',rid,rule.id,revision,v.amountCents,effective,now,a.id,v.request,payload);
  run('UPDATE lesson_price_rules SET revision=? WHERE id=?',revision,rule.id);
  audit(a,'lesson_price.revised',rid,{gradeId:v.gradeId,subjectId:v.subjectId,teacherId:v.teacherId,amountCents:v.amountCents,currency:'SAR',effectiveFrom:effective,revision});return rid;
 });}
 return {lessonPricing,setLessonPrice,resolveLessonPrice};
}
