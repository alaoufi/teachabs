import test from 'node:test';
import assert from 'node:assert/strict';
import {aids,aidsForSubject} from '../board-ui/aids.js';
test('subject catalog never falls back to unrelated teaching aids',()=>{
 assert.equal(aidsForSubject('math').length,2);
 assert.deepEqual(aidsForSubject('missing'),[]);
 for(const key of ['math','arabic','science','english','islamic']){
  const rows=aidsForSubject(key);assert.ok(rows.length);
  assert.ok(rows.every(a=>a.subjectKey===key));
 }
 assert.equal(new Set(aids.map(a=>a.id)).size,aids.length);
});
