import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openStore} from '../store.mjs';

const fullPermissions={register_parent:true,register_child:true,manage_status:true};
const denied=(fn,status)=>assert.throws(fn,error=>error.status===status);
const sorted=values=>[...values].sort();

// Every fixture is a new temporary database containing synthetic demo records.
// No development or production database is opened by this test file.
function fixture(t){
 const dir=mkdtempSync(join(tmpdir(),'registration-school-033-'));
 const file=join(dir,'synthetic.sqlite');
 let store=openStore(file);
 const db=new DatabaseSync(file);
 db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
 t.after(()=>{db.close();store.close();rmSync(dir,{recursive:true,force:true});});
 const a=store.admin,ids=a.demo(),actor=ids.supervisor;
 const scope=a.profile(actor).scope,agent=a.switchDemo(actor,'registration_agent');
 const second=a.createRegistrationAgent(actor,{name:'Synthetic second agent',email:randomUUID()+'@example.invalid',...fullPermissions}).id;
 const parent=store.registration.addParent(agent,{name:'Private synthetic parent',email:randomUUID()+'@example.invalid'}).id;
 store.registration.setStatus(agent,{kind:'parent',id:parent,status:'active'});
 const legacyGrade=a.addSchoolGrade(actor,{grade:4});
 const customTrack=a.addSchoolTrack(actor,{name:'Synthetic custom track',educationType:'private',curriculumName:'Synthetic curriculum'});
 const middle=a.addSchoolGrade(actor,{stage:'middle',grade:2});
 const secondary=a.addSchoolGrade(actor,{stage:'secondary',grade:3});
 const customPrimary=a.addSchoolGrade(actor,{trackId:customTrack,stage:'primary',grade:4});
 const ownGrades={middle,secondary,customPrimary};
 return {
  get s(){return store;},get a(){return store.admin;},db,file,actor,ids,scope,agent,second,parent,legacyGrade,customTrack,ownGrades,
  reopen(){store.close();store=openStore(file);},
  add(gradeId=middle,values={},owner=agent){return store.registration.addChild(owner,{profileType:'school',parent,name:'Private synthetic student',schoolGradeId:gradeId,request:randomUUID(),...values});},
  rows(sql,...args){return db.prepare(sql).all(...args);},
  state(){return Object.fromEntries(['children','child_status','registration_school_students','registration_audit'].map(name=>[name,db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all()]));}
 };
}

function foreignScope(f){
 const ids=f.a.demo(),actor=ids.supervisor,agent=f.a.switchDemo(actor,'registration_agent');
 const parent=f.s.registration.addParent(agent,{name:'Private foreign parent',email:randomUUID()+'@example.invalid'}).id;
 const grade=f.a.addSchoolGrade(actor,{stage:'middle',grade:2});
 const child=f.s.registration.addChild(agent,{profileType:'school',parent,name:'Private foreign student',schoolGradeId:grade,request:randomUUID()});
 return {actor,agent,parent,grade,child};
}

function legacyBooking(f){
 const child=f.s.registration.addChild(f.agent,{parent:f.parent,name:'Private legacy student',grade:4});
 const offer=f.s.offers(f.parent,child,'math')[0];
 assert.ok(offer,'Synthetic legacy teacher must offer a bookable primary lesson');
 const request=randomUUID(),booking=f.s.book(f.parent,child,offer.id,request);
 return {child,offer,booking,request};
}

