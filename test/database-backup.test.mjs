import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,readFile,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {openStore} from '../store.mjs';import {changeBoard} from '../board.mjs';import {snapshotDatabase,restoreDatabase} from '../database-backup.mjs';
test('WAL snapshot restores isolated boards/templates and refuses overwrite or tampering',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'storage-synthetic-')),source=join(dir,'source.sqlite'),s=openStore(source),g=s.tour(),other=s.tour();let second,restored;
 try{
  const slot=s.slot(g.teacher,{subject:'math',minutes:45,start:Date.now()+60000,instructions:'Synthetic'}),booking=s.book(g.parent,g.child,slot,'backup');
  const template=s.savedLessons.createTemplate(g.teacher,{subject:'math',grade:4,title:'Synthetic',pages:[{elements:[],files:{}}]});
  s.changeSavedBoard(booking,current=>changeBoard(current,'teacher',{op:'permission',rev:0,allow:true}));
  second=openStore(source);assert.throws(()=>second.changeSavedBoard(booking,current=>changeBoard(current,'teacher',{op:'permission',rev:0,allow:false})),e=>e.status===409);
  assert.equal(second.readBoard(booking).studentDraw,true);
  const [a,b]=await Promise.all([snapshotDatabase(source,join(dir,'backups')),snapshotDatabase(source,join(dir,'backups'))]);assert.notEqual(a.number,b.number);
  s.changeSavedBoard(booking,current=>changeBoard(current,'teacher',{op:'permission',rev:1,allow:false}));
  const target=join(dir,'restored.sqlite');assert.deepEqual(await restoreDatabase(a.directory,target),{verified:true});await assert.rejects(()=>restoreDatabase(a.directory,target),/exists/);
  restored=openStore(target);assert.equal(restored.readBoard(booking).studentDraw,true);assert.equal(restored.savedLessons.readTemplate(g.teacher,template).pages.length,1);assert.throws(()=>restored.savedLessons.readTemplate(other.teacher,template),e=>e.status===404);
  assert.equal(s.readBoard(booking).studentDraw,false);
  const manifest=join(b.directory,'manifest.json'),data=JSON.parse(await readFile(manifest,'utf8'));data.sha256='0'.repeat(64);await writeFile(manifest,JSON.stringify(data));await assert.rejects(()=>restoreDatabase(b.directory,join(dir,'bad.sqlite')),/verification failed/);
 }finally{restored?.close();second?.close();s.close();}
});
