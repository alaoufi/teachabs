import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from '../store.mjs';
test('individual teacher links expose an explicit opt-in permission and no candidates until grade selection',t=>{const s=openStore(':memory:');t.after(()=>s.close());const a=s.admin,ids=a.demo();assert.equal(typeof a.schoolTeacherStudents,'function');assert.ok(a.profile(ids.supervisor).permissions.includes('school.individuals'));assert.deepEqual(a.schoolTeacherStudents(ids.supervisor,{}).students,[]);assert.equal(typeof a.assignSchoolTeacherStudents,'function');assert.equal(typeof a.removeSchoolTeacherStudent,'function');});
