import test from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openStore} from '../store.mjs';
import {ensureSchoolSchema} from '../school-schema.mjs';

const denied=(fn,status)=>assert.throws(fn,error=>error.status===status);
const current=(a,actor,classId)=>a.school(actor).classes.find(row=>row.id===classId);
const capacity=(a,actor,classId,value,revision=current(a,actor,classId).revision)=>a.updateSchoolClassCapacity(actor,{classId,capacity:value,revision});
const classEvents=(a,actor,classId)=>a.auditLog(actor).filter(row=>row.target===classId);
function fixture(t,file=':memory:'){
  const s=openStore(file);
  t.after(()=>s.close());
  return {s,a:s.admin,ids:s.admin.demo()};
}
function tempFile(t){
  const dir=mkdtempSync(join(tmpdir(),'school-015-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  return join(dir,'synthetic.sqlite');
}
function makeClass(a,actor,{name='A',maximum=3,grade=4,...context}={}){
  const gradeId=a.school(actor).grades.find(row=>row.grade===grade&&row.stage===(context.stage||'primary')&&(!context.trackId||row.track_id===context.trackId))?.id
    ||a.addSchoolGrade(actor,{grade,...context});
  return a.addSchoolClass(actor,{gradeId,name,capacity:maximum});
}
function grant(a,ids,permissions){
  const member=a.members(ids.supervisor).find(row=>row.id===ids.education);
  a.updateMember(ids.supervisor,member.id,{...member,permissions});
}
function children(s,ids,count=3,grade=4){
  const agent=s.admin.switchDemo(ids.supervisor,'registration_agent');
  const {id:parent}=s.registration.addParent(agent,{name:'Synthetic capacity parent',email:randomUUID()+'@example.invalid'});
  s.registration.setStatus(agent,{kind:'parent',id:parent,status:'active'});
  const childIds=Array.from({length:count},(_,i)=>s.registration.addChild(agent,{parent,name:'Synthetic child '+i,grade}));
  return {agent,parent,childIds};
}
function raw(file){
  const db=new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  return db;
}
function migrationTools(db,override={}){
  return {
    db,
    one:(sql,...args)=>db.prepare(sql).get(...args),
    all:(sql,...args)=>db.prepare(sql).all(...args),
    run:(sql,...args)=>db.prepare(sql).run(...args),
    transaction:fn=>{
      db.exec('BEGIN IMMEDIATE');
      try {const result=fn();db.exec('COMMIT');return result;}
      catch(error){db.exec('ROLLBACK');throw error;}
    },
    ...override
  };
}
function rows(db,names){
  return Object.fromEntries(names.map(name=>[name,db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all()]));
}
const preservedSchoolTables=['school_classes','school_class_lifecycle','school_teacher_assignments','school_student_assignments','school_supervision'];

// Start with exclusively synthetic application records, then install the actual
// pre-015 school shape, including occupied and archived classes in two scopes.
function legacyFixture(file){
  const s=openStore(file),ids=s.admin.demo(),other=s.admin.demo();
  const student=s.admin.registration(ids.supervisor).find(row=>row.grade===4).id;
  const otherStudent=s.admin.registration(other.supervisor).find(row=>row.grade===4).id;
  const teacher=s.admin.education(ids.supervisor).teachers[0].id;
  const otherTeacher=s.admin.education(other.supervisor).teachers[0].id;
  const scope=s.admin.profile(ids.supervisor).scope,otherScope=s.admin.profile(other.supervisor).scope;
  const {parent,childIds:extra}=children(s,ids,2);
  const offered=s.offers(parent,extra[0],'math')[0];
  assert.ok(offered,'The synthetic legacy fixture must contain a real booking');
  s.book(parent,extra[0],offered.id,randomUUID());
  s.close();
  const db=raw(file);
  try {
    db.exec(`PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE;
      DROP TABLE school_teacher_students;
      DROP TABLE school_class_capacity;
      DROP TABLE school_class_lifecycle;
      DROP TABLE school_student_assignments;
      DROP TABLE school_teacher_assignments;
      DROP TABLE school_supervision;
      DROP TABLE school_classes;
      DROP TABLE school_grades;
      DROP TABLE school_tracks;
      DROP TABLE school_schema_migrations;
      CREATE TABLE school_grades(id TEXT PRIMARY KEY,scope TEXT NOT NULL,grade INTEGER NOT NULL CHECK(grade BETWEEN 1 AND 6),UNIQUE(scope,grade));
      CREATE TABLE school_classes(id TEXT PRIMARY KEY,grade_id TEXT NOT NULL REFERENCES school_grades(id),name TEXT NOT NULL,UNIQUE(grade_id,name));
      CREATE TABLE school_class_lifecycle(class_id TEXT PRIMARY KEY REFERENCES school_classes(id),state TEXT NOT NULL CHECK(state IN ('active','archived')),revision INTEGER NOT NULL CHECK(revision>=1));
      CREATE TABLE school_teacher_assignments(class_id TEXT NOT NULL REFERENCES school_classes(id),subject TEXT NOT NULL,teacher TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(class_id,subject));
      CREATE TABLE school_student_assignments(child TEXT PRIMARY KEY REFERENCES children(id),class_id TEXT NOT NULL REFERENCES school_classes(id));
      CREATE TABLE school_supervision(teacher TEXT PRIMARY KEY REFERENCES users(id),supervisor TEXT NOT NULL REFERENCES users(id));`);
    const insert=(sql,...args)=>db.prepare(sql).run(...args);
    insert('INSERT INTO school_grades VALUES(?,?,4)','legacy-grade',scope);
    insert('INSERT INTO school_grades VALUES(?,?,4)','foreign-grade',otherScope);
    insert('INSERT INTO school_classes VALUES(?,?,?)','legacy-class','legacy-grade','A');
    insert('INSERT INTO school_classes VALUES(?,?,?)','legacy-archived','legacy-grade','Archived');
    insert('INSERT INTO school_classes VALUES(?,?,?)','foreign-class','foreign-grade','A');
    insert("INSERT INTO school_class_lifecycle VALUES('legacy-class','active',3)");
    insert("INSERT INTO school_class_lifecycle VALUES('legacy-archived','archived',7)");
    insert("INSERT INTO school_student_assignments VALUES(?,'legacy-class')",student);
    insert("INSERT INTO school_student_assignments VALUES(?,'foreign-class')",otherStudent);
    insert("INSERT INTO school_teacher_assignments VALUES('legacy-class','math',?)",teacher);
    insert("INSERT INTO school_teacher_assignments VALUES('foreign-class','math',?)",otherTeacher);
    insert('INSERT INTO school_supervision VALUES(?,?)',teacher,ids.education);
    insert('INSERT INTO school_supervision VALUES(?,?)',otherTeacher,other.education);
    db.exec('COMMIT; PRAGMA foreign_keys=ON;');
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
    const sharedNames=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'school_%' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row=>row.name);
    const shared=rows(db,sharedNames);
    for(const name of ['users','children','slots','bookings'])assert.ok(shared[name].length>0,`${name} must be populated before migration`);
    return {ids,other,student,extra,teacher,scope,otherScope,shared,school:rows(db,preservedSchoolTables),grades:db.prepare('SELECT * FROM school_grades ORDER BY id').all(),gradeSQL:db.prepare("SELECT sql FROM sqlite_master WHERE name='school_grades'").get().sql};
  }finally{db.close();}
}

test('all twelve fixed levels create distinct classes without reinterpreting registration grades',t=>{
  const {a,ids}=fixture(t),actor=ids.supervisor;
  const trackId=a.addSchoolTrack(actor,{name:'Synthetic national track',educationType:'government',curriculumName:'Synthetic curriculum'});
  const keys=['primary:1','primary:2','primary:3','primary:4','primary:5','primary:6','middle:1','middle:2','middle:3','secondary:1','secondary:2','secondary:3'];
  assert.deepEqual(a.school(actor).levels.map(level=>level.key),keys);
  const registered=a.registration(actor);
  for(const levelKey of keys){
    const id=a.addSchoolClass(actor,{trackId,levelKey,name:'A',capacity:20});
    const actual=current(a,actor,id),[stage,grade]=levelKey.split(':');
    assert.equal(actual.stage,stage);assert.equal(actual.grade,Number(grade));
    assert.equal(actual.track_id,trackId);assert.equal(actual.capacity,20);
    assert.equal(actual.assignmentSupported,false);
    assert.equal(actual.studentCount,0);assert.equal(actual.seatsAvailable,20);
    assert.ok(a.school(actor).levels.find(level=>level.key===levelKey).label.length>0);
  }
  assert.equal(a.school(actor).grades.length,12);
  assert.equal(a.school(actor).classes.length,12);
  assert.deepEqual(a.registration(actor),registered);
});

test('fixed level validation rejects out-of-range, fractional, coerced, and unknown contexts atomically',t=>{
  const {a,ids}=fixture(t),actor=ids.supervisor;
  const trackId=a.addSchoolTrack(actor,{name:'Synthetic path'}),before=a.school(actor),audit=a.auditLog(actor);
  const invalid=[['primary',0],['primary',7],['middle',4],['secondary',4],['middle',0],['secondary',-1],['college',1],['PRIMARY',1],['',1],[null,1],['primary','4'],['middle',1.5],['primary',NaN],['primary',Infinity],['primary',null],['primary',true],['primary',Number.MAX_SAFE_INTEGER+1]];
  for(const [stage,grade] of invalid)denied(()=>a.addSchoolGrade(actor,{trackId,stage,grade}),400);
  for(const levelKey of ['primary:0','primary:7','middle:4','secondary:4','middle:1.5','primary:01','primary:1:extra','primary:1 ','college:1','',null,4]){
    denied(()=>a.addSchoolClass(actor,{trackId,levelKey,name:'A',capacity:4}),400);
  }
  denied(()=>a.addSchoolClass(actor,{levelKey:'primary:4',name:'A',capacity:4}),400);
  assert.deepEqual(a.school(actor),before);assert.deepEqual(a.auditLog(actor),audit);
});

test('tracks and grades are scope-local and class names are unique only inside their exact grade context',t=>{
  const {a,ids}=fixture(t),actor=ids.supervisor,other=a.demo();
  const trackId=a.addSchoolTrack(actor,{name:' Same track ',educationType:'private',curriculumName:' Same curriculum '});
  const second=a.addSchoolTrack(actor,{name:'Second track',educationType:'private'});
  const foreignTrack=a.addSchoolTrack(other.supervisor,{name:'Same track',educationType:'private',curriculumName:'Same curriculum'});
  const own=a.addSchoolGrade(actor,{trackId,stage:'primary',grade:4});
  const sameNumberOtherStage=a.addSchoolGrade(actor,{trackId,stage:'middle',grade:1});
  const sameNumberOtherTrack=a.addSchoolGrade(actor,{trackId:second,stage:'primary',grade:4});
  const foreignGrade=a.addSchoolGrade(other.supervisor,{trackId:foreignTrack,grade:4});
  const id=a.addSchoolClass(actor,{gradeId:own,name:' A ',capacity:3});
  a.addSchoolClass(actor,{gradeId:sameNumberOtherStage,name:'A',capacity:3});
  a.addSchoolClass(actor,{gradeId:sameNumberOtherTrack,name:'A',capacity:3});
  a.addSchoolClass(other.supervisor,{gradeId:foreignGrade,name:'A',capacity:3});
  const before=a.school(actor),audit=a.auditLog(actor);
  denied(()=>a.addSchoolTrack(actor,{name:'Same track',educationType:'private',curriculumName:'Same curriculum'}),409);
  denied(()=>a.addSchoolGrade(actor,{trackId,grade:4}),409);
  denied(()=>a.addSchoolClass(actor,{gradeId:own,name:'A',capacity:3}),409);
  denied(()=>a.addSchoolGrade(actor,{trackId:foreignTrack,grade:1}),404);
  denied(()=>a.addSchoolClass(actor,{trackId:foreignTrack,levelKey:'secondary:1',name:'B',capacity:3}),404);
  denied(()=>a.addSchoolClass(actor,{gradeId:foreignGrade,name:'B',capacity:3}),404);
  denied(()=>capacity(a,other.supervisor,id,7,0),404);
  assert.deepEqual(a.school(actor),before);assert.deepEqual(a.auditLog(actor),audit);
  assert.equal(before.classes.find(row=>row.id===id).name,'A');
  assert.ok(before.tracks.every(row=>row.scope===a.profile(actor).scope));
  assert.equal(a.school(other.supervisor).classes.length,1);
});

test('track validation and separate opt-in track and capacity grants fail closed after revocation',t=>{
  const {a,ids}=fixture(t),actor=ids.supervisor,classId=makeClass(a,actor);
  const state=a.school(actor),audit=a.auditLog(actor);
  for(const value of [{name:''},{name:'  '},{name:'x'.repeat(61)},{name:null},{name:'A',educationType:'invented'},{name:'A',educationType:null},{name:'A',curriculumName:1},{name:'A',curriculumName:'x'.repeat(81)}])denied(()=>a.addSchoolTrack(actor,value),400);
  assert.deepEqual(a.school(actor),state);assert.deepEqual(a.auditLog(actor),audit);
  for(const actorId of Object.values(ids).filter(id=>id!==actor)){
    denied(()=>a.addSchoolTrack(actorId,{name:'No grant'}),403);
    denied(()=>capacity(a,actorId,classId,4,0),403);
  }
  denied(()=>grant(a,ids,['school.capacity']),400);
  denied(()=>grant(a,ids,['school.tracks']),400);
  grant(a,ids,['school.read','school.structure','school.lifecycle','school.students']);
  denied(()=>capacity(a,ids.education,classId,4,0),403);
  denied(()=>a.addSchoolTrack(ids.education,{name:'No track grant'}),403);
  grant(a,ids,['school.read','school.capacity','school.tracks']);
  a.addSchoolTrack(ids.education,{name:'Explicitly granted'});
  assert.deepEqual(capacity(a,ids.education,classId,4,0),{id:classId,revision:1});
  denied(()=>a.addSchoolGrade(ids.education,{grade:2}),403);
  denied(()=>a.updateSchoolClass(ids.education,{classId,name:'B',state:'active',revision:1}),403);
  grant(a,ids,['school.read']);
  const revokedState=a.school(actor),revokedAudit=a.auditLog(actor);
  denied(()=>capacity(a,ids.education,classId,5,1),403);
  denied(()=>a.addSchoolTrack(ids.education,{name:'Revoked'}),403);
  assert.deepEqual(a.school(actor),revokedState);assert.deepEqual(a.auditLog(actor),revokedAudit);
});

test('capacity creation and edits accept only positive safe integers with no partial records',t=>{
  const {a,ids}=fixture(t),actor=ids.supervisor,classId=makeClass(a,actor);
  const gradeId=current(a,actor,classId).grade_id;
  const trackId=a.addSchoolTrack(actor,{name:'Atomic structure validation'});
  const before=a.school(actor),audit=a.auditLog(actor);
  const invalid=[undefined,null,'',0,-1,-0,1.5,'2',true,false,NaN,Infinity,-Infinity,Number.MAX_SAFE_INTEGER+1,{},[]];
  for(const value of invalid){
    denied(()=>a.addSchoolClass(actor,{gradeId,name:'Invalid',capacity:value}),400);
    denied(()=>a.addSchoolClass(actor,{trackId,levelKey:'secondary:3',name:'Invalid',capacity:value}),400);
    denied(()=>capacity(a,actor,classId,value,0),400);
  }
  assert.deepEqual(a.school(actor),before);assert.deepEqual(a.auditLog(actor),audit);
  capacity(a,actor,classId,1);
  assert.equal(current(a,actor,classId).capacity,1);
  capacity(a,actor,classId,Number.MAX_SAFE_INTEGER);
  assert.equal(current(a,actor,classId).capacity,Number.MAX_SAFE_INTEGER);
  const maximumClass=a.addSchoolClass(actor,{gradeId,name:'Maximum',capacity:Number.MAX_SAFE_INTEGER});
  assert.equal(current(a,actor,maximumClass).capacity,Number.MAX_SAFE_INTEGER);
});

test('capacity and lifecycle share revisions, reject stale writes, and audit changes but not no-ops',t=>{
  const {a,ids}=fixture(t),actor=ids.supervisor,classId=makeClass(a,actor,{maximum:2});
  const creation=classEvents(a,actor,classId).find(row=>row.action==='school.class.created');
  assert.equal(creation.details.capacity,2);
  assert.deepEqual(capacity(a,actor,classId,5,0),{id:classId,revision:1});
  const event=classEvents(a,actor,classId).find(row=>row.action==='school.class.capacity_updated');
  assert.deepEqual(event.details,{before:2,after:5,studentCount:0});
  const audit=a.auditLog(actor),before=current(a,actor,classId);
  assert.deepEqual(capacity(a,actor,classId,5,1),{id:classId,revision:1});
  for(const revision of [0,2,-1,'1',1.5,NaN,undefined,null])denied(()=>a.updateSchoolClassCapacity(actor,{classId,capacity:5,revision}),409);
  denied(()=>a.updateSchoolClass(actor,{classId,name:'Stale rename',state:'active',revision:0}),409);
  assert.deepEqual(a.auditLog(actor),audit);assert.deepEqual(current(a,actor,classId),before);
  a.updateSchoolClass(actor,{classId,name:'Renamed',state:'archived',revision:1});
  denied(()=>capacity(a,actor,classId,6,1),409);
  assert.deepEqual(capacity(a,actor,classId,6,2),{id:classId,revision:3});
  assert.equal(current(a,actor,classId).state,'archived');
  a.updateSchoolClass(actor,{classId,name:'Renamed',state:'active',revision:3});
  assert.equal(current(a,actor,classId).revision,4);
  assert.equal(current(a,actor,classId).capacity,6);
  assert.equal(classEvents(a,actor,classId).filter(row=>row.action==='school.class.capacity_updated').length,2);
});

test('all memberships consume seats including suspended children and suspended parents',t=>{
  const {s,a,ids}=fixture(t),actor=ids.supervisor,classId=makeClass(a,actor,{maximum:2});
  const {agent,parent,childIds:[first,second,waiting]}=children(s,ids,3);
  a.assignSchoolStudent(actor,{classId,childId:first});
  a.assignSchoolStudent(actor,{classId,childId:second});
  s.registration.setStatus(agent,{kind:'child',id:first,status:'suspended'});
  s.registration.setStatus(agent,{kind:'parent',id:parent,status:'suspended'});
  const before=current(a,actor,classId),audit=a.auditLog(actor);
  assert.equal(before.studentCount,2);assert.equal(before.seatsAvailable,0);
  denied(()=>capacity(a,actor,classId,1),409);
  denied(()=>a.assignSchoolStudent(actor,{classId,childId:waiting}),409);
  assert.deepEqual(current(a,actor,classId),before);assert.deepEqual(a.auditLog(actor),audit);
  a.removeSchoolAssignment(actor,{kind:'student',classId,childId:first});
  assert.equal(current(a,actor,classId).studentCount,1);
  assert.equal(current(a,actor,classId).seatsAvailable,1);
  capacity(a,actor,classId,1);
  assert.equal(current(a,actor,classId).capacity,1);
  capacity(a,actor,classId,2);
  s.registration.setStatus(agent,{kind:'parent',id:parent,status:'active'});
  a.assignSchoolStudent(actor,{classId,childId:waiting});
  assert.equal(current(a,actor,classId).studentCount,2);
  assert.equal(current(a,actor,classId).seatsAvailable,0);
});

test('unsupported tracks and nonprimary stages refuse student and teacher assignment by matching ordinal alone',t=>{
  const {s,a,ids}=fixture(t),actor=ids.supervisor;
  const trackId=a.addSchoolTrack(actor,{name:'Explicit new primary context'});
  const newPrimary=a.addSchoolClass(actor,{trackId,levelKey:'primary:4',name:'A',capacity:3});
  const legacyGrade=a.addSchoolGrade(actor,{grade:4});
  const legacyTrack=a.school(actor).grades.find(row=>row.id===legacyGrade).track_id;
  const middle=a.addSchoolClass(actor,{trackId:legacyTrack,levelKey:'middle:1',name:'A',capacity:3});
  const secondary=a.addSchoolClass(actor,{trackId:legacyTrack,levelKey:'secondary:1',name:'A',capacity:3});
  const child4=children(s,ids,1,4).childIds[0],child1=children(s,ids,1,1).childIds[0];
  const teacher=a.education(actor).teachers[0].id;
  const before=a.school(actor),audit=a.auditLog(actor);
  for(const [classId,childId] of [[newPrimary,child4],[middle,child1],[secondary,child1]]){
    assert.equal(current(a,actor,classId).assignmentSupported,false);
    denied(()=>a.assignSchoolStudent(actor,{classId,childId}),409);
    denied(()=>a.assignSchoolTeacher(actor,{classId,teacherId:teacher,subject:'math'}),409);
  }
  assert.deepEqual(a.school(actor),before);assert.deepEqual(a.auditLog(actor),audit);
  const supported=a.addSchoolClass(actor,{gradeId:legacyGrade,name:'Compatible',capacity:1});
  assert.equal(current(a,actor,supported).assignmentSupported,true);
  a.assignSchoolStudent(actor,{classId:supported,childId:child4});
  a.assignSchoolTeacher(actor,{classId:supported,teacherId:teacher,subject:'math'});
  assert.equal(current(a,actor,supported).studentCount,1);
});

test('migration preserves populated legacy IDs, classes, lifecycle, assignments, and every shared row on reopen',t=>{
  const file=tempFile(t),old=legacyFixture(file);
  let s=openStore(file);
  try {
    const school=s.admin.school(old.ids.supervisor);
    assert.deepEqual(school.grades.map(row=>({id:row.id,scope:row.scope,grade:row.grade})),old.grades.filter(row=>row.scope===old.scope).map(row=>({...row})));
    assert.equal(school.grades[0].stage,'primary');
    assert.equal(school.tracks.length,1);assert.equal(school.tracks[0].legacy,1);
    assert.equal(school.tracks[0].education_type,'unspecified');
    assert.equal(school.tracks[0].curriculum_name,'');
    assert.equal(school.classes.find(row=>row.id==='legacy-class').studentCount,1);
    assert.equal(school.classes.find(row=>row.id==='legacy-class').revision,3);
    assert.equal(school.classes.find(row=>row.id==='legacy-archived').state,'archived');
    assert.equal(school.classes.find(row=>row.id==='legacy-archived').revision,7);
    assert.equal(school.studentAssignments[0].child,old.student);
    assert.equal(school.teacherAssignments[0].teacher,old.teacher);
    for(const cls of school.classes){assert.equal(cls.capacity,null);assert.equal(cls.seatsAvailable,null);}
    assert.equal(s.admin.school(old.other.supervisor).classes.length,1);
  }finally{s.close();}
  let db=raw(file);
  try {
    assert.deepEqual(rows(db,Object.keys(old.shared)),old.shared);
    assert.deepEqual(rows(db,preservedSchoolTables),old.school);
    assert.deepEqual(db.prepare('SELECT id,scope,grade FROM school_grades ORDER BY id').all(),old.grades);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    assert.equal(db.prepare('SELECT COUNT(*) n FROM school_schema_migrations WHERE version=15').get().n,1);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM school_tracks WHERE legacy=1').get().n,2);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM school_class_capacity').get().n,0);
    assert.throws(()=>db.prepare('INSERT INTO school_classes VALUES(?,?,?)').run('bad-class','missing-grade','Bad'),/FOREIGN KEY/);
  }finally{db.close();}
  s=openStore(file);
  try {
    assert.equal(current(s.admin,old.ids.supervisor,'legacy-class').revision,3);
    assert.equal(current(s.admin,old.ids.supervisor,'legacy-class').capacity,null);
    assert.equal(s.admin.school(old.ids.supervisor).tracks.length,1);
    assert.equal(s.admin.school(old.other.supervisor).tracks.length,1);
  }finally{s.close();}
  db=raw(file);
  try {assert.deepEqual(rows(db,Object.keys(old.shared)),old.shared);assert.deepEqual(rows(db,preservedSchoolTables),old.school);}
  finally{db.close();}
});

