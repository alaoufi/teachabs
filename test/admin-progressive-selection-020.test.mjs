import test from 'node:test';
import assert from 'node:assert/strict';
import {schoolSelection} from '../admin-school-selection.mjs';
import {UserError} from '../store.mjs';

function snapshot(){return {
 tracks:[{id:'legacy',scope:'school-a',legacy:1},{id:'custom',scope:'school-a',legacy:0}],
 grades:[
  {id:'p4',scope:'school-a',track_id:'legacy',stage:'primary',grade:4},
  {id:'p5',scope:'school-a',track_id:'legacy',stage:'primary',grade:5},
  {id:'m2',scope:'school-a',track_id:'legacy',stage:'middle',grade:2},
  {id:'custom-p4',scope:'school-a',track_id:'custom',stage:'primary',grade:4},
 ],
 classes:[
  {id:'active',grade_id:'p4',track_id:'legacy',stage:'primary',grade:4,state:'active'},
  {id:'archived',grade_id:'p4',track_id:'legacy',stage:'primary',grade:4,state:'archived'},
  {id:'next-grade',grade_id:'p5',track_id:'legacy',stage:'primary',grade:5,state:'active'},
  {id:'middle-class',grade_id:'m2',track_id:'legacy',stage:'middle',grade:2,state:'active'},
  {id:'other-track',grade_id:'custom-p4',track_id:'custom',stage:'primary',grade:4,state:'active'},
 ],
};}
const empty={trackId:'',stage:'',grade:null,classId:''};
const full={trackId:'legacy',stage:'primary',grade:'4',classId:'active'};
function fails(s,query,status){assert.throws(()=>schoolSelection(s,query),error=>error instanceof UserError&&error.status===status,JSON.stringify(query));}
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

test('progressive navigation does not select the first or only available option',()=>{
 const populated=snapshot();
 for(const s of [populated,{tracks:[],grades:[],classes:[]},{tracks:[populated.tracks[0]],grades:[populated.grades[0]],classes:[populated.classes[0]]}]){
  assert.deepEqual(schoolSelection(s),empty);
  assert.deepEqual(schoolSelection(s,{}),empty);
  assert.deepEqual(schoolSelection(s,{trackId:'',stage:'',grade:'',classId:''}),empty);
 }
});

test('explicit choices reveal one next step without inventing descendants or school rows',()=>{
 const s=snapshot();
 const cases=[
  [{trackId:'legacy'},{trackId:'legacy',stage:'',grade:null,classId:''}],
  [{trackId:'legacy',stage:'primary'},{trackId:'legacy',stage:'primary',grade:null,classId:''}],
  [{trackId:'legacy',stage:'primary',grade:'4'},{trackId:'legacy',stage:'primary',grade:4,classId:''}],
  [{trackId:'legacy',stage:'primary',grade:4,classId:'active'},{trackId:'legacy',stage:'primary',grade:4,classId:'active'}],
  [{trackId:'custom',stage:'secondary',grade:'3'},{trackId:'custom',stage:'secondary',grade:3,classId:''}],
 ];
 const before=structuredClone(s);freeze(s);
 for(const [query,want] of cases){freeze(query);assert.deepEqual(schoolSelection(s,query),want);}
 assert.deepEqual(s,before);
});

test('back navigation can clear one or more descendants and legacy complete links stop at class choice',()=>{
 const s=snapshot();
 for(const [query,want] of [
  [{...full,classId:''},{trackId:'legacy',stage:'primary',grade:4,classId:''}],
  [{trackId:'legacy',stage:'primary',grade:'',classId:''},{trackId:'legacy',stage:'primary',grade:null,classId:''}],
  [{trackId:'legacy',stage:'',grade:'',classId:''},{trackId:'legacy',stage:'',grade:null,classId:''}],
  [{trackId:'',stage:'',grade:'',classId:''},empty],
 ])assert.deepEqual(schoolSelection(s,query),want);
});

