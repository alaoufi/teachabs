import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openStore,UserError} from '../store.mjs';
import {DEFAULT_GRANTS} from '../admin-model.mjs';
import {adminTechnical,adminLibraries} from '../admin-views.mjs';
import {createApp} from '../server.mjs';

// Synthetic records only, isolated in-memory SQLite per test. URLs are catalog
// metadata and are never visited, fetched, imported, or installed by these tests.
function setup(t){const store=openStore(':memory:');t.after(()=>store.close());return {store,a:store.admin,ids:store.admin.demo()};}
const denied=(fn,status=403)=>assert.throws(fn,e=>e instanceof UserError&&e.status===status);
const ticket=(extra={})=>({title:'Synthetic outage',description:'Synthetic reproduction steps',category:'outage',priority:'high',request:randomUUID(),...extra});
const library=(extra={})=>({name:'Synthetic shapes',description:'Synthetic catalog entry',url:'https://example.com/shapes.svg',category:'board_shape',license:'cc0',attribution:'',request:randomUUID(),...extra});
function edit(a,owner,id,changes){a.updateMember(owner,id,{...a.members(owner).find(r=>r.id===id),...changes});}

test('technical default permissions are isolated; supervisor alone controls grants',t=>{
 const {a,ids}=setup(t);
 assert.deepEqual(a.profile(ids.technical).permissions,['technical.read','technical.write','libraries.read','libraries.write']);
 assert.ok(a.technical(ids.technical).length); assert.deepEqual(a.libraries(ids.technical),[]);
 for(const role of ['finance','registration','education','deputy']){
  const id=ids[role]; denied(()=>a.technical(id));denied(()=>a.libraries(id));denied(()=>a.addTicket(id,ticket()));denied(()=>a.addLibrary(id,library()));
 }
 for(const method of ['members','ledger','registration','education','operations','auditLog'])denied(()=>a[method](ids.technical));
 denied(()=>a.createMember(ids.technical,{name:'Synthetic unauthorized',email:'unauthorized@example.invalid',adminRole:'supervisor',permissions:DEFAULT_GRANTS.supervisor}));
 assert.ok(a.technical(ids.supervisor));assert.ok(a.libraries(ids.supervisor));
});

