import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openStore} from '../store.mjs';
import {createApp} from '../server.mjs';

async function setup(t) {
  const store=openStore(':memory:'),app=createApp(store);
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));store.close();});
  const base='http://127.0.0.1:'+app.address().port;
  const get=(path,cookie='')=>fetch(base+path,{headers:{cookie},redirect:'manual'});
  const post=(path,data={},cookie='',origin=base)=>fetch(base+path,{method:'POST',headers:{cookie,origin},body:new URLSearchParams(data),redirect:'manual'});
  return {store,base,get,post,cookie:id=>'ks='+store.session(id)};
}

test('admin demo is a working nested hub; all six sections and CSS are available to supervisor',async t=>{
  const {store,get,post}=await setup(t);
  assert.equal((await get('/admin')).headers.get('location'),'/login');
  const start=await post('/demo/start',{role:'admin'});
  assert.equal(start.status,303);const cookie=start.headers.get('set-cookie').split(';')[0];
  assert.equal(store.user(store.resolve(cookie.slice(3))).role,'admin');
  assert.equal((await get('/app',cookie)).headers.get('location'),'/admin');
  const home=await (await get('/admin',cookie)).text();
  assert.match(home,/<html lang="ar" dir="rtl">/);assert.match(home,/\/admin.css/);assert.doesNotMatch(home,/action="\/tour\/switch"/);
  for(const path of ['/admin','/admin/accounts','/admin/accounts/new','/admin/finance','/admin/registration','/admin/education','/admin/education/teachers/new','/admin/operations','/admin/audit','/admin/technical','/admin/libraries'])assert.equal((await get(path,cookie)).status,200,path);
  const css=await get('/admin.css');assert.equal(css.status,200);assert.match(css.headers.get('content-type'),/text\/css/);
  const switched=await post('/admin/demo/switch',{adminRole:'finance'},cookie);
  assert.equal(switched.status,303);assert.equal(store.resolve(cookie.slice(3)),undefined);
  const finance=switched.headers.get('set-cookie').split(';')[0];
  const html=await (await get('/admin',finance)).text();
  assert.match(html,/href="\/admin\/finance"/);assert.doesNotMatch(html,/href="\/admin\/accounts"/);
  assert.equal((await get('/admin/accounts',finance)).status,403);
});

test('server enforces every direct section and mutation beyond hidden navigation',async t=>{
  const {store,cookie,get,post}=await setup(t),ids=store.admin.demo();
  const matrix={finance:['finance'],registration:['registration'],education:['education'],deputy:['operations'],technical:['technical','libraries']};
  for(const [role,allowed] of Object.entries(matrix)){
    const session=cookie(ids[role]);
    for(const section of ['accounts','finance','registration','education','operations','audit','technical','libraries'])assert.equal((await get('/admin/'+section,session)).status,allowed.includes(section)?200:403,role+' '+section);
    assert.equal((await post('/admin/accounts/new',{name:'تجاوز',email:role+'@example.invalid',adminRole:'supervisor'},session)).status,403);
  }
  const parent=store.tour().parent;
  assert.equal((await get('/admin',cookie(parent))).status,403);
  assert.equal((await post('/admin/finance',{description:'forged',amount:'1',kind:'income',request:randomUUID()},cookie(ids.registration))).status,403);
  assert.equal((await post('/admin/operations',{title:'forged',request:randomUUID()},cookie(ids.finance))).status,403);
  assert.equal((await post('/admin/education/teachers',{name:'forged',email:'fake@example.invalid',subjects:'math',grades:'4',language:'ar'},cookie(ids.finance))).status,403);
});

