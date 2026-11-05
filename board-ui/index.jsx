import {allowedLessons} from '../lesson-catalog.mjs';
import React,{useState,useRef} from 'react';
import{MathPanel}from'./MathPanel.jsx';
import{createRoot}from'react-dom/client';
import{Excalidraw,MainMenu,convertToExcalidrawElements,exportToBlob}from'@excalidraw/excalidraw';
import'@excalidraw/excalidraw/index.css';
import{fitDimensions,wrapAidText}from'./fit.js';
import{aids,aidsForSubject}from'./aids.js';
import'./board.css';

export function attachProfessionalBoard(seat,signals,send,client,lessonSubject,grade){
 const choices=allowedLessons({preview:lessonSubject==='preview',subject:lessonSubject,grade});
 const available=lessonSubject==='preview'?aids:aidsForSubject(lessonSubject);
 let resolveInitial,initialized=false;
 const initialData=new Promise(resolve=>{resolveInitial=resolve;});
 let view='shared';
 const editable=()=>seat==='teacher'?view==='shared':view==='draft'&&remote?.studentDraw;
 const viewed=s=>view==='draft'?(s.studentDraft||{elements:[],files:{}}):view==='published'?(s.publishedStudent||{elements:[],files:{}}):s;
 let api,remote,ready=false,applying=false,saving=false,latest=null,timer,conflict=false;
 let notify=()=>{},refresh=()=>{};
 const nextPosition=()=>({x:80,y:Math.max(40,...api.getSceneElements().filter(e=>!e.isDeleted).map(e=>e.y+e.height))+40});
 const focus=elements=>requestAnimationFrame(()=>api.scrollToContent(elements,{fitToViewport:true,viewportZoomFactor:0.8,animate:false}));
 const relevantFiles=(elements,files)=>Object.fromEntries(elements.filter(e=>e.type==='image'&&!e.isDeleted&&files[e.fileId]).map(e=>[e.fileId,files[e.fileId]]));
 const scene=()=>{const elements=api.getSceneElementsIncludingDeleted();return {elements,files:relevantFiles(elements,api.getFiles())};};
 const signature=s=>JSON.stringify({elements:s.elements,files:s.files});
 let baseline='';
 const mode=()=>api?.updateScene({appState:{viewModeEnabled:!ready||conflict||!editable()}});
 function apply(s){
  if(!api)return;applying=true;remote=s;
  const current=viewed(s);api.addFiles(Object.values(current.files));api.updateScene({elements:current.elements,appState:{viewModeEnabled:!ready||!editable()}});
  baseline=signature(scene());applying=false;refresh(s);
 }
 async function save(){
  if(!latest||saving||!ready||conflict)return;
  const snapshot=latest; saving=true;notify('جارٍ حفظ السبورة…');
  try{
   const next=await send('board',{rev:remote.rev,...snapshot});
   remote=next;baseline=signature(snapshot);
   if(latest===snapshot)latest=null;
   notify('تم التزامن • الحفظ على الخادم مؤقت');refresh(next);
  }catch(e){conflict=true;notify(e.message+' صدّر نسخة محلية ثم حمّل آخر حفظ.');mode();}
  finally{saving=false;if(latest&&!conflict)save();}
 }
 function changed(elements,appState,files){
  files=relevantFiles(elements,files);
  if(!api||applying||!remote||appState.isLoading)return;
  if(!initialized){initialized=true;baseline=signature({elements,files});return;}
  const next={elements,files,lessonId:remote.activeLesson,op:view==='draft'?'draft':'scene'};if(signature(next)===baseline)return;
  if(!editable())return;
  latest=next;clearTimeout(timer);timer=setTimeout(save,400);
 }
 signals.addEventListener('boardstate',event=>{
  const {state,sender}=JSON.parse(event.data);
  resolveInitial({elements:state.elements,files:state.files,appState:{currentItemFontFamily:2}});
  ready=true;
  if(sender===client){remote=state;return;}
  if(latest&&state.rev!==remote?.rev){remote=state;conflict=true;notify('تغيّرت السبورة أثناء عمل غير محفوظ. صدّر عملك ثم حمّل آخر حفظ.');mode();return;}
  if(state.rev===remote?.rev&&latest){mode();save();return;}
  remote=state;apply(state);notify('متصل • الحفظ مؤقت؛ احتفظ بتصدير محلي');
 });
 signals.addEventListener('error',()=>{ready=false;notify('انقطع الاتصال. لا تُغلق الصفحة إذا لديك عمل غير محفوظ.');mode();});
 signals.addEventListener('closed',()=>{ready=false;notify('انتهى إذن الحصة.');mode();});
 function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
 function App(){
  const [status,setStatus]=useState('جارٍ فتح السبورة…'),[state,setState]=useState(null),[subject,setSubject]=useState(available[0]?.subject||'');
  const [viewState,setViewState]=useState('shared');
  const selectView=value=>{if(latest||saving){notify('انتظر حفظ العمل أو صدّره قبل تغيير العرض.');return;}view=value;setViewState(value);apply(remote);};
  const moderate=async op=>{try{const next=await send('board',{op,rev:remote.rev,lessonId:remote.activeLesson});apply(next);notify(op==='publish'?'نُشرت نسخة المشاركة المعتمدة.':'حُجبت المشاركة المعتمدة.');}catch(e){notify(e.message);}};
  const input=useRef();notify=setStatus;refresh=setState;
  const selectedLesson=choices.find(l=>l.id===state?.activeLesson);
  const changeLesson=async id=>{if(!id||latest||saving||conflict)return;try{const s=await send('board',{op:'lesson',rev:remote.rev,lessonId:id});apply(s);focus(s.elements);}catch(e){notify(e.message);}};
  const addAid=a=>{if(!ready||conflict||!api||!editable())return;const elements=convertToExcalidrawElements([{type:'text',...nextPosition(),text:wrapAidText(a.title+'\n'+a.text+'\n'+a.explanation),fontSize:24,fontFamily:2}]);api.updateScene({elements:[...api.getSceneElements(),...elements]});focus(elements);};
  const toggle=async()=>{try{const s=await send('board',{op:'permission',rev:remote.rev,allow:!remote.studentDraw});remote=s;apply(s);}catch(e){notify(e.message);}};
  return <div className="teaching-board" dir="rtl">
   <div className="board-bar"><label>مساحة العمل <select aria-label="مساحة العمل" value={viewState} disabled={!ready||saving||!!latest||conflict} onChange={e=>selectView(e.target.value)}><option value="shared">سبورة المعلم المشتركة</option><option value="draft">مسودة الطالب الخاصة بالطالب والمعلم</option><option value="published">مشاركة الطالب المعتمدة</option></select></label>{seat==='teacher'&&<><button disabled={!ready||saving||!!latest||conflict||!state?.studentDraft} onClick={()=>moderate('publish')}>نشر نسخة من مسودة الطالب</button><button disabled={!ready||saving||!!latest||conflict||!state?.publishedStudent} onClick={()=>moderate('hide')}>حجب المشاركة المعتمدة</button></>}<button onClick={()=>api&&focus(api.getSceneElements())}>إظهار السبورة كاملة</button><strong>سبورة الشرح</strong><span role="status" id="board-status">{status}</span>
    <button onClick={()=>download(JSON.stringify({format:'khatwa-board',version:1,engine:'excalidraw',...scene()}),'lesson-board.json','application/json')}>تصدير قابل للاستعادة</button>
    <button onClick={async()=>{try{const s=scene();const blob=await exportToBlob({...s,appState:{exportBackground:true},mimeType:'image/png'});download(blob,'lesson-board.png','image/png');}catch(e){notify('تعذّر تصدير الصورة؛ استخدم ملف الاستعادة.');}}}>صورة PNG</button>
    <button onClick={()=>{if(latest&&!window.confirm('قد تفقد العمل غير المحفوظ. هل صدّرت نسخة وتريد تحميل آخر حفظ؟'))return;location.reload();}}>تحميل آخر حفظ</button>
    {seat==='teacher'&&<><button disabled={!ready||saving||!!latest} onClick={toggle}>{state?.studentDraw?'إيقاف تحرير الطالب':'السماح للطالب بالتحرير'}</button><button disabled={!editable()} onClick={()=>input.current.click()}>استعادة ملف</button></>}
    <input ref={input} type="file" accept=".json,.excalidraw" hidden onChange={async e=>{try{const f=e.target.files[0];if(f.size>2000000)throw Error();const s=JSON.parse(await f.text());if(!Array.isArray(s.elements)||s.elements.length>1000||s.elements.some(x=>!['rectangle','diamond','ellipse','arrow','line','freedraw','text','image'].includes(x.type)))throw Error();for(const f of Object.values(s.files||{})){if(typeof f.dataURL!=='string'||f.dataURL.length>700000||!/^data:image\/(png|jpeg|webp);base64,/.test(f.dataURL))throw Error();}s.elements=s.elements.map(x=>({...x,link:null}));api.addFiles(Object.values(s.files||{}));api.updateScene({elements:s.elements});}catch{notify('ملف غير صالح أو أكبر من الحد.');}e.target.value='';}}/>
   </div>
   <details className="aid-library"><summary>مكتبة وسائل الشرح — نماذج أولية وليست جميع التخصصات</summary>
    <p>المحتوى تجريبي؛ توزيع الصفوف هنا لا يمثل اعتمادًا لمنهج رسمي.</p>
    {seat==='teacher'?<label>الدرس <select aria-label="الدرس" value={state?.activeLesson||''} disabled={!ready||saving||!!latest||conflict} onChange={e=>changeLesson(e.target.value)}><option value="">اختر درسًا</option>{choices.map(l=><option key={l.id} value={l.id}>{l.subject} · الصف {l.grade} · {l.title}</option>)}</select></label>:<p>الدرس: {selectedLesson?.title||'ينتظر اختيار المعلم'}</p>}
    {!selectedLesson&&<p>يختار المعلم الدرس قبل عرض الوسائل.</p>}
    {selectedLesson&&!selectedLesson.aidIds.length&&<p>لا توجد وسائل جاهزة لهذا الدرس بعد؛ تتوفر السبورة الحرة.</p>}
    {available.filter(a=>selectedLesson?.aidIds.includes(a.id)).map(a=><button key={a.id} disabled={!ready||conflict||!editable()} onClick={()=>addAid(a)}>{a.title} +</button>)}
    <p>محتوى أصلي للمشروع. يضاف إلى السبورة ويتزامن للطرفين؛ يمكن تعديله. صورك تُخزن على خدمة التجربة؛ استخدم مواد وهمية فقط.</p>
   </details>
   {selectedLesson?.subject==='math'&&<MathPanel enabled={ready&&!conflict&&editable()} notify={notify} insert={(dataURL,width,height)=>{const id=crypto.randomUUID();api.addFiles([{id,dataURL,mimeType:'image/png',created:Date.now()}]);api.updateScene({elements:[...api.getSceneElements(),...convertToExcalidrawElements([{type:'image',...nextPosition(),...fitDimensions(width,height),fileId:id,status:'saved'}])]});focus(api.getSceneElements().slice(-1));}}/>}
   <div className="engine"><Excalidraw excalidrawAPI={value=>{api=value;if(remote)apply(remote);}}
    onChange={changed} langCode="ar-SA" viewModeEnabled={!ready||conflict||!state||!editable()} initialData={initialData}
    UIOptions={{canvasActions:{loadScene:false,saveToActiveFile:false,export:false,toggleTheme:false},tools:{image:true}}}
    onLinkOpen={(element,event)=>event.preventDefault()} validateEmbeddable={()=>false}>
     <MainMenu><MainMenu.Item onSelect={()=>download(JSON.stringify({format:'khatwa-board',version:1,...scene()}),'lesson-board.json','application/json')}>تصدير ملف السبورة</MainMenu.Item></MainMenu>
    </Excalidraw></div>
   <p className="board-note">المعلم يمنح الطالب تحرير السبورة المشتركة كاملة. عند تعارض متزامن لا نكتب فوق عملك: صدّره ثم حمّل آخر حفظ. SQLite على الاستضافة المجانية مؤقت؛ التصدير المحلي مهم.</p>
  </div>;
 }
 createRoot(document.getElementById('board-pro')).render(<App/>);
}
