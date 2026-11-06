import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openStore} from '../store.mjs';
import {createApp} from '../server.mjs';
const denied=(fn,status)=>assert.throws(fn,error=>error.status===status);
function fixture(t){const dir=mkdtempSync(join(tmpdir(),'teacher-filter-022-')),file=join(dir,'synthetic.sqlite'),store=openStore(file),a=store.admin,ids=a.demo();t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});const actor=ids.supervisor,gradeId=a.addSchoolGrade(actor,{grade:4}),classId=a.addSchoolClass(actor,{gradeId,name:'Synthetic class',capacity:10});const add=(name,subjects,grades,owner=actor)=>a.createTeacher(owner,{name,email:randomUUID()+'@example.invalid',subjects,grades,language:'ar'}).id;const good=add('<معلم رياضيات>', ['math'],[4]),wrongGrade=add('Synthetic grade 1',['math'],[1]),wrongSubject=add('Synthetic science',['science'],[4]),suspended=add('Synthetic suspended',['math'],[4]),other=a.demo(),foreign=add('Synthetic foreign',['math'],[4],other.supervisor);const db=new DatabaseSync(file);db.prepare("INSERT INTO account_status(user,status) VALUES(?,'suspended') ON CONFLICT(user) DO UPDATE SET status='suspended'").run(suspended);db.close();return {store,a,ids,actor,classId,gradeId,good,wrongGrade,wrongSubject,suspended,foreign,other,file,add};}
function grant(f,permissions){const m=f.a.members(f.actor).find(row=>row.id===f.ids.education);f.a.updateMember(f.actor,m.id,{...m,permissions});}
const selected=(f,extra={})=>{const c=f.a.school(f.actor).classes.find(c=>c.id===f.classId);return new URLSearchParams({trackId:c.track_id,stage:c.stage,grade:String(c.grade),classId:c.id,...extra});};
async function http(t,f){const app=createApp(f.store);await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));t.after(async()=>{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));});const base='http://127.0.0.1:'+app.address().port,get=(query=selected(f),id=f.actor)=>fetch(base+'/admin/school?'+query,{headers:{cookie:'ks='+f.store.session(id)}}),post=(data,id=f.actor,origin=base)=>fetch(base+'/admin/school/teachers',{method:'POST',headers:{origin,cookie:'ks='+f.store.session(id)},body:new URLSearchParams(data),redirect:'manual'});return {get,post,base};}