test('033: middle, secondary and custom-primary profiles retain exact school contexts outside children',t=>{
 const f=fixture(t),beforeChildren=f.rows('SELECT * FROM children ORDER BY id');
 const expected=[['middle',2,f.ownGrades.middle],['secondary',3,f.ownGrades.secondary],['primary',4,f.ownGrades.customPrimary]];
 const students=expected.map(([stage,grade,gradeId],i)=>({id:f.add(gradeId,{name:'Private student '+i}),stage,grade,gradeId}));
 const dashboard=f.s.registration.dashboard(f.agent);
 assert.deepEqual(sorted(dashboard.schoolGrades.map(g=>g.id)),sorted(Object.values(f.ownGrades)));
 assert.ok(!dashboard.schoolGrades.some(g=>g.id===f.legacyGrade));
 for(const {id,stage,grade,gradeId} of students){
  const row=dashboard.schoolStudents.find(s=>s.id===id),opened=f.a.school(f.actor).grades.find(g=>g.id===gradeId);
  assert.equal(row.parent,f.parent);assert.equal(row.stage,stage);assert.equal(row.grade,grade);
  assert.equal(row.grade_id,gradeId);assert.equal(row.track_id,opened.track_id);assert.equal(row.trackName,opened.trackName);
  assert.equal(row.status,'active');assert.ok(row.levelLabel.length>0);
  assert.ok(!dashboard.children.some(s=>s.id===id));
  assert.equal(f.rows('SELECT * FROM child_status WHERE child=?',id).length,0);
  assert.ok(!f.a.school(f.actor).students.some(s=>s.id===id));
  const adminRow=f.a.registration(f.actor).find(s=>s.id===id);
  assert.equal(adminRow.profileType,'school');assert.equal(adminRow.stage,stage);assert.equal(adminRow.grade,grade);
 }
 assert.deepEqual(f.rows('SELECT * FROM children ORDER BY id'),beforeChildren);
 assert.equal(f.s.children(f.parent).length,0);
 assert.equal(dashboard.schoolStudents.length,3);
});

test('033: invalid and conflicting qualifiers fail atomically, including previously ignored legacy stage and track',t=>{
 const f=fixture(t),before=f.state();
 for(const schoolGradeId of [undefined,null,'',4,{},[],true,'not-a-grade',' primary:4 ',f.customTrack]){
  denied(()=>f.add(schoolGradeId===undefined?f.ownGrades.middle:schoolGradeId,{schoolGradeId}),schoolGradeId===f.customTrack?404:400);
 }
 denied(()=>f.add(randomUUID()),404);
 denied(()=>f.add(f.legacyGrade),409);
 for(const profileType of ['',null,'legacy','primary','academic',true,4,{}])denied(()=>f.add(undefined,{profileType}),400);
 for(const name of [undefined,null,'','   ','x'.repeat(41),42,{}])denied(()=>f.add(undefined,{name}),400);
 for(const grade of [null,'',0,2,4,'4',false,Infinity,{},[]])denied(()=>f.add(undefined,{grade}),400);
 for(const stage of [null,'','middle','primary','secondary','college',4,{}])denied(()=>f.add(undefined,{stage}),400);
 for(const trackId of [null,'',f.customTrack,randomUUID(),4,{}])denied(()=>f.add(undefined,{trackId}),400);
 for(const request of [undefined,null,'',4,true,{},[],'not-a-request'])denied(()=>f.add(undefined,{request}),400);
 for(const qualifiers of [{schoolGradeId:f.ownGrades.middle},{stage:'middle'},{stage:'primary'},{stage:null},{trackId:f.customTrack},{trackId:''},{trackId:null},{stage:'secondary',trackId:f.customTrack}]){
  denied(()=>f.s.registration.addChild(f.agent,{parent:f.parent,name:'Must not become a child',grade:4,...qualifiers}),400);
 }
 assert.deepEqual(f.state(),before,'Every rejected write must leave profiles, child status and audit untouched');
 // The HTTP handler uses NaN for an absent legacy grade; this is not a second grade selection.
 const id=f.add(f.ownGrades.middle,{grade:NaN,name:'  Trimmed student  '});
 assert.equal(f.s.registration.dashboard(f.agent).schoolStudents.find(s=>s.id===id).name,'Trimmed student');
});

