import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openStore} from '../store.mjs';
import {createApp} from '../server.mjs';
import {featureDefaults,CLASSROOM_FEATURES} from '../public/classroom-features.js';
import {defaultPlan,validatePlan} from '../public/group-plan.js';
import {initialState,teacherCommand} from '../group-session.mjs';
import {classroomState,checkClassroomCommand} from '../classroom-policy.mjs';

const denied=(fn,status=403)=>assert.throws(fn,e=>e.status===status);
function fixture(t,path=':memory:') {
 const store=openStore(path), ids=store.admin.demo();
 const teacher=store.group.colleagues(store.user(ids.supervisor).scope)[0].id;
 t.after(()=>store.close());
 return {store,ids,teacher};
}
function change(store,id,changes) { const before=store.admin.classroomSettings(id);return store.admin.setClassroomSettings(id,{revision:before.revision,features:{...before.features,...changes}}); }

test('settings use existing roles, explicit grants, scopes, revisions and audit',t=>{
 const {store,ids,teacher}=fixture(t), a=store.admin, other=a.demo();
 assert.deepEqual(a.classroomSettings(ids.supervisor),{features:featureDefaults(),revision:0});
 for(const id of [teacher,ids.finance,ids.technical]) {denied(()=>a.classroomSettings(id));denied(()=>a.setClassroomSettings(id,{features:featureDefaults(),revision:0}));}
 const before=a.auditLog(ids.supervisor).length;
 change(store,ids.supervisor,{camera:false,timer:false});
 assert.equal(a.classroomFeaturesForTeacher(teacher).camera,false);
 assert.equal(a.classroomSettings(other.supervisor).features.camera,true);
 assert.equal(a.auditLog(ids.supervisor).length,before+1);
 assert.equal(a.auditLog(ids.supervisor)[0].action,'classroom.settings.updated');
 denied(()=>a.setClassroomSettings(ids.supervisor,{revision:0,features:featureDefaults()}),409);
 for(const features of [{...featureDefaults(),camera:'false'}, {...featureDefaults(),scope:'forged'},{}]) denied(()=>a.setClassroomSettings(ids.supervisor,{revision:1,features}),400);
 const member=a.members(ids.supervisor).find(m=>m.id===ids.technical);
 a.updateMember(ids.supervisor,ids.technical,{...member,permissions:['classroom.read']});
 assert.equal(a.classroomSettings(ids.technical).features.camera,false);
 denied(()=>a.setClassroomSettings(ids.technical,{revision:1,features:featureDefaults()}));
 const current=a.members(ids.supervisor).find(m=>m.id===ids.technical);
 a.updateMember(ids.supervisor,ids.technical,{...current,permissions:['classroom.read','classroom.write']});
 change(store,ids.technical,{camera:true});
 a.updateMember(ids.supervisor,ids.technical,{...a.members(ids.supervisor).find(m=>m.id===ids.technical),active:false});
 denied(()=>a.classroomSettings(ids.technical));
});

