import test from 'node:test';import assert from 'node:assert/strict';import {rulerElements} from '../board-ui/ruler.js';import {changeBoard,emptyBoard} from '../board.mjs';import {allowedLessons} from '../lesson-catalog.mjs';
test('original grouped ruler stays in the synthetic measurement lesson and preserves transforms',()=>{
 const raw=rulerElements(40,50,'ruler-group');assert.equal(raw.length,24);assert.ok(raw.every(e=>e.groupIds[0]==='ruler-group'));assert.equal(raw.filter(e=>e.type==='line').length,11);
 assert.equal(allowedLessons({subject:'science',grade:4}).some(l=>l.aidIds.includes('ruler')),false);assert.equal(allowedLessons({subject:'math',grade:1}).some(l=>l.aidIds.includes('ruler')),false);
 const context={subject:'math',grade:4};let s=changeBoard(emptyBoard(),'teacher',{op:'lesson',lessonId:'math-g4-length',rev:0},context);
 const elements=raw.map((e,i)=>({...e,id:'ruler'+i,width:e.width||20,height:e.height||20,angle:Math.PI/4,x:e.x+20,y:e.y+10}));s=changeBoard(s,'teacher',{op:'scene',rev:s.rev,lessonId:s.activeLesson,elements,files:{}},context);assert.ok(s.elements.every(e=>e.angle===Math.PI/4));
 s=changeBoard(s,'teacher',{op:'lesson',rev:s.rev,lessonId:'math-g4-fractions'},context);assert.equal(s.elements.length,0);s=changeBoard(s,'teacher',{op:'lesson',rev:s.rev,lessonId:'math-g4-length'},context);assert.equal(s.elements.length,24);assert.throws(()=>changeBoard(s,'student',{op:'draft',rev:s.rev,lessonId:s.activeLesson,elements,files:{}},context),e=>e.status===403);
 s=changeBoard(s,'teacher',{op:'permission',rev:s.rev,allow:true},context);s=changeBoard(s,'student',{op:'draft',rev:s.rev,lessonId:s.activeLesson,elements,files:{}},context);assert.equal(s.studentDraft.elements.length,24);
});
import {transformRuler} from '../board-ui/ruler.js';
test('ruler touch transforms preserve center and unrelated elements',()=>{
 const raw=rulerElements(0,0,'ruler-one').map((e,i)=>({...e,id:'r'+i,width:e.width||20,height:e.height||20,angle:0}));const other={id:'other',x:900,y:900,width:10,height:10,angle:0};let transformed=transformRuler([...raw,other],{dx:20});assert.equal(transformed[0].x,20);transformed=transformRuler(transformed,{rotate:Math.PI/12});assert.equal(transformed[0].x,20);assert.ok(transformed.slice(0,-1).every(e=>Math.abs(e.angle-Math.PI/12)<0.001));assert.equal(transformed.at(-1),other);
});