test('legacy capacity remains unknown and blocks admissions until explicitly configured without losing memberships',t=>{
  const file=tempFile(t),old=legacyFixture(file),s=openStore(file),a=s.admin,actor=old.ids.supervisor;
  t.after(()=>s.close());
  const before=a.school(actor),audit=a.auditLog(actor);
  denied(()=>a.assignSchoolStudent(actor,{classId:'legacy-class',childId:old.extra[0]}),409);
  assert.deepEqual(a.school(actor),before);assert.deepEqual(a.auditLog(actor),audit);
  assert.deepEqual(capacity(a,actor,'legacy-class',1,3),{id:'legacy-class',revision:4});
  const configured=classEvents(a,actor,'legacy-class').find(row=>row.action==='school.class.capacity_updated');
  assert.deepEqual(configured.details,{before:null,after:1,studentCount:1});
  denied(()=>a.assignSchoolStudent(actor,{classId:'legacy-class',childId:old.extra[0]}),409);
  capacity(a,actor,'legacy-class',2,4);
  a.assignSchoolStudent(actor,{classId:'legacy-class',childId:old.extra[0]});
  assert.equal(current(a,actor,'legacy-class').studentCount,2);
  assert.equal(current(a,actor,'legacy-class').capacity,2);
  assert.ok(a.school(actor).studentAssignments.some(row=>row.child===old.student));
});