test('normalized selections are idempotent, including the null unselected grade sentinel',()=>{
 const s=snapshot();
 for(const query of [
  {},{trackId:'legacy'},{trackId:'legacy',stage:'primary'},
  {trackId:'legacy',stage:'primary',grade:'4'},full,
 ]){
  const selected=schoolSelection(s,query);freeze(selected);
  assert.deepEqual(schoolSelection(s,selected),selected);
 }
 assert.deepEqual(schoolSelection(s,{grade:null}),empty);
 assert.deepEqual(schoolSelection(s,{trackId:'legacy',stage:'primary',grade:null}),{trackId:'legacy',stage:'primary',grade:null,classId:''});
 fails(s,{...full,grade:null},400);
});

test('nonempty descendants without all explicitly selected ancestors are bad requests',()=>{
 const s=snapshot();
 for(const query of [
  {stage:'primary'},{grade:'4'},{classId:'active'},
  {trackId:'',stage:'primary'},{trackId:'',stage:'primary',grade:'4'},
  {trackId:'legacy',grade:'4'},{trackId:'legacy',stage:'',grade:'4'},
  {trackId:'legacy',classId:'active'},{trackId:'legacy',stage:'primary',classId:'active'},
  {...full,grade:''},{...full,stage:''},{...full,trackId:''},
 ])fails(s,query,400);
});

test('non-string path, stage or class values cannot be coerced into selections',()=>{
 const s=snapshot();
 for(const key of ['trackId','stage','classId'])for(const value of [null,false,true,0,1,[],['legacy'],{},new String('legacy')])fails(s,{...full,[key]:value},400);
});

test('only canonical decimal grade strings and valid numeric ordinals are accepted',()=>{
 const s=snapshot();
 for(const [stage,max] of [['primary',6],['middle',3],['secondary',3]]){
  for(let grade=1;grade<=max;grade++)for(const value of [grade,String(grade)])assert.deepEqual(schoolSelection(s,{trackId:'legacy',stage,grade:value}),{trackId:'legacy',stage,grade,classId:''});
  fails(s,{trackId:'legacy',stage,grade:max+1},400);
 }
 for(const grade of ['0','7','04','+4','-4','4.0','4.00','4e0','4E0','0x4','0b100','0o4',' 4','4 ','\t4','4\n','٤','NaN','Infinity',0,7,-1,4.5,NaN,Infinity,-Infinity,false,true,[],[4],{},new Number(4)])fails(s,{trackId:'legacy',stage:'primary',grade},400);
});

test('unknown stages are invalid and unknown or out-of-scope tracks are not found',()=>{
 const s=snapshot();
 for(const stage of ['university','PRIMARY',' primary','constructor','toString','__proto__'])fails(s,{trackId:'legacy',stage},400);
 for(const trackId of ['missing','foreign-track',' legacy','legacy '])fails(s,{trackId},404);
});

test('a selected class must be in the selected track, stage and grade',()=>{
 const s=snapshot();
 assert.deepEqual(schoolSelection(s,full),{trackId:'legacy',stage:'primary',grade:4,classId:'active'});
 for(const classId of ['missing','foreign-class','next-grade','middle-class','other-track'])fails(s,{...full,classId},404);
 for(const patch of [{trackId:'custom'},{stage:'secondary',grade:'3'},{grade:'5'}])fails(s,{...full,...patch},404);
});

test('class selection requires the same stored grade row and all denormalized path fields',()=>{
 for(const patch of [{grade_id:'missing-grade'},{grade_id:'p5'},{grade_id:'custom-p4'},{track_id:'custom'},{stage:'secondary'},{grade:5}]){
  const s=snapshot();Object.assign(s.classes[0],patch);fails(s,full,404);
 }
 const missing=snapshot();missing.grades=missing.grades.filter(g=>g.id!=='p4');fails(missing,full,404);
});

test('archived classes remain explicitly selectable for restoration without changing their state',()=>{
 const s=freeze(snapshot()),before=structuredClone(s);
 assert.deepEqual(schoolSelection(s,{...full,classId:'archived'}),{trackId:'legacy',stage:'primary',grade:4,classId:'archived'});
 assert.deepEqual(s,before);
});