test('033: owned parents and opened grades are required across agents and scopes',t=>{
 const f=fixture(t),foreign=foreignScope(f);
 const otherParent=f.s.registration.addParent(f.second,{name:'Private second parent',email:randomUUID()+'@example.invalid'}).id;
 const unmanaged=f.rows("SELECT id FROM users WHERE scope=? AND role='parent' AND id NOT IN (SELECT parent FROM registration_parents)",f.scope)[0].id;
 const before=f.state();
 for(const parent of [otherParent,foreign.parent,unmanaged,f.actor,randomUUID()])denied(()=>f.add(undefined,{parent}),404);
 denied(()=>f.add(foreign.grade),404);
 denied(()=>f.add(undefined,{},f.second),404);
 denied(()=>f.add(undefined,{},foreign.agent),404);
 for(const owner of [f.actor,f.ids.education,f.parent])denied(()=>f.add(undefined,{},owner),403);
 assert.deepEqual(f.state(),before);
 const own=f.add();
 const second=f.add(f.ownGrades.secondary,{parent:otherParent,name:'Private second student'},f.second);
 assert.deepEqual(f.s.registration.dashboard(f.agent).schoolStudents.map(s=>s.id),[own]);
 assert.deepEqual(f.s.registration.dashboard(f.second).schoolStudents.map(s=>s.id),[second]);
 assert.deepEqual(f.s.registration.dashboard(foreign.agent).schoolStudents.map(s=>s.id),[foreign.child]);
 assert.ok(f.s.registration.dashboard(f.agent).schoolGrades.every(g=>g.scope===f.scope));
 assert.ok(!f.s.registration.dashboard(f.agent).schoolGrades.some(g=>g.id===foreign.grade));
 const ownAdmin=f.a.registration(f.actor).map(s=>s.id),foreignAdmin=f.a.registration(foreign.actor).map(s=>s.id);
 assert.ok(ownAdmin.includes(own)&&ownAdmin.includes(second)&&!ownAdmin.includes(foreign.child));
 assert.ok(foreignAdmin.includes(foreign.child)&&!foreignAdmin.includes(own)&&!foreignAdmin.includes(second));
 denied(()=>f.s.registration.setStatus(f.second,{kind:'school_student',id:own,status:'suspended'}),404);
 denied(()=>f.s.registration.setStatus(foreign.agent,{kind:'school_student',id:own,status:'suspended'}),404);
 denied(()=>f.s.registration.setStatus(f.agent,{kind:'school_student',id:foreign.child,status:'suspended'}),404);
});

test('033: inconsistent parent or grade scopes stay hidden and cannot be managed',t=>{
 const f=fixture(t),foreign=foreignScope(f),id=f.add();
 const foreignScopeId=f.s.user(foreign.parent).scope;
 f.db.prepare('UPDATE users SET scope=? WHERE id=?').run(foreignScopeId,f.parent);
 assert.equal(f.s.registration.dashboard(f.agent).schoolStudents.length,0);
 assert.ok(!f.s.registration.dashboard(f.agent).parents.some(p=>p.id===f.parent));
 denied(()=>f.add(),404);
 denied(()=>f.s.registration.setStatus(f.agent,{kind:'school_student',id,status:'suspended'}),404);
 f.db.prepare('UPDATE users SET scope=? WHERE id=?').run(f.scope,f.parent);
 f.db.prepare('UPDATE registration_school_students SET grade_id=? WHERE id=?').run(foreign.grade,id);
 assert.equal(f.s.registration.dashboard(f.agent).schoolStudents.length,0);
 assert.ok(!f.a.registration(f.actor).some(s=>s.id===id));
 denied(()=>f.s.registration.setStatus(f.agent,{kind:'school_student',id,status:'suspended'}),404);
 assert.equal(f.rows('SELECT status FROM registration_school_students WHERE id=?',id)[0].status,'active');
 assert.deepEqual(f.rows('PRAGMA foreign_key_check'),[]);
});