test('admin writes require same origin and valid form and do not change ledger on denial',async t=>{
  const {store,base,cookie,get,post}=await setup(t),ids=store.admin.demo(),session=cookie(ids.finance),before=store.admin.ledger(ids.finance).length;
  const data={description:'قيد تجريبي',amount:'15.10',kind:'income',request:randomUUID()};
  assert.equal((await post('/admin/finance',data,session,'https://evil.example')).status,403);
  const json=await fetch(base+'/admin/finance',{method:'POST',headers:{cookie:session,origin:base,'content-type':'application/json'},body:JSON.stringify(data)});
  assert.equal(json.status,415);assert.equal(store.admin.ledger(ids.finance).length,before);
  assert.equal((await post('/admin/finance',data,session)).status,303);
  assert.equal((await post('/admin/finance',data,session)).status,303);assert.equal(store.admin.ledger(ids.finance).length,before+1);
  assert.equal((await get('/admin/unknown',session)).status,404);
});

test('supervisor creates activation link and stale edits fail, reclassification revokes old session',async t=>{
  const {store,cookie,get,post}=await setup(t),ids=store.admin.demo(),owner=cookie(ids.supervisor);
  const response=await post('/admin/accounts/new',{name:'عضو اختبار',email:'http.member@example.invalid',adminRole:'finance','permission_finance.read':'1'},owner);
  assert.equal(response.status,201);const html=await response.text();
  const token=html.match(/\/activate\?code=([a-f0-9]{64})/)?.[1];assert.ok(token);
  const id=store.activate(token,'test-password-123'),session=cookie(id);
  assert.equal((await get('/admin/finance',session)).status,200);
  assert.equal((await post('/admin/finance',{description:'denied',kind:'income',amount:'1',request:randomUUID()},session)).status,403);
  const update={name:'عضو اختبار',adminRole:'registration',active:'1',revision:'1','permission_registration.read':'1'};
  assert.equal((await post('/admin/accounts/'+id,update,owner)).status,303);
  assert.equal((await get('/admin/finance',session)).headers.get('location'),'/login');
  assert.equal((await post('/admin/accounts/'+id,update,owner)).status,409);
  const fresh=cookie(id);assert.equal((await get('/admin/registration',fresh)).status,200);assert.equal((await get('/admin/finance',fresh)).status,403);
  const second=store.admin.demo();assert.equal((await post('/admin/accounts/'+second.finance,{...update,revision:'1'},owner)).status,404);
});

test('real accounts cannot start demo or switch to demo supervisor',async t=>{
  const {store,cookie,post}=await setup(t);
  const bootstrap=store.admin.bootstrap({name:'مشرف الاختبار',email:'root@example.test'}),id=store.activate(bootstrap.token,'test-password-123'),session=cookie(id);
  assert.equal((await post('/demo/start',{role:'admin'},session)).status,409);
  assert.equal((await post('/admin/demo/switch',{adminRole:'supervisor'},session)).status,403);
  assert.equal((await post('/tour/switch',{},session)).status,403);
  assert.equal(store.resolve(session.slice(3)),id);
});

test('teacher invitations and schedule operations are functional without sending email',async t=>{
  const {store,cookie,post,get}=await setup(t),ids=store.admin.demo(),session=cookie(ids.education);
  const response=await post('/admin/education/teachers',{name:'معلم اختبار',email:'teacher.http@example.invalid',subjects:'math,science',grades:'4,5',language:'ar'},session);
  assert.equal(response.status,201);const token=(await response.text()).match(/\/activate\?code=([a-f0-9]{64})/)?.[1];assert.ok(token);
  const pending=store.admin.education(ids.education).teachers.find(t=>t.name==='معلم اختبار');assert.equal(pending.activated,false);
  assert.ok((await (await get('/admin/education',session)).text()).includes('/admin/education/teachers/'+pending.id+'/renew'));
  const teacher=store.activate(token,'test-password-123'),start=new Date(Date.now()+10*86400000).toISOString().slice(0,16);
  const data={teacher,subject:'math',start,minutes:'45',instructions:'موعد افتراضي',request:randomUUID()};
  assert.equal((await post('/admin/education/slots',data,session)).status,303);
  assert.equal((await post('/admin/education/slots',data,session)).status,303);
  assert.equal(store.admin.education(ids.education).slots.filter(s=>s.teacher===teacher).length,1);
  assert.match(await (await get('/admin/education',session)).text(),/معلم اختبار/);
});

