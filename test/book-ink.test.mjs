import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState, teacherCommand, studentInk, switchBookPage, publicView} from '../group-session.mjs';
const plan = {steps: [{id:'page', type:'page', title:'الكتاب'}, {id:'other', type:'page', title:'صفحة أخرى'}]};
const stroke = {op:'stroke', tool:'pen', size:'m', color:'#173e34', points:[[400,200],[500,250]], step:'page', pageVer:0};
test('each book page restores its own ink and camera without retaining image data', () => {
 let s = switchBookPage(initialState(plan),'page','g4-t1-math',13);
 s = teacherCommand(s,plan,stroke); s = teacherCommand(s,plan,{op:'camera',z:2,x:200,y:100});
 const ink=structuredClone(s.strokes.page);
 s = switchBookPage(s,'page','g4-t1-math',14);
 assert.deepEqual(s.strokes.page,[]); assert.equal(s.camera.page.z,1);
 s = teacherCommand(s,plan,{...stroke,color:'#c0392b'});
 s = switchBookPage(s,'page','g4-t1-math',13);
 assert.deepEqual(s.strokes.page,ink); assert.deepEqual(s.camera.page,{z:2,x:200,y:100});
 assert.ok(!JSON.stringify(s).includes('data:image'));
});
test('student ink requires current teacher grant, visible live step and matching page generation', () => {
 let s=initialState(plan);
 assert.throws(()=>studentInk(s,plan,'student',stroke),{status:403});
 s=teacherCommand(s,plan,{op:'draw-permission',student:'student',allow:true});
 let next=studentInk(s,plan,'student',stroke); assert.equal(next.strokes.page[0].author,'student');
 assert.throws(()=>studentInk(s,plan,'other',stroke),{status:403});
 assert.throws(()=>studentInk(s,plan,'student',{...stroke,op:'clear-strokes'}),{status:403});
 assert.throws(()=>studentInk(s,plan,'student',{...stroke,pageVer:99}),{status:409});
 for(const command of [{op:'draw-permission',student:'student',allow:false},{op:'show',shown:false},{op:'go',index:1},{op:'live',on:false},{op:'attention',on:true}]) {
  const stopped=teacherCommand(s,plan,command);
  assert.throws(()=>studentInk(stopped,plan,'student',stroke));
  assert.equal(publicView(stopped,plan,'student',[]).canDraw,false);
 }
 next=switchBookPage(s,'page','g4-t1-math',14);
 assert.deepEqual(next.drawGrants,{});
});
