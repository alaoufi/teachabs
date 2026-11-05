export function attachPlaceBoard(seat,signals,send) {
  const panel=document.getElementById('place-activity');
  if(!panel)return ()=>{};
  const get=id=>document.getElementById(id);
  const num=n=>n.toLocaleString('ar-SA');
  const error=get('pv-error'), setup=get('pv-setup'), grade=get('pv-grade');
  const phases={model:'شرح المعلم',solving:'دور الطالب',submitted:'تم تسليم الحل',graded:'تم اعتماد النتيجة'};
  let state=null,connected=false,busy=false;

  function readTarget(){
    const text=setup.elements.target.value.trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632))
      .replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776));
    if(!/^\d{1,2}$/.test(text))throw new Error('أدخل عددًا صحيحًا من ٠ إلى ٩٩.');
    return Number(text);
  }
  const canMove=()=>state && ((seat==='teacher'&&state.phase==='model')||(seat==='student'&&state.phase==='solving'));
  function render(){
    const enabled=connected&&!busy&&state;
    for(const button of panel.querySelectorAll('button,input,select,textarea'))button.disabled=!enabled;
    if(!state)return;
    get('pv-phase').textContent=phases[state.phase];
    get('pv-target').textContent=num(state.target);
    const prompts={
      model:seat==='teacher'?'اعرض مثالًا بالمكعبات، ثم اضغط «دور الطالب» لتبدأ محاولته من لوحة فارغة.':'تابع مثال المعلم. ستفتح لك القطع عندما يحين دورك.',
      solving:seat==='student'?'دورك الآن. كوّن العدد بالقضبان والمكعبات، ثم سلّم حلك.':'الطالب يحل الآن. تظهر حركاته هنا مباشرة.',
      submitted:seat==='teacher'?'راجع الحل، ثم اعتمد تقييمك أو أعد الدور للطالب.':'وصل حلّك إلى المعلم.',
      graded:seat==='teacher'?'تم حفظ التقييم. تظهر النتيجة لولي الأمر بعد انتهاء موعد الحصة.':'تم اعتماد محاولتك.'};
    get('pv-prompt').textContent=prompts[state.phase];
    if(setup)setup.hidden=state.phase!=='model';
    if(grade)grade.hidden=state.phase!=='submitted';
    const submit=get('pv-submit'), total=state.tens*10+state.ones;
    if(submit){
      submit.hidden=state.phase!=='solving';
      submit.disabled=!enabled || state.ones>=10;
      if(!submit.hidden && state.ones>=10)get('pv-prompt').textContent='اجمع كل ١٠ آحاد في عشرة، ثم سلّم حلّك.';
    }
    if(setup){
      get('pv-observe').hidden=state.phase!=='solving';
      get('pv-equation').textContent=num(state.tens*10)+' + '+num(state.ones)+' = '+num(total);
    }
    get('pv-split').disabled=!enabled||!canMove()||state.tens===0;
    get('pv-bundle').disabled=!enabled||!canMove()||state.ones<10;
    if(get('pv-preview-result'))get('pv-preview-result').hidden=state.phase!=='graded';
    for(const unit of ['tens','ones']){
      const count=state[unit],box=panel.querySelector('[data-blocks="'+unit+'"]');
      panel.querySelector('[data-count="'+unit+'"]').textContent=num(count);
      if(box.childElementCount!==count){
        box.replaceChildren(...Array.from({length:count},()=>{
          const piece=document.createElement('i');piece.className='pv-piece '+unit;return piece;
        }));
      }
      panel.querySelector('[data-add="'+unit+'"]').disabled=!enabled||!canMove()||total+(unit==='tens'?10:1)>99;
      panel.querySelector('[data-sub="'+unit+'"]').disabled=!enabled||!canMove()||count<=0;
    }
    const answer=state.answer;
    const reviewing=answer&&['submitted','graded'].includes(state.phase);
    get('pv-answer').textContent=reviewing?'الحل المسلّم '+num(answer.tens*10+answer.ones)+' · '+
      (answer.tens*10+answer.ones===state.target?'إجابة صحيحة':'الإجابة تحتاج تصحيحًا'):'';
  }
  function accept(next){
    if(state && next.rev<state.rev)return;
    if(setup && (!state||next.target!==state.target))setup.elements.target.value=num(next.target);
    state=next;render();
  }
  async function act(change){
    if(!connected||!state||busy)return;
    busy=true;error.textContent='';render();
    try{accept(await send('place',{...change,rev:state.rev}));}
    catch(err){error.textContent=err.message;}
    finally{busy=false;render();}
  }
  if(setup){
    function setNumber(op){
      try{void act({op,value:readTarget()});}catch(err){error.textContent=err.message;}
    }
    setup.addEventListener('submit',ev=>{ev.preventDefault();setNumber('target');});
    get('pv-turn').addEventListener('click',()=>setNumber('turn'));
    get('pv-retry').addEventListener('click',()=>act({op:'retry'}));
    grade.addEventListener('submit',ev=>{
      ev.preventDefault();act({op:'grade',rating:grade.elements.rating.value,note:grade.elements.note.value});
    });
  }else{get('pv-submit').addEventListener('click',()=>act({op:'submit'}));}

  get('pv-split').addEventListener('click',()=>act({op:'split'}));
  get('pv-bundle').addEventListener('click',()=>act({op:'bundle'}));
  for(const tray of panel.querySelectorAll('[data-tray]')){
    const unit=tray.dataset.tray,add=panel.querySelector('[data-add="'+unit+'"]'),remove=tray.querySelector('[data-sub]');
    const move=delta=>act({op:'move',unit,delta});
    add.addEventListener('click',()=>move(1));remove.addEventListener('click',()=>move(-1));
    add.addEventListener('dragstart',ev=>{if(add.disabled){ev.preventDefault();return;}ev.dataTransfer.setData('application/x-khatwa-place',unit);});
    tray.addEventListener('dragover',ev=>{if(!add.disabled && ev.dataTransfer.types.includes('application/x-khatwa-place'))ev.preventDefault();});
    tray.addEventListener('drop',ev=>{
      ev.preventDefault();
      if(!add.disabled && ev.dataTransfer.getData('application/x-khatwa-place')===unit)move(1);
    });
  }
  signals.addEventListener('open',()=>{state=null;render();});
  signals.addEventListener('place',ev=>accept(JSON.parse(ev.data)));
  return ready=>{connected=ready;render();};
}