test('class teacher read list filters active scope grade and specialty without writes',t=>{
 const f=fixture(t),before=f.a.auditLog(f.actor);assert.equal(typeof f.a.schoolClassTeachers,'function');
 const result=f.a.schoolClassTeachers(f.actor,{classId:f.classId,subject:'math'});
 assert.equal(result.subject,'math');assert.ok(result.teachers.some(row=>row.id===f.good));
 for(const id of [f.wrongGrade,f.wrongSubject,f.suspended,f.foreign])assert.ok(!result.teachers.some(row=>row.id===id));
 assert.ok(result.teachers.every(row=>Object.keys(row).sort().join(',')==='id,name'));
 assert.deepEqual(f.a.auditLog(f.actor),before);assert.equal(f.a.school(f.actor).teacherAssignments.length,0);
});
test('teacher candidate access is separately authorized and cannot widen unsupported school contexts',t=>{
 const f=fixture(t);grant(f,['school.read','school.supervision']);denied(()=>f.a.schoolClassTeachers(f.ids.education,{classId:f.classId,subject:'math'}),403);
 grant(f,['school.read','school.teachers']);assert.ok(f.a.schoolClassTeachers(f.ids.education,{classId:f.classId,subject:'math'}).teachers.length);grant(f,['school.read']);denied(()=>f.a.schoolClassTeachers(f.ids.education,{classId:f.classId,subject:'math'}),403);
 for(const subject of ['',null,[],{},'constructor','unknown'])denied(()=>f.a.schoolClassTeachers(f.actor,{classId:f.classId,subject}),400);
 const foreignGrade=f.a.addSchoolGrade(f.other.supervisor,{grade:4}),foreignClass=f.a.addSchoolClass(f.other.supervisor,{gradeId:foreignGrade,name:'Foreign',capacity:10});denied(()=>f.a.schoolClassTeachers(f.actor,{classId:foreignClass,subject:'math'}),404);
 const trackId=f.a.addSchoolTrack(f.actor,{name:'New path'}),legacy=f.a.school(f.actor).tracks.find(t=>t.legacy).id;
 for(const values of [{trackId,levelKey:'primary:4'},{trackId:legacy,levelKey:'middle:1'},{trackId:legacy,levelKey:'secondary:1'}]){const classId=f.a.addSchoolClass(f.actor,{...values,name:'Unsupported',capacity:10});denied(()=>f.a.schoolClassTeachers(f.actor,{classId,subject:'math'}),409);}
 f.a.updateSchoolClass(f.actor,{classId:f.classId,name:'Synthetic class',state:'archived',revision:0});denied(()=>f.a.schoolClassTeachers(f.actor,{classId:f.classId,subject:'math'}),409);
});
test('existing class or individual teacher assignments constrain choices without changing history',t=>{
 const f=fixture(t),child=f.a.registration(f.actor).find(ch=>ch.grade===4),second=f.add('Second math',['math'],[4]);
 f.a.assignSchoolStudent(f.actor,{classId:f.classId,childId:child.id});f.a.assignSchoolTeacherStudents(f.actor,{gradeId:f.gradeId,subject:'math',teacherId:f.good,childIds:[child.id]});
 let result=f.a.schoolClassTeachers(f.actor,{classId:f.classId,subject:'math'});assert.deepEqual(result.teachers.map(t=>t.id),[f.good]);assert.ok(!result.teachers.some(t=>t.id===second));
 f.a.assignSchoolTeacher(f.actor,{classId:f.classId,subject:'math',teacherId:f.good});const before=f.a.auditLog(f.actor);
 result=f.a.schoolClassTeachers(f.actor,{classId:f.classId,subject:'math'});assert.deepEqual(result.teachers,[]);assert.equal(result.reason,'assigned');assert.deepEqual(f.a.auditLog(f.actor),before);
 assert.equal(f.a.school(f.actor).teacherAssignments[0].teacher,f.good);
});
test('class teacher UI asks for subject before showing a filtered teacher select',async t=>{
 const f=fixture(t),{get,post}=await http(t,f);
 let html=await (await get()).text();const assignment=html.match(/<section[^>]*>[\s\S]*?<h2>إسناد المعلمين حسب المادة<\/h2>([\s\S]*?)<\/section>/)?.[1];assert.ok(assignment);assert.doesNotMatch(assignment,/<select name="teacherId"/);assert.match(assignment,/<select name="subject"/);
 html=await (await get(selected(f,{subject:'math'}))).text();const teachers=html.match(/<form method="post" action="\/admin\/school\/teachers"[^>]*>(.*?)<\/form>/)?.[1];assert.ok(teachers);
 assert.match(teachers,new RegExp('value="'+f.good+'"'));for(const id of [f.wrongGrade,f.wrongSubject,f.suspended,f.foreign])assert.doesNotMatch(teachers,new RegExp(id));
 assert.match(teachers,/&lt;معلم رياضيات&gt;/);assert.match(teachers,/name="subject" value="math"/);assert.match(teachers,/<option value="" selected>/);
 assert.equal((await post({classId:f.classId,subject:'math',teacherId:f.wrongGrade})).status,400);assert.equal((await post({classId:f.classId,subject:'math',teacherId:f.wrongSubject})).status,400);
 assert.equal((await post({classId:f.classId,subject:'math',teacherId:f.good})).status,303);
});
test('subject filters reject missing class duplicate values and unauthorized reads',async t=>{
 const f=fixture(t),{get}=await http(t,f);assert.equal((await get('subject=math')).status,400);assert.equal((await get(selected(f,{subject:'math'})+'&subject=science')).status,400);assert.equal((await get(selected(f,{subject:'unknown'}))).status,400);
 grant(f,['school.read']);assert.equal((await get(selected(f,{subject:'math'}),f.ids.education)).status,403);
});
test('stale teacher choice still fails current server checks and origin protection',async t=>{
 const f=fixture(t),{get,post}=await http(t,f);assert.equal((await get(selected(f,{subject:'math'}))).status,200);
 const data={classId:f.classId,subject:'math',teacherId:f.good};assert.equal((await post(data,f.actor,'https://invalid.example')).status,403);
 const db=new DatabaseSync(f.file);db.prepare("INSERT INTO account_status(user,status) VALUES(?,'suspended') ON CONFLICT(user) DO UPDATE SET status='suspended'").run(f.good);db.close();
 assert.equal((await post(data)).status,404);assert.equal(f.a.school(f.actor).teacherAssignments.length,0);
});
test('candidate filtering includes multi-specialty teachers and rejects malformed class identifiers',t=>{
 const f=fixture(t),multi=f.add('Synthetic multi',['math','science'],[1,4]);
 assert.ok(f.a.schoolClassTeachers(f.actor,{classId:f.classId,subject:'math'}).teachers.some(t=>t.id===multi));
 assert.ok(f.a.schoolClassTeachers(f.actor,{classId:f.classId,subject:'science'}).teachers.some(t=>t.id===multi));
 for(const classId of ['',null,[],{},true,'bad'])denied(()=>f.a.schoolClassTeachers(f.actor,{classId,subject:'math'}),400);
 denied(()=>f.a.schoolClassTeachers(f.actor,{classId:randomUUID(),subject:'math'}),404);
 assert.equal(f.a.classTeacherCompatible,undefined);assert.equal(f.a.assertClassTeacherCompatible,undefined);
});
test('pending accounts and non-teacher roles never become candidates',t=>{
 const f=fixture(t),db=new DatabaseSync(f.file);db.prepare("UPDATE account_status SET status='pending' WHERE user=?").run(f.suspended);db.close();
 const ids=f.a.schoolClassTeachers(f.actor,{classId:f.classId,subject:'math'}).teachers.map(t=>t.id);
 for(const id of [f.suspended,f.actor,f.ids.education,f.ids.finance])assert.ok(!ids.includes(id));
});
test('all neighboring grants remain unable to read class teacher candidates',t=>{
 const f=fixture(t);for(const permission of ['school.supervision','school.students','school.individuals','school.structure']){grant(f,['school.read',permission]);denied(()=>f.a.schoolClassTeachers(f.ids.education,{classId:f.classId,subject:'math'}),403);}
});
test('subject GET preserves class context, refreshes candidates and is cleared by upstream selection',async t=>{
 const f=fixture(t),{get}=await http(t,f);let html=await (await get(selected(f,{subject:'math'}))).text();
 const subjectForm=[...html.matchAll(/<form method="get"[^>]*>(.*?)<\/form>/g)].map(m=>m[1]).find(form=>form.includes('<select name="subject"'));assert.ok(subjectForm);
 for(const [key,value] of selected(f))assert.match(subjectForm,new RegExp('name="'+key+'" value="'+value+'"'));
 for(const form of [...html.matchAll(/<form method="get"[^>]*>(.*?)<\/form>/g)].map(m=>m[1]).filter(form=>/<select name="(?:trackId|stage|grade|classId)"/.test(form)))assert.doesNotMatch(form,/name="subject"/);
 html=await (await get(selected(f,{subject:'science'}))).text();const picker=html.match(/<form method="post" action="\/admin\/school\/teachers"[^>]*>(.*?)<\/form>/)?.[1];assert.match(picker,new RegExp(f.wrongSubject));assert.doesNotMatch(picker,new RegExp(f.good));
});
test('archived and unsupported class records remain viewable without invoking candidate reads',async t=>{
 const f=fixture(t),{get}=await http(t,f);f.a.updateSchoolClass(f.actor,{classId:f.classId,name:'Synthetic class',state:'archived',revision:0});
 let r=await get();assert.equal(r.status,200);let html=await r.text();assert.match(html,/إعادة الإتاحة/);assert.doesNotMatch(html,/action="\/admin\/school\/teachers"/);
 assert.equal((await get(selected(f,{subject:'math'}))).status,409);
 const trackId=f.a.addSchoolTrack(f.actor,{name:'Unsupported'}),classId=f.a.addSchoolClass(f.actor,{trackId,levelKey:'primary:4',name:'Unsupported class',capacity:10});
 r=await get(new URLSearchParams({trackId,stage:'primary',grade:'4',classId}));assert.equal(r.status,200);html=await r.text();assert.match(html,/ربط التسجيل/);assert.doesNotMatch(html,/action="\/admin\/school\/teachers"/);
});
test('existing suspended teacher assignments remain visible and removable without conversion',async t=>{
 const f=fixture(t),{get}=await http(t,f);f.a.assignSchoolTeacher(f.actor,{classId:f.classId,teacherId:f.good,subject:'math'});
 const db=new DatabaseSync(f.file);db.prepare("INSERT INTO account_status(user,status) VALUES(?,'suspended') ON CONFLICT(user) DO UPDATE SET status='suspended'").run(f.good);db.close();
 const html=await (await get(selected(f,{subject:'math'}))).text();assert.match(html,/&lt;معلم رياضيات&gt;/);assert.match(html,/name="teacherId" value="/);assert.doesNotMatch(html,/action="\/admin\/school\/teachers"/);
 f.a.removeSchoolAssignment(f.actor,{kind:'teacher',classId:f.classId,teacherId:f.good,subject:'math'});assert.equal(f.a.school(f.actor).teacherAssignments.length,0);
});
test('stale specialization, lifecycle and grant changes cannot bypass the unchanged writer',async t=>{
 for(const change of ['specialty','archive','permission']){
  const f=fixture(t),{get,post}=await http(t,f);grant(f,['school.read','school.teachers']);assert.equal((await get(selected(f,{subject:'math'}),f.ids.education)).status,200);
  if(change==='specialty'){const db=new DatabaseSync(f.file);db.prepare('UPDATE users SET grades=? WHERE id=?').run('[1]',f.good);db.close();}
  else if(change==='archive')f.a.updateSchoolClass(f.actor,{classId:f.classId,name:'Synthetic class',state:'archived',revision:0});
  else grant(f,['school.read']);
  const before=f.a.auditLog(f.actor),r=await post({classId:f.classId,teacherId:f.good,subject:'math'},f.ids.education);assert.equal(r.status,{specialty:400,archive:409,permission:403}[change]);assert.equal(f.a.school(f.actor).teacherAssignments.length,0);assert.deepEqual(f.a.auditLog(f.actor),before);
 }
});
test('direct conflict is shared by candidate filtering and write rejection with no audit changes',async t=>{
 const f=fixture(t),{post}=await http(t,f),child=f.a.registration(f.actor).find(ch=>ch.grade===4),other=f.add('Other qualified math',['math'],[4]);
 f.a.assignSchoolStudent(f.actor,{classId:f.classId,childId:child.id});f.a.assignSchoolTeacherStudents(f.actor,{gradeId:f.gradeId,subject:'math',teacherId:f.good,childIds:[child.id]});const before=f.a.auditLog(f.actor);
 assert.ok(!f.a.schoolClassTeachers(f.actor,{classId:f.classId,subject:'math'}).teachers.some(t=>t.id===other));assert.equal((await post({classId:f.classId,teacherId:other,subject:'math'})).status,409);assert.deepEqual(f.a.auditLog(f.actor),before);
 assert.equal((await post({classId:f.classId,teacherId:f.good,subject:'math'})).status,303);const linked=f.a.schoolTeacherStudents(f.actor,{gradeId:f.gradeId,subject:'math',teacherId:f.good}).students.find(s=>s.id===child.id);assert.ok(linked.directAssignmentId);assert.equal(linked.inheritedTeacherId,f.good);
 const after=f.a.auditLog(f.actor);assert.equal((await post({classId:f.classId,teacherId:f.good,subject:'math'})).status,409);assert.deepEqual(f.a.auditLog(f.actor),after);
});
