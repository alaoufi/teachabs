import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openStore} from '../store.mjs';
import {createApp} from '../server.mjs';
async function fixture(t){const store=openStore(':memory:'),ids=store.admin.demo(),app=createApp(store);await new Promise(r=>app.listen(0,'127.0.0.1',r));t.after(async()=>{app.closeAllConnections();await new Promise(r=>app.close(r));store.close();});const base='http://127.0.0.1:'+app.address().port,cookie='ks='+store.session(ids.supervisor);return {store,ids,base,cookie,get:path=>fetch(base+path,{headers:{cookie},redirect:'manual'}),post:(path,data,origin=base)=>fetch(base+path,{method:'POST',headers:{cookie,origin},body:new URLSearchParams(data),redirect:'manual'})};}
test('038 calendar screen offers explicit year/term instead of manual student teacher assignment',async t=>{const f=await fixture(t),r=await f.get('/admin/school/calendar');assert.equal(r.status,200);const h=await r.text();assert.match(h,/الأعوام والفصول الدراسية/);assert.match(h,/action="\/admin\/school\/calendar\/years"/);assert.doesNotMatch(h,/student-teachers|onchange=|<script/);});
test('038 calendar HTTP writes enforce origin and server permission',async t=>{const f=await fixture(t),data={name:'عام اختبار',startDate:'2030-01-01',endDate:'2030-12-31',request:randomUUID()};assert.equal((await f.post('/admin/school/calendar/years',data,'https://evil.invalid')).status,403);assert.equal((await f.post('/admin/school/calendar/years',data)).status,303);const cookie='ks='+f.store.session(f.ids.finance);assert.equal((await fetch(f.base+'/admin/school/calendar',{headers:{cookie},redirect:'manual'})).status,403);});
test('038 retired independent manual enrollment has no write endpoint',async t=>{const f=await fixture(t);for(const path of ['/admin/school/academics/student-teachers','/admin/school/assignments','/admin/school/assignments/remove'])assert.equal((await f.post(path,{studentId:randomUUID(),teacherId:randomUUID()})).status,409);});
test('038 academic consumer API returns JSON authentication errors not admin authority',async t=>{const f=await fixture(t),path='/api/academics/teacher/classes';let r=await fetch(f.base+path,{redirect:'manual'});assert.equal(r.status,401);assert.match(r.headers.get('content-type'),/application\/json/);r=await f.get(path);assert.equal(r.status,403);});

test('a supervisor registers a new pupil directly in the class, atomically enforces capacity and can retry',async t=>{
 const f=await fixture(t),a=f.store.admin,actor=f.ids.supervisor,gradeId=a.addSchoolGrade(actor,{grade:4});
 const classId=a.addSchoolClass(actor,{gradeId,name:'فصل تجريبي',capacity:1});
 const yearId=a.addAcademicYear(actor,{name:'عام تجريبي',startDate:'2030-01-01',endDate:'2030-12-31',request:randomUUID()});
 const parentId=a.school(actor).parents[0].id,path='/admin/school/calendar/students';
 const form={classId,yearId,parentId,name:'طالب تجريبي',request:randomUUID()};
 assert.equal((await f.post(path,form)).status,303);
 assert.equal((await f.post(path,form)).status,303);
 const students=a.school(actor).students.length;
 assert.equal((await f.post(path,{...form,name:'طالب آخر',request:randomUUID()})).status,409);
 assert.equal(a.school(actor).students.length,students);
 assert.equal(a.school(actor).classes.find(x=>x.id===classId).studentCount,1);
 assert.equal(a.calendarSchool(actor).enrollments.filter(x=>x.classId===classId).length,1);
});