test('injected migration failure after table replacement rolls back data and restores foreign-key enforcement',t=>{
  const file=tempFile(t),old=legacyFixture(file),db=raw(file);
  try {
    let injected=false;
    const realRun=(sql,...args)=>db.prepare(sql).run(...args);
    assert.throws(()=>ensureSchoolSchema(migrationTools(db,{run:(sql,...args)=>{
      if(sql.startsWith('INSERT OR REPLACE INTO school_schema_migrations')){injected=true;throw new Error('Injected migration completion failure');}
      return realRun(sql,...args);
    }})),/Injected migration completion failure/);
    assert.equal(injected,true);
    assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys,1);
    assert.equal(db.prepare("SELECT sql FROM sqlite_master WHERE name='school_grades'").get().sql,old.gradeSQL);
    assert.deepEqual(db.prepare('SELECT * FROM school_grades ORDER BY id').all(),old.grades);
    assert.deepEqual(rows(db,preservedSchoolTables),old.school);
    assert.deepEqual(rows(db,Object.keys(old.shared)),old.shared);
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='school_grades_015'").get(),undefined);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM school_tracks').get().n,0);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM school_schema_migrations').get().n,0);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
    assert.throws(()=>db.prepare('INSERT INTO school_classes VALUES(?,?,?)').run('blocked','missing','Bad'),/FOREIGN KEY/);
    ensureSchoolSchema(migrationTools(db));
    assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys,1);
    assert.deepEqual(rows(db,preservedSchoolTables),old.school);
    assert.deepEqual(rows(db,Object.keys(old.shared)),old.shared);
  }finally{db.close();}
  const s=openStore(file);
  try {assert.equal(current(s.admin,old.ids.supervisor,'legacy-class').studentCount,1);}
  finally{s.close();}
});

