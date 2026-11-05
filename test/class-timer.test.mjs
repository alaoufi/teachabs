import test from 'node:test';import assert from 'node:assert/strict';import {changeClassTimer} from '../class-timer.mjs';import {changeBoard,emptyBoard} from '../board.mjs';import {openStore} from '../store.mjs';import {mkdtempSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
test('teacher timer bounds, pause/resume, expiry and student denial',()=>{
 let timer=changeClassTimer(null,'teacher',{op:'timer-start',seconds:60},1000);assert.equal(timer.endsAt,61000);
 assert.throws(()=>changeClassTimer(timer,'student',{op:'timer-reset'},2000),e=>e.status===403);
 for(const seconds of [0,3601,1.5,NaN])assert.throws(()=>changeClassTimer(null,'teacher',{op:'timer-start',seconds}));
 timer=changeClassTimer(timer,'teacher',{op:'timer-pause'},11000);assert.equal(timer.remainingMs,50000);timer=changeClassTimer(timer,'teacher',{op:'timer-resume'},21000);assert.equal(timer.endsAt,71000);
 timer=changeClassTimer(timer,'teacher',{op:'timer-pause'},81000);assert.equal(timer.remainingMs,0);assert.throws(()=>changeClassTimer(timer,'teacher',{op:'timer-resume'},82000));assert.equal(changeClassTimer(timer,'teacher',{op:'timer-reset'}),null);
});
test('timer is revision checked and persists without changing drawings',()=>{
 const file=join(mkdtempSync(join(tmpdir(),'timer-synthetic-')),'test.sqlite');let s=openStore(file);try{let board=s.changeSavedBoard('synthetic-timer',current=>changeBoard(current,'teacher',{op:'timer-start',seconds:60,rev:0}));const endsAt=board.classTimer.endsAt;assert.deepEqual(board.elements,[]);assert.throws(()=>changeBoard(board,'teacher',{op:'timer-reset',rev:0}),e=>e.status===409);s.close();s=openStore(file);assert.equal(s.readBoard('synthetic-timer').classTimer.endsAt,endsAt);assert.throws(()=>changeBoard(s.readBoard('synthetic-timer'),'student',{op:'timer-pause',rev:1}),e=>e.status===403);}finally{s.close();}
});