test('033: school suspension is independent and permissions revocation fails closed',t=>{
 const f=fixture(t),id=f.add(),legacy=f.s.registration.addChild(f.agent,{parent:f.parent,name:'Unchanged legacy sibling',grade:4});
 const set=status=>f.s.registration.setStatus(f.agent,{kind:'school_student',id,status});
 set('suspended');
 assert.equal(f.s.registration.dashboard(f.agent).schoolStudents.find(s=>s.id===id).status,'suspended');
 assert.equal(f.s.registration.dashboard(f.agent).children.find(s=>s.id===legacy).status,'active');
 assert.equal(f.rows('SELECT * FROM child_status WHERE child=?',id).length,0);
 denied(()=>f.s.registration.setStatus(f.agent,{kind:'child',id,status:'active'}),404);
 denied(()=>f.s.registration.setStatus(f.agent,{kind:'school_student',id:legacy,status:'suspended'}),404);
 for(const status of ['pending','',null])denied(()=>f.s.registration.setStatus(f.agent,{kind:'school_student',id,status}),400);
 set('active');
 let rev=f.s.registration.setPermissions(f.actor,f.agent,{...fullPermissions,register_child:false},0);
 assert.deepEqual(f.s.registration.dashboard(f.agent).schoolGrades,[]);
 assert.equal(f.s.registration.dashboard(f.agent).schoolStudents.length,1);
 let before=f.state();denied(()=>f.add(),403);assert.deepEqual(f.state(),before);
 set('suspended');
 rev=f.s.registration.setPermissions(f.actor,f.agent,{...fullPermissions,manage_status:false},rev);
 before=f.state();denied(()=>set('active'),403);assert.deepEqual(f.state(),before);
 rev=f.s.registration.setPermissions(f.actor,f.agent,{register_parent:false,register_child:false,manage_status:false},rev);
 denied(()=>f.s.registration.dashboard(f.agent),403);denied(()=>f.add(),403);denied(()=>set('active'),403);
 f.s.registration.setPermissions(f.actor,f.agent,fullPermissions,rev);
 f.db.prepare("INSERT INTO account_status(user,status) VALUES(?,'suspended') ON CONFLICT(user) DO UPDATE SET status='suspended'").run(f.agent);
 before=f.state();denied(()=>f.add(),403);denied(()=>set('active'),403);denied(()=>f.s.registration.dashboard(f.agent),403);assert.deepEqual(f.state(),before);
});

test('033: repeated requests are idempotent per actor and conflicting replays are rejected',t=>{
 const f=fixture(t),request=randomUUID();
 const values={profileType:'school',parent:f.parent,name:'Private idempotent student',schoolGradeId:f.ownGrades.middle,request};
 const id=f.s.registration.addChild(f.agent,values),after=f.state();
 assert.equal(f.s.registration.addChild(f.agent,{...values}),id);
 assert.deepEqual(f.state(),after,'A successful replay must not create another profile or audit event');
 for(const changed of [{name:'Changed student'},{schoolGradeId:f.ownGrades.secondary}])denied(()=>f.s.registration.addChild(f.agent,{...values,...changed}),409);
 const parent=f.s.registration.addParent(f.agent,{name:'Private alternative parent',email:randomUUID()+'@example.invalid'}).id;
 denied(()=>f.s.registration.addChild(f.agent,{...values,parent}),409);
 const otherParent=f.s.registration.addParent(f.second,{name:'Private second parent',email:randomUUID()+'@example.invalid'}).id;
 const second=f.s.registration.addChild(f.second,{...values,parent:otherParent});
 assert.notEqual(second,id,'Another agent may reuse a request UUID for that agent’s own parent');
 const before=f.state();
 denied(()=>f.s.registration.addChild(f.second,values),404);
 assert.deepEqual(f.state(),before);
 f.s.registration.setPermissions(f.actor,f.agent,{...fullPermissions,register_child:false},0);
 denied(()=>f.s.registration.addChild(f.agent,values),403);
});

