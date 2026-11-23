import {randomUUID} from 'node:crypto';
import {schoolLevelLabel} from './school-catalog.mjs';

export const GUARDIAN_RELATIONSHIPS=Object.freeze({father:'أب',mother:'أم',brother:'أخ',sister:'أخت',other:'أخرى'});
const digits=value=>String(value).replace(/[٠-٩۰-۹]/g,c=>String(c.charCodeAt(0)-(c>='۰'?'۰':'٠').charCodeAt(0)));
const uuid=value=>typeof value==='string'&&/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);
const parentFields=new Set(['name','mobile','eligibleChildrenCount','request']);
const studentFields=new Set(['name','studentMobile','guardianMobile','guardianRelationship','parentId','gradeId','request']);
export function registrationIntakeValues(values,kind='student'){
 if(kind==='parent')return {...values};
 return {...Object.fromEntries(Object.entries(values).filter(([k])=>!k.startsWith('subject_'))),requestedSubjects:Object.keys(values).filter(k=>k.startsWith('subject_')).map(k=>values[k]==='1'?k.slice(8):null)};
}
export async function registrationIntakeFields(req,kind,UserError){
 if(req.headers['content-type']?.split(';')[0]!=='application/x-www-form-urlencoded')throw new UserError('صيغة نموذج غير صالحة.',415);
 const chunks=[];let size=0;
 for await(const chunk of req){size+=chunk.length;if(size>32768)throw new UserError('حجم الإدخال كبير.',413);chunks.push(chunk);}
 const params=new URLSearchParams(Buffer.concat(chunks).toString('utf8')),seen=new Set(),known=kind==='parent'?parentFields:studentFields;
 for(const [key,value] of params){
  if(seen.has(key))throw new UserError('أرسل قيمة واحدة لكل حقل.',400);
  if(!known.has(key)&&!(kind==='student'&&key.startsWith('subject_')&&value==='1'))throw new UserError('يحتوي النموذج على حقول غير معتمدة.',400);
  seen.add(key);
 }
 return Object.fromEntries(params);
}

export const registrationRequestKey=uuid;
export function registrationInputTools(check){
 function knownValues(values,kind){const known=kind==='parent'?parentFields:new Set([...studentFields,'requestedSubjects']);check(values&&typeof values==='object'&&!Array.isArray(values)&&Object.keys(values).every(k=>known.has(k)),'يحتوي الطلب على حقول غير معتمدة.');}
 function nameFor(a,value){
  check(typeof value==='string'&&value.trim().length>0&&value.trim().length<=60&&!/[\x00-\x1f\x7f]/.test(value),'اكتب الاسم في ٦٠ حرفًا أو أقل.');
  const name=value.trim();
  check(!a.scope||/(تجريبي|تجريبية|synthetic|demo)/iu.test(name),'المعاينة للبيانات الوهمية فقط. استخدم اسمًا يتضمن «تجريبي».');
  return name;
 }
 function mobileFor(a,value,optional=false){
  if(optional&&(value===undefined||value===null||value===''))return null;
  check(typeof value==='string'&&value.length<=40,'اكتب رقم جوال صحيحًا.');
  const mobile=digits(value).replace(/[\s()-]/g,'');
  if(a.scope){check(mobile==='0000000000','المعاينة لا تقبل جوالًا حقيقيًا. استخدم 0000000000 فقط.');return mobile;}
  check(/^(?:\+[1-9]\d{7,14}|\d{7,15})$/.test(mobile)&&!/^0+$/.test(mobile),'اكتب رقم جوال محليًا أو دوليًا صحيحًا.');
  return mobile;
 }
 function request(value){check(uuid(value),'حدّث نموذج التسجيل قبل الحفظ.');return value;}
 return {knownValues,nameFor,mobileFor,request};
}

