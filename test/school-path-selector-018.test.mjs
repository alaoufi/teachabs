import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from '../store.mjs';
import {createApp} from '../server.mjs';

async function fixture(t){const store=openStore(':memory:'),a=store.admin,ids=a.demo(),app=createApp(store);await new Promise(r=>app.listen(0,'127.0.0.1',r));t.after(async()=>{app.closeAllConnections();await new Promise(r=>app.close(r));store.close();});const base='http://127.0.0.1:'+app.address().port;const get=(query='',id=ids.supervisor)=>fetch(base+'/admin/school'+query,{headers:{cookie:'ks='+store.session(id)}});const post=(path,data,id=ids.supervisor,origin=base)=>fetch(base+path,{method:'POST',headers:{origin,cookie:'ks='+store.session(id)},body:new URLSearchParams(data),redirect:'manual'});return {a,ids,get,post};}
function choices(html,name){return html.match(new RegExp('<select name="'+name+'"[^>]*>(.*?)</select>'))?.[1]||'';}
const url=values=>'?'+new URLSearchParams(values);
function grant(a,ids,permissions){const m=a.members(ids.supervisor).find(m=>m.id===ids.education);a.updateMember(ids.supervisor,m.id,{...m,permissions});}

test('path stage grade flow uses exactly the stored fixed stage and grade catalog',async t=>{
 const {a,ids,get}=await fixture(t),trackId=a.addSchoolTrack(ids.supervisor,{name:'المسار المصري',curriculumName:'المصري'});
 for(const [stage,count] of [['primary',6],['middle',3],['secondary',3]]){
  const response=await get(url({trackId,stage}));assert.equal(response.status,200);const html=await response.text(),stages=choices(html,'stage'),grades=choices(html,'grade');
  assert.equal((stages.match(/<option /g)||[]).length,3);assert.match(stages,/value="primary"/);assert.match(stages,/value="middle"/);assert.match(stages,/value="secondary"/);
  assert.equal((grades.match(/<option /g)||[]).length,count);for(let n=1;n<=count;n++)assert.match(grades,new RegExp('value="'+n+'"'));assert.doesNotMatch(html,/<select name="levelKey"/);
  assert.match(html,/إنشاء مسار جديد/);assert.match(html,/name="trackId"/);assert.match(html,/اسناد|إسناد/);
 }
});

test('new path returns to its own selector and selected fixed grade creates only its own class',async t=>{
 const {a,ids,get,post}=await fixture(t);
 let response=await post('/admin/school/tracks',{name:'<مسار جديد>',educationType:'private',curriculumName:'<منهج>'});assert.equal(response.status,303);
 const track=a.school(ids.supervisor).tracks[0];assert.match(response.headers.get('location'),new RegExp('trackId='+track.id));
 response=await post('/admin/school/classes',{trackId:track.id,stage:'middle',grade:'2',name:'متوسط خاص',capacity:'10'});assert.equal(response.status,303);
 const classRow=a.school(ids.supervisor).classes[0];assert.equal(classRow.stage,'middle');assert.equal(classRow.grade,2);assert.equal(classRow.capacity,10);assert.equal(classRow.assignmentSupported,false);
 const secondary=a.addSchoolClass(ids.supervisor,{trackId:track.id,levelKey:'secondary:3',name:'ثانوي غير محدد',capacity:15});assert.ok(secondary);
 const html=await (await get(url({trackId:track.id,stage:'middle',grade:'2'}))).text();assert.match(html,/متوسط خاص/);assert.doesNotMatch(html,/ثانوي غير محدد/);assert.match(html,/&lt;مسار جديد&gt;/);assert.doesNotMatch(html,/<مسار جديد>/);
 assert.match(html,/بانتظار ربط التسجيل|تحتاج ربط/);assert.doesNotMatch(html,/action="\/admin\/school\/teachers"/);assert.doesNotMatch(html,/action="\/admin\/school\/students"/);
});

