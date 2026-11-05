import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server.mjs';
import { openStore } from '../store.mjs';
import { advancePlace } from '../place-value.mjs';

test('تبديل عشر وحدات يحفظ قيمة العدد ويحترم الدور وشكل الحل المسلّم',()=>{
  let state;
  const play=(seat,op,fields={})=>{state=advancePlace(state,seat,{op,rev:state?.rev??0,...fields});};
  const move=(seat,unit)=>play(seat,'move',{unit,delta:1});
  move('teacher','tens');
  play('teacher','split');
  assert.deepEqual([state.tens,state.ones],[0,10]);
  assert.throws(()=>play('student','bundle'));
  play('teacher','bundle');
  assert.deepEqual([state.tens,state.ones],[1,0]);
  assert.throws(()=>play('teacher','bundle'));
  play('teacher','turn',{value:10});
  assert.throws(()=>play('student','split'));
  for(let i=0;i<10;i++)move('student','ones');
  assert.throws(()=>play('teacher','bundle'));
  assert.throws(()=>play('student','submit'));
  play('student','bundle');
  play('student','submit');
  assert.deepEqual(state.answer,{tens:1,ones:0});
  assert.throws(()=>play('student','split'));
});

test('القطع تمثل حتى ٩٩ حتى عند فك العشرات',()=>{
  let state;
  for(const unit of ['tens','ones']){
    for(let i=0;i<9;i++)state=advancePlace(state,'teacher',{op:'move',unit,delta:1,rev:state?.rev??0});
  }
  state=advancePlace(state,'teacher',{op:'split',rev:state.rev});
  assert.deepEqual([state.tens,state.ones],[8,19]);
  for(const unit of ['tens','ones'])assert.throws(()=>advancePlace(state,'teacher',{op:'move',unit,delta:1,rev:state.rev}));
});

test('العدد صفر وعدد العشرات الأقصى ومحاولة التصحيح والتقييم المتأخر',()=>{
  let s=advancePlace(null,'teacher',{op:'target',value:0,rev:0});
  s=advancePlace(s,'teacher',{op:'turn',rev:s.rev});
  s=advancePlace(s,'student',{op:'submit',rev:s.rev});
  assert.deepEqual(s.answer,{tens:0,ones:0});
  s=advancePlace(s,'teacher',{op:'retry',rev:s.rev});
  for(let i=0;i<9;i++)s=advancePlace(s,'student',{op:'move',unit:'tens',delta:1,rev:s.rev});
  assert.throws(()=>advancePlace(s,'student',{op:'move',unit:'tens',delta:1,rev:s.rev}));
  assert.throws(()=>advancePlace(s,'student',{op:'move',unit:'ones',delta:-1,rev:s.rev}));
  const grade={op:'grade',rev:s.rev,rating:'independent',note:''};
  assert.throws(()=>advancePlace(s,'teacher',grade));
  s=advancePlace(s,'teacher',grade,true);
  assert.deepEqual(s.answer,{tens:0,ones:0});
  assert.throws(()=>advancePlace(s,'teacher',{...grade,rev:s.rev},true));
});