// Intake records do not create users, invitations, child identities, enrollment,
// bookings, or classroom access. Registration interest is not lesson eligibility.
export function createRegistrationIntake({db,one,all,run,transaction,requireAccess,audit,check,subjects}){
 db.exec(`CREATE TABLE IF NOT EXISTS registration_intake_parents(
  id TEXT PRIMARY KEY,scope TEXT NOT NULL,actor TEXT NOT NULL REFERENCES users(id),request TEXT NOT NULL,
  name TEXT NOT NULL,mobile TEXT NOT NULL,eligible_children_count INTEGER NOT NULL CHECK(typeof(eligible_children_count)='integer' AND eligible_children_count BETWEEN 0 AND 50),
  payload TEXT NOT NULL,created INTEGER NOT NULL,UNIQUE(actor,request),UNIQUE(id,scope));
 CREATE TABLE IF NOT EXISTS registration_intake_students(
  id TEXT PRIMARY KEY,scope TEXT NOT NULL,actor TEXT NOT NULL REFERENCES users(id),request TEXT NOT NULL,
  parent_id TEXT, name TEXT NOT NULL,student_mobile TEXT,guardian_mobile TEXT,guardian_relationship TEXT,
  grade_id TEXT NOT NULL REFERENCES school_grades(id),requested_subjects TEXT NOT NULL,payload TEXT NOT NULL,created INTEGER NOT NULL,
  CHECK(parent_id IS NOT NULL OR student_mobile IS NOT NULL),
  CHECK(guardian_relationship IS NULL OR guardian_relationship IN ('father','mother','brother','sister','other')),
  CHECK(guardian_relationship IS NULL OR guardian_mobile IS NOT NULL),
  FOREIGN KEY(parent_id,scope) REFERENCES registration_intake_parents(id,scope),UNIQUE(actor,request));
 CREATE INDEX IF NOT EXISTS registration_intake_parent_scope ON registration_intake_parents(scope,created);
 CREATE INDEX IF NOT EXISTS registration_intake_student_scope ON registration_intake_students(scope,created);
 CREATE INDEX IF NOT EXISTS registration_intake_student_parent ON registration_intake_students(parent_id);`);
 const {knownValues,nameFor,mobileFor,request}=registrationInputTools(check);
 function grade(a,id){
  check(uuid(id),'اختر الصف من القائمة.');
  const g=one('SELECT g.id,g.stage,g.grade,g.track_id,t.name trackName FROM school_grades g JOIN school_tracks t ON t.id=g.track_id AND t.scope=g.scope WHERE g.id=? AND g.scope=?',id,a.scope);
  check(g,'الصف غير متاح في هذه المساحة.',404);return g;
 }
 function catalog(a){return [...Object.entries(subjects).map(([key,name])=>({id:'legacy:'+key,name})),...all('SELECT id,name FROM academic_subjects WHERE scope=? AND active=1 ORDER BY name,id',a.scope).map(s=>({id:'academic:'+s.id,name:s.name}))];}
 function selectedSubjects(a,values){
  check(Array.isArray(values)&&values.length>=1&&values.length<=30&&new Set(values).size===values.length,'اختر مادة واحدة على الأقل وحتى ٣٠ مادة دون تكرار.');
  const options=new Map(catalog(a).map(s=>[s.id,s]));
  check(values.every(v=>typeof v==='string'&&options.has(v)),'إحدى المواد غير متاحة. حدّث القائمة ثم اختر المواد المطلوبة.');
  return [...values].sort().map(id=>options.get(id));
 }
 function addRegistrationParent(actor,values){return transaction(()=>{
  const a=requireAccess(actor,'registration.write');knownValues(values,'parent');const name=nameFor(a,values.name),mobile=mobileFor(a,values.mobile),key=request(values.request);
  const raw=typeof values.eligibleChildrenCount==='number'?String(values.eligibleChildrenCount):typeof values.eligibleChildrenCount==='string'?digits(values.eligibleChildrenCount):'';
  check(/^\d{1,2}$/.test(raw)&&Number(raw)<=50,'عدد الأبناء المؤهلين يجب أن يكون عددًا صحيحًا من ٠ إلى ٥٠.');
  const count=Number(raw),payload=JSON.stringify([name,mobile,count]);
  const old=one('SELECT id,scope,payload FROM registration_intake_parents WHERE actor=? AND request=?',a.id,key);
  if(old){check(old.scope===a.scope&&old.payload===payload,'استُخدم النموذج لبيانات مختلفة. افتح نموذجًا جديدًا.',409);return old.id;}
  const id=randomUUID();run('INSERT INTO registration_intake_parents VALUES(?,?,?,?,?,?,?,?,?)',id,a.scope,a.id,key,name,mobile,count,payload,Date.now());
  audit(a,'registration.intake.parent.created',id,{eligibleChildrenCount:count});return id;
 });}
 function addRegistrationStudent(actor,values){return transaction(()=>{
  const a=requireAccess(actor,'registration.write');knownValues(values,'student');const name=nameFor(a,values.name),key=request(values.request),parentId=values.parentId||null;
  let parent=null;
  if(parentId){check(uuid(parentId),'اختر ولي الأمر من القائمة.');parent=one('SELECT id,mobile FROM registration_intake_parents WHERE id=? AND scope=?',parentId,a.scope);check(parent,'سجل ولي الأمر غير متاح.',404);}
  const studentMobile=mobileFor(a,values.studentMobile,!!parent),providedGuardian=mobileFor(a,values.guardianMobile,true);
  check(!parent||!providedGuardian||providedGuardian===parent.mobile,'جوال ولي الأمر يتبع سجل ولي الأمر المختار.');
  const guardianMobile=parent?.mobile||providedGuardian,relationship=values.guardianRelationship||null;
  check(relationship===null||(typeof relationship==='string'&&Object.hasOwn(GUARDIAN_RELATIONSHIPS,relationship)),'اختر صلة القرابة من القائمة.');
  check(!relationship||!!guardianMobile,'أدخل جوال ولي الأمر قبل تحديد صلة القرابة.');
  const g=grade(a,values.gradeId),requested=selectedSubjects(a,values.requestedSubjects);
  const payload=JSON.stringify([parentId,name,studentMobile,guardianMobile,relationship,g.id,requested.map(s=>s.id)]);
  const old=one('SELECT id,scope,payload FROM registration_intake_students WHERE actor=? AND request=?',a.id,key);
  if(old){check(old.scope===a.scope&&old.payload===payload,'استُخدم النموذج لبيانات مختلفة. افتح نموذجًا جديدًا.',409);return old.id;}
  const id=randomUUID();run('INSERT INTO registration_intake_students VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',id,a.scope,a.id,key,parentId,name,studentMobile,guardianMobile,relationship,g.id,JSON.stringify(requested),payload,Date.now());
  audit(a,'registration.intake.student.created',id,{hasParent:!!parent,gradeId:g.id,requestedSubjectCount:requested.length});return id;
 });}
 function registrationIntake(actor){
  const a=requireAccess(actor,'registration.read');
  const parents=all('SELECT p.id,p.name,p.mobile,p.eligible_children_count eligibleChildrenCount,(SELECT count(*) FROM registration_intake_students s WHERE s.parent_id=p.id AND s.scope=p.scope) registeredChildrenCount FROM registration_intake_parents p WHERE p.scope=? ORDER BY p.created DESC,p.id',a.scope);
  const students=all(`SELECT s.id,s.name,s.parent_id parentId,p.name parentName,s.student_mobile studentMobile,s.guardian_mobile guardianMobile,s.guardian_relationship guardianRelationship,s.grade_id gradeId,s.requested_subjects requestedSubjects,g.stage,g.grade,t.name trackName
   FROM registration_intake_students s JOIN school_grades g ON g.id=s.grade_id AND g.scope=s.scope JOIN school_tracks t ON t.id=g.track_id AND t.scope=s.scope
   LEFT JOIN registration_intake_parents p ON p.id=s.parent_id AND p.scope=s.scope WHERE s.scope=? ORDER BY s.created DESC,s.id`,a.scope).map(s=>({...s,levelLabel:schoolLevelLabel(s.stage,s.grade),requestedSubjects:JSON.parse(s.requestedSubjects)}));
  const grades=all('SELECT g.id,g.stage,g.grade,t.name trackName FROM school_grades g JOIN school_tracks t ON t.id=g.track_id AND t.scope=g.scope WHERE g.scope=? ORDER BY t.name,g.stage,g.grade',a.scope).map(g=>({...g,name:g.trackName+' · '+schoolLevelLabel(g.stage,g.grade)}));
  return {parents,students,grades,subjects:catalog(a)};
 }
 return {addRegistrationParent,addRegistrationStudent,registrationIntake};
}
