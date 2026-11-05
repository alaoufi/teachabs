import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../store.mjs';

function setup(t) {
  const s = openStore(':memory:');
  t.after(() => s.close());
  const family = s.parent('ولي الأمر','parent@example.test','testing12345');
  const other = s.parent('أسرة أخرى','other@example.test','testing12345');
  const invite = s.invite({name:'المعلمة سارة',email:'teacher@example.test',subjects:['math'],grades:[1,2,3,4,5,6],language:'ar'});
  const teacher = s.activate(invite,'testing12345');
  const child = s.child(family,{name:'نورة',grade:4,curriculum:'sa',language:'ar'});
  const start = Math.ceil(Date.now()/60000)*60000 + 86400000;
  const slot = s.slot(teacher,{subject:'math',minutes:45,start,instructions:'الدخول من غرفة الدرس المتفق عليها'});
  return {s,family,other,teacher,child,start,slot,invite};
}
test('ولي الأمر والمعلم يريان المرجع نفسه، وإعادة التأكيد آمنة',t=>{
  const {s,family,teacher,child,slot}=setup(t);
  const id=s.book(family,child,slot,'request-key-one');
  assert.equal(s.book(family,child,slot,'request-key-one'),id);
  assert.equal(s.bookings(family)[0].id,id);
  assert.equal(s.bookings(teacher)[0].id,id);
  assert.equal(s.bookings(teacher)[0].instructions,'الدخول من غرفة الدرس المتفق عليها');
  assert.equal(s.offers(family,child,'math').length,0);
});
test('الحسابات معزولة ولا يمكن حجز موعد مرتين أو الدعوة مرتين',t=>{
  const {s,family,other,child,slot,invite}=setup(t);
  assert.throws(()=>s.book(other,child,slot,'request-key-two'));
  const sibling=s.child(other,{name:'علي',grade:4,curriculum:'sa',language:'ar'});
  s.book(family,child,slot,'request-key-one');
  assert.throws(()=>s.book(other,sibling,slot,'request-key-two'));
  assert.throws(()=>s.activate(invite,'testing12345'));
  assert.deepEqual(s.bookings(other),[]);
});
test('الصف واللغة والتغطية تحدد المواعيد ومدة الحصة',t=>{
  const {s,family,teacher,child,slot,start}=setup(t);
  assert.equal(s.offers(family,child,'math').length,1);
  for(const [grade,language] of [[2,'ar'],[4,'en']]){
    const id=s.child(family,{name:'طفل',grade,curriculum:'sa',language});
    assert.equal(s.offers(family,id,'math').length,0);
    assert.throws(()=>s.book(family,id,slot,'rejected-key'));
  }
  assert.throws(()=>s.slot(teacher,{subject:'science',minutes:45,start:start+7200000,instructions:'في الغرفة'}));
  assert.throws(()=>s.slot(teacher,{subject:'math',minutes:45,start:start+60000,instructions:'في الغرفة'}));
});
test('تداخل وقت الطفل مع معلم آخر ممنوع ولو اختلف وقت البداية',t=>{
  const {s,family,child,slot,start}=setup(t);
  const teacher2=s.activate(s.invite({name:'معلم آخر',email:'second@example.test',subjects:['math'],grades:[4],language:'ar'}),'testing12345');
  const second=s.slot(teacher2,{subject:'math',minutes:45,start:start+900000,instructions:'موعد ثان'});
  s.book(family,child,slot,'request-key-one');
  assert.throws(()=>s.book(family,child,second,'request-key-two'));
  assert.equal(s.offers(family,child,'math').length,0);
});
test('إلغاء الأسرة يعيد الموعد وإلغاء المعلم يسحبه',t=>{
  const {s,family,other,teacher,child,slot}=setup(t);
  const id=s.book(family,child,slot,'request-key-one');
  assert.throws(()=>s.cancel(other,id));
  s.cancel(family,id);
  assert.equal(s.offers(family,child,'math').length,1);
  const next=s.book(family,child,slot,'request-key-new');
  s.cancel(teacher,next);
  assert.equal(s.offers(family,child,'math').length,0);
  assert.equal(s.bookings(family).filter(x=>x.status==='confirmed').length,0);
});
test('الجولة التوضيحية مستقلة عن الأسر الحقيقية والجولات الأخرى',t=>{
  const {s,family,child}=setup(t);
  const a=s.tour(), b=s.tour();
  const offer=s.offers(a.parent,a.child,'math')[0];
  assert.ok(offer);
  assert.throws(()=>s.book(family,child,offer.id,'real-to-demo'));
  assert.throws(()=>s.book(b.parent,b.child,offer.id,'demo-to-demo'));
  assert.equal(s.bookings(a.teacher).length,0);
});

test('تجديد دعوة معلقة يبطل رابطها السابق ولا يغير حسابًا مفعّلًا',t=>{
  const s=openStore(':memory:');t.after(()=>s.close());
  const info={name:'معلمة',email:'pending@example.test',subjects:['math'],grades:[2],language:'ar'};
  const first=s.invite(info), renewed=s.invite(info);
  assert.throws(()=>s.activate(first,'testing-password'));
  const id=s.activate(renewed,'testing-password');
  assert.equal(s.login(info.email,'testing-password'),id);
  assert.throws(()=>s.invite(info));
});

test('الحجز والجلسة محفوظان بعد إغلاق قاعدة البيانات وإعادة فتحها',()=>{
  const directory=mkdtempSync(join(tmpdir(),'khatwa-test-'));
  const file=join(directory,'test.sqlite');
  let s=openStore(file);
  try {
    const tour=s.tour(), slot=s.offers(tour.parent,tour.child,'math')[0].id;
    const booking=s.book(tour.parent,tour.child,slot,'restart-test');
    const session=s.session(tour.parent);
    s.close(); s=openStore(file);
    assert.equal(s.resolve(session),tour.parent);
    assert.equal(s.bookings(tour.teacher)[0].id,booking);
    assert.equal(s.bookings(tour.parent)[0].id,booking);
  } finally { s.close(); rmSync(directory,{recursive:true,force:true}); }
});
