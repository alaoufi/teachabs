import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openStore} from '../store.mjs';
import {createApp} from '../server.mjs';

async function fixture(t,file=':memory:'){const store=openStore(file),a=store.admin,ids=a.demo(),app=createApp(store);await new Promise(r=>app.listen(0,'127.0.0.1',r));t.after(async()=>{app.closeAllConnections();await new Promise(r=>app.close(r));store.close();});const base='http://127.0.0.1:'+app.address().port;const call=(path,options={},id=ids.supervisor)=>fetch(base+path,{headers:{cookie:'ks='+store.session(id),origin:base,...options.headers},...options,redirect:'manual'});const post=(path,data,id=ids.supervisor,origin=base)=>call(path,{method:'POST',headers:{cookie:'ks='+store.session(id),origin},body:new URLSearchParams(data)},id);const gradeId=a.addSchoolGrade(ids.supervisor,{grade:4}),classId=a.addSchoolClass(ids.supervisor,{gradeId,name:'A',capacity:10}),child=a.registration(ids.supervisor).find(x=>x.grade===4);a.assignSchoolStudent(ids.supervisor,{classId,childId:child.id});const teacherId=a.createTeacher(ids.supervisor,{name:'<معلم آمن>',email:randomUUID()+'@example.invalid',subjects:['math','science'],grades:[4],language:'ar'}).id;return {store,a,ids,call,post,base,gradeId,classId,child,teacherId};}
function grant(a,ids,permissions){const m=a.members(ids.supervisor).find(m=>m.id===ids.education);a.updateMember(ids.supervisor,m.id,{...m,permissions});}
const selection=(f,extra={})=>new URLSearchParams({gradeId:f.gradeId,subject:'math',teacherId:f.teacherId,...extra}).toString();

test('individual assignment routes isolate permissions, validate origin, and retain unique checkbox selections',async t=>{
 const f=await fixture(t),{a,ids,post,call}=f;
 assert.equal((await call('/admin/school/assignments')).status,200);
 assert.equal((await call('/admin/school/assignments',{},ids.education)).status,403);
 const data={gradeId:f.gradeId,subject:'math',teacherId:f.teacherId,['child_'+f.child.id]:'1'};
 assert.equal((await post('/admin/school/assignments',data,ids.supervisor,'https://invalid.example')).status,403);
 assert.equal((await post('/admin/school/assignments',data,ids.finance)).status,403);
 grant(a,ids,['school.read','school.teachers','school.students']);
 assert.equal((await call('/admin/school/assignments',{},ids.education)).status,403);
 grant(a,ids,['school.read','school.individuals']);
 const response=await post('/admin/school/assignments',data,ids.education);assert.equal(response.status,303);
 assert.match(response.headers.get('location'),/^\/admin\/school\/assignments\?/);
 assert.equal(a.schoolTeacherStudents(ids.supervisor,{gradeId:f.gradeId,subject:'math',teacherId:f.teacherId}).students[0].selectable,false);
 grant(a,ids,[]);assert.equal((await post('/admin/school/assignments',data,ids.education)).status,403);
});

test('selection UI escapes names and disables conflicting students with an explicit teacher/source reason',async t=>{
 const f=await fixture(t),{a,ids,call,post}=f;
 let res=await call('/admin/school/assignments?'+selection(f)),html=await res.text();assert.equal(res.status,200);
 assert.match(html,/&lt;معلم آمن&gt;/);assert.doesNotMatch(html,/<معلم آمن>/);
 assert.match(html,new RegExp('name="child_'+f.child.id+'"[^>]*value="1"'));
 assert.match(html,/غير الملحقين/);assert.match(html,/المادة نفسها/);
 a.assignSchoolTeacher(ids.supervisor,{classId:f.classId,teacherId:f.teacherId,subject:'math'});
 const other=a.createTeacher(ids.supervisor,{name:'معلم آخر',email:randomUUID()+'@example.invalid',subjects:['math'],grades:[4],language:'ar'}).id;
 html=await (await call('/admin/school/assignments?'+selection(f,{teacherId:other}))).text();
 assert.match(html,new RegExp('name="child_'+f.child.id+'"[^>]*disabled'));
 assert.match(html,/معلم الفصل/);assert.match(html,/&lt;معلم آمن&gt;/);
 assert.equal((await post('/admin/school/assignments',{gradeId:f.gradeId,subject:'math',teacherId:other,['child_'+f.child.id]:'1'})).status,409);
 assert.equal(a.school(ids.supervisor).teacherAssignments[0].teacher,f.teacherId);
});

