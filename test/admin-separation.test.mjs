import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {openStore} from '../store.mjs';
import {createApp} from '../server.mjs';
import {adminHome,adminRegistrationAgents} from '../admin-views.mjs';

async function setup(t){
 const store=openStore(':memory:'),ids=store.admin.demo(),app=createApp(store);
 await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));store.close();});
 const base='http://127.0.0.1:'+app.address().port;
 const cookie=id=>id?'ks='+store.session(id):'';
 const get=(path,id=ids.supervisor)=>fetch(base+path,{headers:{cookie:cookie(id)},redirect:'manual'});
 const post=(path,data,id=ids.supervisor,origin=base)=>fetch(base+path,{method:'POST',headers:{cookie:cookie(id),...(origin?{origin}:{})},body:new URLSearchParams(data),redirect:'manual'});
 return {store,ids,base,get,post};
}
const invitation=extra=>({name:'وكيل اختبار مستقل',email:randomUUID()+'@example.invalid',register_parent:'on',register_child:'on',...extra});
const token=html=>html.match(/\/activate\?code=([a-f0-9]{64})/)?.[1];

test('administration has its own masthead, logout and navigation without classroom destinations',async t=>{
 const {store,ids}=await setup(t),p=store.admin.profile(ids.supervisor);
 const html=adminHome(p,store.admin.overview(ids.supervisor));
 assert.match(html,/class="adm-masthead"/);
 assert.match(html,/<form method="post" action="\/logout"/);
 assert.match(html,/href="\/admin\/agents"/);
 assert.doesNotMatch(html,/href="\/(?:demo|lesson|classroom|teach|join)(?:[\/?#"])/);
 assert.doesNotMatch(html,/href="\/admin\/registration-agents"/);
 const css=readFileSync(new URL('../public/admin.css',import.meta.url),'utf8');
 assert.match(css,/body:has\(\.adm\)>header,body:has\(\.adm\)>footer\{display:none\}/);
 assert.doesNotMatch(css,/\.adm header\s*\{display:none/);
});

test('new agent workspace preserves supervisor-only access and old route compatibility',async t=>{
 const {store,ids,get,post}=await setup(t);
 assert.equal((await get('/admin/agents',null)).headers.get('location'),'/login');
 const html=await (await get('/admin/agents')).text();
 assert.match(html,/data-admin-section="registration-agents"/);
 assert.match(html,/action="\/admin\/agents\/new"/);
 assert.match(html,/دليل القسم/);
 assert.equal((await get('/admin/registration-agents')).status,200);
 const tour=store.tour();
 for(const id of [ids.finance,ids.education,tour.parent,tour.teacher]){
  assert.equal((await get('/admin/agents',id)).status,403);
  assert.equal((await post('/admin/agents/new',invitation(),id)).status,403);
 }
 const agent=store.admin.createRegistrationAgent(ids.supervisor,{name:'وكيل تجريبي',email:randomUUID()+'@example.invalid',register_parent:true,register_child:false,manage_status:false});
 store.activate(agent.token,'synthetic-agent-password');
 assert.equal((await get('/admin/agents',agent.id)).status,403);
});

test('agent creation and revisioned permission edits keep the new administration destination',async t=>{
 const {store,ids,post,get}=await setup(t),data=invitation();
 const created=await post('/admin/agents/new',data);
 assert.equal(created.status,201);
 const html=await created.text();
 assert.ok(token(html));
 assert.match(html,/data-admin-section="registration-agents"/);
 assert.match(html,/href="\/admin\/agents"/);
 assert.match(html,/لم يتم إرسال بريد إلكتروني تلقائيًا/);
 const before=store.registration.agents(ids.supervisor).find(a=>a.email===data.email);
 assert.equal(before.register_parent,1);assert.equal(before.register_child,1);assert.equal(before.manage_status,0);
 const values={agent:before.id,rev:String(before.rev),manage_status:'on'};
 const saved=await post('/admin/agents',values);
 assert.equal(saved.status,303);assert.equal(saved.headers.get('location'),'/admin/agents');
 const after=store.registration.agents(ids.supervisor).find(a=>a.id===before.id);
 assert.equal(after.register_parent,0);assert.equal(after.register_child,0);assert.equal(after.manage_status,1);
 assert.equal(after.rev,before.rev+1);
 assert.equal((await post('/admin/agents',values)).status,409);
 assert.deepEqual(store.registration.agents(ids.supervisor).find(a=>a.id===before.id),after);
 assert.match(await (await get('/admin/agents')).text(),/name="rev"/);
});

test('new agent routes reject untrusted origin, wrong scope and non-supervisor mutations without changes',async t=>{
 const {store,ids,post}=await setup(t);
 const a=store.admin.createRegistrationAgent(ids.supervisor,{name:'وكيل الاختبار',email:randomUUID()+'@example.invalid',register_parent:true,register_child:false,manage_status:false});
 const before=store.registration.agents(ids.supervisor),row=before.find(r=>r.id===a.id);
 const values={agent:a.id,rev:String(row.rev),register_child:'on'};
 for(const origin of ['', 'https://invalid.example'])assert.equal((await post('/admin/agents',values,ids.supervisor,origin)).status,403);
 assert.equal((await post('/admin/agents',values,ids.finance)).status,403);
 assert.equal((await post('/admin/agents/renew',{agent:a.id},ids.finance)).status,403);
 const other=store.admin.demo();
 assert.equal((await post('/admin/agents',values,other.supervisor)).status,403);
 assert.equal((await post('/admin/agents/renew',{agent:a.id},other.supervisor)).status,404);
 assert.deepEqual(store.registration.agents(ids.supervisor),before);
});

test('agent renewal invalidates the old token and stops after account activation',async t=>{
 const {store,ids,post,get}=await setup(t),data=invitation();
 const firstToken=token(await (await post('/admin/agents/new',data)).text());
 const agent=store.registration.agents(ids.supervisor).find(a=>a.email===data.email);
 const renewed=await post('/admin/agents/renew',{agent:agent.id});
 assert.equal(renewed.status,200);
 const nextToken=token(await renewed.text());
 assert.ok(nextToken&&nextToken!==firstToken);
 assert.throws(()=>store.activate(firstToken,'synthetic-agent-password'),e=>e.status===400);
 store.activate(nextToken,'synthetic-agent-password');
 assert.equal((await post('/admin/agents/renew',{agent:agent.id})).status,409);
 const html=adminRegistrationAgents(store.admin.profile(ids.supervisor),store.registration.agents(ids.supervisor).filter(a=>a.id===agent.id));
 assert.doesNotMatch(html,/action="\/admin\/agents\/renew"/);
 assert.match(html,/تم الإعداد/);
 assert.equal((await get('/admin/registration-agents')).status,200);
});

test('agent names are escaped and seed accounts without email have no renewal action',async t=>{
 const {store,ids}=await setup(t),p=store.admin.profile(ids.supervisor);
 const html=adminRegistrationAgents(p,[{id:'synthetic',name:'<img src=x onerror=alert(1)>',email:null,activated:true,rev:1,register_parent:1,register_child:0,manage_status:0}]);
 assert.doesNotMatch(html,/<img src=x/);
 assert.match(html,/&lt;img/);
 assert.doesNotMatch(html,/action="\/admin\/agents\/renew"/);
 assert.match(html,/name="register_parent" checked/);
 assert.doesNotMatch(html,/name="register_child" checked/);
});
