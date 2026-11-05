import test from 'node:test';import assert from 'node:assert/strict';import{changeBoard}from'../board.mjs';
import{openStore}from'../store.mjs';import{mkdtempSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';
const element={id:'shape-1',type:'rectangle',x:0,y:0,width:100,height:100,angle:0};
test('scene revision, permissions, external image and link restrictions',()=>{
 let s=changeBoard(null,'teacher',{rev:0,op:'scene',elements:[{...element,link:'https://external.example'}],files:{}});
 assert.equal(s.elements[0].link,null);
 assert.throws(()=>changeBoard(s,'student',{rev:1,op:'scene',elements:[],files:{}}),e=>e.status===403);
 s=changeBoard(s,'teacher',{rev:1,op:'permission',allow:true});
 assert.throws(()=>changeBoard(s,'teacher',{rev:1,op:'scene',elements:[],files:{}}),e=>e.status===409);
 assert.throws(()=>changeBoard(s,'student',{rev:2,op:'scene',elements:[{...element,type:'embeddable'}]}));
 assert.throws(()=>changeBoard(s,'student',{rev:2,op:'scene',elements:[{...element,type:'image',fileId:'f'}],files:{f:{dataURL:'https://tracker.example/a.png'}}}));
 s=changeBoard(s,'student',{rev:2,op:'scene',elements:[element],files:{}});assert.equal(s.rev,3);
});
test('board persists independently of in-memory lesson room and remains isolated by key',()=>{
 const dir=mkdtempSync(join(tmpdir(),'board-persist-')),path=join(dir,'test.sqlite');
 try{let store=openStore(path);const s=changeBoard(null,'teacher',{rev:0,op:'scene',elements:[element],files:{}});store.writeBoard('lesson-A',s);assert.equal(store.readBoard('lesson-B'),null);store.close();store=openStore(path);assert.deepEqual(store.readBoard('lesson-A'),s);store.close();}finally{rmSync(dir,{recursive:true,force:true});}
});
