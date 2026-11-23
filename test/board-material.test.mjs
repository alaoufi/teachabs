import test from 'node:test';
import assert from 'node:assert/strict';
import {attachMaterial,closeMaterial,sendMaterial} from '../board-material.mjs';
import {initialState,switchBookPage} from '../group-session.mjs';
import {validatePlan,defaultPlan} from '../public/group-plan.js';

test('document pages keep separate ink and closing restores the previous book and zoom', () => {
  const plan = validatePlan(defaultPlan()), step = plan.steps.find(s => s.type === 'page').id;
  const book = switchBookPage(initialState(plan),step,'math',6);
  book.strokes[step] = [{id:'book-ink'}]; book.camera[step] = {z:2,x:100,y:24};
  const meta = {id:'demo',step,page:1};
  const first = attachMaterial(book,meta);
  assert.deepEqual(first.strokes[step],[]);
  first.strokes[step].push({id:'slide-ink'});
  const second = attachMaterial(first,{...meta,page:2});
  assert.deepEqual(second.strokes[step],[]);
  assert.deepEqual(attachMaterial(second,meta).strokes[step],[{id:'slide-ink'}]);
  const restored = closeMaterial(second);
  assert.equal(restored.bookActive[step],'math:6');
  assert.deepEqual(restored.strokes[step],book.strokes[step]);
  assert.deepEqual(restored.camera[step],book.camera[step]);
  assert.equal(restored.material,undefined);
});

test('only the active page and valid byte ranges can be fetched', () => {
  const bytes = Buffer.from('0123456789');
  const store = {materialBytes:(_code,start,len) => bytes.subarray(start,start + len)};
  const state = {material:{id:'a',page:2,step:'s',length:10,mime:'video/mp4'}};
  const res = {writeHead(status,headers){ this.status=status; this.headers=headers; },end(data){this.data=data;}};
  const read = (range,url) => sendMaterial({headers:{range}},res,new URL(url,'http://localhost'),store,'ROOM',state,'s');
  read('bytes=-3','/?id=a&page=2');
  assert.equal(res.status,206); assert.equal(res.data.toString(),'789');
  read('bytes=10-','/?id=a&page=2'); assert.equal(res.status,416);
  assert.throws(() => read('bytes=0-1','/?id=a&page=1'),e => e.status === 404);
});