test('technical and library write grants require read; revoked grants use fresh authority',t=>{
 const {store,a,ids}=setup(t),before=a.auditLog(ids.supervisor);
 for(const permissions of [['technical.write'],['libraries.write'],['technical.read','libraries.write']])denied(()=>edit(a,ids.supervisor,ids.finance,{permissions}),400);
 assert.deepEqual(a.auditLog(ids.supervisor),before);
 edit(a,ids.supervisor,ids.finance,{permissions:['technical.read','libraries.read']});
 assert.ok(a.technical(ids.finance));assert.ok(a.libraries(ids.finance));denied(()=>a.addTicket(ids.finance,ticket()));denied(()=>a.addLibrary(ids.finance,library()));
 const session=store.session(ids.technical);edit(a,ids.supervisor,ids.technical,{permissions:['technical.read','libraries.read']});
 assert.equal(store.resolve(session),undefined);denied(()=>a.addTicket(ids.technical,ticket()));denied(()=>a.addLibrary(ids.technical,library()));
 const p=a.profile(ids.technical);assert.doesNotMatch(adminTechnical(p,a.technical(ids.technical)),/action="\/admin\/technical(?:\/|\")/);assert.doesNotMatch(adminLibraries(p,[]),/action="\/admin\/libraries(?:\/|\")/);
});

test('tickets and library records are scope isolated for reads and targeted writes',t=>{
 const {a,ids}=setup(t),other=a.demo(),id=a.addTicket(ids.technical,ticket()),resource=a.addLibrary(ids.technical,library());
 assert.ok(!a.technical(other.technical).some(r=>r.id===id));assert.ok(!a.libraries(other.technical).some(r=>r.id===resource));
 const audit=a.auditLog(ids.supervisor);
 denied(()=>a.updateTicket(other.technical,id,{revision:1,status:'resolved',priority:'normal'}),404);
 denied(()=>a.updateLibrary(other.supervisor,resource,{revision:1,active:false}),404);
 assert.deepEqual(a.auditLog(ids.supervisor),audit);
 assert.equal(a.switchDemo(ids.supervisor,'technical'),ids.technical);
});

test('ticket create/update validates, deduplicates and detects stale revisions without audit side effects',t=>{
 const {a,ids}=setup(t),v=ticket(),id=a.addTicket(ids.technical,v),audit=a.auditLog(ids.supervisor);
 assert.equal(a.addTicket(ids.technical,v),id);denied(()=>a.addTicket(ids.technical,{...v,title:'Changed'}),409);
 for(const changes of [{title:''},{title:'x'.repeat(161)},{description:'x'.repeat(1001)},{category:'malware'},{priority:'critical'},{request:'bad'}])denied(()=>a.addTicket(ids.technical,ticket(changes)),400);
 denied(()=>a.updateTicket(ids.technical,id,{revision:1,status:'deleted',priority:'normal'}),400);
 denied(()=>a.updateTicket(ids.technical,id,{revision:1,status:'resolved',priority:'invalid'}),400);
 denied(()=>a.updateTicket(ids.finance,id,{revision:1,status:'resolved',priority:'normal'}));assert.deepEqual(a.auditLog(ids.supervisor),audit);
 a.updateTicket(ids.technical,id,{revision:1,status:'in_progress',priority:'urgent'});
 const after=a.auditLog(ids.supervisor);denied(()=>a.updateTicket(ids.technical,id,{revision:1,status:'resolved',priority:'normal'}),409);assert.deepEqual(a.auditLog(ids.supervisor),after);
 a.updateTicket(ids.technical,id,{revision:2,status:'resolved',priority:'normal'});assert.equal(a.technical(ids.technical).find(r=>r.id===id).revision,3);
});

test('resource URLs block executable schemes, credentials, IPs and nonpublic host forms',t=>{
 const {a,ids}=setup(t),audit=a.auditLog(ids.supervisor);
 for(const url of ['javascript:alert(1)','data:text/html,evil','file:///tmp/example','http://example.com/file','https://user:password@example.com/file','https://127.0.0.1/a','https://127.1/a','https://2130706433/a','https://0x7f000001/a','https://[::1]/a','https://[2001:4860:4860::8888]/a','https://localhost/a','https://a.local/a','https://a.internal/a','https://a.test/a','https://a.invalid/a','https://localhost./a','https://a.internal./a','https://a.test./a','https://a.invalid./a','https://example.com:444/a','not a url'])denied(()=>a.addLibrary(ids.technical,library({url})),400);
 assert.deepEqual(a.libraries(ids.technical),[]);assert.deepEqual(a.auditLog(ids.supervisor),audit);
 const id=a.addLibrary(ids.technical,library({url:'https://EXAMPLE.com:443/shapes.svg'}));assert.equal(a.libraries(ids.technical).find(r=>r.id===id).url,'https://example.com/shapes.svg');
});

test('catalog validation enforces license attribution and bounded metadata',t=>{
 const {a,ids}=setup(t),audit=a.auditLog(ids.supervisor);
 for(const license of ['cc_by','cc_by_sa','permission'])for(const attribution of ['','   '])denied(()=>a.addLibrary(ids.technical,library({license,attribution})),400);
 for(const changes of [{name:''},{name:'x'.repeat(101)},{description:'x'.repeat(401)},{attribution:'x'.repeat(161)},{category:'executable'},{license:'unverified'},{request:'bad'}])denied(()=>a.addLibrary(ids.technical,library(changes)),400);
 assert.deepEqual(a.auditLog(ids.supervisor),audit);
 for(const license of ['own','cc0','cc_by','cc_by_sa','permission'])assert.ok(a.addLibrary(ids.technical,library({license,attribution:'Synthetic rights holder / permission reference'})));
});

test('catalog entries are idempotent; active toggles enforce boolean and optimistic revision',t=>{
 const {a,ids}=setup(t),v=library(),id=a.addLibrary(ids.technical,v),audit=a.auditLog(ids.supervisor);
 assert.equal(a.addLibrary(ids.technical,v),id);denied(()=>a.addLibrary(ids.technical,{...v,url:'https://example.com/other'}),409);
 denied(()=>a.updateLibrary(ids.technical,id,{revision:1,active:'false'}),400);denied(()=>a.updateLibrary(ids.finance,id,{revision:1,active:false}));assert.deepEqual(a.auditLog(ids.supervisor),audit);
 a.updateLibrary(ids.technical,id,{revision:1,active:false});let row=a.libraries(ids.technical).find(r=>r.id===id);assert.equal(row.active,false);assert.equal(row.revision,2);
 denied(()=>a.updateLibrary(ids.technical,id,{revision:1,active:true}),409);
 assert.doesNotMatch(adminLibraries(a.profile(ids.technical),[row]),/href="https:\/\/example.com\/shapes.svg"/);
 a.updateLibrary(ids.technical,id,{revision:2,active:true});row=a.libraries(ids.technical).find(r=>r.id===id);assert.equal(row.active,true);assert.equal(row.revision,3);
});

test('catalog and tickets escape stored HTML; catalog explicitly does not install or import',t=>{
 const {a,ids}=setup(t),attack='<img src=x onerror=alert(1)>';
 a.addTicket(ids.technical,ticket({title:attack,description:attack}));a.addLibrary(ids.technical,library({name:attack,description:attack,license:'cc_by',attribution:attack}));
 for(const html of [adminTechnical(a.profile(ids.technical),a.technical(ids.technical)),adminLibraries(a.profile(ids.technical),a.libraries(ids.technical))]){assert.ok(!html.includes(attack));assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));}
 const html=adminLibraries(a.profile(ids.technical),a.libraries(ids.technical));
 assert.match(html,/فهرس للروابط فقط/);assert.match(html,/لا تثبّت أو تنفّذ ملفات أو برامج/);assert.match(html,/لا يستورده إلى السبورة/);assert.match(html,/rel="noopener noreferrer"/);
 assert.doesNotMatch(html,/<iframe|<script|<object|<embed|type="file"/);
});

