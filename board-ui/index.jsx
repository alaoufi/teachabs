import React,{useState,useRef} from 'react';
import{MathPanel}from'./MathPanel.jsx';
import{createRoot}from'react-dom/client';
import{Excalidraw,MainMenu,convertToExcalidrawElements,exportToBlob}from'@excalidraw/excalidraw';
import'@excalidraw/excalidraw/index.css';
import{aids,aidsForSubject}from'./aids.js';
import'./board.css';

export function attachProfessionalBoard(seat,signals,send,client,lessonSubject){
 const available=lessonSubject==='preview'?aids:aidsForSubject(lessonSubject);
 let resolveInitial,initialized=false;
 const initialData=new Promise(resolve=>{resolveInitial=resolve;});
 let api,remote,ready=false,applying=false,saving=false,latest=null,timer,conflict=false;
 let notify=()=>{},refresh=()=>{};
 const nextPosition=()=>({x:80,y:Math.max(40,...api.getSceneElements().filter(e=>!e.isDeleted).map(e=>e.y+e.height))+40});
 const scene=()=>({elements:api.getSceneElementsIncludingDeleted(),files:api.getFiles()});
 const signature=s=>JSON.stringify({elements:s.elements,files:s.files});
 let baseline='';
 const mode=()=>api?.updateScene({appState:{viewModeEnabled:!ready||conflict||(seat!=='teacher'&&!remote?.studentDraw)}});
 function apply(s){
  if(!api)return;applying=true;remote=s;
  api.addFiles(Object.values(s.files));api.updateScene({elements:s.elements,appState:{viewModeEnabled:!ready||(seat!=='teacher'&&!s.studentDraw)}});
  baseline=signature(scene());applying=false;refresh(s);
 }
 async function save(){
  if(!latest||saving||!ready||conflict)return;
  const snapshot=latest; saving=true;notify('جارٍ حفظ السبورة…');
  try{
   const next=await send('board',{op:'scene',rev:remote.rev,...snapshot});
   remote=next;baseline=signature(snapshot);
   if(latest===snapshot)latest=null;
   notify('تم التزامن • الحفظ على الخادم مؤقت');refresh(next);
  }catch(e){conflict=true;notify(e.message+' صدّر نسخة محلية ثم حمّل آخر حفظ.');mode();}
  finally{saving=false;if(latest&&!conflict)save();}
 }
 function changed(elements,appState,files){
  if(!api||applying||!remote||appState.isLoading)return;
  if(!initialized){initialized=true;baseline=signature({elements,files});return;}
  const next={elements,files};if(signature(next)===baseline)return;
  if(seat!=='teacher'&&!remote.studentDraw)return;
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
  const input=useRef();notify=setStatus;refresh=setState;
  const addAid=a=>{if(!ready||conflict||!api)return;const elements=convertToExcalidrawElements([{type:'text',...nextPosition(),text:a.title+'\n'+a.text+'\n'+a.explanation,fontSize:24,fontFamily:2}]);api.updateScene({elements:[...api.getSceneElements(),...elements]});};
  const toggle=async()=>{try{const s=await send('board',{op:'permission',rev:remote.rev,allow:!remote.studentDraw});remote=s;apply(s);}catch(e){notify(e.message);}};
  return <div className="teaching-board" dir="rtl">
   <div className="board-bar"><strong>سبورة الشرح</strong><span role="status" id="board-status">{status}</span>
    <button onClick={()=>download(JSON.stringify({format:'khatwa-board',version:1,engine:'excalidraw',...scene()}),'lesson-board.json','application/json')}>تصدير قابل للاستعادة</button>
    <button onClick={async()=>{try{const s=scene();const blob=await exportToBlob({...s,appState:{exportBackground:true},mimeType:'image/png'});download(blob,'lesson-board.png','image/png');}catch(e){notify('تعذّر تصدير الصورة؛ استخدم ملف الاستعادة.');}}}>صورة PNG</button>
    <button onClick={()=>{if(latest&&!window.confirm('قد تفقد العمل غير المحفوظ. هل صدّرت نسخة وتريد تحميل آخر حفظ؟'))return;location.reload();}}>تحميل آخر حفظ</button>
    {seat==='teacher'&&<><button disabled={!ready||saving||!!latest} onClick={toggle}>{state?.studentDraw?'إيقاف تحرير الطالب':'السماح للطالب بالتحرير'}</button><button onClick={()=>input.current.click()}>استعادة ملف</button></>}
    <input ref={input} type="file" accept=".json,.excalidraw" hidden onChange={async e=>{try{const f=e.target.files[0];if(f.size>2000000)throw Error();const s=JSON.parse(await f.text());if(!Array.isArray(s.elements)||s.elements.length>1000||s.elements.some(x=>!['rectangle','diamond','ellipse','arrow','line','freedraw','text','image'].includes(x.type)))throw Error();for(const f of Object.values(s.files||{})){if(typeof f.dataURL!=='string'||f.dataURL.length>700000||!/^data:image\/(png|jpeg|webp);base64,/.test(f.dataURL))throw Error();}s.elements=s.elements.map(x=>({...x,link:null}));api.addFiles(Object.values(s.files||{}));api.updateScene({elements:s.elements});}catch{notify('ملف غير صالح أو أكبر من الحد.');}e.target.value='';}}/>
   </div>
   <details className="aid-library"><summary>مكتبة وسائل الشرح — نماذج أولية وليست جميع التخصصات</summary>
    {!available.length&&<p>لا تتوفر وسائل مراجعة لهذا التخصص بعد.</p>}<label>التخصص <select disabled={lessonSubject!=='preview'} value={subject} onChange={e=>setSubject(e.target.value)}>{[...new Set(available.map(a=>a.subject))].map(s=><option key={s}>{s}</option>)}</select></label>
    {available.filter(a=>a.subject===subject).map(a=><button key={a.id} disabled={!ready||conflict||(seat!=='teacher'&&!state?.studentDraw)} onClick={()=>addAid(a)}>{a.title} +</button>)}
    <p>محتوى أصلي للمشروع. يضاف إلى السبورة ويتزامن للطرفين؛ يمكن تعديله. صورك تُخزن على خدمة التجربة؛ استخدم مواد وهمية فقط.</p>
   </details>
   <MathPanel enabled={ready&&!conflict&&(seat==='teacher'||state?.studentDraw)} notify={notify} insert={(dataURL,width,height)=>{const id=crypto.randomUUID();api.addFiles([{id,dataURL,mimeType:'image/png',created:Date.now()}]);api.updateScene({elements:[...api.getSceneElements(),...convertToExcalidrawElements([{type:'image',...nextPosition(),width,height,fileId:id,status:'saved'}])]});}}/>
   <div className="engine"><Excalidraw excalidrawAPI={value=>{api=value;if(remote)apply(remote);}}
    onChange={changed} langCode="ar-SA" viewModeEnabled={!ready||conflict||!state||(seat!=='teacher'&&!state.studentDraw)} initialData={initialData}
    UIOptions={{canvasActions:{loadScene:false,saveToActiveFile:false,export:false,toggleTheme:false},tools:{image:true}}}
    onLinkOpen={(element,event)=>event.preventDefault()} validateEmbeddable={()=>false}>
     <MainMenu><MainMenu.Item onSelect={()=>download(JSON.stringify({format:'khatwa-board',version:1,...scene()}),'lesson-board.json','application/json')}>تصدير ملف السبورة</MainMenu.Item></MainMenu>
    </Excalidraw></div>
   <p className="board-note">المعلم يمنح الطالب تحرير السبورة المشتركة كاملة. عند تعارض متزامن لا نكتب فوق عملك: صدّره ثم حمّل آخر حفظ. SQLite على الاستضافة المجانية مؤقت؛ التصدير المحلي مهم.</p>
  </div>;
 }
 createRoot(document.getElementById('board-pro')).render(<App/>);
}
