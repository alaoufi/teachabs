import test from 'node:test';import assert from 'node:assert/strict';import {changeBoard,emptyBoard} from '../board.mjs';
const context={subject:'science',grade:4};
test('lesson permission, subject and grade isolation and restoration',()=>{
 let s=emptyBoard();const select=(seat,id)=>changeBoard(s,seat,{op:'lesson',lessonId:id,rev:s.rev},context);
 assert.throws(()=>select('student','science-g4-water'),e=>e.status===403);
 assert.throws(()=>select('teacher','math-g4-fractions'),e=>e.status===403);
 assert.throws(()=>changeBoard(s,'teacher',{op:'lesson',lessonId:'science-g4-water',rev:0},{subject:'science',grade:3}),e=>e.status===403);
 s=select('teacher','science-g4-water');
 const element={id:'text1',type:'text',text:'Synthetic water note',x:0,y:0,width:100,height:30,angle:0};
 s=changeBoard(s,'teacher',{op:'scene',rev:s.rev,lessonId:s.activeLesson,elements:[element],files:{}},context);
 s=select('teacher','science-g4-observation');assert.equal(s.elements.length,0);assert.equal(s.studentDraw,false);
 assert.throws(()=>changeBoard(s,'teacher',{op:'scene',rev:s.rev,lessonId:'science-g4-water',elements:[element],files:{}},context),e=>e.status===409);
 s=select('teacher','science-g4-water');assert.equal(s.elements[0].text,element.text);
});
