import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore, UserError } from '../store.mjs';
import { DEFAULT_GRANTS } from '../admin-model.mjs';
import * as views from '../admin-views.mjs';

// All records are synthetic. Every ordinary test owns an in-memory database.
function fixture(t) { const store=openStore(':memory:'); t.after(()=>store.close()); return {store,a:store.admin,ids:store.admin.demo()}; }
const denied=(fn,status=403)=>assert.throws(fn,e=>e instanceof UserError&&e.status===status);
const member=(role='finance',extra={})=>({name:'Synthetic member',email:`${randomUUID()}@example.invalid`,adminRole:role,permissions:[...(DEFAULT_GRANTS[role]||[])],...extra});
const current=(a,supervisor,id)=>a.members(supervisor).find(m=>m.id===id);
const edit=(a,supervisor,id,changes={})=>a.updateMember(supervisor,id,{...current(a,supervisor,id),...changes});
const ledger=extra=>({description:'Synthetic tuition',kind:'income',amount:'12.34',request:randomUUID(),...extra});

test('default departments have exact read access and hidden overview metrics',t=>{
 const {a,ids}=fixture(t);
 const readers={finance:'ledger',registration:'registration',education:'education',deputy:'operations'};
 for(const [role,id] of Object.entries(ids)){
  assert.equal(a.profile(id).role,'admin'); assert.equal(a.profile(id).adminRole,role);
  assert.deepEqual(a.profile(id).permissions,[...DEFAULT_GRANTS[role]]);
  for(const [owner,method] of Object.entries(readers)) if(role==='supervisor'||role===owner) assert.ok(a[method](id)); else denied(()=>a[method](id));
  if(role!=='supervisor'){denied(()=>a.members(id)); denied(()=>a.auditLog(id)); assert.equal(a.overview(id).members,null);}
 }
 assert.equal(a.overview(ids.finance).students,null); assert.equal(a.overview(ids.registration).entries,null);
});

test('parent and teacher identities cannot access admin even with forged role fields',t=>{
 const {store,a,ids}=fixture(t),tour=store.tour();
 for(const id of [tour.parent,tour.teacher]){denied(()=>a.profile(id)); denied(()=>a.createMember(id,member('supervisor')));}
 denied(()=>a.updateMember(ids.finance,ids.finance,{...member('supervisor'),revision:1,active:true}));
 assert.equal(a.profile(ids.finance).adminRole,'finance');
});

test('separate demo scopes isolate members, student files, teachers, finance, operations and audit',t=>{
 const {a,ids}=fixture(t),other=a.demo();
 assert.notEqual(a.profile(ids.supervisor).scope,a.profile(other.supervisor).scope);
 for(const method of ['members','registration','ledger','operations','auditLog']){
  const first=a[method](ids.supervisor),second=a[method](other.supervisor);
  assert.ok(first.length>0&&second.length>0); assert.ok(first.every(row=>!second.some(otherRow=>otherRow.id===row.id)));
 }
 assert.ok(a.education(ids.supervisor).teachers.every(row=>!a.education(other.supervisor).teachers.some(otherRow=>otherRow.id===row.id)));
 denied(()=>a.updateMember(ids.supervisor,other.finance,{...current(a,other.supervisor,other.finance),name:'Intrusion'}),404);
 const task=a.operations(other.deputy)[0]; denied(()=>a.updateOperation(ids.deputy,task.id,{revision:task.revision,status:'done'}),404);
 assert.equal(a.switchDemo(ids.finance,'supervisor'),ids.supervisor); denied(()=>a.switchDemo(ids.finance,'invented'));
});

test('only supervisor can create accounts and grant access; failed actions do not mutate or audit',t=>{
 const {a,ids}=fixture(t),before=a.members(ids.supervisor),audit=a.auditLog(ids.supervisor);
 for(const role of ['finance','registration','education','deputy']){
  denied(()=>a.createMember(ids[role],member())); denied(()=>a.updateMember(ids[role],ids.finance,{...current(a,ids.supervisor,ids.finance),name:'Unauthorized edit'}));
  denied(()=>a.addLedger(ids.registration,ledger())); denied(()=>a.addOperation(ids.finance,{title:'No',request:randomUUID()}));
 }
 assert.deepEqual(a.members(ids.supervisor),before); assert.deepEqual(a.auditLog(ids.supervisor),audit);
 const created=a.createMember(ids.supervisor,member('registration',{permissions:['finance.read']}));
 assert.ok(a.ledger(created.id)); denied(()=>a.registration(created.id)); denied(()=>a.addLedger(created.id,ledger()));
});

