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
  const dir=mkdtempSync(join(tmpdir(),'school-020-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  return join(dir,'synthetic.sqlite');
}
function fixture(t,file=':memory:',capacity=200){
  const s=openStore(file),a=s.admin,ids=a.demo(),actor=ids.supervisor;
  let closed=false;
  const close=()=>{if(!closed){s.close();closed=true;}};
  t.after(close);
  const gradeId=a.addSchoolGrade(actor,{grade:4});
  const classId=a.addSchoolClass(actor,{gradeId,name:'Synthetic class A',capacity});
  return {s,a,ids,actor,gradeId,classId,close};
}
function children(f,count=3,{grade=4,parentStatus='active'}={}){
  const agent=f.a.switchDemo(f.actor,'registration_agent');
  const {id:parent}=f.s.registration.addParent(agent,{name:'Synthetic enrollment parent',email:randomUUID()+'@example.invalid'});
  if(parentStatus!=='pending')f.s.registration.setStatus(agent,{kind:'parent',id:parent,status:parentStatus});
  const childIds=Array.from({length:count},(_,i)=>f.s.registration.addChild(agent,{parent,name:'Synthetic child '+String(i).padStart(3,'0'),grade}));
  return {agent,parent,childIds};
}
const assign=(f,childIds,values={},actor=f.actor)=>f.a.assignSchoolStudents(actor,{classId:f.classId,childIds,...values});
const state=f=>f.a.school(f.actor);
const events=f=>f.a.auditLog(f.actor).filter(row=>row.action==='school.student.assigned');
function grant(f,permissions){
  const member=f.a.members(f.actor).find(row=>row.id===f.ids.education);
  f.a.updateMember(f.actor,member.id,{...member,permissions});
}
function raw(file){
  const db=new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  return db;
}

test('bulk enrollment admits all selected students and records the existing per-child audit',t=>{
  const f=fixture(t),{childIds}=children(f);
  assert.equal(typeof f.a.assignSchoolStudents,'function','The bulk class enrollment API must be available');
  assert.deepEqual(assign(f,childIds),{assigned:3});
  assert.deepEqual(state(f).studentAssignments.map(row=>row.child).sort(),[...childIds].sort());
  assert.ok(state(f).studentAssignments.every(row=>row.class_id===f.classId));
  const cls=state(f).classes.find(row=>row.id===f.classId);
  assert.equal(cls.studentCount,3);assert.equal(cls.seatsAvailable,197);
  assert.deepEqual(events(f).map(row=>row.target).sort(),[...childIds].sort());
  assert.ok(events(f).every(row=>row.details.classId===f.classId));
});

test('bulk enrollment accepts exactly one and exactly one hundred students',t=>{
  const f=fixture(t),{childIds}=children(f,101);
  assert.deepEqual(assign(f,childIds.slice(0,1)),{assigned:1});
  assert.deepEqual(assign(f,childIds.slice(1)),{assigned:100});
  assert.equal(state(f).studentAssignments.length,101);
  assert.equal(events(f).length,101);
});

test('malformed duplicate oversized and sparse selections reject without admissions or audits',t=>{
  const f=fixture(t),{childIds}=children(f,101),before=state(f),audit=f.a.auditLog(f.actor);
  const sparse=[childIds[0],,childIds[1]];
  const invalid=[undefined,null,{},childIds[0],new Set(childIds),{0:childIds[0],length:1},[],childIds,
    [childIds[0],childIds[0]],[childIds[0],null],[childIds[0],undefined],[childIds[0],7],
    [childIds[0],''],[childIds[0],'not-a-uuid'],[childIds[0],childIds[1]+'x'],
    [childIds[0],childIds[1].replaceAll('-','')],[childIds[0],' '+childIds[1]],new Array(1),sparse];
  for(const ids of invalid)denied(()=>assign(f,ids),400);
  assert.deepEqual(state(f),before);assert.deepEqual(f.a.auditLog(f.actor),audit);
});

test('student projection exposes active defaults and suspended children without hiding retained membership',t=>{
  const f=fixture(t),{agent,childIds}=children(f,2);
  const legacy=f.a.registration(f.actor).find(row=>row.grade===4&& !childIds.includes(row.id));
  assert.equal(state(f).students.find(row=>row.id===legacy.id).status,'active');
  assert.equal(state(f).students.find(row=>row.id===childIds[0]).status,'active');
  f.a.assignSchoolStudent(f.actor,{classId:f.classId,childId:childIds[0]});
  f.s.registration.setStatus(agent,{kind:'child',id:childIds[0],status:'suspended'});
  assert.equal(state(f).students.find(row=>row.id===childIds[0]).status,'suspended');
  assert.equal(state(f).studentAssignments.find(row=>row.child===childIds[0]).class_id,f.classId);
  assert.equal(state(f).classes.find(row=>row.id===f.classId).studentCount,1);
});

test('a later suspended missing foreign-scope or wrong-grade child rolls back earlier admissions and audits',t=>{
  const f=fixture(t),own=children(f,2),wrongGrade=children(f,1,{grade:5}),other=f.a.demo();
  const foreign=f.a.registration(other.supervisor).find(row=>row.grade===4).id;
  f.s.registration.setStatus(own.agent,{kind:'child',id:own.childIds[1],status:'suspended'});
  const before=state(f),audit=f.a.auditLog(f.actor);
  for(const [id,status] of [[own.childIds[1],404],[randomUUID(),404],[foreign,404],[wrongGrade.childIds[0],400]]){
    denied(()=>assign(f,[own.childIds[0],id]),status);
    assert.deepEqual(state(f),before);assert.deepEqual(f.a.auditLog(f.actor),audit);
  }
  assert.deepEqual(assign(f,[own.childIds[0]]),{assigned:1});
});

test('foreign missing archived nonlegacy and nonprimary classes never admit students by matching grade alone',t=>{
  const f=fixture(t),{childIds}=children(f,1),gradeOne=children(f,1,{grade:1}),other=f.a.demo();
  const foreignGrade=f.a.addSchoolGrade(other.supervisor,{grade:4});
  const foreignClass=f.a.addSchoolClass(other.supervisor,{gradeId:foreignGrade,name:'Foreign class',capacity:3});
  const archived=f.a.addSchoolClass(f.actor,{gradeId:f.gradeId,name:'Archived class',capacity:3});
  f.a.updateSchoolClass(f.actor,{classId:archived,name:'Archived class',state:'archived',revision:0});
  const trackId=f.a.addSchoolTrack(f.actor,{name:'Separate synthetic path'});
  const nonlegacy=f.a.addSchoolClass(f.actor,{trackId,levelKey:'primary:4',name:'Nonlegacy class',capacity:3});
  const legacy=state(f).tracks.find(row=>row.legacy===1).id;
  const middle=f.a.addSchoolClass(f.actor,{trackId:legacy,levelKey:'middle:1',name:'Middle class',capacity:3});
  const secondary=f.a.addSchoolClass(f.actor,{trackId:legacy,levelKey:'secondary:1',name:'Secondary class',capacity:3});
  const before=state(f),audit=f.a.auditLog(f.actor);
  for(const [classId,ids,status] of [[foreignClass,childIds,404],[randomUUID(),childIds,404],
    [archived,childIds,409],[nonlegacy,childIds,409],[middle,gradeOne.childIds,409],[secondary,gradeOne.childIds,409]]){
    denied(()=>assign(f,ids,{classId}),status);
    assert.deepEqual(state(f),before);assert.deepEqual(f.a.auditLog(f.actor),audit);
  }
});

test('bulk admission preserves single-admission semantics for pending and suspended parent accounts',t=>{
  const f=fixture(t);
  for(const parentStatus of ['pending','suspended']){
    const {childIds}=children(f,3,{parentStatus});
    f.a.assignSchoolStudent(f.actor,{classId:f.classId,childId:childIds[0]});
    assert.deepEqual(assign(f,childIds.slice(1)),{assigned:2});
  }
  assert.equal(state(f).studentAssignments.length,6);assert.equal(events(f).length,6);
});

test('existing membership in either the same class or another class rejects the entire batch without transfers',t=>{
  const f=fixture(t),{childIds}=children(f,3);
  const second=f.a.addSchoolClass(f.actor,{gradeId:f.gradeId,name:'Synthetic class B',capacity:3});
  f.a.assignSchoolStudent(f.actor,{classId:f.classId,childId:childIds[1]});
  f.a.assignSchoolStudent(f.actor,{classId:second,childId:childIds[2]});
  const before=state(f),audit=f.a.auditLog(f.actor);
  for(const enrolled of childIds.slice(1)){
    denied(()=>assign(f,[childIds[0],enrolled]),409);
    assert.deepEqual(state(f),before);assert.deepEqual(f.a.auditLog(f.actor),audit);
  }
  denied(()=>assign(f,[childIds[1]]),409);
  assert.deepEqual(state(f),before);assert.deepEqual(f.a.auditLog(f.actor),audit);
});

test('bulk admission requires an explicit current school.students grant and rejects revocation',t=>{
  const f=fixture(t),{childIds}=children(f,2);
  for(const permissions of [[],['school.read'],['school.read','school.teachers'],['school.read','school.individuals']]){
    grant(f,permissions);
    denied(()=>assign(f,childIds,{},f.ids.education),403);
    assert.equal(state(f).studentAssignments.length,0);assert.equal(events(f).length,0);
  }
  grant(f,['school.read','school.students']);
  assert.deepEqual(assign(f,[childIds[0]],{},f.ids.education),{assigned:1});
  grant(f,['school.read']);
  const before=state(f),audit=f.a.auditLog(f.actor);
  denied(()=>assign(f,[childIds[1]],{},f.ids.education),403);
  assert.deepEqual(state(f),before);assert.deepEqual(f.a.auditLog(f.actor),audit);
});

test('all seats including suspended members count and a batch cannot partially fill the last seat',t=>{
  const f=fixture(t,':memory:',2),{agent,childIds}=children(f,3);
  f.a.assignSchoolStudent(f.actor,{classId:f.classId,childId:childIds[0]});
  f.s.registration.setStatus(agent,{kind:'child',id:childIds[0],status:'suspended'});
  const before=state(f),audit=f.a.auditLog(f.actor);
  denied(()=>assign(f,childIds.slice(1)),409);
  assert.deepEqual(state(f),before);assert.deepEqual(f.a.auditLog(f.actor),audit);
  assert.deepEqual(assign(f,[childIds[1]]),{assigned:1});
  denied(()=>assign(f,[childIds[2]]),409);
  assert.equal(state(f).classes.find(row=>row.id===f.classId).studentCount,2);
  assert.equal(state(f).classes.find(row=>row.id===f.classId).seatsAvailable,0);
  assert.equal(events(f).length,2);
});

test('a legacy class with unspecified capacity rejects bulk admission until capacity is explicitly set',t=>{
  const file=tempFile(t),f=fixture(t,file),{childIds}=children(f,2),db=raw(file);
  try {
    db.prepare('DELETE FROM school_class_capacity WHERE class_id=?').run(f.classId);
    const before=state(f),audit=f.a.auditLog(f.actor);
    denied(()=>assign(f,childIds),409);
    assert.deepEqual(state(f),before);assert.deepEqual(f.a.auditLog(f.actor),audit);
    f.a.updateSchoolClassCapacity(f.actor,{classId:f.classId,capacity:2,revision:0});
    assert.deepEqual(assign(f,childIds),{assigned:2});
  }finally{db.close();}
});

test('a later per-child audit failure rolls back the entire batch and all its audit entries',t=>{
  const file=tempFile(t),f=fixture(t,file),{childIds}=children(f),db=raw(file);
  try {
    const before=state(f),audit=f.a.auditLog(f.actor);
    db.exec(`CREATE TRIGGER fail_later_enrollment_audit BEFORE INSERT ON admin_audit
      WHEN NEW.action='school.student.assigned' AND NEW.target='${childIds[1]}'
      BEGIN SELECT RAISE(ABORT,'Injected later enrollment audit failure'); END;`);
    assert.throws(()=>assign(f,childIds),/Injected later enrollment audit failure/);
    assert.deepEqual(state(f),before);assert.deepEqual(f.a.auditLog(f.actor),audit);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM school_student_assignments').get().n,0);
    db.exec('DROP TRIGGER fail_later_enrollment_audit');
    assert.deepEqual(assign(f,childIds),{assigned:3});assert.equal(events(f).length,3);
  }finally{db.close();}
});

test('each nested admission rechecks authority and a mid-batch permission change rolls everything back',t=>{
  const file=tempFile(t),f=fixture(t,file),{childIds}=children(f),db=raw(file);
  grant(f,['school.read','school.students']);
  try {
    const before=state(f),audit=f.a.auditLog(f.actor);
    db.exec(`CREATE TRIGGER revoke_during_bulk AFTER INSERT ON school_student_assignments
      WHEN NEW.child='${childIds[0]}' BEGIN
      UPDATE admin_members SET permissions='["school.read"]' WHERE user='${f.ids.education}'; END;`);
    denied(()=>assign(f,childIds,{},f.ids.education),403);
    assert.deepEqual(state(f),before);assert.deepEqual(f.a.auditLog(f.actor),audit);
    assert.ok(f.a.profile(f.ids.education).permissions.includes('school.students'));
    db.exec('DROP TRIGGER revoke_during_bulk');
    assert.deepEqual(assign(f,childIds,{},f.ids.education),{assigned:3});
  }finally{db.close();}
});

test('bulk admission preserves individual-link guards instead of repairing or transferring inconsistent history',t=>{
  const file=tempFile(t),f=fixture(t,file),{childIds}=children(f,2),db=raw(file);
  const otherClass=f.a.addSchoolClass(f.actor,{gradeId:f.gradeId,name:'Synthetic class B',capacity:3});
  const firstTeacher=f.a.createTeacher(f.actor,{name:'Synthetic first teacher',email:randomUUID()+'@example.invalid',subjects:['math'],grades:[4],language:'ar'}).id;
  const otherTeacher=f.a.createTeacher(f.actor,{name:'Synthetic other teacher',email:randomUUID()+'@example.invalid',subjects:['math'],grades:[4],language:'ar'}).id;
  f.a.assignSchoolTeacher(f.actor,{classId:f.classId,teacherId:firstTeacher,subject:'math'});
  try {
    // Synthetic historical orphans test the same explicit compatibility guard
    // used by single admission. Normal application APIs cannot create these.
    db.exec('PRAGMA foreign_keys=OFF');
    for(const [classId,teacher] of [[otherClass,firstTeacher],[f.classId,otherTeacher]]){
      const linkId=randomUUID();
      db.prepare('INSERT INTO school_teacher_students VALUES(?,?,?,?,?,?,?)').run(linkId,childIds[1],'math',teacher,classId,f.actor,Date.now());
      const before=state(f),audit=f.a.auditLog(f.actor),link=db.prepare('SELECT * FROM school_teacher_students WHERE id=?').get(linkId);
      denied(()=>assign(f,childIds),409);
      assert.deepEqual(state(f),before);assert.deepEqual(f.a.auditLog(f.actor),audit);
      assert.deepEqual(db.prepare('SELECT * FROM school_teacher_students WHERE id=?').get(linkId),link);
      db.prepare('DELETE FROM school_teacher_students WHERE id=?').run(linkId);
    }
    db.exec('PRAGMA foreign_keys=ON');
    assert.deepEqual(assign(f,childIds),{assigned:2});
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

test('independent processes with overlapping batches commit one whole class membership set and no losing audits',async t=>{
  const file=tempFile(t),f=fixture(t,file),{childIds}=children(f,9);
  const classes=Array.from({length:6},(_,i)=>f.a.addSchoolClass(f.actor,{gradeId:f.gradeId,name:'Overlap class '+i,capacity:3}));
  f.close();
  for(let round=0;round<3;round++){
    const [first,second,shared]=childIds.slice(round*3,round*3+3);
    const batches=[[first,shared],[second,shared]],targets=classes.slice(round*2,round*2+2);
    const results=await race(file,batches.map((childIds,index)=>({actor:f.actor,operation:'assignSchoolStudents',values:{classId:targets[index],childIds}})));
    assert.equal(results.filter(result=>result.ok).length,1,JSON.stringify(results));
    assert.deepEqual(results.filter(result=>!result.ok).map(result=>result.status),[409]);
    const winner=results.findIndex(result=>result.ok),db=raw(file);
    try {
      assert.deepEqual(results[winner].value,{assigned:2});
      const rows=db.prepare('SELECT child,class_id FROM school_student_assignments WHERE class_id IN (?,?) ORDER BY child').all(...targets);
      assert.deepEqual(rows.map(row=>row.child),[...batches[winner]].sort());
      assert.ok(rows.every(row=>row.class_id===targets[winner]));
      assert.equal(db.prepare('SELECT COUNT(*) n FROM school_student_assignments WHERE child=?').get(shared).n,1);
      const audit=db.prepare("SELECT target,details FROM admin_audit WHERE action='school.student.assigned' AND target IN (?,?,?) ORDER BY target").all(first,second,shared);
      assert.deepEqual(audit.map(row=>row.target),[...batches[winner]].sort());
      assert.ok(audit.every(row=>JSON.parse(row.details).classId===targets[winner]));
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
    }finally{db.close();}
  }
});

test('independent processes competing for the last two seats commit exactly one complete batch',async t=>{
  const file=tempFile(t),f=fixture(t,file),{childIds}=children(f,15);
  const classes=Array.from({length:3},(_,i)=>f.a.addSchoolClass(f.actor,{gradeId:f.gradeId,name:'Last seats class '+i,capacity:3}));
  for(const [round,classId] of classes.entries())f.a.assignSchoolStudent(f.actor,{classId,childId:childIds[round*5]});
  f.close();
  for(const [round,classId] of classes.entries()){
    const [existing,...candidates]=childIds.slice(round*5,round*5+5),batches=[candidates.slice(0,2),candidates.slice(2)];
    const results=await race(file,batches.map(childIds=>({actor:f.actor,operation:'assignSchoolStudents',values:{classId,childIds}})));
    assert.equal(results.filter(result=>result.ok).length,1,JSON.stringify(results));
    assert.deepEqual(results.filter(result=>!result.ok).map(result=>result.status),[409]);
    const winner=results.findIndex(result=>result.ok),db=raw(file);
    try {
      const rows=db.prepare('SELECT child FROM school_student_assignments WHERE class_id=? ORDER BY child').all(classId);
      assert.deepEqual(rows.map(row=>row.child),[existing,...batches[winner]].sort());
      assert.equal(db.prepare('SELECT capacity FROM school_class_capacity WHERE class_id=?').get(classId).capacity,3);
      const audit=db.prepare("SELECT target FROM admin_audit WHERE action='school.student.assigned' AND json_extract(details,'$.classId')=? ORDER BY target").all(classId);
      assert.deepEqual(audit.map(row=>row.target),[existing,...batches[winner]].sort());
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
    }finally{db.close();}
  }
});

test('independent batch admission and capacity shrink serialize without overfill or partial admissions',async t=>{
  const file=tempFile(t),f=fixture(t,file),{childIds}=children(f,9);
  const classes=Array.from({length:3},(_,i)=>f.a.addSchoolClass(f.actor,{gradeId:f.gradeId,name:'Shrink class '+i,capacity:3}));
  for(const [round,classId] of classes.entries())f.a.assignSchoolStudent(f.actor,{classId,childId:childIds[round*3]});
  f.close();
  for(const [round,classId] of classes.entries()){
    const [existing,...candidates]=childIds.slice(round*3,round*3+3);
    const results=await race(file,[
      {actor:f.actor,operation:'assignSchoolStudents',values:{classId,childIds:candidates}},
      {actor:f.actor,operation:'updateSchoolClassCapacity',values:{classId,capacity:2,revision:0}}
    ]);
    assert.equal(results.filter(result=>result.ok).length,1,JSON.stringify(results));
    assert.deepEqual(results.filter(result=>!result.ok).map(result=>result.status),[409]);
    const admitted=results[0].ok,db=raw(file);
    try {
      const rows=db.prepare('SELECT child FROM school_student_assignments WHERE class_id=? ORDER BY child').all(classId);
      assert.deepEqual(rows.map(row=>row.child),(admitted?[existing,...candidates]:[existing]).sort());
      const capacity=db.prepare('SELECT capacity FROM school_class_capacity WHERE class_id=?').get(classId).capacity;
      assert.equal(capacity,admitted?3:2);assert.ok(rows.length<=capacity);
      const audit=db.prepare("SELECT target FROM admin_audit WHERE action='school.student.assigned' AND json_extract(details,'$.classId')=? ORDER BY target").all(classId);
      assert.deepEqual(audit.map(row=>row.target),rows.map(row=>row.child));
      assert.equal(db.prepare("SELECT COUNT(*) n FROM admin_audit WHERE action='school.class.capacity_updated' AND target=?").get(classId).n,admitted?0:1);
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
      assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    }finally{db.close();}
  }
});

test('bulk admission changes only administrative membership and audit while preserving registration and booking data',t=>{
  const file=tempFile(t),f=fixture(t,file),{parent,childIds}=children(f,2),db=raw(file);
  try {
    const offer=f.s.offers(parent,childIds[0],'math')[0];
    assert.ok(offer,'Synthetic fixture must include a real booking');
    f.s.book(parent,childIds[0],offer.id,randomUUID());
    const tables=['users','children','account_status','child_status','registration_permissions','registration_parents','registration_audit','slots','bookings','place_value_activities'];
    const before=Object.fromEntries(tables.map(name=>[name,db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all()]));
    assert.deepEqual(assign(f,childIds),{assigned:2});
    for(const name of tables)assert.deepEqual(db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all(),before[name],name);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  }finally{db.close();}
});


