import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openStore} from '../store.mjs';
import {createApp} from '../server.mjs';
async function fixture(t){const store=openStore(':memory:'),a=store.admin,ids=a.demo(),actor=ids.supervisor,gradeId=a.addSchoolGrade(actor,{grade:4}),classId=a.addSchoolClass(actor,{gradeId,name:'Synthetic class',capacity:1}),child=a.registration(actor).find(ch=>ch.grade===4),app=createApp(store);await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));t.after(async()=>{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));store.close();});const base='http://127.0.0.1:'+app.address().port,post=(route,data,id=actor,headers={})=>fetch(base+'/admin/school/'+route,{method:'POST',headers:{origin:base,cookie:'ks='+store.session(id),...headers},body:new URLSearchParams(data),redirect:'manual'});return {store,a,ids,actor,classId,gradeId,child,base,post};}
function destination(html){const match=html.match(/href="([^"]+)">العودة والمتابعة<\/a>/);assert.ok(match);return new URL(match[1].replaceAll('&amp;','&'),'http://local.invalid');}
function assertClass(f,html){const link=destination(html),row=f.a.school(f.actor).classes.find(c=>c.id===f.classId);assert.equal(link.origin,'http://local.invalid');assert.equal(link.pathname,'/admin/school');for(const [key,value] of Object.entries({trackId:row.track_id,stage:row.stage,grade:String(row.grade),classId:row.id}))assert.equal(link.searchParams.get(key),value);}
function grant(f,permissions){const m=f.a.members(f.actor).find(row=>row.id===f.ids.education);f.a.updateMember(f.actor,m.id,{...m,permissions});}