test('033: academic profiles cannot book or receive class or teacher assignments; legacy bookings stay unchanged',t=>{
 const f=fixture(t),legacy=legacyBooking(f);
 const beforeBooking=f.rows('SELECT * FROM bookings ORDER BY id');
 const legacyClass=f.a.addSchoolClass(f.actor,{gradeId:f.legacyGrade,name:'Synthetic legacy class',capacity:10});
 const teacher=f.a.education(f.actor).teachers.find(t=>t.id===legacy.offer.teacher).id;
 f.a.assignSchoolStudent(f.actor,{classId:legacyClass,childId:legacy.child});
 denied(()=>f.a.assignSchoolTeacherStudents(f.actor,{gradeId:f.legacyGrade,subject:'math',teacherId:teacher,childIds:[legacy.child]}),409);
 const beforeAssignments={students:f.rows('SELECT * FROM school_student_assignments'),teachers:f.rows('SELECT * FROM school_teacher_students'),classTeachers:f.rows('SELECT * FROM school_teacher_assignments')};
 for(const gradeId of Object.values(f.ownGrades)){
  const id=f.add(gradeId),classId=f.a.addSchoolClass(f.actor,{gradeId,name:'Synthetic academic class',capacity:10});
  denied(()=>f.s.ownedChild(f.parent,id),404);
  denied(()=>f.s.offers(f.parent,id,'math'),404);
  denied(()=>f.s.book(f.parent,id,legacy.offer.id,randomUUID()),404);
  denied(()=>f.a.assignSchoolStudent(f.actor,{classId:legacyClass,childId:id}),404);
  denied(()=>f.a.assignSchoolStudent(f.actor,{classId,childId:id}),404);
  denied(()=>f.a.assignSchoolStudents(f.actor,{classId:legacyClass,childIds:[id]}),404);
  denied(()=>f.a.assignSchoolTeacherStudents(f.actor,{gradeId:f.legacyGrade,subject:'math',teacherId:teacher,childIds:[id]}),409);
  denied(()=>f.a.assignSchoolTeacherStudents(f.actor,{gradeId,subject:'math',teacherId:teacher,childIds:[id]}),409);
  denied(()=>f.a.assignSchoolTeacher(f.actor,{classId,subject:'math',teacherId:teacher}),409);
  assert.equal(f.a.school(f.actor).classes.find(c=>c.id===classId).assignmentSupported,false);
  assert.ok(!f.a.schoolTeacherStudents(f.actor,{gradeId:f.legacyGrade,subject:'math',teacherId:teacher}).students.some(s=>s.id===id));
 }
 assert.deepEqual(f.rows('SELECT * FROM bookings ORDER BY id'),beforeBooking);
 assert.deepEqual(f.rows('SELECT * FROM school_student_assignments'),beforeAssignments.students);
 assert.deepEqual(f.rows('SELECT * FROM school_teacher_students'),beforeAssignments.teachers);
 assert.deepEqual(f.rows('SELECT * FROM school_teacher_assignments'),beforeAssignments.classTeachers);
 assert.equal(f.s.book(f.parent,legacy.child,legacy.offer.id,legacy.request),legacy.booking);
 assert.equal(f.s.bookings(f.parent,legacy.booking)[0].status,'confirmed');
 assert.equal(f.s.children(f.parent).length,1);
 assert.equal(f.s.children(f.parent)[0].id,legacy.child);
});

