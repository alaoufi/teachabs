import {UserError} from './store.mjs';
export function changeClassTimer(timer,seat,command,now=Date.now()){
 const need=(ok,message,status=400)=>{if(!ok)throw new UserError(message,status);};
 need(seat==='teacher','Only the teacher controls the class timer',403);
 if(command.op==='timer-reset')return null;
 if(command.op==='timer-start'){
  need(Number.isInteger(command.seconds)&&command.seconds>=1&&command.seconds<=3600,'Timer duration must be 1–3600 seconds');
  return {running:true,remainingMs:command.seconds*1000,endsAt:now+command.seconds*1000};
 }
 need(timer,'No timer has been started');
 if(command.op==='timer-pause')return {running:false,remainingMs:timer.running?Math.max(0,timer.endsAt-now):timer.remainingMs,endsAt:null};
 need(command.op==='timer-resume'&&!timer.running&&timer.remainingMs>0,'Timer cannot resume');
 return {...timer,running:true,endsAt:now+timer.remainingMs};
}