test('unknown permissions, fake roles and write-without-read grants are rejected atomically',t=>{
 const {a,ids}=fixture(t),before=a.members(ids.supervisor),audit=a.auditLog(ids.supervisor);
 for(const permissions of [['supervisor'],['finance.write'],['education.write'],['operations.write'],['__proto__'],['finance.read','account.write']]){
  denied(()=>a.createMember(ids.supervisor,member('finance',{permissions})),400);
  denied(()=>edit(a,ids.supervisor,ids.finance,{permissions}),400);
 }
 denied(()=>a.createMember(ids.supervisor,member('root',{permissions:[]})),400);
 denied(()=>a.createMember(ids.supervisor,member('finance',{email:'synthetic@real-domain.test'})),400);
 assert.deepEqual(a.members(ids.supervisor),before); assert.deepEqual(a.auditLog(ids.supervisor),audit);
});

test('member edits use revisions and reload authority; authority changes revoke sessions',t=>{
 const {store,a,ids}=fixture(t),stale=current(a,ids.supervisor,ids.finance),session=store.session(ids.finance);
 const snapshot=a.profile(ids.finance); snapshot.permissions.push('audit.read'); denied(()=>a.auditLog(ids.finance));
 edit(a,ids.supervisor,ids.finance,{permissions:['finance.read']});
 assert.equal(store.resolve(session),undefined); denied(()=>a.addLedger(ids.finance,ledger()));
 const audit=a.auditLog(ids.supervisor); denied(()=>a.updateMember(ids.supervisor,ids.finance,{...stale,name:'Stale'}),409);
 assert.deepEqual(a.auditLog(ids.supervisor),audit); assert.equal(a.profile(ids.finance).revision,2);
 const next=store.session(ids.finance); edit(a,ids.supervisor,ids.finance,{active:false});
 assert.equal(store.resolve(next),undefined); denied(()=>a.profile(ids.finance));
});

test('sole supervisor cannot disable or demote self; another supervisor can safely change peers',t=>{
 const {a,ids}=fixture(t);
 for(const changes of [{active:false},{adminRole:'finance',permissions:[...DEFAULT_GRANTS.finance]}]) denied(()=>edit(a,ids.supervisor,ids.supervisor,changes),409);
 assert.equal(a.members(ids.supervisor).filter(m=>m.adminRole==='supervisor'&&m.active).length,1);
 const peer=a.createMember(ids.supervisor,member('supervisor'));
 edit(a,ids.supervisor,peer.id,{adminRole:'finance',permissions:[...DEFAULT_GRANTS.finance]});
 denied(()=>a.members(peer.id)); assert.equal(a.profile(ids.supervisor).adminRole,'supervisor');
});

test('activation is single-use and deactivated accounts cannot activate or log in',t=>{
 const {store,a,ids}=fixture(t),values=member(),created=a.createMember(ids.supervisor,values),password='synthetic-test-password';
 assert.equal(current(a,ids.supervisor,created.id).activated,false);
 assert.equal(store.activate(created.token,password),created.id); assert.equal(store.login(values.email,password),created.id);
 denied(()=>store.activate(created.token,password),400); assert.equal(current(a,ids.supervisor,created.id).activated,true);
 edit(a,ids.supervisor,created.id,{active:false}); denied(()=>store.login(values.email,password));
 const pending=a.createMember(ids.supervisor,member()); edit(a,ids.supervisor,pending.id,{active:false}); denied(()=>store.activate(pending.token,password));
 assert.equal(current(a,ids.supervisor,pending.id).activated,false);
});

test('bootstrap creates one real-scope supervisor without reading demo records',t=>{
 const {store,a}=fixture(t),created=a.bootstrap({name:'Synthetic supervisor',email:'bootstrap@example.invalid'});
 assert.equal(a.profile(created.id).scope,''); assert.equal(a.members(created.id).length,1);
 assert.deepEqual(a.registration(created.id),[]); denied(()=>a.switchDemo(created.id,'finance'));
 denied(()=>a.bootstrap({name:'Second synthetic',email:'second@example.invalid'}),409);
 assert.equal(store.activate(created.token,'synthetic-bootstrap-password'),created.id);
});