test('033: exact profiles, status, request replay and legacy bookings survive reopen with private audit and healthy FKs',t=>{
 const f=fixture(t),legacy=legacyBooking(f),request=randomUUID();
 const values={profileType:'school',parent:f.parent,name:'Private persistence student',schoolGradeId:f.ownGrades.middle,request};
 const first=f.s.registration.addChild(f.agent,values);
 const second=f.add(f.ownGrades.secondary,{name:'Private secondary student'}),third=f.add(f.ownGrades.customPrimary,{name:'Private primary student'});
 f.s.registration.setStatus(f.agent,{kind:'school_student',id:second,status:'suspended'});
 const before=f.s.registration.dashboard(f.agent),bookings=f.s.bookings(f.parent),audit=f.rows('SELECT * FROM registration_audit ORDER BY id');
 const events=audit.filter(row=>[first,second,third].includes(row.target));
 assert.equal(events.filter(e=>e.action==='register-school-student-profile').length,3);
 assert.equal(events.filter(e=>e.action==='set-school_student-status').length,1);
 for(const event of events){
  const detail=JSON.parse(event.detail);
  assert.ok(!event.detail.includes('Private'));assert.ok(!Object.hasOwn(detail,'name'));assert.ok(!Object.hasOwn(detail,'parentName'));
  if(event.action==='register-school-student-profile'){
   assert.equal(detail.parent,f.parent);assert.ok(Object.values(f.ownGrades).includes(detail.gradeId));
   assert.ok(['primary','middle','secondary'].includes(detail.stage));assert.ok(Number.isInteger(detail.grade));
   assert.equal(typeof detail.trackId,'string');
  }else assert.deepEqual(detail,{status:'suspended'});
 }
 f.reopen();
 assert.deepEqual(f.s.registration.dashboard(f.agent),before);
 assert.deepEqual(f.s.bookings(f.parent),bookings);
 assert.equal(f.s.book(f.parent,legacy.child,legacy.offer.id,legacy.request),legacy.booking);
 assert.equal(f.s.registration.addChild(f.agent,values),first);
 assert.deepEqual(f.rows('SELECT * FROM registration_audit ORDER BY id'),audit);
 assert.equal(f.s.registration.dashboard(f.agent).schoolStudents.find(s=>s.id===second).status,'suspended');
 assert.deepEqual(f.rows('PRAGMA foreign_key_check'),[]);
 assert.equal(f.rows('PRAGMA integrity_check')[0].integrity_check,'ok');
 assert.equal(f.rows('SELECT COUNT(*) AS n FROM children WHERE parent=?',f.parent)[0].n,1);
 assert.equal(f.rows('SELECT COUNT(*) AS n FROM registration_school_students WHERE parent=?',f.parent)[0].n,3);
});

test('033: failed audit rolls back academic creation and status together',t=>{
 const f=fixture(t),id=f.add(),before=f.state();
 f.db.exec("CREATE TRIGGER fail_academic_audit BEFORE INSERT ON registration_audit WHEN NEW.action IN ('register-school-student-profile','set-school_student-status') BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END");
 assert.throws(()=>f.add(),/synthetic audit failure/);
 assert.deepEqual(f.state(),before);
 assert.throws(()=>f.s.registration.setStatus(f.agent,{kind:'school_student',id,status:'suspended'}),/synthetic audit failure/);
 assert.deepEqual(f.state(),before);
 f.db.exec('DROP TRIGGER fail_academic_audit');
 f.s.registration.setStatus(f.agent,{kind:'school_student',id,status:'suspended'});
 assert.equal(f.s.registration.dashboard(f.agent).schoolStudents[0].status,'suspended');
});

test('033: additive initialization preserves an existing primary database and its booking',t=>{
 const f=fixture(t),legacy=legacyBooking(f);
 const tables=['users','children','bookings','slots','registration_parents','registration_permissions','registration_audit','school_grades','school_classes'];
 const before=Object.fromEntries(tables.map(table=>[table,f.rows('SELECT * FROM '+table+' ORDER BY rowid')]));
 // Simulate a pre-033 store. Only the new empty table is absent.
 f.db.exec('DROP TABLE registration_school_students');f.reopen();
 for(const table of tables)assert.deepEqual(f.rows('SELECT * FROM '+table+' ORDER BY rowid'),before[table],table);
 assert.deepEqual(f.s.registration.dashboard(f.agent).schoolStudents,[]);
 assert.equal(f.s.book(f.parent,legacy.child,legacy.offer.id,legacy.request),legacy.booking);
 const id=f.add();assert.ok(f.s.registration.dashboard(f.agent).schoolStudents.some(r=>r.id===id));
 assert.deepEqual(f.rows('PRAGMA foreign_key_check'),[]);
});