test('migration refuses custom grade objects, conflicting tables, and pre-existing integrity failures',async t=>{
  for(const kind of ['custom-index','custom-trigger','replacement-table','foreign-key'])await t.test(kind,sub=>{
    const file=tempFile(sub),old=legacyFixture(file),db=raw(file);
    try {
      if(kind==='custom-index')db.exec('CREATE INDEX custom_grade_scope ON school_grades(scope)');
      if(kind==='custom-trigger')db.exec('CREATE TRIGGER custom_grade_guard BEFORE UPDATE ON school_grades BEGIN SELECT 1; END;');
      if(kind==='replacement-table')db.exec('CREATE TABLE school_grades_015(sentinel TEXT); INSERT INTO school_grades_015 VALUES(\'preserve\');');
      if(kind==='foreign-key')db.exec("PRAGMA foreign_keys=OFF; UPDATE school_classes SET grade_id='missing' WHERE id='legacy-class'; PRAGMA foreign_keys=ON;");
      const before=rows(db,['school_grades',...preservedSchoolTables]);
      assert.throws(()=>ensureSchoolSchema(migrationTools(db)),/custom grade|replacement table|foreign-key verification/);
      assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys,1);
      assert.deepEqual(rows(db,['school_grades',...preservedSchoolTables]),before);
      assert.deepEqual(rows(db,Object.keys(old.shared)),old.shared);
      assert.equal(db.prepare('SELECT COUNT(*) n FROM school_schema_migrations').get().n,0);
      assert.equal(db.prepare('SELECT COUNT(*) n FROM school_tracks').get().n,0);
      if(kind==='replacement-table')assert.equal(db.prepare('SELECT sentinel FROM school_grades_015').get().sentinel,'preserve');
    }finally{db.close();}
  });
});

