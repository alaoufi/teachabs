import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {selectionState,selectedElements,transformSelection} from '../board-ui/selection.js';
import {createPreparation,canPublishPreparation,outgoingScene} from '../board-ui/preparation.js';
import {protractorElements,protractorReading,setProtractorAngle} from '../board-ui/protractor.js';
import {changeBoard,emptyBoard} from '../board.mjs';
const items=()=>protractorElements(40,50,'protractor-test').map((e,i)=>({...e,id:e.id||'item'+i,width:e.width??40,height:e.height??20,angle:e.angle||0,version:1,isDeleted:false}));
test('protractor arc and tick bounds match points, including repeated resize',()=>{
 let elements=items();const selected=selectionState(elements);assert.equal(Object.keys(selected.selectedGroupIds).length,1);
 for(const factor of [0.5,0.8,1.15,1/1.15,2.5]){
  elements=transformSelection(elements,selected.selectedElementIds,{scale:factor});
  for(const e of elements.filter(e=>e.type==='line')){assert.ok(Math.abs(e.width-(Math.max(...e.points.map(p=>p[0]))-Math.min(...e.points.map(p=>p[0]))))<1e-8);assert.ok(Math.abs(e.height-(Math.max(...e.points.map(p=>p[1]))-Math.min(...e.points.map(p=>p[1]))))<1e-8);assert.ok(e.width>0||e.height>0);}
  assert.equal(protractorReading(elements).degrees,90);
 }
 elements=setProtractorAngle(elements,45);assert.equal(protractorReading(elements).degrees,45);
 const base=elements.find(e=>e.id==='base-protractor-test'),ray=elements.find(e=>e.id==='ray-protractor-test');const origin=e=>[e.x+e.width/2-Math.cos(e.angle)*e.width/2,e.y+e.height/2-Math.sin(e.angle)*e.width/2];assert.ok(origin(base).every((v,i)=>Math.abs(v-origin(ray)[i])<1e-8));
});
test('selection controls move, resize and delete grouped tools without touching unrelated or locked objects',()=>{
 const source=items(),other={id:'other',type:'rectangle',x:900,y:800,width:50,height:60,version:1},locked={...other,id:'locked',locked:true};const selection={[source[0].id]:true,locked:true};
 assert.equal(selectedElements([...source,other,locked],selection).length,source.length);
 const moved=transformSelection([...source,other,locked],selection,{dx:15,dy:-10});assert.equal(moved[0].x,source[0].x+15);assert.equal(moved[0].y,source[0].y-10);assert.equal(moved.at(-1),locked);assert.equal(moved.at(-2),other);
 const resized=transformSelection(moved,selection,{scale:1.15});assert.ok(Math.abs(resized[0].width-460)<1e-8);assert.equal(resized[0].angle,source[0].angle);assert.equal(resized.at(-1),locked);
 const deleted=transformSelection(resized,selection,{remove:true});assert.ok(deleted.slice(0,source.length).every(e=>e.isDeleted));assert.ok(!deleted.at(-2).isDeleted);
});
test('private teacher preparation emits no outgoing scene until confirmed and protects concurrent changes',()=>{
 const original={activeLesson:'math-g4-angles',rev:4,elements:[],files:{}};const preparation=createPreparation(original,{elements:[],files:{}});const elements=items();
 assert.equal(outgoingScene({preparation,elements,files:{},lessonId:original.activeLesson,view:'shared'}),null);
 assert.equal(preparation.snapshot.elements,elements);assert.deepEqual(original.elements,[]);assert.ok(canPublishPreparation(preparation,original));
 assert.ok(canPublishPreparation(preparation,{...original,rev:5,studentDraw:true,classTimer:{running:true}}));
 assert.equal(canPublishPreparation(preparation,{...original,activeLesson:'math-g4-length'}),false);
 assert.equal(canPublishPreparation(preparation,{...original,elements:[{id:'new'}]}),false);
 const outgoing=outgoingScene({preparation:null,...preparation.snapshot,lessonId:original.activeLesson,view:'shared'});assert.equal(outgoing.op,'scene');assert.equal(outgoing.elements.length,elements.length);
});
test('explicit publication uses unchanged teacher/student server permission gates',()=>{
 const context={subject:'math',grade:4};let state=changeBoard(emptyBoard(),'teacher',{op:'lesson',lessonId:'math-g4-angles',rev:0},context);const before=state.elements.length;const prep=createPreparation(state,{elements:items(),files:{}});
 assert.equal(state.elements.length,before);assert.equal(outgoingScene({preparation:prep,...prep.snapshot,lessonId:state.activeLesson,view:'shared'}),null);
 const payload={...outgoingScene({preparation:null,...prep.snapshot,lessonId:state.activeLesson,view:'shared'}),rev:state.rev};assert.throws(()=>changeBoard(state,'student',payload,context),e=>e.status===403);
 state=changeBoard(state,'teacher',payload,context);assert.equal(state.elements.length,prep.snapshot.elements.length);
 assert.throws(()=>changeBoard(state,'student',{...payload,op:'draft',rev:state.rev},context),e=>e.status===403);
 state=changeBoard(state,'teacher',{op:'permission',rev:state.rev,allow:true},context);const draft=changeBoard(state,'student',{...payload,op:'draft',rev:state.rev},context);assert.equal(draft.studentDraft.elements.length,prep.snapshot.elements.length);
});
test('canvas precedes all local controls and expanded workspace can be dismissed',async()=>{
 const source=await readFile(new URL('../board-ui/index.jsx',import.meta.url),'utf8'),css=await readFile(new URL('../board-ui/board.css',import.meta.url),'utf8');
 assert.ok(source.indexOf('id="board-canvas"')<source.indexOf('className="board-tools"'));assert.ok(source.indexOf('id="board-canvas"')<source.indexOf('<ClassTimer'));
 for(const name of ['وسائل الدرس','المشاركة والصلاحيات','الحفظ والاستعادة','مؤقت الحصة'])assert.ok(source.includes('<summary>'+name+'</summary>'));
 assert.match(source,/e.key==='Escape'/);assert.match(css,/\.board-expanded\{position:fixed/);assert.match(css,/box-shadow:/);assert.match(source,/تأكيد المكان وإرسال للطالب/);
});
