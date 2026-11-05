import React,{useEffect,useState} from 'react';
export function ClassTimer({timer,serverNow,teacher,enabled,command}){
 const [minutes,setMinutes]=useState(5),[clock,setClock]=useState(Date.now());
 const [anchor,setAnchor]=useState({server:serverNow||Date.now(),local:Date.now()});
 useEffect(()=>{if(serverNow)setAnchor({server:serverNow,local:Date.now()});},[serverNow]);
 useEffect(()=>{const id=setInterval(()=>setClock(Date.now()),250);return()=>clearInterval(id);},[]);
 const now=anchor.server+clock-anchor.local,seconds=Math.ceil(Math.max(0,timer?.running?timer.endsAt-now:timer?.remainingMs||0)/1000);
 const display=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
 return <section className="board-bar" aria-label="مؤقت الحصة"><strong>مؤقت الحصة</strong><output role="timer" aria-live="off" dir="ltr" aria-label="الوقت المتبقي">{display}</output><span>{!timer?'لم يبدأ':seconds===0?'انتهى الوقت':timer.running?'جارٍ':'متوقف مؤقتًا'}</span>
 {teacher&&<><label>دقائق <input type="number" min="1" max="60" value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/></label><button disabled={!enabled||!Number.isInteger(minutes)||minutes<1||minutes>60} onClick={()=>command('timer-start',{seconds:minutes*60})}>بدء مؤقت جديد</button><button disabled={!enabled||!timer||!seconds} onClick={()=>command(timer.running?'timer-pause':'timer-resume')}>{timer?.running?'إيقاف المؤقت مؤقتًا':'متابعة المؤقت'}</button><button disabled={!enabled||!timer} onClick={()=>command('timer-reset')}>إلغاء المؤقت</button></>}
 <small>تنبيه بصري للحصة؛ لا ينهي الحصة ولا يمسح العمل.</small></section>;
}