test('migration preserves unknown legacy columns, generated values, constraints, defaults, and references by refusing replacement',async t=>{
  const definitions=[
    ['notes column',"id TEXT PRIMARY KEY,scope TEXT NOT NULL,grade INTEGER NOT NULL CHECK(grade BETWEEN 1 AND 6),notes TEXT,UNIQUE(scope,grade)"],
    ['virtual generated column',"id TEXT PRIMARY KEY,scope TEXT NOT NULL,grade INTEGER NOT NULL CHECK(grade BETWEEN 1 AND 6),grade_label TEXT GENERATED ALWAYS AS ('Grade ' || grade) VIRTUAL,UNIQUE(scope,grade)"],
    ['stored generated column',"id TEXT PRIMARY KEY,scope TEXT NOT NULL,grade INTEGER NOT NULL CHECK(grade BETWEEN 1 AND 6),grade_label TEXT GENERATED ALWAYS AS ('Grade ' || grade) STORED,UNIQUE(scope,grade)"],
    ['additional CHECK',"id TEXT PRIMARY KEY,scope TEXT NOT NULL,grade INTEGER NOT NULL CHECK(grade BETWEEN 1 AND 6),UNIQUE(scope,grade),CHECK(length(scope)>0)"],
    ['additional DEFAULT',"id TEXT PRIMARY KEY,scope TEXT NOT NULL,grade INTEGER NOT NULL DEFAULT 4 CHECK(grade BETWEEN 1 AND 6),UNIQUE(scope,grade)"],
    ['additional foreign key',"id TEXT PRIMARY KEY,scope TEXT NOT NULL,grade INTEGER NOT NULL CHECK(grade BETWEEN 1 AND 6),UNIQUE(scope,grade),FOREIGN KEY(scope) REFERENCES legacy_scope_registry(scope)"]
  ];
  for(const [kind,definition] of definitions)await t.test(kind,sub=>{
    const file=tempFile(sub),old=legacyFixture(file),db=raw(file);
    try {
      // Rebuild only this synthetic fixture. Reusing the exact old table name
      // avoids ALTER TABLE quoting differences masking the extension under test.
      db.exec('PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE;');
      if(kind==='additional foreign key'){
        db.exec('CREATE TABLE legacy_scope_registry(scope TEXT PRIMARY KEY)');
        for(const scope of [old.scope,old.otherScope])db.prepare('INSERT INTO legacy_scope_registry VALUES(?)').run(scope);
      }
      db.exec('DROP TABLE school_grades; CREATE TABLE school_grades('+definition+');');
      for(const row of old.grades)db.prepare('INSERT INTO school_grades(id,scope,grade) VALUES(?,?,?)').run(row.id,row.scope,row.grade);
      if(kind==='notes column')db.prepare("UPDATE school_grades SET notes='Persistent custom note for ' || id").run();
      db.exec('COMMIT; PRAGMA foreign_keys=ON;');
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
      const before=rows(db,['school_grades',...preservedSchoolTables]);
      const schema=()=>db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE tbl_name='school_grades' ORDER BY type,name").all();
      const schemaBefore=schema(),columnsBefore=db.prepare('PRAGMA table_xinfo(school_grades)').all();
      const referencesBefore=db.prepare('PRAGMA foreign_key_list(school_grades)').all();
      if(kind==='notes column')assert.ok(before.school_grades.every(row=>row.notes==='Persistent custom note for '+row.id));
      if(kind.includes('generated'))assert.ok(before.school_grades.every(row=>row.grade_label==='Grade 4'));
      if(kind==='additional DEFAULT')assert.equal(columnsBefore.find(row=>row.name==='grade').dflt_value,'4');
      if(kind==='additional foreign key')assert.equal(referencesBefore[0].table,'legacy_scope_registry');
      assert.throws(()=>ensureSchoolSchema(migrationTools(db)),/unknown legacy grade schema or columns require review/);
      assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys,1);
      assert.deepEqual(schema(),schemaBefore);
      assert.deepEqual(db.prepare('PRAGMA table_xinfo(school_grades)').all(),columnsBefore);
      assert.deepEqual(db.prepare('PRAGMA foreign_key_list(school_grades)').all(),referencesBefore);
      assert.deepEqual(rows(db,['school_grades',...preservedSchoolTables]),before);
      assert.deepEqual(rows(db,Object.keys(old.shared)),old.shared);
      assert.equal(db.prepare('SELECT COUNT(*) n FROM school_schema_migrations').get().n,0);
      assert.equal(db.prepare('SELECT COUNT(*) n FROM school_tracks').get().n,0);
      assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='school_grades_015'").get(),undefined);
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
      assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
      assert.throws(()=>db.prepare('INSERT INTO school_classes VALUES(?,?,?)').run('blocked','missing-grade','Bad'),/FOREIGN KEY/);
      if(kind==='additional foreign key')assert.deepEqual(db.prepare('SELECT scope FROM legacy_scope_registry ORDER BY scope').all().map(row=>row.scope),[old.scope,old.otherScope].sort());
    }finally{db.close();}
  });
});

