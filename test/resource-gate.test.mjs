import test from 'node:test';import assert from 'node:assert/strict';import{openStore}from'../store.mjs';import{createApp}from'../server.mjs';
test('HTTP lesson resources and clear stay within authenticated teacher booking',async t=>{
 const store=openStore(':memory:'),app=createApp(store);await new Promise(r=>app.listen(0,'127.0.0.1',r));t.after(()=>{app.closeAllConnections();app.close();store.close();});
 const base='http://127.0.0.1:'+app.address().port,group=store.tour(),other=store.tour();const teacher='ks='+store.session(group.teacher),parent='ks='+store.session(group.parent),outsider='ks='+store.session(other.teacher);
 const slot=store.slot(group.teacher,{subject:'math',minutes:45,start:Date.now()+60000,instructions:'Synthetic'}),id=store.book(group.parent,group.child,slot,'test-context'),client='aa45b5de-9404-4909-829b-4fddda2b1017';
 const events=await fetch(base+'/lesson/'+id+'/events?client='+client,{headers:{cookie:teacher}});const reader=events.body.getReader();await reader.read();
 const send=(cookie,payload,action='send')=>fetch(base+'/lesson/'+id+'/'+action,{method:'POST',headers:{cookie,origin:base},body:new URLSearchParams({client,kind:'board',payload:JSON.stringify(payload)})});
 let r=await send(teacher,{op:'lesson',rev:0,lessonId:'science-g4-water'});assert.equal(r.status,403);
 r=await send(teacher,{op:'lesson',rev:0,lessonId:'math-g4-fractions'});assert.equal(r.status,200);let state=await r.json();assert.deepEqual(state.resources.map(a=>a.id),['fraction']);assert.equal(state.lessonScenes,undefined);
 assert.equal((await send(parent,{op:'clear',rev:state.rev,lessonId:state.activeLesson,confirm:true},'clear')).status,403);
 assert.equal((await send(outsider,{op:'clear',rev:state.rev,lessonId:state.activeLesson,confirm:true},'clear')).status,404);
 assert.equal((await send(teacher,{op:'clear',rev:state.rev,lessonId:state.activeLesson,confirm:false},'clear')).status,403);
 r=await send(teacher,{op:'clear',rev:state.rev,lessonId:state.activeLesson,confirm:true},'clear');assert.equal(r.status,200);state=await r.json();assert.equal(state.elements.length,0);await reader.cancel();
});
