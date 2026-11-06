import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {openStore} from '../store.mjs';
import {adminHome} from '../admin-views.mjs';
import {createApp} from '../server.mjs';
const css=readFileSync(new URL('../public/admin.css',import.meta.url),'utf8');
test('demo summary reflows above 360px and does not force the switch hint into a nowrap overflow',()=>{
 const base=css.slice(css.indexOf('/* Administration 012:'),css.indexOf('@media(max-width:1100px)',css.indexOf('/* Administration 012:')));
 assert.match(base,/\.adm \.adm-simulation>summary\{[^}]*flex-wrap:wrap/);
 assert.match(base,/\.adm \.adm-simulation>summary small\{[^}]*white-space:normal/);
 assert.match(base,/\.adm \.adm-simulation>summary span\{[^}]*overflow-wrap:break-word/);
 assert.doesNotMatch(base,/\.adm \.adm-simulation>summary[^}]*overflow(?:-x)?:hidden|text-overflow:ellipsis/);
});
test('demo banner retains native disclosure, role options and existing protected switch action',async t=>{
 const store=openStore(':memory:'),a=store.admin,ids=a.demo(),app=createApp(store);await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));t.after(async()=>{app.closeAllConnections();await new Promise(resolve=>app.close(resolve));store.close();});
 const p=a.profile(ids.supervisor),html=adminHome(p,a.overview(ids.supervisor)),banner=html.match(/<details class="adm-simulation">([\s\S]*?)<\/details>/)?.[1];assert.ok(banner);
 assert.match(banner,/<summary><strong>تجربة مؤقتة<\/strong>/);assert.match(banner,/<small>تبديل الدور ⌄<\/small>/);assert.match(banner,/method="post" action="\/admin\/demo\/switch"/);assert.match(banner,/<select name="adminRole"/);assert.match(banner,/value="finance"/);assert.match(banner,/value="registration_agent"/);
 const base='http://127.0.0.1:'+app.address().port,post=origin=>fetch(base+'/admin/demo/switch',{method:'POST',headers:{origin,cookie:'ks='+store.session(ids.supervisor)},body:new URLSearchParams({adminRole:'finance'}),redirect:'manual'});
 assert.equal((await post('https://invalid.example')).status,403);const r=await post(base);assert.equal(r.status,303);assert.match(r.headers.get('set-cookie'),/ks=/);
 assert.doesNotMatch(adminHome({...p,scope:null},a.overview(ids.supervisor)),/class="adm-simulation"/);
});