test('database constraints reject invalid levels and capacity after migration and require its completion marker',t=>{
  const file=tempFile(t),old=legacyFixture(file),db=raw(file);
  try {
    ensureSchoolSchema(migrationTools(db));
    const trackId=db.prepare('SELECT id FROM school_tracks WHERE scope=?').get(old.scope).id;
    for(const [stage,grade] of [['primary',7],['middle',4],['secondary',4],['primary',1.25],['unknown',1]]){
      assert.throws(()=>db.prepare('INSERT INTO school_grades VALUES(?,?,?,?,?)').run(randomUUID(),old.scope,trackId,stage,grade),/CHECK constraint/);
    }
    for(const value of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>db.prepare('INSERT INTO school_class_capacity VALUES(?,?)').run('legacy-class',value),/CHECK constraint/);
    db.exec('DELETE FROM school_schema_migrations WHERE version=15');
    assert.throws(()=>ensureSchoolSchema(migrationTools(db)),/explicit migration review/);
    assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys,1);
    assert.deepEqual(rows(db,preservedSchoolTables),old.school);
  }finally{db.close();}
});

test('audit write failures roll back capacity, membership, and implicit grade creation together',t=>{
  const file=tempFile(t),{s,a,ids}=fixture(t,file),actor=ids.supervisor;
  const classId=makeClass(a,actor,{maximum:2}),childId=children(s,ids,1).childIds[0];
  const trackId=a.addSchoolTrack(actor,{name:'Atomic grade creation'});
  const db=raw(file);
  try {
    for(const [action,attempt] of [
      ['school.class.capacity_updated',()=>capacity(a,actor,classId,5)],
      ['school.student.assigned',()=>a.assignSchoolStudent(actor,{classId,childId})],
      ['school.class.created',()=>a.addSchoolClass(actor,{trackId,levelKey:'secondary:3',name:'Blocked',capacity:3})]
    ]){
      const before=a.school(actor),audit=a.auditLog(actor);
      db.exec(`CREATE TRIGGER fail_school_audit BEFORE INSERT ON admin_audit WHEN NEW.action='${action}' BEGIN SELECT RAISE(ABORT,'Injected school audit failure'); END;`);
      assert.throws(attempt,/Injected school audit failure/);
      assert.deepEqual(a.school(actor),before);assert.deepEqual(a.auditLog(actor),audit);
      db.exec('DROP TRIGGER fail_school_audit');
    }
    capacity(a,actor,classId,5);
    a.assignSchoolStudent(actor,{classId,childId});
    assert.equal(current(a,actor,classId).studentCount,1);
    assert.equal(current(a,actor,classId).capacity,5);
    assert.equal(current(a,actor,classId).revision,1);
  }finally{db.close();}
});

