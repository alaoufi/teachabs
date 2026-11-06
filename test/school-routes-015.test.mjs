import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from '../store.mjs';
import {createApp} from '../server.mjs';
import {adminSchool} from '../admin-views.mjs';
import {SCHOOL_LEVELS} from '../school-catalog.mjs';

async function fixture(t){const store=openStore(':memory:'),a=store.admin,ids=a.demo(),app=createApp(store);await new Promise(r=>app.listen(0,'127.0.0.1',r));t.after(async()=>{app.closeAllConnections();await new Promise(r=>app.close(r));store.close();});const base='http://127.0.0.1:'+app.address().port;const post=(path,data,id=ids.supervisor,origin=base)=>fetch(base+path,{method:'POST',headers:{origin,cookie:'ks='+store.session(id)},body:new URLSearchParams(data),redirect:'manual'});return {a,ids,post,store};}
function grant(a,ids,permissions){const m=a.members(ids.supervisor).find(m=>m.id===ids.education);a.updateMember(ids.supervisor,m.id,{...m,permissions});}

test('track/class HTTP workflow enforces origin, scope, explicit capacity and fixed levels',async t=>{
 const {a,ids,post}=await fixture(t),id=ids.supervisor;
 const track={name:'المسار المصري',educationType:'government',curriculumName:'المصري'};
 const before=a.auditLog(id).length;
 assert.equal((await post('/admin/school/tracks',track,ids.finance)).status,403);
 assert.equal((await post('/admin/school/tracks',track,id,'https://invalid.example')).status,403);
 assert.equal(a.auditLog(id).length,before);assert.equal(a.school(id).tracks.length,0);
 assert.equal((await post('/admin/school/tracks',track)).status,303);
 const trackId=a.school(id).tracks[0].id,values={trackId,levelKey:'middle:1',name:'أ',capacity:'10'};
 assert.equal((await post('/admin/school/classes',{...values,capacity:''})).status,400);
 assert.equal((await post('/admin/school/classes',{...values,levelKey:'middle:4'})).status,400);
 assert.equal(a.school(id).grades.length,0);assert.equal(a.school(id).classes.length,0);
 assert.equal((await post('/admin/school/classes',values)).status,303);
 const c=a.school(id).classes[0];assert.equal(c.capacity,10);assert.equal(c.stage,'middle');assert.equal(c.assignmentSupported,false);
 const other=a.demo();assert.equal((await post('/admin/school/classes',{...values,name:'ب'},other.supervisor)).status,404);
 assert.equal((await post('/admin/school/grades',{trackId,stage:'secondary',grade:'3'})).status,303);
 assert.equal(a.school(id).grades.find(g=>g.stage==='secondary').grade,3);
});

test('capacity has its own granted HTTP permission and stale revisions cannot change it',async t=>{
 const {a,ids,post}=await fixture(t),id=ids.supervisor,gradeId=a.addSchoolGrade(id,{grade:4}),classId=a.addSchoolClass(id,{gradeId,name:'أ',capacity:10});
 grant(a,ids,['school.read','school.lifecycle']);
 const values={classId,capacity:'12',revision:'0'};
 assert.equal((await post('/admin/school/classes/capacity',values,ids.education)).status,403);
 grant(a,ids,['school.read','school.capacity']);
 assert.equal((await post('/admin/school/classes/capacity',values,ids.education,'https://invalid.example')).status,403);
 assert.equal((await post('/admin/school/classes/capacity',values,ids.education)).status,303);
 assert.equal((await post('/admin/school/classes/capacity',{...values,capacity:'13'},ids.education)).status,409);
 assert.equal((await post('/admin/school/classes/update',{classId,name:'ب',state:'active',revision:'1'},ids.education)).status,403);
 assert.equal(a.school(id).classes[0].capacity,12);
 assert.equal(a.auditLog(id).filter(e=>e.action==='school.class.capacity_updated').length,1);
});