test('محاولة رياضيات متزامنة، وتقرير مؤجل ومقيد بالأسرة ومحفوظ بعد إعادة الفتح',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'khatwa-place-'));
  const file=join(dir,'school.sqlite'), s=openStore(file);
  const app=createApp(s);
  await new Promise(r=>app.listen(0,'127.0.0.1',r));
  const origin='http://127.0.0.1:'+app.address().port;
  const abort=new AbortController();
  let dbOpen=true;
  t.after(async()=>{abort.abort();app.closeAllConnections();await new Promise(r=>app.close(r));if(dbOpen)s.close();rmSync(dir,{recursive:true,force:true});});
  const tour=s.tour(),others=s.tour();
  const parent='ks='+s.session(tour.parent), teacher='ks='+s.session(tour.teacher), stranger='ks='+s.session(others.parent);
  const start=Date.now()+60000;
  const slot=s.slot(tour.teacher,{subject:'math',minutes:45,start,instructions:''});
  const booking=s.book(tour.parent,tour.child,slot,'math-attempt');
  const room='/lesson/'+booking, tc=randomUUID(), sc=randomUUID();
  const get=(url,cookie)=>fetch(origin+url,{headers:{cookie},signal:abort.signal,redirect:'manual'});
  const action=(cookie,client,change)=>fetch(origin+room+'/send',{method:'POST',headers:{cookie,origin},body:new URLSearchParams({client,kind:'place',payload:JSON.stringify(change)})});
  const path='/progress?child='+tour.child;
  assert.equal((await get(path,stranger)).status,404);
  assert.equal((await get(path,teacher)).status,403);
  assert.equal((await get(path,parent)).status,200);
  assert.match(await (await get(room,teacher)).text(),/الآحاد والعشرات/);
  const scienceSlot=s.slot(others.teacher,{subject:'science',minutes:45,start,instructions:''});
  const science=s.book(others.parent,others.child,scienceSlot,'science-without-math');
  const scienceTeacher='ks='+s.session(others.teacher);
  assert.doesNotMatch(await (await get('/lesson/'+science,scienceTeacher)).text(),/id="place-activity"/);
  await get('/lesson/'+science+'/events?client='+tc,scienceTeacher);
  const blocked=await fetch(origin+'/lesson/'+science+'/send',{method:'POST',headers:{cookie:scienceTeacher,origin},
    body:new URLSearchParams({client:tc,kind:'place',payload:JSON.stringify({op:'turn',rev:0})})});
  assert.equal(blocked.status,403);
  const streams=[];
  for(const [key,c] of [[teacher,tc],[parent,sc]]){
    const events=await get(room+'/events?client='+c,key);
    assert.equal(events.status,200);
    streams.push(events.body.getReader());
  }
  t.after(()=>Promise.allSettled(streams.map(reader=>reader.cancel())));
  assert.equal((await action(parent,sc,{op:'turn',rev:0})).status,403);
  assert.equal((await action(teacher,tc,{op:'target',rev:0,value:100})).status,400);
  assert.equal((await action(teacher,tc,{op:'turn',rev:0})).status,200);
  assert.equal((await action(teacher,tc,{op:'move',rev:1,unit:'tens',delta:1})).status,403);
  assert.equal((await action(parent,sc,{op:'move',rev:1,unit:'tens',delta:1})).status,200);
  assert.equal((await action(parent,sc,{op:'move',rev:1,unit:'tens',delta:1})).status,409);
  assert.equal((await action(parent,sc,{op:'submit',rev:2})).status,200);
  assert.equal((await action(parent,sc,{op:'grade',rev:3,rating:'help',note:'غير مسموح'})).status,403);
  assert.equal((await action(teacher,tc,{op:'grade',rev:3,rating:'help',note:'راجع ترتيب المنازل'})).status,200);
  assert.doesNotMatch(await (await get(path,parent)).text(),/راجع ترتيب المنازل/);
  assert.doesNotMatch(await (await get('/booking/'+booking,parent)).text(),/راجع ترتيب المنازل/);
  const nextStart=start+60*60000;
  const nextSlot=s.slot(tour.teacher,{subject:'math',minutes:45,start:nextStart,instructions:''});
  const next=s.book(tour.parent,tour.child,nextSlot,'late-review');
  for(const [who,op] of [['teacher','turn'],['student','submit']]){
    s.changePlace(next,current=>advancePlace(current,who,{op,rev:current?.rev??0}));
  }
  const gradeLate=cookie=>fetch(origin+'/booking/'+next+'/grade',{method:'POST',redirect:'manual',headers:{cookie,origin},body:new URLSearchParams({rev:'2',rating:'practice',note:'متابعة لاحقة'})});
  assert.equal((await gradeLate(teacher)).status,403);
  const original=Date.now;
  try{
    Date.now=()=>start+45*60000;
    const body=await (await get(path,parent)).text();
    assert.match(body,/راجع ترتيب المنازل/);assert.match(body,/احتاج مساعدة/);assert.match(body,/تحتاج تصحيحًا/);
    assert.match(await (await get('/booking/'+booking,parent)).text(),/راجع ترتيب المنازل/);
    Date.now=()=>nextStart+45*60000;
    assert.match(await (await get('/booking/'+next,parent)).text(),/بانتظار تقييم المعلم/);
    assert.equal((await gradeLate(parent)).status,403);
    assert.equal((await gradeLate('ks='+s.session(others.teacher))).status,404);
    assert.equal((await gradeLate(teacher)).status,303);
    assert.match(await (await get(path,parent)).text(),/متابعة لاحقة/);
  }finally{Date.now=original;}
  abort.abort();
  s.close();dbOpen=false;
  const restored=openStore(file);
  try {assert.equal(restored.placeActivity(booking).note,'راجع ترتيب المنازل');} finally{restored.close();}
});