test('assignment route validates selection and stale removal without changing class links',async t=>{
 const f=await fixture(t),{a,ids,call,post}=f;
 assert.equal((await call('/admin/school/assignments?'+selection(f,{subject:'bogus'}))).status,400);
 assert.equal((await call('/admin/school/assignments?'+selection(f,{page:'0'}))).status,400);
 assert.equal((await post('/admin/school/assignments',{gradeId:f.gradeId,subject:'math',teacherId:f.teacherId})).status,400);
 assert.equal((await post('/admin/school/assignments',{gradeId:f.gradeId,subject:'math',teacherId:f.teacherId,child_invalid:'1'})).status,400);
 a.assignSchoolTeacherStudents(ids.supervisor,{gradeId:f.gradeId,subject:'math',teacherId:f.teacherId,childIds:[f.child.id]});
 const student=a.schoolTeacherStudents(ids.supervisor,{gradeId:f.gradeId,subject:'math',teacherId:f.teacherId}).students[0];
 assert.equal((await post('/admin/school/assignments/remove',{assignmentId:student.directAssignmentId,gradeId:f.gradeId,subject:'math',teacherId:f.teacherId})).status,303);
 assert.equal((await post('/admin/school/assignments/remove',{assignmentId:student.directAssignmentId})).status,409);
 assert.equal(a.school(ids.supervisor).studentAssignments[0].child,f.child.id);
});


test('retained direct links remain manageable after the last qualified teacher is suspended',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'individual-ui-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const file=join(dir,'test.sqlite');
 const f=await fixture(t,file),{a,ids,call,post}=f;
 a.assignSchoolTeacherStudents(ids.supervisor,{gradeId:f.gradeId,subject:'math',teacherId:f.teacherId,childIds:[f.child.id]});
 const assignmentId=a.schoolTeacherStudents(ids.supervisor,{gradeId:f.gradeId,subject:'math',teacherId:f.teacherId}).students[0].directAssignmentId;
 const db=new DatabaseSync(file);for(const teacher of a.education(ids.supervisor).teachers)db.prepare("INSERT INTO account_status VALUES(?,'suspended') ON CONFLICT(user) DO UPDATE SET status='suspended'").run(teacher.id);db.close();
 const page=await call('/admin/school/assignments?'+new URLSearchParams({gradeId:f.gradeId,subject:'math'}));assert.equal(page.status,200);
 assert.match(await page.text(),new RegExp('value="'+assignmentId+'"'));
 const response=await post('/admin/school/assignments/remove',{assignmentId,gradeId:f.gradeId,subject:'math',teacherId:f.teacherId});assert.equal(response.status,303);
 assert.equal((await call(response.headers.get('location'))).status,200);
 assert.equal(a.schoolTeacherStudents(ids.supervisor,{gradeId:f.gradeId,subject:'math'}).students[0].directAssignmentId,null);
});

test('two uniquely named checkboxes survive shared form decoding and changing filters clears prior selections',async t=>{
 const f=await fixture(t),{a,ids,store,post,call}=f;
 const agent=a.switchDemo(ids.supervisor,'registration_agent'),{id:parent}=store.registration.addParent(agent,{name:'Synthetic group parent',email:randomUUID()+'@example.invalid'});
 store.registration.setStatus(agent,{kind:'parent',id:parent,status:'active'});
 const second=store.registration.addChild(agent,{parent,name:'<طالب المجموعة>',grade:4});a.assignSchoolStudent(ids.supervisor,{classId:f.classId,childId:second});
 const response=await post('/admin/school/assignments',{gradeId:f.gradeId,subject:'math',teacherId:f.teacherId,['child_'+f.child.id]:'1',['child_'+second]:'1'});assert.equal(response.status,303);
 const records=a.schoolTeacherStudents(ids.supervisor,{gradeId:f.gradeId,subject:'math',teacherId:f.teacherId});assert.equal(records.students.filter(x=>x.directTeacherId===f.teacherId).length,2);
 const html=await (await call('/admin/school/assignments?'+selection(f))).text();assert.match(html,/&lt;طالب المجموعة&gt;/);assert.doesNotMatch(html,/<طالب المجموعة>/);
 const filters=html.match(/<form method="get" action="\/admin\/school\/assignments"[^>]*>(.*?)<\/form>/)?.[1];assert.ok(filters);assert.doesNotMatch(filters,/name="teacherId"|name="child_/);
 const reset=await (await call('/admin/school/assignments?'+selection(f,{subject:'science',teacherId:''}))).text();assert.doesNotMatch(reset,/name="child_/);assert.doesNotMatch(reset,/<form method="post" action="\/admin\/school\/assignments"/);
});
