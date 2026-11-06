import test from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openStore} from '../store.mjs';

const denied=(fn,status)=>assert.throws(fn,error=>error.status===status);
function tempFile(t){
  const dir=mkdtempSync(join(tmpdir(),'school-016-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  return join(dir,'synthetic.sqlite');
}
function fixture(t,file=':memory:'){
  const s=openStore(file),a=s.admin,ids=a.demo(),actor=ids.supervisor;
  let closed=false;
  const close=()=>{if(!closed){s.close();closed=true;}};
  t.after(close);
  const gradeId=a.addSchoolGrade(actor,{grade:4});
  const classId=a.addSchoolClass(actor,{gradeId,name:'Synthetic class A',capacity:200});
  const teacherId=a.createTeacher(actor,{name:'Synthetic math teacher',email:randomUUID()+'@example.invalid',subjects:['math'],grades:[4],language:'ar'}).id;
  const secondTeacherId=a.createTeacher(actor,{name:'Other synthetic math teacher',email:randomUUID()+'@example.invalid',subjects:['math'],grades:[4],language:'ar'}).id;
  return {s,a,ids,actor,gradeId,classId,teacherId,secondTeacherId,close};
}
function children(f,count=3,{grade=4,enrolled=true,classId=f.classId}={}){
  const agent=f.a.switchDemo(f.actor,'registration_agent');
  const {id:parent}=f.s.registration.addParent(agent,{name:'Synthetic assignment parent',email:randomUUID()+'@example.invalid'});
  f.s.registration.setStatus(agent,{kind:'parent',id:parent,status:'active'});
  const childIds=Array.from({length:count},(_,i)=>f.s.registration.addChild(agent,{parent,name:'Synthetic child '+String(i).padStart(3,'0'),grade}));
  if(enrolled)for(const childId of childIds)f.a.assignSchoolStudent(f.actor,{classId,childId});
  return {agent,parent,childIds};
}
const query=(f,values={})=>f.a.schoolTeacherStudents(f.actor,{gradeId:f.gradeId,subject:'math',teacherId:f.teacherId,...values});
const assign=(f,childIds,values={})=>f.a.assignSchoolTeacherStudents(f.actor,{gradeId:f.gradeId,subject:'math',teacherId:f.teacherId,childIds,...values});
const events=f=>f.a.auditLog(f.actor).filter(row=>row.action==='school.individuals.assigned');

// Catches missing direct assignments, batch count errors, and missing one-per-batch audit.
test('assigning one student and a batch creates only subject-specific direct links and one audit per changed batch',t=>{
  const f=fixture(t),{childIds}=children(f);
  assert.equal(typeof f.a.assignSchoolTeacherStudents,'function','The teacher-to-student assignment API must be available');
  assert.deepEqual(assign(f,[childIds[0]]),{assigned:1});
  assert.deepEqual(assign(f,childIds.slice(1)),{assigned:2});
  const result=query(f);
  assert.equal(result.total,3);
  for(const child of result.students){
    assert.equal(child.directTeacherId,f.teacherId);
    assert.equal(child.classId,f.classId);
    assert.ok(child.directAssignmentId);
    assert.equal(child.selectable,false);
    assert.ok(child.reason);
  }
  assert.equal(events(f).length,2);
});

function grant(f,permissions){
  const member=f.a.members(f.actor).find(row=>row.id===f.ids.education);
  f.a.updateMember(f.actor,member.id,{...member,permissions});
}
function raw(file){
  const db=new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  return db;
}
function snapshot(db,names){
  return Object.fromEntries(names.map(name=>[name,db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all()]));
}
const rejectSelection=fn=>assert.throws(fn,error=>[400,404,409].includes(error.status));
const student=(f,id,values={})=>query(f,values).students.find(row=>row.id===id);
const remove=(f,assignmentId,actor=f.actor)=>f.a.removeSchoolTeacherStudent(actor,{assignmentId});

// Catches grants accidentally inherited from other school permissions and cached authority.
test('candidate identities and direct mutations require the separate grant and stop immediately on revocation',t=>{
  const f=fixture(t),{childIds}=children(f,2),values={gradeId:f.gradeId,subject:'math',teacherId:f.teacherId,childIds};
  denied(()=>grant(f,['school.individuals']),400);
  for(const permissions of [[],['school.read'],['school.read','school.teachers'],['school.read','school.students'],['school.read','school.teachers','school.students']]){
    grant(f,permissions);
    denied(()=>f.a.schoolTeacherStudents(f.ids.education,values),403);
    denied(()=>f.a.assignSchoolTeacherStudents(f.ids.education,values),403);
    denied(()=>f.a.removeSchoolTeacherStudent(f.ids.education,{assignmentId:randomUUID()}),403);
  }
  grant(f,['school.read','school.individuals']);
  assert.equal(f.a.schoolTeacherStudents(f.ids.education,values).students.length,2);
  assert.deepEqual(f.a.assignSchoolTeacherStudents(f.ids.education,{...values,childIds:[childIds[0]]}),{assigned:1});
  const assignmentId=student(f,childIds[0]).directAssignmentId;
  denied(()=>f.a.removeSchoolAssignment(f.ids.education,{kind:'student',classId:f.classId,childId:childIds[0]}),403);
  denied(()=>f.a.assignSchoolTeacher(f.ids.education,{classId:f.classId,subject:'math',teacherId:f.teacherId}),403);
  grant(f,['school.read']);
  const before=query(f),audit=f.a.auditLog(f.actor);
  denied(()=>f.a.schoolTeacherStudents(f.ids.education,values),403);
  denied(()=>f.a.assignSchoolTeacherStudents(f.ids.education,{...values,childIds:[childIds[1]]}),403);
  denied(()=>remove(f,assignmentId,f.ids.education),403);
  assert.deepEqual(query(f),before);assert.deepEqual(f.a.auditLog(f.actor),audit);
  grant(f,['school.read','school.individuals']);
  remove(f,assignmentId,f.ids.education);
  assert.equal(student(f,childIds[0]).selectable,true);
});

// Catches foreign-scope reads, a forged teacher, and cross-scope batch/removal writes.
test('grade teacher student and immutable removal targets are bound to the current school scope',t=>{
  const f=fixture(t),{childIds}=children(f,2),other=f.a.demo();
  const otherGrade=f.a.addSchoolGrade(other.supervisor,{grade:4});
  const otherClass=f.a.addSchoolClass(other.supervisor,{gradeId:otherGrade,name:'Foreign class',capacity:10});
  const otherTeacher=f.a.education(other.supervisor).teachers[0].id;
  const otherChild=f.a.registration(other.supervisor).find(row=>row.grade===4).id;
  f.a.assignSchoolStudent(other.supervisor,{classId:otherClass,childId:otherChild});
  f.a.assignSchoolTeacherStudents(other.supervisor,{gradeId:otherGrade,subject:'math',teacherId:otherTeacher,childIds:[otherChild]});
  const foreign=f.a.schoolTeacherStudents(other.supervisor,{gradeId:otherGrade,subject:'math',teacherId:otherTeacher});
  const foreignId=foreign.students[0].directAssignmentId;
  const before=query(f),audit=f.a.auditLog(f.actor),foreignBefore=foreign;
  denied(()=>query(f,{gradeId:otherGrade}),404);
  denied(()=>query(f,{teacherId:otherTeacher}),404);
  denied(()=>assign(f,childIds,{gradeId:otherGrade}),404);
  denied(()=>assign(f,childIds,{teacherId:otherTeacher}),404);
  denied(()=>assign(f,[childIds[0],otherChild]),404);
  denied(()=>remove(f,foreignId),409);
  assert.deepEqual(query(f),before);assert.deepEqual(f.a.auditLog(f.actor),audit);
  assert.deepEqual(f.a.schoolTeacherStudents(other.supervisor,{gradeId:otherGrade,subject:'math',teacherId:otherTeacher}),foreignBefore);
  assert.ok(before.grades.every(row=>row.id!==otherGrade));
  assert.ok(before.teachers.every(row=>row.id!==otherTeacher));
  assert.ok(before.students.every(row=>row.id!==otherChild));
});

// Catches accidental global-per-child exclusivity and replace-on-replay behavior.
test('one student can have different subject teachers and replay leaves exact links and audit unchanged',t=>{
  const f=fixture(t),{childIds}=children(f,2);
  const science=f.a.createTeacher(f.actor,{name:'Synthetic science teacher',email:randomUUID()+'@example.invalid',subjects:['science'],grades:[4],language:'ar'}).id;
  assign(f,[childIds[0]]);
  const initial=student(f,childIds[0]),audit=f.a.auditLog(f.actor);
  assert.deepEqual(assign(f,[childIds[0]]),{assigned:0});
  assert.deepEqual(student(f,childIds[0]),initial);assert.deepEqual(f.a.auditLog(f.actor),audit);
  assert.deepEqual(assign(f,childIds),{assigned:1});
  assert.equal(student(f,childIds[0]).directAssignmentId,initial.directAssignmentId);
  assert.equal(events(f).length,2);
  assert.deepEqual(assign(f,[childIds[0]],{subject:'science',teacherId:science}),{assigned:1});
  const scienceRow=student(f,childIds[0],{subject:'science',teacherId:science});
  assert.equal(scienceRow.directTeacherId,science);
  assert.notEqual(scienceRow.directAssignmentId,initial.directAssignmentId);
  assert.equal(student(f,childIds[0]).directTeacherId,f.teacherId);
});

// Catches copying or overriding inherited class assignments and partial conflicting batches.
test('inherited class teachers are effective without copying and conflicts reject the whole batch',t=>{
  const f=fixture(t),{childIds}=children(f,3);
  const inheritedClass=f.a.addSchoolClass(f.actor,{gradeId:f.gradeId,name:'Inherited class',capacity:5});
  const inherited=children(f,1,{classId:inheritedClass}).childIds[0];
  f.a.assignSchoolTeacher(f.actor,{classId:inheritedClass,subject:'math',teacherId:f.teacherId});
  const priorSchool=f.a.school(f.actor),audit=f.a.auditLog(f.actor);
  assert.deepEqual(assign(f,[inherited]),{assigned:0});
  const row=student(f,inherited);
  assert.equal(row.inheritedTeacherId,f.teacherId);
  assert.ok(row.inheritedTeacherName);
  assert.ok(!row.directAssignmentId);assert.ok(!row.directTeacherId);
  assert.equal(row.selectable,false);assert.ok(row.reason);
  assert.deepEqual(f.a.school(f.actor),priorSchool);assert.deepEqual(f.a.auditLog(f.actor),audit);
  assign(f,[childIds[2]],{teacherId:f.secondTeacherId});
  const before=query(f),beforeAudit=f.a.auditLog(f.actor);
  denied(()=>assign(f,[childIds[0],childIds[2],childIds[1]]),409);
  denied(()=>assign(f,[childIds[0],inherited],{teacherId:f.secondTeacherId}),409);
  assert.deepEqual(query(f),before);assert.deepEqual(f.a.auditLog(f.actor),beforeAudit);
  assert.deepEqual(assign(f,[inherited,childIds[0]]),{assigned:1});
  assert.ok(!student(f,inherited).directAssignmentId);
});

// Catches classes/stages with the same ordinal being treated as the selected compatible grade.
test('candidates are enrolled in the exact supported legacy grade and cannot be forged from another track or level',t=>{
  const f=fixture(t),enrolled=children(f,1).childIds[0],unenrolled=children(f,1,{enrolled:false}).childIds[0];
  const grade5=f.a.addSchoolGrade(f.actor,{grade:5}),class5=f.a.addSchoolClass(f.actor,{gradeId:grade5,name:'Other grade',capacity:5});
  const child5=children(f,1,{grade:5,classId:class5}).childIds[0];
  const track=f.a.addSchoolTrack(f.actor,{name:'New curriculum'});
  const otherGrade=f.a.addSchoolGrade(f.actor,{trackId:track,grade:4});
  const legacyTrack=f.a.school(f.actor).grades.find(row=>row.id===f.gradeId).track_id;
  const middle=f.a.addSchoolGrade(f.actor,{trackId:legacyTrack,stage:'middle',grade:1});
  const initial=query(f),audit=f.a.auditLog(f.actor);
  assert.deepEqual(initial.students.map(row=>row.id),[enrolled]);
  assert.ok(initial.grades.some(row=>row.id===f.gradeId));
  assert.ok(initial.grades.every(row=>row.id!==otherGrade&&row.id!==middle));
  for(const gradeId of [otherGrade,middle]){
    denied(()=>query(f,{gradeId}),409);
    denied(()=>assign(f,[enrolled],{gradeId}),409);
  }
  for(const childId of [unenrolled,child5])rejectSelection(()=>assign(f,[enrolled,childId]));
  assert.deepEqual(query(f),initial);assert.deepEqual(f.a.auditLog(f.actor),audit);
});

// Catches unsupported teachers leaking into the picker or being accepted by forged writes.
test('eligible teachers must be active and teach both the selected subject and grade',t=>{
  const file=tempFile(t),f=fixture(t,file),{childIds}=children(f,1);
  const make=(name,subjects,grades)=>f.a.createTeacher(f.actor,{name,email:randomUUID()+'@example.invalid',subjects,grades,language:'ar'}).id;
  const wrongSubject=make('Wrong subject',['science'],[4]),wrongGrade=make('Wrong grade',['math'],[5]);
  const inactive=make('Inactive math',['math'],[4]),pending=make('Pending math',['math'],[4]);
  const db=raw(file);
  try {
    db.prepare('INSERT INTO account_status VALUES(?,?)').run(inactive,'suspended');
    db.prepare('INSERT INTO account_status VALUES(?,?)').run(pending,'pending');
    const state=query(f),audit=f.a.auditLog(f.actor);
    assert.ok(state.teachers.some(row=>row.id===f.teacherId));
    for(const teacherId of [wrongSubject,wrongGrade,inactive,pending]){
      assert.ok(state.teachers.every(row=>row.id!==teacherId));
      rejectSelection(()=>assign(f,childIds,{teacherId}));
    }
    for(const subject of ['invented','',null,{},'Math'])denied(()=>assign(f,childIds,{subject}),400);
    assert.deepEqual(query(f),state);assert.deepEqual(f.a.auditLog(f.actor),audit);
  }finally{db.close();}
});

// Catches missing request bounds, duplicate normalization, and partial inserts before validation.
test('batches require one to one hundred distinct UUIDs and validate every member before writing',t=>{
  const f=fixture(t),{childIds}=children(f,101),before=query(f),audit=f.a.auditLog(f.actor);
  const invalid=[undefined,null,{},'',childIds[0],[],[childIds[0],childIds[0]],['not-a-uuid'],[null],[42],[{}],[childIds[0],'not-a-uuid'],Array(1),[childIds[0],...Array(1)],childIds];
  for(const value of invalid)denied(()=>assign(f,value),400);
  rejectSelection(()=>assign(f,[childIds[0],randomUUID()]));
  assert.deepEqual(query(f),before);assert.deepEqual(f.a.auditLog(f.actor),audit);
  assert.deepEqual(assign(f,childIds.slice(0,100)),{assigned:100});
  assert.equal(events(f).length,1);
  assert.deepEqual(assign(f,[childIds[100]]),{assigned:1});
  assert.equal(events(f).length,2);
});

// Catches pagination dropping candidates and returning assigned or inactive students as selectable.
test('pagination has disjoint hundred-row pages and retained assigned students include disabled reasons',t=>{
  const f=fixture(t),{agent,childIds}=children(f,103);
  assign(f,[childIds[0]]);
  f.s.registration.setStatus(agent,{kind:'child',id:childIds[1],status:'suspended'});
  const first=query(f,{page:1}),second=query(f,{page:2});
  assert.equal(first.page,1);assert.equal(first.pages,2);assert.equal(first.total,103);assert.equal(first.students.length,100);
  assert.equal(second.page,2);assert.equal(second.pages,2);assert.equal(second.total,103);assert.equal(second.students.length,3);
  const all=[...first.students,...second.students];
  assert.deepEqual(all.map(row=>row.id).sort(),[...childIds].sort());
  assert.equal(new Set(all.map(row=>row.id)).size,103);
  assert.deepEqual(query(f,{page:1}),first);
  for(const id of childIds.slice(0,2)){
    const row=all.find(row=>row.id===id);assert.equal(row.selectable,false);assert.ok(row.reason);
  }
  const direct=all.find(row=>row.id===childIds[0]);
  assert.equal(direct.directTeacherName,'Synthetic math teacher');
  assert.equal(direct.className,'Synthetic class A');
  assert.ok(all.filter(row=>!childIds.slice(0,2).includes(row.id)).every(row=>row.selectable===true));
});

// Catches stale lifecycle/account/registration state being checked only when membership was created.
test('suspended children parents archived classes and mismatched enrollment are disabled and rejected atomically',t=>{
  const file=tempFile(t),f=fixture(t,file),active=children(f,1),suspended=children(f,1),parentSuspended=children(f,1),inconsistent=children(f,1);
  const archivedClass=f.a.addSchoolClass(f.actor,{gradeId:f.gradeId,name:'Retained archived class',capacity:2});
  const archived=children(f,1,{classId:archivedClass});
  f.s.registration.setStatus(suspended.agent,{kind:'child',id:suspended.childIds[0],status:'suspended'});
  f.s.registration.setStatus(parentSuspended.agent,{kind:'parent',id:parentSuspended.parent,status:'suspended'});
  const db=raw(file);
  try {
    // Represent externally retained historical inconsistencies, which the normal
    // administration must neither silently repair nor make assignable.
    db.prepare('INSERT INTO school_class_lifecycle VALUES(?,?,?)').run(archivedClass,'archived',1);
    db.prepare('UPDATE children SET grade=5 WHERE id=?').run(inconsistent.childIds[0]);
    const disabled=[suspended,parentSuspended,inconsistent,archived].map(group=>group.childIds[0]);
    const before=query(f),audit=f.a.auditLog(f.actor);
    for(const id of disabled){
      const row=before.students.find(row=>row.id===id);
      assert.ok(row,'Retained membership must remain visible');assert.equal(row.selectable,false);assert.ok(row.reason);
      rejectSelection(()=>assign(f,[active.childIds[0],id]));
    }
    assert.deepEqual(query(f),before);assert.deepEqual(f.a.auditLog(f.actor),audit);
    assert.equal(before.students.find(row=>row.id===active.childIds[0]).selectable,true);
    assert.deepEqual(assign(f,active.childIds),{assigned:1});
  }finally{db.close();}
});

// Catches audit emitted outside the write transaction and partially committed batch inserts.
test('an injected assignment audit failure rolls the entire batch back and permits a clean retry',t=>{
  const file=tempFile(t),f=fixture(t,file),{childIds}=children(f,3),db=raw(file);
  try {
    const before=query(f),audit=f.a.auditLog(f.actor);
    db.exec("CREATE TRIGGER fail_individuals_audit BEFORE INSERT ON admin_audit WHEN NEW.action='school.individuals.assigned' BEGIN SELECT RAISE(ABORT,'Injected individuals audit failure'); END;");
    assert.throws(()=>assign(f,childIds),/Injected individuals audit failure/);
    assert.deepEqual(query(f),before);assert.deepEqual(f.a.auditLog(f.actor),audit);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM school_teacher_students').get().n,0);
    db.exec('DROP TRIGGER fail_individuals_audit');
    assert.deepEqual(assign(f,childIds),{assigned:3});
    assert.equal(events(f).length,1);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM school_teacher_students').get().n,3);
  }finally{db.close();}
});

// Catches student-only removals silently cascading direct links or transferring them.
test('membership removal is blocked until every direct subject link is explicitly removed',t=>{
  const f=fixture(t),{childIds:[child,unaffected]}=children(f,2);
  const science=f.a.createTeacher(f.actor,{name:'Synthetic science teacher',email:randomUUID()+'@example.invalid',subjects:['science'],grades:[4],language:'ar'}).id;
  assign(f,[child]);assign(f,[child],{subject:'science',teacherId:science});
  grant(f,['school.read','school.students']);
  const mathId=student(f,child).directAssignmentId,scienceId=student(f,child,{subject:'science',teacherId:science}).directAssignmentId;
  const before=query(f),school=f.a.school(f.actor),audit=f.a.auditLog(f.actor);
  for(const actor of [f.actor,f.ids.education])denied(()=>f.a.removeSchoolAssignment(actor,{kind:'student',classId:f.classId,childId:child}),409);
  assert.deepEqual(query(f),before);assert.deepEqual(f.a.school(f.actor),school);assert.deepEqual(f.a.auditLog(f.actor),audit);
  f.a.removeSchoolAssignment(f.ids.education,{kind:'student',classId:f.classId,childId:unaffected});
  assert.ok(!f.a.school(f.actor).studentAssignments.some(row=>row.child===unaffected));
  remove(f,mathId);
  denied(()=>f.a.removeSchoolAssignment(f.actor,{kind:'student',classId:f.classId,childId:child}),409);
  assert.equal(student(f,child,{subject:'science',teacherId:science}).directAssignmentId,scienceId);
  remove(f,scienceId);
  f.a.removeSchoolAssignment(f.ids.education,{kind:'student',classId:f.classId,childId:child});
  assert.equal(query(f).total,0);
  assert.equal(f.a.school(f.actor).studentAssignments.length,0);
});

// Catches stale form targets deleting a new record after a remove/reassign cycle.
test('removal targets the immutable assignment ID and remains usable for retained inactive records',t=>{
  const file=tempFile(t),f=fixture(t,file),{agent,parent,childIds:[child]}=children(f,1),db=raw(file);
  try {
    assign(f,[child]);const first=student(f,child).directAssignmentId;
    remove(f,first);assign(f,[child]);const replacement=student(f,child).directAssignmentId;
    assert.notEqual(replacement,first);
    const before=query(f),audit=f.a.auditLog(f.actor);
    denied(()=>remove(f,first),409);
    denied(()=>remove(f,randomUUID()),409);
    assert.deepEqual(query(f),before);assert.deepEqual(f.a.auditLog(f.actor),audit);
    f.s.registration.setStatus(agent,{kind:'child',id:child,status:'suspended'});
    f.s.registration.setStatus(agent,{kind:'parent',id:parent,status:'suspended'});
    db.prepare('INSERT INTO account_status VALUES(?,?)').run(f.teacherId,'suspended');
    grant(f,['school.read','school.individuals']);
    remove(f,replacement,f.ids.education);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM school_teacher_students WHERE child=?').get(child).n,0);
    assert.equal(f.a.school(f.actor).studentAssignments.find(row=>row.child===child).class_id,f.classId);
    assert.equal(db.prepare('SELECT status FROM child_status WHERE child=?').get(child).status,'suspended');
    assert.equal(db.prepare('SELECT status FROM account_status WHERE user=?').get(parent).status,'suspended');
    assert.equal(db.prepare('SELECT status FROM account_status WHERE user=?').get(f.teacherId).status,'suspended');
  }finally{db.close();}
});

// Catches the legacy class API ignoring direct links or deleting them as a side effect.
test('class teacher writes honor direct exclusivity and removing an inherited teacher preserves direct links',t=>{
  const f=fixture(t),{childIds}=children(f,2);
  assign(f,[childIds[0]]);
  const directId=student(f,childIds[0]).directAssignmentId,before=query(f),school=f.a.school(f.actor),audit=f.a.auditLog(f.actor);
  denied(()=>f.a.assignSchoolTeacher(f.actor,{classId:f.classId,subject:'math',teacherId:f.secondTeacherId}),409);
  assert.deepEqual(query(f),before);assert.deepEqual(f.a.school(f.actor),school);assert.deepEqual(f.a.auditLog(f.actor),audit);
  f.a.assignSchoolTeacher(f.actor,{classId:f.classId,subject:'math',teacherId:f.teacherId});
  assert.equal(student(f,childIds[0]).directAssignmentId,directId);
  assert.equal(student(f,childIds[0]).inheritedTeacherId,f.teacherId);
  assert.equal(student(f,childIds[1]).inheritedTeacherId,f.teacherId);
  const inheritedAudit=f.a.auditLog(f.actor);
  assert.deepEqual(assign(f,childIds),{assigned:0});
  assert.deepEqual(f.a.auditLog(f.actor),inheritedAudit);
  f.a.removeSchoolAssignment(f.actor,{kind:'teacher',classId:f.classId,subject:'math',teacherId:f.teacherId});
  assert.equal(student(f,childIds[0]).directAssignmentId,directId);
  assert.ok(!student(f,childIds[0]).inheritedTeacherId);
  assert.equal(student(f,childIds[1]).selectable,true);
  assert.ok(!student(f,childIds[1]).directAssignmentId);
});

// Catches suspended effective teachers incorrectly treated as unassigned.
test('a retained inactive inherited teacher still blocks a competing direct teacher',t=>{
  const file=tempFile(t),f=fixture(t,file),{childIds}=children(f,1),db=raw(file);
  try {
    f.a.assignSchoolTeacher(f.actor,{classId:f.classId,subject:'math',teacherId:f.teacherId});
    db.prepare('INSERT INTO account_status VALUES(?,?)').run(f.teacherId,'suspended');
    const before=query(f,{teacherId:f.secondTeacherId}),audit=f.a.auditLog(f.actor);
    assert.equal(before.students[0].inheritedTeacherId,f.teacherId);
    assert.equal(before.students[0].selectable,false);assert.ok(before.students[0].reason);
    denied(()=>assign(f,childIds,{teacherId:f.secondTeacherId}),409);
    assert.deepEqual(query(f,{teacherId:f.secondTeacherId}),before);assert.deepEqual(f.a.auditLog(f.actor),audit);
  }finally{db.close();}
});

// Catches a missing database-level uniqueness or membership-context reference.
test('database constraints enforce child plus subject uniqueness and exact enrollment context',t=>{
  const file=tempFile(t),f=fixture(t,file),{childIds:[child]}=children(f,1),db=raw(file);
  try {
    assign(f,[child]);
    const existing=db.prepare('SELECT * FROM school_teacher_students WHERE child=?').get(child);
    assert.equal(existing.child,child);assert.equal(existing.subject,'math');assert.equal(existing.teacher,f.teacherId);
    assert.equal(existing.class_id,f.classId);assert.equal(existing.actor,f.actor);assert.ok(Number.isInteger(existing.created));
    const insert=(overrides={})=>{
      const row={...existing,id:randomUUID(),...overrides};
      return db.prepare('INSERT INTO school_teacher_students(id,child,subject,teacher,class_id,actor,created) VALUES(?,?,?,?,?,?,?)').run(row.id,row.child,row.subject,row.teacher,row.class_id,row.actor,row.created);
    };
    assert.throws(()=>insert({teacher:f.secondTeacherId}),/UNIQUE constraint/);
    const wrongClass=f.a.addSchoolClass(f.actor,{gradeId:f.gradeId,name:'Different membership context',capacity:3});
    assert.throws(()=>insert({subject:'science',class_id:wrongClass}),/FOREIGN KEY/);
    assert.throws(()=>insert({subject:'science',child:randomUUID()}),/FOREIGN KEY/);
    assert.throws(()=>insert({subject:'science',teacher:randomUUID()}),/FOREIGN KEY/);
    assert.throws(()=>insert({subject:'science',actor:randomUUID()}),/FOREIGN KEY/);
    assert.throws(()=>db.prepare('DELETE FROM school_student_assignments WHERE child=?').run(child),/FOREIGN KEY/);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM school_teacher_students WHERE child=?').get(child).n,1);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  }finally{db.close();}
});

// Catches migration touching original relationships/shared classroom data or losing direct records on reopen.
test('additive initialization and reopening preserve old school links shared data and immutable direct assignments',t=>{
  const file=tempFile(t),s=openStore(file),a=s.admin,ids=a.demo(),actor=ids.supervisor;
  const f={s,a,ids,actor,gradeId:a.addSchoolGrade(actor,{grade:4})};
  f.classId=a.addSchoolClass(actor,{gradeId:f.gradeId,name:'Legacy populated class',capacity:10});
  f.teacherId=a.education(actor).teachers[0].id;
  const {parent,childIds}=children(f,2);
  const offer=s.offers(parent,childIds[0],'math')[0];
  assert.ok(offer,'The preservation fixture must have a real synthetic booking');
  s.book(parent,childIds[0],offer.id,randomUUID());
  a.assignSchoolTeacher(actor,{classId:f.classId,subject:'math',teacherId:f.teacherId});
  a.assignSchoolSupervisor(actor,{teacherId:f.teacherId,supervisorId:ids.education});
  s.close();
  let db=raw(file),tables,before;
  try {
    tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'school_teacher_students' ORDER BY name").all().map(row=>row.name);
    before=snapshot(db,tables);
    for(const table of ['users','children','slots','bookings','school_student_assignments','school_teacher_assignments','school_supervision'])assert.ok(before[table].length>0,table+' must be populated');
    db.exec('DROP TABLE school_teacher_students');
  }finally{db.close();}
  let reopened=openStore(file);reopened.close();
  db=raw(file);
  try {assert.deepEqual(snapshot(db,tables),before);assert.equal(db.prepare('SELECT COUNT(*) n FROM school_teacher_students').get().n,0);}
  finally{db.close();}
  reopened=openStore(file);
  let direct;
  try {
    // Other-subject direct assignment coexists with the original math class link.
    const science=reopened.admin.createTeacher(actor,{name:'Persistent science teacher',email:randomUUID()+'@example.invalid',subjects:['science'],grades:[4],language:'ar'}).id;
    reopened.admin.assignSchoolTeacherStudents(actor,{gradeId:f.gradeId,subject:'science',teacherId:science,childIds});
    direct=reopened.admin.schoolTeacherStudents(actor,{gradeId:f.gradeId,subject:'science',teacherId:science});
    assert.equal(direct.students.length,2);
  }finally{reopened.close();}
  db=raw(file);
  let saved,shared;
  try {saved=snapshot(db,['school_teacher_students','school_student_assignments','school_teacher_assignments','school_supervision']);shared=snapshot(db,['children','slots','bookings']);}
  finally{db.close();}
  for(let i=0;i<2;i++){
    reopened=openStore(file);
    try {assert.deepEqual(reopened.admin.schoolTeacherStudents(actor,{gradeId:f.gradeId,subject:'science',teacherId:direct.teacher.id}),direct);}
    finally{reopened.close();}
  }
  db=raw(file);
  try {
    assert.deepEqual(snapshot(db,Object.keys(saved)),saved);assert.deepEqual(snapshot(db,Object.keys(shared)),shared);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  }finally{db.close();}
});
function raceWorker(config){
  const process=fork(new URL('./helpers/school-016-race-worker.mjs',import.meta.url),[JSON.stringify(config)],{stdio:['ignore','pipe','pipe','ipc'],execArgv:[]});
  const received=[],waiters=[];
  let failure,stderr='';
  const rejectAll=error=>{failure=error;for(const waiter of waiters.splice(0)){clearTimeout(waiter.timer);waiter.reject(error);}};
  process.stderr.on('data',chunk=>{stderr+=chunk;});
  process.on('error',rejectAll);
  process.on('message',message=>{
    if(message.type==='fatal'){rejectAll(new Error(message.message));return;}
    received.push(message);
    for(const waiter of [...waiters])if(waiter.type===message.type){
      waiters.splice(waiters.indexOf(waiter),1);clearTimeout(waiter.timer);waiter.resolve(message);
    }
  });
  const exited=new Promise(resolve=>process.once('exit',(code,signal)=>{
    resolve({code,signal});
    if(!received.some(message=>message.type==='result'))rejectAll(new Error(`Race worker exited ${code}/${signal}: ${stderr}`));
  }));
  const waitFor=type=>{
    const existing=received.find(message=>message.type===type);
    if(existing)return Promise.resolve(existing);
    if(failure)return Promise.reject(failure);
    return new Promise((resolve,reject)=>{
      const waiter={type,resolve,reject};
      waiter.timer=setTimeout(()=>{
        waiters.splice(waiters.indexOf(waiter),1);
        reject(new Error(`Race worker timed out waiting for ${type}: ${stderr}`));
      },15000);
      waiters.push(waiter);
    });
  };
  return {process,waitFor,exited};
}

async function race(file,operations){
  const workers=[],lock=raw(file);
  let locked=false;
  try {
    // Schema initialization is not the operation under test. Initialize each
    // independent connection before racing only the two requested mutations.
    const ready=[];
    for(const operation of operations){
      const worker=raceWorker({file,...operation});workers.push(worker);
      ready.push(await worker.waitFor('ready'));
    }
    assert.notEqual(ready[0].pid,ready[1].pid);
    assert.ok(ready.every(message=>message.pid!==process.pid));
    // Both connections must finish initialization first. Hold a third connection's
    // write lock until both contenders have been told to attempt their mutations.
    lock.exec('BEGIN IMMEDIATE');locked=true;
    const attempting=workers.map(worker=>worker.waitFor('attempting'));
    for(const worker of workers)worker.process.send({type:'go'});
    await Promise.all(attempting);
    lock.exec('COMMIT');locked=false;
    const results=await Promise.all(workers.map(worker=>worker.waitFor('result')));
    const exits=await Promise.all(workers.map(worker=>worker.exited));
    assert.ok(exits.every(exit=>exit.code===0),JSON.stringify(exits));
    return results;
  }finally{
    if(locked)lock.exec('ROLLBACK');
    lock.close();
    for(const worker of workers)if(worker.process.exitCode===null&&worker.process.signalCode===null)worker.process.kill();
    await Promise.all(workers.map(worker=>worker.exited));
  }
}


// Catches a check-then-write race invisible to Promise.all on one synchronous store.
test('independent SQLite processes competing for the same student subject commit one teacher and one batch audit',async t=>{
  const file=tempFile(t),f=fixture(t,file),{childIds}=children(f,3);
  f.close();
  for(const child of childIds){
    const teachers=[f.teacherId,f.secondTeacherId];
    const results=await race(file,teachers.map(teacherId=>({actor:f.actor,operation:'assignSchoolTeacherStudents',values:{gradeId:f.gradeId,subject:'math',teacherId,childIds:[child]}})));
    assert.equal(results.filter(result=>result.ok).length,1,JSON.stringify(results));
    assert.deepEqual(results.filter(result=>!result.ok).map(result=>result.status),[409]);
    const db=raw(file);
    try {
      const rows=db.prepare('SELECT * FROM school_teacher_students WHERE child=? AND subject=?').all(child,'math');
      assert.equal(rows.length,1);assert.equal(rows[0].teacher,teachers[results.findIndex(result=>result.ok)]);
      const audit=db.prepare("SELECT details FROM admin_audit WHERE action='school.individuals.assigned'").all();
      assert.equal(audit.length,childIds.indexOf(child)+1);
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
    }finally{db.close();}
  }
});

// Catches each API validating only its own relation while a competing relation commits.
test('class teacher and direct teacher races serialize to one compatible effective assignment',async t=>{
  const file=tempFile(t),f=fixture(t,file),classes=[f.classId];
  for(let i=1;i<3;i++)classes.push(f.a.addSchoolClass(f.actor,{gradeId:f.gradeId,name:'Class race '+i,capacity:3}));
  const childrenByClass=classes.map(classId=>children(f,1,{classId}).childIds[0]);
  f.close();
  for(const [index,classId] of classes.entries()){
    const child=childrenByClass[index];
    const results=await race(file,[
      {actor:f.actor,operation:'assignSchoolTeacherStudents',values:{gradeId:f.gradeId,subject:'math',teacherId:f.teacherId,childIds:[child]}},
      {actor:f.actor,operation:'assignSchoolTeacher',values:{classId,subject:'math',teacherId:f.secondTeacherId}}
    ]);
    assert.equal(results.filter(result=>result.ok).length,1,JSON.stringify(results));
    assert.deepEqual(results.filter(result=>!result.ok).map(result=>result.status),[409]);
    const db=raw(file);
    try {
      const direct=db.prepare('SELECT * FROM school_teacher_students WHERE child=?').all(child);
      const inherited=db.prepare('SELECT * FROM school_teacher_assignments WHERE class_id=?').all(classId);
      assert.equal(direct.length,results[0].ok?1:0);assert.equal(inherited.length,results[1].ok?1:0);
      if(results[0].ok)assert.equal(direct[0].teacher,f.teacherId);
      if(results[1].ok)assert.equal(inherited[0].teacher,f.secondTeacherId);
      const classAudit=db.prepare("SELECT COUNT(*) n FROM admin_audit WHERE action='school.teacher.assigned' AND target=?").get(classId).n;
      assert.equal(classAudit,results[1].ok?1:0);
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
    }finally{db.close();}
  }
});

// Catches a stale membership validation followed by insertion after enrollment was removed.
test('direct assignment racing membership removal either preserves both links or removes only the unassigned membership',async t=>{
  const file=tempFile(t),f=fixture(t,file),{childIds}=children(f,3);
  f.close();
  for(const child of childIds){
    const results=await race(file,[
      {actor:f.actor,operation:'assignSchoolTeacherStudents',values:{gradeId:f.gradeId,subject:'math',teacherId:f.teacherId,childIds:[child]}},
      {actor:f.actor,operation:'removeSchoolAssignment',values:{kind:'student',classId:f.classId,childId:child}}
    ]);
    assert.equal(results.filter(result=>result.ok).length,1,JSON.stringify(results));
    assert.ok(results.filter(result=>!result.ok).every(result=>[404,409].includes(result.status)),JSON.stringify(results));
    const db=raw(file);
    try {
      const direct=db.prepare('SELECT COUNT(*) n FROM school_teacher_students WHERE child=?').get(child).n;
      const membership=db.prepare('SELECT COUNT(*) n FROM school_student_assignments WHERE child=?').get(child).n;
      assert.equal(direct,results[0].ok?1:0);assert.equal(membership,results[0].ok?1:0);
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
    }finally{db.close();}
  }
});

// Catches same-teacher replay bypassing the current active-state checks for existing links.
test('same-teacher no-op replay revalidates inactive enrollment before writing any new member of the batch',t=>{
  const f=fixture(t),existing=children(f,1),fresh=children(f,1),child=existing.childIds[0];
  assign(f,[child]);
  f.s.registration.setStatus(existing.agent,{kind:'child',id:child,status:'suspended'});
  const before=query(f),audit=f.a.auditLog(f.actor);
  denied(()=>assign(f,[fresh.childIds[0],child]),409);
  assert.deepEqual(query(f),before);assert.deepEqual(f.a.auditLog(f.actor),audit);
  f.s.registration.setStatus(existing.agent,{kind:'child',id:child,status:'active'});
  f.s.registration.setStatus(existing.agent,{kind:'parent',id:existing.parent,status:'suspended'});
  const parentState=query(f),parentAudit=f.a.auditLog(f.actor);
  denied(()=>assign(f,[fresh.childIds[0],child]),409);
  assert.deepEqual(query(f),parentState);assert.deepEqual(f.a.auditLog(f.actor),parentAudit);
});

// Catches malformed or out-of-range selectors reaching SQL and silently changing the selection.
test('candidate listing rejects malformed selection and pagination without exposing another grade',t=>{
  const f=fixture(t);children(f,1);
  const before=query(f),audit=f.a.auditLog(f.actor);
  for(const page of [0,-1,1.5,'1',NaN,Infinity,null,{},[]])denied(()=>query(f,{page}),400);
  denied(()=>query(f,{page:2}),409);
  for(const gradeId of ['not-a-uuid',null,{},[]])denied(()=>query(f,{gradeId}),400);
  for(const teacherId of ['not-a-uuid',null,{},[]])denied(()=>query(f,{teacherId}),400);
  for(const subject of ['unknown',null,{},[]])denied(()=>query(f,{subject}),400);
  assert.deepEqual(query(f),before);assert.deepEqual(f.a.auditLog(f.actor),audit);
});

// Catches treating an idempotent concurrent replay as a conflict or emitting duplicate audits.
test('independent processes assigning the same teacher replay idempotently with one stored link and one audit',async t=>{
  const file=tempFile(t),f=fixture(t,file),{childIds}=children(f,1);
  f.close();
  const operation={actor:f.actor,operation:'assignSchoolTeacherStudents',values:{gradeId:f.gradeId,subject:'math',teacherId:f.teacherId,childIds}};
  const results=await race(file,[operation,operation]);
  assert.ok(results.every(result=>result.ok),JSON.stringify(results));
  assert.deepEqual(results.map(result=>result.value.assigned).sort(),[0,1]);
  const db=raw(file);
  try {
    assert.equal(db.prepare('SELECT COUNT(*) n FROM school_teacher_students').get().n,1);
    assert.equal(db.prepare("SELECT COUNT(*) n FROM admin_audit WHERE action='school.individuals.assigned'").get().n,1);
  }finally{db.close();}
});

// Catches validating overlapping batches outside their write transaction or leaking a losing batch's unique student.
test('overlapping competing batches commit one whole batch and leave the losing unique student unassigned',async t=>{
  const file=tempFile(t),f=fixture(t,file),{childIds:[shared,left,right]}=children(f,3);
  f.close();
  const teachers=[f.teacherId,f.secondTeacherId],batches=[[left,shared],[right,shared]];
  const results=await race(file,teachers.map((teacherId,index)=>({actor:f.actor,operation:'assignSchoolTeacherStudents',values:{gradeId:f.gradeId,subject:'math',teacherId,childIds:batches[index]}})));
  assert.equal(results.filter(result=>result.ok).length,1,JSON.stringify(results));
  assert.deepEqual(results.filter(result=>!result.ok).map(result=>result.status),[409]);
  const winner=results.findIndex(result=>result.ok),db=raw(file);
  try {
    const rows=db.prepare('SELECT child,teacher FROM school_teacher_students ORDER BY child').all();
    assert.deepEqual(rows.map(row=>row.child),[...batches[winner]].sort());
    assert.ok(rows.every(row=>row.teacher===teachers[winner]));
    const audit=db.prepare("SELECT details FROM admin_audit WHERE action='school.individuals.assigned'").all();
    assert.equal(audit.length,1);
    assert.deepEqual(JSON.parse(audit[0].details).childIds.sort(),[...batches[winner]].sort());
  }finally{db.close();}
});