test('rejected single and batch enrollment return to the server-authorized class with original error status',async t=>{
 const f=await fixture(t);f.a.assignSchoolStudent(f.actor,{classId:f.classId,childId:f.child.id});const before=f.a.auditLog(f.actor);
 for(const [route,data] of [['students',{childId:f.child.id}],['students/batch',{['child_'+f.child.id]:'1'}]]){const r=await f.post(route,{classId:f.classId,...data});assert.equal(r.status,409);assert.equal(r.headers.get('location'),null);assertClass(f,await r.text());}
 assert.deepEqual(f.a.auditLog(f.actor),before);assert.equal(f.a.school(f.actor).classes[0].studentCount,1);
});
test('invalid selection and unavailable child errors preserve class navigation without leaking child details',async t=>{
 const f=await fixture(t);for(const [data,status] of [[{},400],[{childId:f.child.id},400],[{child_not_uuid:'1'},400],[{['child_'+randomUUID()]:'1'},404]]){const r=await f.post('students/batch',{classId:f.classId,...data});assert.equal(r.status,status);assertClass(f,await r.text());}
 assert.equal(f.a.school(f.actor).studentAssignments.length,0);
});
test('capacity rejection rolls back the whole batch and returns to its destination class',async t=>{
 const f=await fixture(t),agent=f.a.switchDemo(f.actor,'registration_agent'),{id:parent}=f.store.registration.addParent(agent,{name:'Synthetic parent',email:randomUUID()+'@example.invalid'}),second=f.store.registration.addChild(agent,{parent,name:'Synthetic child two',grade:4});const before=f.a.auditLog(f.actor);
 const r=await f.post('students/batch',{classId:f.classId,['child_'+f.child.id]:'1',['child_'+second]:'1'});assert.equal(r.status,409);assertClass(f,await r.text());assert.equal(f.a.school(f.actor).studentAssignments.length,0);assert.deepEqual(f.a.auditLog(f.actor),before);
});
test('untrusted return parameters and Referer cannot replace the canonical local class link',async t=>{
 const f=await fixture(t);const r=await f.post('students/batch',{classId:f.classId,returnUrl:'https://attacker.invalid/private',returnTo:'//attacker.invalid/other',next:'javascript:alert(1)',redirect:'/admin/school?classId=forged' },f.actor,{referer:'https://attacker.invalid/referrer'});assert.equal(r.status,400);const html=await r.text();assertClass(f,html);assert.doesNotMatch(html,/attacker\.invalid|javascript:alert|classId=forged/);
});
test('foreign, absent and forged class context never creates a class-specific error return',async t=>{
 const f=await fixture(t),other=f.a.demo(),g=f.a.addSchoolGrade(other.supervisor,{grade:4}),foreign=f.a.addSchoolClass(other.supervisor,{gradeId:g,name:'Foreign secret class',capacity:1});
 for(const classId of [foreign,randomUUID(),'https://attacker.invalid/class']){const r=await f.post('students/batch',{classId,['child_'+f.child.id]:'1'});assert.equal(r.status,404);const html=await r.text(),link=destination(html);assert.equal(link.pathname,'/app');assert.equal(link.search,'');assert.doesNotMatch(html,/Foreign secret class|attacker\.invalid/);}
});
test('permission revocation and origin denial do not expose class return context',async t=>{
 const f=await fixture(t);grant(f,['school.read','school.students']);grant(f,['school.read']);
 for(const [actor,headers] of [[f.ids.education,{}],[f.actor,{origin:'https://attacker.invalid'}]]){const r=await f.post('students/batch',{classId:f.classId},actor,headers);assert.equal(r.status,403);const html=await r.text(),link=destination(html);assert.equal(link.pathname,'/app');assert.equal(link.search,'');assert.doesNotMatch(html,new RegExp('classId='+f.classId));}
 assert.equal(f.a.school(f.actor).studentAssignments.length,0);
});
test('missing or empty class cannot use the generic destination as a contextual return',async t=>{
 const f=await fixture(t);for(const extra of [{},{classId:''}]){const r=await f.post('students/batch',{...extra,['child_'+f.child.id]:'1'});assert.equal(r.status,400);const link=destination(await r.text());assert.equal(link.pathname,'/app');assert.equal(link.search,'');}
});
test('single admission capacity rejection keeps the same class without a partial change',async t=>{
 const f=await fixture(t),agent=f.a.switchDemo(f.actor,'registration_agent'),{id:parent}=f.store.registration.addParent(agent,{name:'Synthetic parent',email:randomUUID()+'@example.invalid'}),second=f.store.registration.addChild(agent,{parent,name:'Synthetic second',grade:4});f.a.assignSchoolStudent(f.actor,{classId:f.classId,childId:f.child.id});const before=f.a.auditLog(f.actor);
 const r=await f.post('students',{classId:f.classId,childId:second});assert.equal(r.status,409);assertClass(f,await r.text());assert.equal(f.a.school(f.actor).studentAssignments.some(s=>s.child===second),false);assert.deepEqual(f.a.auditLog(f.actor),before);
});
test('service error boundary escapes expected text and passes unexpected errors through',async t=>{
 const f=await fixture(t),{adminService}=await import('../admin-service.mjs'),{UserError}=await import('../store.mjs');
 async function invoke(error){const admin={...f.a,assignSchoolStudents:()=>{throw error;}};return adminService({admin}).handle({req:{method:'POST',headers:{origin:f.base}},url:new URL(f.base+'/admin/school/students/batch'),u:{id:f.actor},base:f.base,fields:async()=>({classId:f.classId,['child_'+f.child.id]:'1'}),limit:()=>{},html:(title,body,status)=>({body,status}),redirect:url=>({redirect:url})});}
 for(const error of [new Error('Synthetic unexpected failure'),new UserError('Synthetic server error',500),new UserError('Synthetic denied',403)])await assert.rejects(invoke(error),caught=>caught===error);
 const result=await invoke(new UserError('<img src=x onerror=alert(1)>',400));assert.equal(result.status,400);assert.match(result.body,/&lt;img src=x onerror=alert\(1\)&gt;/);assert.doesNotMatch(result.body,/<img src=x/);assertClass(f,result.body);
});
test('service rechecks authorization and class visibility after a rejected write before rendering context',async t=>{
 const {adminService}=await import('../admin-service.mjs'),{UserError}=await import('../store.mjs');
 for(const change of ['permission','class']){const f=await fixture(t);grant(f,['school.read','school.students']);let failed=false,rendered=false;
  const admin={...f.a,assignSchoolStudents:()=>{failed=true;throw new UserError('Synthetic conflict',409);},requireAccess:(...args)=>{if(failed&&change==='permission')throw new UserError('Synthetic revoked',403);return f.a.requireAccess(...args);},school:(...args)=>{const snapshot=f.a.school(...args);return failed&&change==='class'?{...snapshot,classes:[]}:snapshot;}};
  await assert.rejects(adminService({admin}).handle({req:{method:'POST',headers:{origin:f.base}},url:new URL(f.base+'/admin/school/students/batch'),u:{id:f.ids.education},base:f.base,fields:async()=>({classId:f.classId,['child_'+f.child.id]:'1'}),limit:()=>{},html:()=>{rendered=true;},redirect:()=>{throw new Error('Unexpected redirect');}}),error=>error instanceof UserError&&error.status===(change==='permission'?403:404));assert.equal(rendered,false);
 }
});
