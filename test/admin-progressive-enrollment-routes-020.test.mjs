import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from '../store.mjs';
import {createApp} from '../server.mjs';
async function fixture(t){const store=openStore(':memory:'),a=store.admin,ids=a.demo(),app=createApp(store);await new Promise(r=>app.listen(0,'127.0.0.1',r));t.after(async()=>{app.closeAllConnections();await new Promise(r=>app.close(r));store.close();});const base='http://127.0.0.1:'+app.address().port;const get=(path='/admin/school',id=ids.supervisor)=>fetch(base+path,{headers:{cookie:'ks='+store.session(id)}});const post=(path,data,id=ids.supervisor,origin=base)=>fetch(base+path,{method:'POST',headers:{origin,cookie:'ks='+store.session(id)},body:new URLSearchParams(data),redirect:'manual'});const gradeId=a.addSchoolGrade(ids.supervisor,{grade:4}),one=a.addSchoolClass(ids.supervisor,{gradeId,name:'الفصل الأول',capacity:10}),two=a.addSchoolClass(ids.supervisor,{gradeId,name:'الفصل الثاني',capacity:10}),g=a.school(ids.supervisor).grades.find(g=>g.id===gradeId),query={trackId:g.track_id,stage:g.stage,grade:String(g.grade)};return {store,a,ids,get,post,one,two,query};}
const path=(q,route='/admin/school')=>route+'?'+new URLSearchParams(q);
function grant(a,ids,permissions){const m=a.members(ids.supervisor).find(m=>m.id===ids.education);a.updateMember(ids.supervisor,m.id,{...m,permissions});}
test('progressive UI hides descendants until explicit parent choices and clears children in GET forms',async t=>{
 const {get,query,one}=await fixture(t);
 for(const [q,names] of [[{},['trackId']],[{trackId:query.trackId},['trackId','stage']],[{trackId:query.trackId,stage:'primary'},['trackId','stage','grade']],[query,['trackId','stage','grade','classId']]]){
  const r=await get(path(q));assert.equal(r.status,200);const html=await r.text();
  for(const name of ['trackId','stage','grade','classId'])assert.equal(html.includes('<select name="'+name+'"'),names.includes(name),name);
  assert.doesNotMatch(html,/data-class-id=|name="child_/);
  for(const match of html.matchAll(/<select name="(?:trackId|stage|grade|classId)"[^>]*>(.*?)<\/select>/g))assert.match(match[1],/^<option value=""/);
 }
 const html=await (await get(path({...query,classId:one}))).text();assert.match(html,new RegExp('data-class-id="'+one+'"'));
 const forms=[...html.matchAll(/<form method="get"[^>]*>(.*?)<\/form>/g)].map(m=>m[1]);
 for(const [index,name] of ['trackId','stage','grade','classId'].entries()){const f=forms.find(f=>f.includes('<select name="'+name+'"'));assert.ok(f);for(const later of ['trackId','stage','grade','classId'].slice(index+1))assert.doesNotMatch(f,new RegExp('name="'+later+'"'));}
});
test('opened class shows only its members plus active unassigned same-grade candidates',async t=>{
 const {a,ids,get,query,one,two}=await fixture(t),student=a.registration(ids.supervisor).find(c=>c.grade===4);
 a.assignSchoolStudent(ids.supervisor,{classId:one,childId:student.id});
 let html=await (await get(path({...query,classId:one}))).text();assert.match(html,new RegExp('data-member-id="'+student.id+'"'));assert.doesNotMatch(html,new RegExp('name="child_'+student.id+'"'));
 html=await (await get(path({...query,classId:two}))).text();assert.doesNotMatch(html,new RegExp(student.id));assert.doesNotMatch(html,new RegExp('data-class-id="'+one+'"'));
});
test('both bulk routes use unique checkbox names and canonical class redirect without transfer',async t=>{
 const {a,ids,get,post,query,one,two}=await fixture(t),student=a.registration(ids.supervisor).find(c=>c.grade===4);
 const html=await (await get(path(query,'/admin/school/enrollment'))).text();assert.match(html,new RegExp('name="child_'+student.id+'"'));assert.ok(html.indexOf('name="child_')<html.indexOf('<select name="classId"'));assert.match(html,/<option value="" selected>اختر الفصل/);
 const opened=await (await get(path({...query,classId:one}))).text();assert.match(opened,/action="\/admin\/school\/students\/batch"/);assert.match(opened,new RegExp('name="classId" value="'+one+'"'));
 let r=await post('/admin/school/students/batch',{classId:one,['child_'+student.id]:'1'});assert.equal(r.status,303);assert.equal(new URL(r.headers.get('location'),'http://test.invalid').searchParams.get('classId'),one);
 r=await post('/admin/school/students/batch',{classId:two,['child_'+student.id]:'1'});assert.equal(r.status,409);assert.equal(a.school(ids.supervisor).studentAssignments.find(s=>s.child===student.id).class_id,one);
});
test('bulk enrollment page and writes enforce permission, origin and unsupported contexts',async t=>{
 const {a,ids,get,post,query,one}=await fixture(t),student=a.registration(ids.supervisor).find(c=>c.grade===4),payload={classId:one,['child_'+student.id]:'1'};
 grant(a,ids,['school.read']);assert.equal((await get(path(query,'/admin/school/enrollment'),ids.education)).status,403);assert.equal((await post('/admin/school/students/batch',payload,ids.education)).status,403);
 assert.equal((await post('/admin/school/students/batch',payload,ids.supervisor,'https://invalid.example')).status,403);
 const trackId=a.addSchoolTrack(ids.supervisor,{name:'مسار جديد'}),c=a.addSchoolClass(ids.supervisor,{trackId,levelKey:'middle:1',name:'متوسط',capacity:10});
 const html=await (await get(path({trackId,stage:'middle',grade:'1',classId:c}))).text();assert.match(html,/ربط التسجيل/);assert.doesNotMatch(html,/name="child_|action="\/admin\/school\/students\/batch"/);
 assert.equal((await post('/admin/school/students/batch',{...payload,classId:c})).status,409);assert.equal(a.school(ids.supervisor).studentAssignments.length,0);
});
test('query duplicates and enrollment without complete grade are rejected',async t=>{
 const {get,query}=await fixture(t);
 for(const suffix of ['&trackId='+query.trackId,'&stage=primary','&grade=4','&classId=&classId='])assert.equal((await get(path(query)+suffix)).status,400);
 assert.equal((await get('/admin/school/enrollment')).status,400);
 assert.equal((await get(path({trackId:query.trackId,grade:'4'}))).status,400);
});
test('creation and class archive preserve explicit class navigation including restoration',async t=>{
 const {a,ids,get,post,query,one}=await fixture(t);
 let r=await post('/admin/school/classes/update',{classId:one,name:'الفصل الأول',state:'archived',revision:'0'});assert.equal(r.status,303);const destination=r.headers.get('location');assert.equal(new URL(destination,'http://test.invalid').searchParams.get('classId'),one);
 let html=await (await get(destination)).text();assert.match(html,/إعادة الإتاحة/);assert.doesNotMatch(html,/action="\/admin\/school\/students\/batch"/);
 r=await post('/admin/school/classes',{...query,name:'جديد',capacity:'10'});assert.equal(r.status,303);const classId=new URL(r.headers.get('location'),'http://test.invalid').searchParams.get('classId');assert.ok(classId);assert.equal(a.school(ids.supervisor).classes.find(c=>c.id===classId).name,'جديد');
 r=await post('/admin/school/tracks',{name:'مسار جديد'});const u=new URL(r.headers.get('location'),'http://test.invalid');assert.ok(u.searchParams.get('trackId'));assert.equal(u.searchParams.has('stage'),false);
});
test('candidate filtering excludes suspended, other-grade and enrolled students while retaining class members',async t=>{
 const {store,a,ids,get,post,query,one,two}=await fixture(t),agent=a.switchDemo(ids.supervisor,'registration_agent');
 const {id:parent}=store.registration.addParent(agent,{name:'Synthetic parent',email:'filters-020@example.invalid'});
 const free=store.registration.addChild(agent,{parent,name:'Synthetic free',grade:4}),suspended=store.registration.addChild(agent,{parent,name:'Synthetic suspended',grade:4}),otherGrade=store.registration.addChild(agent,{parent,name:'Synthetic grade five',grade:5}),member=store.registration.addChild(agent,{parent,name:'Synthetic member',grade:4});
 store.registration.setStatus(agent,{kind:'child',id:suspended,status:'suspended'});
 a.assignSchoolStudent(ids.supervisor,{classId:one,childId:member});store.registration.setStatus(agent,{kind:'child',id:member,status:'suspended'});
 for(const url of [path({...query,classId:one}),path(query,'/admin/school/enrollment')]){
  const html=await (await get(url)).text();assert.match(html,new RegExp('name="child_'+free+'"'));
  for(const unavailable of [suspended,otherGrade,member])assert.doesNotMatch(html,new RegExp('name="child_'+unavailable+'"'));
 }
 let html=await (await get(path({...query,classId:one}))).text();assert.match(html,new RegExp('data-member-id="'+member+'"'));
 html=await (await get(path({...query,classId:two}))).text();assert.doesNotMatch(html,new RegExp(member));
 grant(a,ids,['school.read']);html=await (await get(path({...query,classId:one}),ids.education)).text();assert.doesNotMatch(html,/Synthetic member|Synthetic free|name="child_/);
 const r=await post('/admin/school/students/batch',{classId:two,['child_'+free]:'1',['child_'+suspended]:'1'});assert.equal(r.status,404);assert.equal(a.school(ids.supervisor).studentAssignments.some(s=>s.child===free),false);
});
test('class capacity, teacher, single admission and removal redirects stay on the affected class',async t=>{
 const {a,ids,post,query,one}=await fixture(t),child=a.registration(ids.supervisor).find(c=>c.grade===4),teacher=a.education(ids.supervisor).teachers.find(t=>t.subjects.includes('math')&&t.grades.includes(4));
 for(const [route,data] of [['classes/capacity',{capacity:'12',revision:'0'}],['teachers',{teacherId:teacher.id,subject:'math'}],['students',{childId:child.id}],['remove',{kind:'student',childId:child.id}],['remove',{kind:'teacher',teacherId:teacher.id,subject:'math'}]]){
  const r=await post('/admin/school/'+route,{classId:one,...data});assert.equal(r.status,303);const target=new URL(r.headers.get('location'),'http://test.invalid');
  for(const [key,value] of Object.entries({...query,classId:one}))assert.equal(target.searchParams.get(key),value);
 }
});