test('ledger uses exact integer cents, bounded values and idempotent request keys',t=>{
 const {a,ids}=fixture(t),values=ledger({amount:'0.29'}),before=a.ledger(ids.finance).length;
 const id=a.addLedger(ids.finance,values),audit=a.auditLog(ids.supervisor);
 assert.equal(a.ledger(ids.finance).find(r=>r.id===id).amountCents,29); assert.equal(a.addLedger(ids.finance,values),id);
 assert.equal(a.ledger(ids.finance).length,before+1); assert.deepEqual(a.auditLog(ids.supervisor),audit);
 denied(()=>a.addLedger(ids.finance,{...values,amount:'0.30'}),409);
 for(const amount of ['0','-1','1.001','1e3','NaN','Infinity','1000000.01',' 12','12.',12]) denied(()=>a.addLedger(ids.finance,ledger({amount})),400);
 denied(()=>a.addLedger(ids.finance,ledger({kind:'refund'})),400); denied(()=>a.addLedger(ids.finance,ledger({request:'bad'})),400);
 assert.deepEqual(a.auditLog(ids.supervisor),audit);
 const max=a.addLedger(ids.finance,ledger({amount:'1000000'})); assert.equal(a.ledger(ids.finance).find(r=>r.id===max).amountCents,100000000);
});

test('operations enforce allowed status, revisions, idempotency and denied nonmutation',t=>{
 const {a,ids}=fixture(t),values={title:'Synthetic operation',request:randomUUID()},id=a.addOperation(ids.deputy,values),audit=a.auditLog(ids.supervisor);
 assert.equal(a.addOperation(ids.deputy,values),id); assert.deepEqual(a.auditLog(ids.supervisor),audit);
 denied(()=>a.addOperation(ids.deputy,{...values,title:'Different'}),409);
 denied(()=>a.updateOperation(ids.deputy,id,{revision:1,status:'deleted'}),400); denied(()=>a.updateOperation(ids.finance,id,{revision:1,status:'done'}));
 assert.deepEqual(a.auditLog(ids.supervisor),audit);
 a.updateOperation(ids.deputy,id,{revision:1,status:'in_progress'}); denied(()=>a.updateOperation(ids.deputy,id,{revision:1,status:'done'}),409);
 a.updateOperation(ids.deputy,id,{revision:2,status:'done'}); assert.equal(a.operations(ids.deputy).find(r=>r.id===id).revision,3);
});

test('education creates scoped teachers; schedule enforces qualifications, overlap and idempotency',t=>{
 const {store,a,ids}=fixture(t),other=a.demo(),teacher=a.createTeacher(ids.education,{name:'Synthetic teacher',email:`${randomUUID()}@example.invalid`,subjects:['math'],grades:[2],language:'ar'});
 assert.equal(store.user(teacher.id).scope,a.profile(ids.education).scope);
 const values={teacher:teacher.id,subject:'math',minutes:30,start:Date.now()+7*86400000,instructions:'Synthetic only',request:randomUUID()};
 const id=a.addSlot(ids.education,values),audit=a.auditLog(ids.supervisor);
 assert.equal(a.addSlot(ids.education,values),id); assert.deepEqual(a.auditLog(ids.supervisor),audit);
 denied(()=>a.addSlot(other.education,values),404); denied(()=>a.addSlot(ids.registration,values));
 denied(()=>a.addSlot(ids.education,{...values,subject:'science',request:randomUUID()}));
 denied(()=>a.addSlot(ids.education,{...values,minutes:45,request:randomUUID()}),400);
 denied(()=>a.addSlot(ids.education,{...values,start:values.start+60000}),409);
 denied(()=>a.addSlot(ids.education,{...values,start:values.start+60000,request:randomUUID()}),409);
 denied(()=>a.addSlot(ids.education,{...values,start:Date.now()-1,request:randomUUID()}),400);
 assert.deepEqual(a.auditLog(ids.supervisor),audit);
 a.addSlot(ids.education,{...values,start:values.start+30*60000,request:randomUUID()});
 assert.equal(a.education(ids.education).slots.filter(s=>s.teacher===teacher.id).length,2);
});

test('audit records before/after authority and status, never invitation tokens or passwords',t=>{
 const {store,a,ids}=fixture(t),created=a.createMember(ids.supervisor,member()),password='synthetic-audit-password';
 store.activate(created.token,password); edit(a,ids.supervisor,created.id,{permissions:['finance.read']});
 const operation=a.addOperation(ids.deputy,{title:'Synthetic audit',request:randomUUID()}); a.updateOperation(ids.deputy,operation,{revision:1,status:'done'});
 const rows=a.auditLog(ids.supervisor),change=rows.find(r=>r.action==='member.updated'&&r.target===created.id);
 assert.deepEqual(change.details.before.permissions,[...DEFAULT_GRANTS.finance]); assert.deepEqual(change.details.after.permissions,['finance.read']);
 assert.deepEqual(rows.find(r=>r.action==='operation.updated').details,{before:'open',after:'done'});
 const serialized=JSON.stringify(rows); assert.ok(!serialized.includes(created.token)); assert.ok(!serialized.includes(password)); assert.ok(!serialized.includes('"pass"'));
});

