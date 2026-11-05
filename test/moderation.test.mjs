import test from 'node:test';import assert from 'node:assert/strict';import{changeBoard,emptyBoard}from'../board.mjs';
const e={id:'draft-1',type:'text',text:'Synthetic student work',x:0,y:0,width:100,height:30,angle:0};
test('student draft ownership, permission, immutable publication, hide and stale revision',()=>{
 let s=emptyBoard();const command=(seat,op,extra={})=>changeBoard(s,seat,{rev:s.rev,op,...extra});
 assert.throws(()=>command('student','draft',{elements:[e],files:{}}),x=>x.status===403);
 s=command('teacher','permission',{allow:true});
 assert.throws(()=>command('student','scene',{elements:[e],files:{}}),x=>x.status===403);
 assert.throws(()=>command('teacher','draft',{elements:[e],files:{}}),x=>x.status===403);
 s=command('student','draft',{elements:[e],files:{}});assert.equal(s.elements.length,0);assert.equal(s.publishedStudent,undefined);
 assert.throws(()=>command('student','publish'),x=>x.status===403);
 s=command('teacher','publish');assert.equal(s.publishedStudent.elements[0].text,e.text);
 s=command('student','draft',{elements:[{...e,text:'New private version'}],files:{}});assert.equal(s.publishedStudent.elements[0].text,e.text);
 assert.throws(()=>changeBoard(s,'teacher',{rev:s.rev-1,op:'publish'}),x=>x.status===409);
 s=command('teacher','permission',{allow:false});assert.throws(()=>command('student','draft',{elements:[],files:{}}),x=>x.status===403);
 s=command('teacher','hide');assert.equal(s.publishedStudent,null);assert.equal(s.studentDraft.elements[0].text,'New private version');
 assert.throws(()=>command('outsider','scene',{elements:[],files:{}}),x=>x.status===403);
});