function raceWorker(config){
  const process=fork(new URL('./helpers/school-015-race-worker.mjs',import.meta.url),[JSON.stringify(config)],{stdio:['ignore','pipe','pipe','ipc'],execArgv:[]});
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
  const workers=operations.map(operation=>raceWorker({file,...operation})),lock=raw(file);
  let locked=false;
  try {
    const ready=await Promise.all(workers.map(worker=>worker.waitFor('ready')));
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

test('separate processes racing for the last seat commit exactly one admission and one audit event',async t=>{
  const file=tempFile(t),s=openStore(file),a=s.admin,ids=a.demo(),actor=ids.supervisor;
  const childIds=children(s,ids,6).childIds;
  const classIds=Array.from({length:3},(_,i)=>makeClass(a,actor,{name:'Seat race '+i,maximum:1}));
  s.close();
  for(const [index,classId] of classIds.entries()){
    const candidates=childIds.slice(index*2,index*2+2);
    const results=await race(file,candidates.map(childId=>({actor,operation:'assignSchoolStudent',values:{classId,childId}})));
    assert.equal(results.filter(result=>result.ok).length,1,JSON.stringify(results));
    assert.deepEqual(results.filter(result=>!result.ok).map(result=>result.status),[409]);
    const reopened=openStore(file);
    try {
      const cls=current(reopened.admin,actor,classId);
      assert.equal(cls.studentCount,1);assert.equal(cls.capacity,1);assert.equal(cls.seatsAvailable,0);
      const assignments=reopened.admin.school(actor).studentAssignments.filter(row=>row.class_id===classId);
      assert.equal(assignments.length,1);
      assert.equal(assignments[0].child,candidates[results.findIndex(result=>result.ok)]);
      const events=reopened.admin.auditLog(actor).filter(row=>row.action==='school.student.assigned'&&row.details.classId===classId);
      assert.equal(events.length,1);assert.equal(events[0].target,assignments[0].child);
    }finally{reopened.close();}
  }
});

test('separate processes racing admission against capacity shrink preserve the occupancy invariant',async t=>{
  const file=tempFile(t),s=openStore(file),a=s.admin,ids=a.demo(),actor=ids.supervisor;
  const childIds=children(s,ids,6).childIds;
  const classIds=Array.from({length:3},(_,i)=>makeClass(a,actor,{name:'Shrink race '+i,maximum:2}));
  for(const [index,classId] of classIds.entries())a.assignSchoolStudent(actor,{classId,childId:childIds[index*2]});
  s.close();
  for(const [index,classId] of classIds.entries()){
    const candidate=childIds[index*2+1];
    const results=await race(file,[
      {actor,operation:'assignSchoolStudent',values:{classId,childId:candidate}},
      {actor,operation:'updateSchoolClassCapacity',values:{classId,capacity:1,revision:0}}
    ]);
    assert.equal(results.filter(result=>result.ok).length,1,JSON.stringify(results));
    assert.deepEqual(results.filter(result=>!result.ok).map(result=>result.status),[409]);
    const reopened=openStore(file);
    try {
      const cls=current(reopened.admin,actor,classId),admissionWon=results[0].ok;
      assert.equal(cls.studentCount,admissionWon?2:1);
      assert.equal(cls.capacity,admissionWon?2:1);
      assert.equal(cls.revision,admissionWon?0:1);
      assert.equal(cls.seatsAvailable,0);
      assert.ok(cls.studentCount<=cls.capacity);
      const audit=reopened.admin.auditLog(actor);
      assert.equal(audit.filter(row=>row.action==='school.student.assigned'&&row.details.classId===classId).length,admissionWon?2:1);
      assert.equal(audit.filter(row=>row.action==='school.class.capacity_updated'&&row.target===classId).length,admissionWon?0:1);
    }finally{reopened.close();}
  }
  const db=raw(file);
  try {assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}
  finally{db.close();}
});
