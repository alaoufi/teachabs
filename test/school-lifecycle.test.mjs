import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openStore} from '../store.mjs';
import {createApp} from '../server.mjs';
import {adminSchool,adminAudit} from '../admin-views.mjs';

function fixture(t){const s=openStore(':memory:');t.after(()=>s.close());return {s,a:s.admin,ids:s.admin.demo()};}
function create(a,id,name='أ',grade=4){const gradeId=a.school(id).grades.find(g=>g.grade===grade)?.id||a.addSchoolGrade(id,{grade});return a.addSchoolClass(id,{gradeId,name});}
const current=(a,id,classId)=>a.school(id).classes.find(c=>c.id===classId);
const update=(a,id,classId,changes={})=>{const c=current(a,id,classId);return a.updateSchoolClass(id,{classId,name:c.name,state:c.state,revision:c.revision,...changes});};
const denied=(fn,status)=>assert.throws(fn,e=>e.status===status);
function grant(a,ids,permissions){const member=a.members(ids.supervisor).find(m=>m.id===ids.education);a.updateMember(ids.supervisor,member.id,{...member,permissions});}

test('class lifecycle is a separate opt-in permission and revocation is immediate',t=>{
 const {a,ids}=fixture(t),classId=create(a,ids.supervisor);
 grant(a,ids,['school.read','school.structure']);
 denied(()=>update(a,ids.education,classId,{name:'ب'}),403);
 denied(()=>grant(a,ids,['school.lifecycle']),400);
 grant(a,ids,['school.read','school.lifecycle']);
 update(a,ids.education,classId,{name:'ب'});
 assert.equal(current(a,ids.education,classId).name,'ب');
 grant(a,ids,['school.read']);
 denied(()=>update(a,ids.education,classId,{state:'archived'}),403);
 assert.equal(current(a,ids.supervisor,classId).state,'active');
 assert.doesNotMatch(adminSchool(a.profile(ids.education),a.school(ids.education)),/action="\/admin\/school\/classes\/update"/);
});

test('rename archive and restore are revisioned, audited, and do not delete records',t=>{
 const {a,ids}=fixture(t),id=ids.supervisor,classId=create(a,id),first=current(a,id,classId);
 update(a,id,classId,{name:'ب'});
 const renamed=current(a,id,classId);
 assert.equal(renamed.revision,first.revision+1);
 const audit=a.auditLog(id);
 denied(()=>a.updateSchoolClass(id,{classId,name:'قديم',state:'active',revision:first.revision}),409);
 assert.deepEqual(a.auditLog(id),audit);
 update(a,id,classId,{state:'archived'});
 assert.equal(current(a,id,classId).state,'archived');
 update(a,id,classId,{state:'active'});
 const restored=current(a,id,classId);
 assert.equal(restored.name,'ب');assert.equal(restored.revision,3);
 assert.equal(a.school(id).classes.length,1);
 const beforeNoop=a.auditLog(id);
 update(a,id,classId);
 assert.deepEqual(a.auditLog(id),beforeNoop);
 const event=a.auditLog(id).find(r=>r.action==='school.class.updated');
 assert.ok(event.details.before&&event.details.after);
 assert.match(adminAudit(a.profile(id),[event]),/تحديث سجل فصل/);
});

test('archive refuses assigned teachers or students and archived records reject new assignments',t=>{
 const {a,ids}=fixture(t),id=ids.supervisor,classId=create(a,id);
 const teacher=a.createTeacher(id,{name:'معلم افتراضي',email:randomUUID()+'@example.invalid',subjects:['math'],grades:[4],language:'ar'}).id;
 const child=a.registration(id).find(c=>c.grade===4).id;
 a.assignSchoolTeacher(id,{classId,teacherId:teacher,subject:'math'});
 a.assignSchoolStudent(id,{classId,childId:child});
 const before=a.school(id),audit=a.auditLog(id);
 denied(()=>update(a,id,classId,{state:'archived'}),409);
 assert.deepEqual(a.school(id),before);assert.deepEqual(a.auditLog(id),audit);
 a.removeSchoolAssignment(id,{kind:'teacher',classId,subject:'math',teacherId:teacher});
 denied(()=>update(a,id,classId,{state:'archived'}),409);
 a.removeSchoolAssignment(id,{kind:'student',classId,childId:child});
 update(a,id,classId,{state:'archived'});
 const archivedAudit=a.auditLog(id);
 denied(()=>a.assignSchoolTeacher(id,{classId,teacherId:teacher,subject:'math'}),409);
 denied(()=>a.assignSchoolStudent(id,{classId,childId:child}),409);
 assert.deepEqual(a.auditLog(id),archivedAudit);
 update(a,id,classId,{state:'active'});
 a.assignSchoolTeacher(id,{classId,teacherId:teacher,subject:'math'});
 a.assignSchoolStudent(id,{classId,childId:child});
});

