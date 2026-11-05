import test from 'node:test';
import assert from 'node:assert/strict';
import {experiment,validateExperiment,template} from '../public/classroom-lab-model.js';
import {openStore} from '../store.mjs';
import {createApp} from '../server.mjs';

test('lab import validates geometry and strips executable/unknown fields',()=>{
 const original=experiment([...template('axes'),...template('curve')],'دالة تربيعية','خطوات التجربة');
 assert.deepEqual(validateExperiment(JSON.parse(JSON.stringify(original))),original);
 const data=structuredClone(original);data.shapes[0].onclick='alert(1)';data.token='private';
 assert.deepEqual(validateExperiment(data),original);
 for(const mutate of [d=>d.version=2,d=>d.shapes[0].type='script',d=>d.shapes[0].points=[[NaN,0],[0,1]],d=>d.shapes[0].color='url(https://outside.test)',d=>d.shapes=Array(501).fill(d.shapes[0]),d=>d.notes='x'.repeat(10001)]){
  const broken=structuredClone(original);mutate(broken);assert.throws(()=>validateExperiment(broken));
 }
});
test('lab is discoverable, isolated, same-origin and session-free',async t=>{
 const store=openStore(':memory:'),app=createApp(store);await new Promise(r=>app.listen(0,'127.0.0.1',r));
 t.after(async()=>{app.closeAllConnections();await new Promise(r=>app.close(r));store.close();});
 const base='http://127.0.0.1:'+app.address().port;
 const response=await fetch(base+'/classroom-lab'),html=await response.text();
 assert.equal(response.status,200);assert.equal(response.headers.get('set-cookie'),null);
 assert.match(response.headers.get('content-security-policy'),/connect-src 'none'/);
 assert.match(response.headers.get('permissions-policy'),/microphone=\(\)/);
 for(const part of ['lab-board','lab-journal','lab-import','محاكاة','https://www.learncube.com/','https://demo.bigbluebutton.org'])assert.ok(html.includes(part),part);
 assert.ok(!html.includes('<iframe'));
 assert.match(await (await fetch(base+'/demo')).text(),/href="\/classroom-lab"/);
 for(const asset of ['classroom-lab.js','classroom-lab-model.js','classroom-lab.css'])assert.equal((await fetch(base+'/'+asset)).status,200);
 assert.equal((await fetch(base+'/classroom-lab',{method:'POST',headers:{origin:base},body:new URLSearchParams(),redirect:'manual'})).status,303);
});