test('school UI uses the fixed catalog, separates path/type/curriculum, and exposes only granted editors',async t=>{
 const {a,ids}=await fixture(t),id=ids.supervisor,trackId=a.addSchoolTrack(id,{name:'<مسار>',educationType:'private',curriculumName:'<منهج>'});
 const classId=a.addSchoolClass(id,{trackId,levelKey:'secondary:3',name:'فصل تجريبي',capacity:10}),selection={trackId,stage:'secondary',grade:3,classId};
 let html=adminSchool(a.profile(id),a.school(id),selection);
 assert.match(html,/name="educationType"/);assert.match(html,/name="curriculumName"/);assert.match(html,/الحد الأقصى للطلاب/);
 assert.match(html,/&lt;مسار&gt;/);assert.match(html,/&lt;منهج&gt;/);assert.doesNotMatch(html,/<مسار>|<منهج>/);
 const stages=html.match(/<select name="stage"[^>]*>(.*?)<\/select>/)?.[1];assert.ok(stages);
 const levels=html.match(/<select name="grade"[^>]*>(.*?)<\/select>/)?.[1];assert.ok(levels);
 for(const level of SCHOOL_LEVELS.filter(l=>l.stage==='secondary'))assert.ok(levels.includes('value="'+level.grade+'"'));
 assert.equal((stages.match(/<option /g)||[]).length,4);assert.equal((levels.match(/<option /g)||[]).length,4);assert.doesNotMatch(html,/action="\/admin\/school\/grades"/);
 assert.match(html,/بانتظار ربط التسجيل/);assert.doesNotMatch(html,/action="\/admin\/school\/students"/);
 grant(a,ids,['school.read']);html=adminSchool(a.profile(ids.education),a.school(ids.education),selection);
 assert.doesNotMatch(html,/action="\/admin\/school\/(?:tracks|classes|classes\/capacity|classes\/update)"/);
 grant(a,ids,['school.read','school.capacity']);html=adminSchool(a.profile(ids.education),a.school(ids.education),selection);
 assert.match(html,/action="\/admin\/school\/classes\/capacity"/);assert.doesNotMatch(html,/action="\/admin\/school\/classes\/update"/);
});

test('fresh administration can explicitly initialize the current registration path and enroll through HTTP',async t=>{
 const {a,ids,post}=await fixture(t),id=ids.supervisor;
 let html=adminSchool(a.profile(id),a.school(id));assert.match(html,/action="\/admin\/school\/tracks\/initialize"/);
 assert.equal(a.school(id).tracks.length,0);
 assert.equal((await post('/admin/school/tracks/initialize',{},ids.finance)).status,403);
 assert.equal((await post('/admin/school/tracks/initialize',{},id,'https://invalid.example')).status,403);
 assert.equal(a.school(id).tracks.length,0);
 // A user-named path cannot impersonate the compatible system context.
 a.addSchoolTrack(id,{name:'مسار التسجيل الحالي',educationType:'unspecified'});
 assert.equal((await post('/admin/school/tracks/initialize',{})).status,303);
 const track=a.school(id).tracks.find(t=>t.legacy===1);assert.ok(track);assert.notEqual(track.name,'مسار التسجيل الحالي');
 assert.equal(track.education_type,'unspecified');assert.equal(track.curriculum_name,'');
 const audit=a.auditLog(id).length;
 assert.equal((await post('/admin/school/tracks/initialize',{})).status,303);assert.equal(a.auditLog(id).length,audit);
 assert.equal((await post('/admin/school/classes',{trackId:track.id,levelKey:'primary:4',name:'أ',capacity:'10'})).status,303);
 const c=a.school(id).classes[0],child=a.registration(id).find(c=>c.grade===4),teacher=a.education(id).teachers.find(t=>t.subjects.includes('math')&&t.grades.includes(4));
 assert.equal((await post('/admin/school/students',{classId:c.id,childId:child.id})).status,303);
 assert.equal((await post('/admin/school/teachers',{classId:c.id,teacherId:teacher.id,subject:'math'})).status,303);
 assert.equal(a.school(id).classes[0].studentCount,1);assert.equal(a.school(id).teacherAssignments.length,1);
 html=adminSchool(a.profile(id),a.school(id));assert.doesNotMatch(html,/action="\/admin\/school\/tracks\/initialize"/);
});

test('legacy grade route cannot bypass track initialization authority or its audit',async t=>{
 const {a,ids,post}=await fixture(t),id=ids.supervisor;
 grant(a,ids,['school.read','school.structure']);
 const before=a.auditLog(id);
 assert.equal((await post('/admin/school/grades',{grade:'4'},ids.education)).status,403);
 assert.equal(a.school(id).tracks.length,0);assert.equal(a.school(id).grades.length,0);assert.deepEqual(a.auditLog(id),before);
 assert.equal((await post('/admin/school/tracks/initialize',{})).status,303);
 assert.equal(a.auditLog(id).filter(e=>e.action==='school.track.initialized').length,1);
 assert.equal((await post('/admin/school/grades',{grade:'4'},ids.education)).status,303);
 assert.equal(a.auditLog(id).filter(e=>e.action==='school.track.initialized').length,1);
 const other=a.demo();assert.equal((await post('/admin/school/grades',{grade:'4'},other.supervisor)).status,303);
 assert.equal(a.auditLog(other.supervisor).filter(e=>e.action==='school.track.initialized').length,1);
});