test('technical and catalog audit records show changes and catalog-only intent',t=>{
 const {a,ids}=setup(t),id=a.addTicket(ids.technical,ticket()),resource=a.addLibrary(ids.technical,library());
 a.updateTicket(ids.technical,id,{revision:1,status:'resolved',priority:'normal'});a.updateLibrary(ids.technical,resource,{revision:1,active:false});
 const audit=a.auditLog(ids.supervisor);
 assert.deepEqual(audit.find(r=>r.action==='technical.updated'&&r.target===id).details,{before:{status:'open',priority:'high'},after:{status:'resolved',priority:'normal'}});
 assert.deepEqual(audit.find(r=>r.action==='library.updated'&&r.target===resource).details,{before:{active:true},after:{active:false}});
 assert.equal(audit.find(r=>r.action==='library.created'&&r.target===resource).details.catalogOnly,true);
 assert.ok(audit.filter(r=>r.target===resource||r.target===id).every(r=>!('description' in r.details)&&!('url' in r.details)));
});

async function http(t){const store=openStore(':memory:'),app=createApp(store);await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));t.after(async()=>{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));store.close();});const base='http://127.0.0.1:'+app.address().port;return {store,base,cookie:id=>'ks='+store.session(id),get:(path,cookie='')=>fetch(base+path,{headers:{cookie},redirect:'manual'}),post:(path,data,cookie='',origin=base)=>fetch(base+path,{method:'POST',headers:{cookie,origin},body:new URLSearchParams(data),redirect:'manual'})};}

test('technical HTTP routes enforce role boundaries, origin checks, form type and revisions',async t=>{
 const {store,base,cookie,get,post}=await http(t),a=store.admin,ids=a.demo(),session=cookie(ids.technical);
 for(const path of ['/admin/technical','/admin/libraries']){
  assert.equal((await get(path)).headers.get('location'),'/login');assert.equal((await get(path,session)).status,200);assert.equal((await get(path,cookie(ids.supervisor))).status,200);
  for(const role of ['finance','registration','education','deputy'])assert.equal((await get(path,cookie(ids[role]))).status,403);
 }
 const before=a.auditLog(ids.supervisor);
 for(const [path,data] of [['/admin/technical',ticket()],['/admin/libraries',library()]]){
  assert.equal((await post(path,data,session,'https://evil.example')).status,403);
  assert.equal((await post(path,data,cookie(ids.finance))).status,403);
  const json=await fetch(base+path,{method:'POST',headers:{cookie:session,origin:base,'content-type':'application/json'},body:JSON.stringify(data),redirect:'manual'});assert.equal(json.status,415);
 }
 assert.deepEqual(a.auditLog(ids.supervisor),before);
 const v=ticket();assert.equal((await post('/admin/technical',v,session)).status,303);assert.equal((await post('/admin/technical',v,session)).status,303);
 const id=a.technical(ids.technical).find(r=>r.title===v.title).id;
 assert.equal((await post('/admin/technical/'+id,{revision:'1',status:'resolved',priority:'normal'},session)).status,303);
 assert.equal((await post('/admin/technical/'+id,{revision:'1',status:'open',priority:'normal'},session)).status,409);
 const l=library();assert.equal((await post('/admin/libraries',l,session)).status,303);
 const resource=a.libraries(ids.technical)[0].id;assert.equal((await post('/admin/libraries/'+resource,{revision:'1',active:'0'},session)).status,303);assert.equal(a.libraries(ids.technical)[0].active,false);
});
