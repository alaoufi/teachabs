import test from 'node:test';import assert from 'node:assert/strict';
import {allowedLessons} from '../lesson-catalog.mjs';
import {changeBoard,emptyBoard} from '../board.mjs';
test('original book is preview-only; teacher navigation preserves separate page annotations',()=>{
 const context={preview:true};let s=emptyBoard();
 const select=(role,id)=>changeBoard(s,role,{op:'lesson',rev:s.rev,lessonId:id},context);
 assert.equal(allowedLessons({subject:'math',grade:1}).some(l=>l.bookPage),false);
 assert.throws(()=>changeBoard(s,'teacher',{op:'lesson',rev:0,lessonId:'original-book-p1'},{subject:'math',grade:1}),e=>e.status===403);
 assert.throws(()=>select('student','original-book-p1'),e=>e.status===403);
 s=select('teacher','original-book-p1');
 const element={id:'original-note',type:'text',text:'شرح مستقل',x:0,y:0,width:100,height:30,angle:0};
 s=changeBoard(s,'teacher',{op:'scene',rev:s.rev,lessonId:s.activeLesson,elements:[element],files:{}},context);
 s=select('teacher','original-book-p2');assert.equal(s.elements.length,0);
 assert.throws(()=>changeBoard(s,'teacher',{op:'scene',rev:s.rev,lessonId:'original-book-p1',elements:[],files:{}},context),e=>e.status===409);
 s=select('teacher','original-book-p1');assert.equal(s.elements[0].text,element.text);
});