test('validation and scope denial preserve the class and audit log',t=>{
 const {a,ids}=fixture(t),id=ids.supervisor,classId=create(a,id),other=a.demo();
 create(a,id,'ب');
 const c=current(a,id,classId),audit=a.auditLog(id);
 for(const change of [{name:''},{name:' '.repeat(5)},{name:'x'.repeat(41)},{state:'deleted'},{name:null}])denied(()=>update(a,id,classId,change),400);
 denied(()=>update(a,id,classId,{name:'ب'}),409);
 denied(()=>a.updateSchoolClass(other.supervisor,{classId,name:'غير مسموح',state:'active',revision:c.revision}),404);
 assert.deepEqual(current(a,id,classId),c);assert.deepEqual(a.auditLog(id),audit);
 update(a,id,classId,{name:'<script>bad</script>'});
 const html=adminSchool(a.profile(id),a.school(id));
 assert.match(html,/&lt;script&gt;bad&lt;\/script&gt;/);assert.doesNotMatch(html,/<script>bad/);
});

test('organizational UI omits archived choices and impossible empty forms',t=>{
 const {a,ids}=fixture(t),id=ids.supervisor;
 let html=adminSchool(a.profile(id),a.school(id));
 assert.doesNotMatch(html,/action="\/admin\/school\/classes"/);
 assert.doesNotMatch(html,/action="\/admin\/school\/teachers"/);
 assert.match(html,/افتح صفًا أولًا/);
 const active=create(a,id,'أ'),archived=create(a,id,'ب');
 update(a,id,archived,{state:'archived'});
 html=adminSchool(a.profile(id),a.school(id));
 const selectors=[...html.matchAll(/<select name="classId"[^>]*>(.*?)<\/select>/g)].map(m=>m[1]);
 assert.ok(selectors.length>0);
 for(const options of selectors){assert.ok(options.includes(active));assert.ok(!options.includes(archived));}
 assert.match(html,/إعادة الإتاحة/);
 assert.match(html,/لا تنشئ حصصًا جماعية/);
});

test('additive lifecycle migration preserves existing records and state survives reopening',()=>{
 const dir=mkdtempSync(join(tmpdir(),'admin-lifecycle-')),file=join(dir,'synthetic.sqlite');
 try{
  let s=openStore(file),ids=s.admin.demo(),classId=create(s.admin,ids.supervisor);
  s.close();let db=new DatabaseSync(file);
  const tables=['users','children','slots','bookings','school_grades','school_classes'];
  const before=Object.fromEntries(tables.map(name=>[name,db.prepare('SELECT * FROM '+name).all()]));
  db.exec('DROP TABLE school_class_lifecycle');db.close();
  s=openStore(file);
  assert.equal(current(s.admin,ids.supervisor,classId).state,'active');
  s.close();db=new DatabaseSync(file);
  for(const [name,rows] of Object.entries(before))assert.deepEqual(db.prepare('SELECT * FROM '+name).all(),rows);
  db.close();s=openStore(file);
  update(s.admin,ids.supervisor,classId,{state:'archived'});s.close();
  s=openStore(file);assert.equal(current(s.admin,ids.supervisor,classId).state,'archived');
  assert.equal(current(s.admin,ids.supervisor,classId).revision,1);s.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('HTTP lifecycle updates enforce origin, permission, revision and concurrent edit boundaries',async t=>{
 const {s,a,ids}=fixture(t),id=ids.supervisor,classId=create(a,id),app=createApp(s);
 await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));});
 const base='http://127.0.0.1:'+app.address().port,cookie=actor=>'ks='+s.session(actor);
 const post=(data,actor=id,origin=base)=>fetch(base+'/admin/school/classes/update',{method:'POST',headers:{cookie:cookie(actor),origin},body:new URLSearchParams(data),redirect:'manual'});
 const data={classId,name:'ج',state:'active',revision:'0'};
 assert.equal((await post(data,ids.finance)).status,403);
 assert.equal((await post(data,id,'https://invalid.example')).status,403);
 const responses=await Promise.all([post(data),post({...data,name:'د'})]);
 assert.deepEqual(responses.map(r=>r.status).sort(),[303,409]);
 assert.equal(current(a,id,classId).revision,1);
 assert.equal(a.auditLog(id).filter(r=>r.action==='school.class.updated').length,1);
 assert.equal((await post({...data,revision:'1',state:'deleted'})).status,400);
});
