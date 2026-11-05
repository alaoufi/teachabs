import test from 'node:test';import assert from 'node:assert/strict';import {openStore} from '../store.mjs';import {mkdtempSync,rmSync} from 'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';
test('saved templates are teacher-owned, instances restart at page one and survive reopen',()=>{
 const dir=mkdtempSync(join(tmpdir(),'saved-lessons-')),file=join(dir,'synthetic.sqlite');let s=openStore(file);
 try{const group=s.tour(),other=s.tour(),lib=s.savedLessons;const e={id:'text1',type:'text',text:'Teacher explanation',x:0,y:0,width:100,height:30,angle:0};
 const template=lib.createTemplate(group.teacher,{subject:'math',grade:4,title:'Synthetic fractions',pages:[{elements:[e],files:{},studentDraft:{text:'PRIVATE'}},{elements:[],files:{}}]});
 const restored=lib.importTemplate(group.teacher,JSON.parse(JSON.stringify(lib.exportTemplate(group.teacher,template))));assert.deepEqual(lib.readTemplate(group.teacher,restored),lib.readTemplate(group.teacher,template));
 assert.equal(JSON.stringify(lib.readTemplate(group.teacher,template)).includes('PRIVATE'),false);
 assert.throws(()=>lib.readTemplate(other.teacher,template),x=>x.status===404);assert.throws(()=>lib.readTemplate(group.parent,template),x=>x.status===403);
 const slot=s.slot(group.teacher,{subject:'math',minutes:45,start:Date.now()+60000,instructions:'Synthetic'}),booking=s.book(group.parent,group.child,slot,'saved-test');
 const a=lib.instantiate(group.teacher,template,booking),b=lib.instantiate(group.teacher,template,booking);assert.equal(a.pageIndex,0);assert.equal(b.pageIndex,0);
 lib.navigate(group.teacher,a.id,0,1);assert.equal(lib.readInstance(group.teacher,b.id).pageIndex,0);assert.throws(()=>lib.navigate(group.teacher,a.id,0,0),x=>x.status===409);assert.throws(()=>lib.navigate(group.teacher,a.id,1,2));assert.throws(()=>lib.studentReplay(group.parent,a.id),x=>x.status===403);
 s.close();s=openStore(file);assert.equal(s.savedLessons.readInstance(group.teacher,a.id).pageIndex,1);assert.equal(s.savedLessons.readTemplate(group.teacher,template).pages.length,2);
 }finally{s.close();rmSync(dir,{recursive:true,force:true});}
});