test('settings survive restart; audit failure rolls back the setting atomically',t=>{
 const dir=mkdtempSync(join(tmpdir(),'classroom-settings-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const path=join(dir,'synthetic.sqlite');let store=openStore(path);const ids=store.admin.demo();
 change(store,ids.supervisor,{homework:false});store.close();store=openStore(path);t.after(()=>store.close());
 assert.equal(store.admin.classroomSettings(ids.supervisor).features.homework,false);
 const db=new DatabaseSync(path);db.exec("CREATE TRIGGER reject_settings_audit BEFORE INSERT ON admin_audit WHEN NEW.action='classroom.settings.updated' BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END");db.close();
 assert.throws(()=>change(store,ids.supervisor,{homework:true}));
 assert.equal(store.admin.classroomSettings(ids.supervisor).features.homework,false);
 assert.equal(store.admin.classroomSettings(ids.supervisor).revision,1);
});

test('policy projects hidden components without deleting stored lesson state',()=>{
 const plan=validatePlan(defaultPlan());let state=initialState(plan);
 state=teacherCommand(state,plan,{op:'voice',teacher:true,mics:true,camera:true});
 state=teacherCommand(state,plan,{op:'timer',seconds:60});
 state=teacherCommand(state,plan,{op:'homework',status:'open'});
 const saved=structuredClone(state),features=Object.fromEntries(CLASSROOM_FEATURES.map(f=>[f.key,false]));
 const projected=classroomState(state,plan,features);
 assert.equal(projected.shown,false);assert.equal(projected.voice.camera,false);assert.equal(projected.homework,'none');assert.equal(projected.timer,null);
 assert.deepEqual(state,saved);
 const need=(ok,msg,status)=>{if(!ok)throw Object.assign(new Error(msg),{status});};
 for(const command of [{op:'voice',camera:true},{op:'timer',seconds:60},{op:'stroke'},{op:'go',index:0},{op:'show',shown:true},{op:'homework',status:'open'}])denied(()=>checkClassroomCommand(features,state,plan,command,need));
 assert.deepEqual(checkClassroomCommand(features,state,plan,{op:'voice',camera:false},need),{op:'voice',camera:false});
 assert.equal(classroomState(state,plan,featureDefaults()).homework,'open');
 const f={...featureDefaults(),interactive:false,notes:false};
 assert.equal(checkClassroomCommand(f,state,plan,{op:'go',by:1},need).index,3);
});

async function httpFixture(t) {
 const f=fixture(t), app=createApp(f.store);await new Promise(r=>app.listen(0,'127.0.0.1',r));
 t.after(async()=>{app.closeAllConnections();await new Promise(r=>app.close(r));});
 const base='http://127.0.0.1:'+app.address().port;
 const cookies={admin:'ks='+f.store.session(f.ids.supervisor),teacher:'ks='+f.store.session(f.teacher),finance:'ks='+f.store.session(f.ids.finance)};
 const plan=validatePlan(defaultPlan()),code=f.store.group.startSession(f.teacher,plan,initialState(plan));
 const student=f.store.group.join(code,'طالب تجريبي',30);cookies.student=`gl_${code}=${student.token}`;
 const get=(path,who='admin')=>fetch(base+path,{headers:{cookie:cookies[who]},redirect:'manual'});
 const post=(path,data,who='admin',origin=base)=>fetch(base+path,{method:'POST',headers:{cookie:cookies[who],origin},body:data instanceof URLSearchParams?data:new URLSearchParams(data),redirect:'manual'});
 const json=(path,data,who='teacher')=>fetch(base+path,{method:'POST',headers:{cookie:cookies[who],origin:base,'content-type':'application/json'},body:JSON.stringify(data)});
 const form=features=>({revision:String(f.store.admin.classroomSettings(f.ids.supervisor).revision),...Object.fromEntries(Object.entries(features).filter(([,v])=>v).map(([k])=>['feature_'+k,'1']))});
 return {...f,base,code,plan,get,post,json,form};
}

test('HTTP settings require permission, same origin, strict fields and fresh revision',async t=>{
 const f=await httpFixture(t);
 assert.equal((await f.get('/admin/classroom')).status,200);
 for(const who of ['finance','teacher'])assert.equal((await f.post('/admin/classroom',f.form(featureDefaults()),who)).status,403);
 assert.equal((await f.post('/admin/classroom',f.form(featureDefaults()),'admin','https://example.invalid')).status,403);
 const duplicate=new URLSearchParams(f.form(featureDefaults()));duplicate.append('revision','0');assert.equal((await f.post('/admin/classroom',duplicate)).status,400);
 assert.equal((await f.post('/admin/classroom',{...f.form(featureDefaults()),scope:'other'})).status,400);
 assert.equal((await f.post('/admin/classroom',f.form(featureDefaults()),'student')).headers.get('location'),'/login');
 const body=f.form({...featureDefaults(),camera:false});assert.equal((await f.post('/admin/classroom',body)).status,303);
 assert.equal((await f.post('/admin/classroom',body)).status,409);
 assert.equal((await f.json(`/teach/live/${f.code}/command`,{op:'voice',camera:true})).status,403);
});

test('live events update existing rooms; hidden content and commands are denied, restored state survives',async t=>{
 const f=await httpFixture(t), ctl=new AbortController();t.after(()=>ctl.abort());
 const response=await fetch(f.base+`/class/${f.code}/events`,{headers:{cookie:`gl_${f.code}=${f.store.group.join(f.code,'طالبة',30).token}`},signal:ctl.signal});
 const reader=response.body.getReader();await reader.read();
 const state=f.store.group.session(f.code).state;
 assert.equal((await f.post('/admin/classroom',f.form({...featureDefaults(),page:false,hands:false,questions:false,homework:false,evaluation:false,display:false,laser:false}))).status,303);
 const updated=new TextDecoder().decode((await reader.read()).value);assert.match(updated,/"page":false/);assert.match(updated,/"shown":false/);
 assert.equal((await f.get(`/class/${f.code}/content?step=${f.plan.steps[0].id}`,'student')).status,403);
 assert.equal((await f.json(`/class/${f.code}/hand`,{up:true},'student')).status,403);
 assert.equal((await f.json(`/teach/live/${f.code}/laser`,{p:[[1,2]]})).status,403);
 assert.equal((await f.get(`/teach/live/${f.code}/display`,'teacher')).status,403);
 assert.equal((await f.json(`/teach/live/${f.code}/command`,{op:'show',shown:true})).status,403);
 assert.deepEqual(f.store.group.session(f.code).state,state);
 await f.post('/admin/classroom',f.form(featureDefaults()));
 assert.equal((await f.get(`/class/${f.code}/content?step=${f.plan.steps[0].id}`,'student')).status,200);
 ctl.abort();
});