test('stored malicious names and ledger descriptions remain escaped in admin views',t=>{
 const {a,ids}=fixture(t),attack='<img src=x onerror=alert(1)>',created=a.createMember(ids.supervisor,member('finance',{name:attack}));
 a.addLedger(created.id,ledger({description:attack}));
 const profile=a.profile(created.id);
 for(const html of [views.adminHome(profile,a.overview(created.id)),views.adminAccounts(a.profile(ids.supervisor),a.members(ids.supervisor)),views.adminAccountForm(a.profile(ids.supervisor),current(a,ids.supervisor,created.id)),views.adminFinance(profile,a.ledger(created.id))]){
  assert.ok(!html.includes(attack)); assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
 }
});

test('opening a synthetic pre-admin database adds tables without replacing old records',t=>{
 const directory=mkdtempSync(join(tmpdir(),'synthetic-admin-migration-')),path=join(directory,'old.sqlite'); t.after(()=>rmSync(directory,{recursive:true,force:true}));
 const old=new DatabaseSync(path);
 old.exec("CREATE TABLE users(id TEXT PRIMARY KEY,role TEXT NOT NULL,name TEXT NOT NULL,email TEXT UNIQUE,pass TEXT,scope TEXT NOT NULL DEFAULT '',subjects TEXT,grades TEXT,language TEXT); INSERT INTO users(id,role,name,email) VALUES('old-synthetic-parent','parent','Synthetic legacy','legacy@example.invalid')"); old.close();
 const store=openStore(path); try{assert.equal(store.user('old-synthetic-parent').name,'Synthetic legacy'); const admin=store.admin.bootstrap({name:'Synthetic migrated supervisor',email:'migration@example.invalid'}); assert.equal(store.admin.members(admin.id).length,1); denied(()=>store.admin.profile('old-synthetic-parent'));} finally{store.close();}
 const reopened=openStore(path); try{assert.equal(reopened.user('old-synthetic-parent').role,'parent'); denied(()=>reopened.admin.bootstrap({name:'Duplicate',email:'duplicate@example.invalid'}),409);} finally{reopened.close();}
});

test('an inactive supervisor can be renamed or reassigned without blocking the remaining active supervisor',t=>{
 const {a,ids}=fixture(t),second=a.createMember(ids.supervisor,member('supervisor'));
 edit(a,ids.supervisor,second.id,{active:false});
 edit(a,ids.supervisor,second.id,{name:'Renamed inactive supervisor'});
 edit(a,ids.supervisor,second.id,{adminRole:'finance',permissions:['finance.read']});
 const changed=current(a,ids.supervisor,second.id);
 assert.equal(changed.active,false);assert.equal(changed.adminRole,'finance');assert.equal(changed.name,'Renamed inactive supervisor');
 assert.equal(a.profile(ids.supervisor).adminRole,'supervisor');
 assert.equal(a.members(ids.supervisor).filter(m=>m.active&&m.adminRole==='supervisor').length,1);
});

test('pending teachers may have prepared schedules but are not offered or bookable until activation',t=>{
 const {store,a}=fixture(t),supervisor=a.bootstrap({name:'Synthetic supervisor',email:'schedule.owner@example.test'});
 const teacher=a.createTeacher(supervisor.id,{name:'Pending synthetic teacher',email:'pending.teacher@example.test',subjects:['math'],grades:[4],language:'ar'});
 const slot=a.addSlot(supervisor.id,{teacher:teacher.id,subject:'math',minutes:45,start:Date.now()+7*86400000,instructions:'Synthetic only',request:randomUUID()});
 assert.equal(a.education(supervisor.id).slots.find(s=>s.id===slot).teacherActivated,false);
 assert.match(views.adminEducation(a.profile(supervisor.id),a.education(supervisor.id)),/بانتظار تفعيل المعلم/);
 const parent=store.parent('Synthetic parent','pending.parent@example.test','synthetic-password-123');
 const child=store.child(parent,{name:'Synthetic child',grade:4,curriculum:'sa',language:'ar'});
 assert.deepEqual(store.offers(parent,child,'math'),[]);
 denied(()=>store.book(parent,child,slot,randomUUID()),409);
 assert.deepEqual(store.bookings(parent),[]);
 store.activate(teacher.token,'synthetic-password-123');
 assert.equal(a.education(supervisor.id).slots.find(s=>s.id===slot).teacherActivated,true);
 assert.equal(store.offers(parent,child,'math')[0].id,slot);
 const booking=store.book(parent,child,slot,randomUUID());assert.equal(store.bookings(parent)[0].id,booking);
});