test('selector scope and fixed values reject forged input without changing data',async t=>{
 const {a,ids,get,post}=await fixture(t),trackId=a.addSchoolTrack(ids.supervisor,{name:'مسار'}),other=a.demo(),foreign=a.addSchoolTrack(other.supervisor,{name:'مسار آخر'});
 for(const query of [{trackId:foreign,stage:'primary'},{trackId,stage:'university'},{trackId,stage:'middle',grade:'4'},{trackId,stage:'primary',grade:'1.5'}])assert.ok([400,404].includes((await get(url(query))).status));
 const before=a.school(ids.supervisor),audit=a.auditLog(ids.supervisor);
 for(const extra of [{stage:'middle',grade:'4'},{stage:'secondary',grade:'6'},{stage:'university',grade:'1'},{stage:'primary',grade:'1',levelKey:'primary:2'},{stage:'primary',grade:'1',gradeId:'forged'}])assert.equal((await post('/admin/school/classes',{trackId,name:'غير مسموح',capacity:'10',...extra})).status,400);
 assert.deepEqual(a.school(ids.supervisor),before);assert.deepEqual(a.auditLog(ids.supervisor),audit);
});

test('read-only navigation stays available while creation and assignments remain independently authorized',async t=>{
 const {a,ids,get,post}=await fixture(t),trackId=a.addSchoolTrack(ids.supervisor,{name:'مسار'});
 grant(a,ids,['school.read']);let html=await (await get(url({trackId,stage:'secondary'}),ids.education)).text();assert.match(html,/<form method="get"/);assert.match(html,/<select name="stage"/);assert.doesNotMatch(html,/action="\/admin\/school\/tracks"|action="\/admin\/school\/classes"/);
 assert.equal((await post('/admin/school/classes',{trackId,stage:'secondary',grade:'1',name:'A',capacity:'10'},ids.education)).status,403);
 grant(a,ids,['school.read','school.structure']);assert.equal((await post('/admin/school/classes',{trackId,stage:'secondary',grade:'1',name:'A',capacity:'10'},ids.education,'https://invalid.example')).status,403);
 assert.equal((await post('/admin/school/classes',{trackId,stage:'secondary',grade:'1',name:'A',capacity:'10'},ids.education)).status,303);
 grant(a,ids,[]);assert.equal((await get(url({trackId,stage:'secondary'}),ids.education)).status,403);
});

test('class edits retain the selected path stage and grade rather than hiding the updated record',async t=>{
 const {a,ids,get,post}=await fixture(t),actor=ids.supervisor;
 a.initializeSchoolLegacyTrack(actor);a.addSchoolGrade(actor,{grade:4});
 const trackId=a.addSchoolTrack(actor,{name:'مسار ثانوي'}),classId=a.addSchoolClass(actor,{trackId,levelKey:'secondary:3',name:'قبل',capacity:10});
 let response=await post('/admin/school/classes/update',{classId,name:'بعد',state:'active',revision:'0'});assert.equal(response.status,303);
 let destination=new URL(response.headers.get('location'),'http://test.invalid');assert.equal(destination.searchParams.get('trackId'),trackId);assert.equal(destination.searchParams.get('stage'),'secondary');assert.equal(destination.searchParams.get('grade'),'3');
 assert.match(await (await get(destination.search)).text(),/بعد/);
 response=await post('/admin/school/classes/capacity',{classId,capacity:'12',revision:'1'});assert.equal(response.status,303);destination=new URL(response.headers.get('location'),'http://test.invalid');assert.equal(destination.searchParams.get('trackId'),trackId);
 assert.equal(a.school(actor).classes.find(c=>c.id===classId).capacity,12);
});

test('returning from individual assignment restores the selected school grade',async t=>{
 const {a,ids,get}=await fixture(t),actor=ids.supervisor;
 a.addSchoolGrade(actor,{grade:1});const gradeId=a.addSchoolGrade(actor,{grade:4}),school=a.school(actor),grade=school.grades.find(g=>g.id===gradeId);
 const {adminSchoolIndividuals}=await import('../admin-views.mjs');
 const html=adminSchoolIndividuals(a.profile(actor),a.schoolTeacherStudents(actor,{gradeId}));
 const match=html.match(/href="([^"]+)">العودة إلى الصفوف والفصول<\/a>/);assert.ok(match);
 const destination=new URL(match[1].replaceAll('&amp;','&'),'http://test.invalid');assert.equal(destination.searchParams.get('trackId'),grade.track_id);assert.equal(destination.searchParams.get('stage'),'primary');assert.equal(destination.searchParams.get('grade'),'4');
 assert.equal((await get(destination.search)).status,200);
});