test('renewing member and teacher invitations invalidates prior links and never crosses scope',async t=>{
  const {store,cookie,post}=await setup(t),ids=store.admin.demo(),owner=cookie(ids.supervisor),education=cookie(ids.education);
  const member=store.admin.createMember(ids.supervisor,{name:'دعوة عضو',email:'renew.member@example.invalid',adminRole:'finance',permissions:['finance.read']});
  assert.equal((await post('/admin/accounts/'+member.id+'/renew',{},education)).status,403);
  const renewed=await post('/admin/accounts/'+member.id+'/renew',{},owner);assert.equal(renewed.status,200);
  const token=(await renewed.text()).match(/\/activate\?code=([a-f0-9]{64})/)?.[1];assert.ok(token);assert.notEqual(token,member.token);
  assert.throws(()=>store.activate(member.token,'test-password-123'));
  assert.equal(store.activate(token,'test-password-123'),member.id);
  assert.equal((await post('/admin/accounts/'+member.id+'/renew',{},owner)).status,409);
  const teacher=store.admin.createTeacher(ids.education,{name:'دعوة معلم',email:'renew.teacher@example.invalid',subjects:['math'],grades:[4],language:'ar'});
  const other=store.admin.demo();assert.equal((await post('/admin/education/teachers/'+teacher.id+'/renew',{},cookie(other.education))).status,404);
  const renewedTeacher=await post('/admin/education/teachers/'+teacher.id+'/renew',{},education);assert.equal(renewedTeacher.status,200);
  const teacherToken=(await renewedTeacher.text()).match(/\/activate\?code=([a-f0-9]{64})/)?.[1];assert.ok(teacherToken);
  assert.throws(()=>store.activate(teacher.token,'test-password-123'));
  assert.equal(store.activate(teacherToken,'test-password-123'),teacher.id);
  assert.equal((await post('/admin/accounts/'+ids.finance+'/renew',{},owner)).status,409);
  assert.ok(store.admin.auditLog(ids.supervisor).some(row=>row.action==='member.invitation_renewed'));
  assert.ok(store.admin.auditLog(ids.supervisor).some(row=>row.action==='teacher.invitation_renewed'));
});

test('initial supervisor invitation can be renewed before activation, not replaced afterwards',async t=>{
  const {store}=await setup(t),values={name:'مشرف الاختبار',email:'initial@example.test'};
  const first=store.admin.bootstrap(values),second=store.admin.bootstrap(values);
  assert.equal(first.id,second.id);assert.notEqual(first.token,second.token);
  assert.throws(()=>store.activate(first.token,'test-password-123'));
  assert.equal(store.activate(second.token,'test-password-123'),first.id);
  assert.throws(()=>store.admin.bootstrap(values),error=>error.status===409);
  assert.equal(store.login(values.email,'test-password-123'),first.id);
});

test('Arabic teacher selection checkboxes create the same validated teaching scope',async t=>{
  const {store,cookie,post}=await setup(t),ids=store.admin.demo();
  const response=await post('/admin/education/teachers',{name:'معلم الاختيارات',email:'checkbox.teacher@example.invalid',teacher_subject_math:'1',teacher_subject_science:'1',teacher_grade_1:'1',teacher_grade_4:'1',language:'ar'},cookie(ids.education));
  assert.equal(response.status,201);
  const teacher=store.admin.education(ids.education).teachers.find(row=>row.name==='معلم الاختيارات');
  assert.deepEqual(teacher.subjects,['math','science']);assert.deepEqual(teacher.grades,[1,4]);assert.equal(teacher.activated,false);
});
