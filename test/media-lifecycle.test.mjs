import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('background stops active media and rejects a late permission result',async()=>{
  const listeners={},nodes=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{seat:'teacher'},setAttribute(){},addEventListener(){},play(){return Promise.resolve();}});return nodes.get(id);};
  let resolveMedia;
  const document={hidden:false,getElementById:node,addEventListener:(name,fn)=>listeners[name]=fn};
  const context={document,window:{addEventListener(){}},crypto:{randomUUID:()=> 'test-client'},location:{pathname:'/lesson/preview',search:''},URLSearchParams,EventSource:class{},MediaStream:class{},navigator:{mediaDevices:{getUserMedia:()=>new Promise(r=>resolveMedia=r)}},attachProfessionalBoard:()=>{},attachPlaceBoard:()=>()=>{}};
  const source=readFileSync(new URL('../public/lesson-client.js',import.meta.url),'utf8').replace(/^import .*\r?\n/gm,'').split('function newPeer')[0];
  runInNewContext(source+'\npresent=true;globalThis.api={toggle,tracks};',context);
  let stopped=0;
  const first=context.api.toggle('audio');resolveMedia({getTracks:()=>[{stop(){stopped++;}}]});await first;
  assert.ok(context.api.tracks.audio);
  assert.equal(typeof listeners['khatwa-pause'],'function');
  listeners['khatwa-pause']();
  assert.equal(stopped,1);assert.equal(context.api.tracks.audio,null);
  const late=context.api.toggle('video');listeners['khatwa-pause']();
  resolveMedia({getTracks:()=>[{stop(){stopped++;}}]});await late;
  assert.equal(stopped,2);assert.equal(context.api.tracks.video,null);
  const hidden=context.api.toggle('audio');document.hidden=true;listeners.visibilitychange();
  resolveMedia({getTracks:()=>[{stop(){stopped++;}}]});await hidden;
  assert.equal(stopped,3);assert.equal(context.api.tracks.audio,null);
});
