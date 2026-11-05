import {libraryElements} from './library-elements.js';
import {rulerElements,transformRuler} from './ruler.js';
import {protractorElements,protractorReading,setProtractorAngle} from './protractor.js';
import {ClassTimer} from './ClassTimer.jsx';
import {allowedLessons} from '../lesson-catalog.mjs';
import React,{useState,useRef,useEffect} from 'react';
import {selectionState,selectedElements,transformSelection} from './selection.js';
import {createPreparation,canPublishPreparation,outgoingScene} from './preparation.js';

import{createRoot}from'react-dom/client';
import{Excalidraw,MainMenu,CaptureUpdateAction,convertToExcalidrawElements,exportToBlob}from'@excalidraw/excalidraw';
import'@excalidraw/excalidraw/index.css';
import{fitDimensions,wrapAidText}from'./fit.js';

import'./board.css';

export function attachProfessionalBoard(seat,signals,send,client,lessonSubject,grade){
 const choices=allowedLessons({preview:lessonSubject==='preview',subject:lessonSubject,grade});

 let resolveInitial,initialized=false;
 const initialData=new Promise(resolve=>{resolveInitial=resolve;});
 let view='shared';
 const editable=()=>seat==='teacher'?view==='shared':view==='draft'&&remote?.studentDraw;
 const viewed=s=>view==='draft'?(s.studentDraft||{elements:[],files:{}}):view==='published'?(s.publishedStudent||{elements:[],files:{}}):s;
 let api,remote,ready=false,applying=false,saving=false,latest=null,timer,conflict=false;
 let notify=()=>{},refresh=()=>{},openExit=()=>{},refreshSelection=()=>{},refreshToolReading=()=>{};
 let preparation=null;
 if(seat==='teacher')document.getElementById('leave').addEventListener('click',e=>{e.preventDefault();openExit();});
 const nextPosition=()=>({x:80,y:Math.max(40,...api.getSceneElements().filter(e=>!e.isDeleted).map(e=>e.y+e.height))+40});
 const focus=elements=>requestAnimationFrame(()=>api.scrollToContent(elements,{fitToViewport:true,viewportZoomFactor:0.8,animate:false}));
 const relevantFiles=(elements,files)=>Object.fromEntries(elements.filter(e=>e.type==='image'&&!e.isDeleted&&files[e.fileId]).map(e=>[e.fileId,files[e.fileId]]));
 const scene=()=>{const elements=api.getSceneElementsIncludingDeleted();return {elements,files:relevantFiles(elements,api.getFiles())};};
 const signature=s=>JSON.stringify({elements:s.elements,files:s.files});
 let baseline='';
 const mode=()=>api?.updateScene({appState:{viewModeEnabled:!ready||conflict||!editable()}});
 function apply(s,{resetHistory=false}={}){
  // Replies to permission/timer/lesson commands can arrive after preparation
  // starts. Update server metadata, never replace a private canvas with them.
  if(!s||(remote&&s.rev<remote.rev))return false;
  remote=s;
  if(preparation){refresh(s);mode();return false;}
  if(!api)return false;
  applying=true;
  const current=viewed(s),previous=api.getAppState();
  // A history-stack clear alone leaves private elements in Store.snapshot.
  // Reset both Store and History before restoring so even deleted tombstones
  // cannot reappear through a later Undo/Redo or enter an outgoing snapshot.
  if(resetHistory)api.resetScene({resetLoadingState:true});
  api.addFiles(Object.values(current.files));api.updateScene({elements:current.elements,appState:{...(resetHistory?{scrollX:previous.scrollX,scrollY:previous.scrollY,zoom:previous.zoom,currentItemFontFamily:2,selectedElementIds:{},selectedGroupIds:{},editingGroupId:null}:{}),viewModeEnabled:!ready||conflict||!editable()},captureUpdate:CaptureUpdateAction.NEVER});
  baseline=signature(scene());initialized=true;applying=false;refresh(s);return true;
 }
 async function save(){
  if(!latest||saving||!ready||conflict)return;
  const snapshot=latest; saving=true;notify('جارٍ حفظ السبورة…');
  try{
   const next=await send('board',{rev:remote.rev,...snapshot});
   if(!remote||next.rev>=remote.rev)remote=next;baseline=signature(snapshot);
   if(latest===snapshot)latest=null;
   notify('تم التزامن • الحفظ على الخادم مؤقت');refresh(remote);
  }catch(e){conflict=true;notify(e.message+' صدّر نسخة محلية ثم حمّل آخر حفظ.');mode();}
  finally{saving=false;if(latest&&!conflict)save();}
 }
 function changed(elements,appState,files){
  refreshSelection(selectedElements(elements,appState.selectedElementIds).length);refreshToolReading(elements);
  files=relevantFiles(elements,files);
  if(!api||applying||!remote||appState.isLoading)return;
  if(!initialized){initialized=true;baseline=signature({elements,files});return;}
  const next=outgoingScene({preparation,elements,files,lessonId:remote.activeLesson,view});if(!next||signature(next)===baseline)return;
  if(!editable())return;
  latest=next;clearTimeout(timer);timer=setTimeout(save,400);
 }
 signals.addEventListener('boardstate',event=>{
  const {state,sender}=JSON.parse(event.data);
  if(remote&&state.rev<remote.rev)return;
  resolveInitial({elements:state.elements,files:state.files,appState:{currentItemFontFamily:2}});
  ready=true;
  if(sender===client){remote=state;return;}
  if(preparation){remote=state;refresh(state);mode();notify(canPublishPreparation(preparation,state)?'تجهيز خاص: لم يُرسل للطالب بعد.':'تغيّرت السبورة أثناء التجهيز. صدّر المعاينة أو ألغها؛ الإرسال موقوف لحماية العمل.');return;}
  if(latest&&state.rev!==remote?.rev){remote=state;conflict=true;notify('تغيّرت السبورة أثناء عمل غير محفوظ. صدّر عملك ثم حمّل آخر حفظ.');mode();return;}
  if(state.rev===remote?.rev&&latest){mode();save();return;}
  remote=state;apply(state);notify('متصل • الحفظ مؤقت؛ احتفظ بتصدير محلي');
 });
 signals.addEventListener('error',()=>{ready=false;notify('انقطع الاتصال. لا تُغلق الصفحة إذا لديك عمل غير محفوظ.');mode();});
 signals.addEventListener('closed',()=>{if(seat==='teacher')openExit();ready=false;notify('انتهى إذن الحصة.');mode();});
 function receiveAPI(value){api=value;if(remote&&!preparation)apply(remote);}
 function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
 function App(){
  const [status,setStatus]=useState('جارٍ فتح السبورة…'),[state,setState]=useState(null);
  const [viewState,setViewState]=useState('shared');
  const [preparing,setPreparing]=useState(false),[selectionCount,setSelectionCount]=useState(0),[properties,setProperties]=useState(false),[expanded,setExpanded]=useState(false);
  const [toolReading,setToolReading]=useState({angle:null,ruler:false});
  refreshToolReading=elements=>{const angle=protractorReading(elements)?.degrees??null,ruler=elements.some(e=>!e.isDeleted&&e.groupIds?.some(g=>g.startsWith('ruler-')));setToolReading(previous=>previous.angle===angle&&previous.ruler===ruler?previous:{angle,ruler});};
  const workspace=useRef(),expandButton=useRef();refreshSelection=setSelectionCount;
  useEffect(()=>{if(!expanded)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';const escape=e=>{if(e.key==='Escape'){setExpanded(false);expandButton.current?.focus();}};window.addEventListener('keydown',escape);return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',escape);};},[expanded]);
  useEffect(()=>{if(!preparing)return;const warn=e=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[preparing]);
  const startPreparation=()=>{if(preparation)return true;if(seat!=='teacher'||view!=='shared'||!ready||latest||saving||conflict)return false;preparation=createPreparation(remote,scene());setPreparing(true);notify('تجهيز خاص: حرّك الوسيلة واضبط حجمها، ثم أرسلها للطالب.');return true;};
  const cancelPreparation=()=>{preparation=null;setPreparing(false);apply(remote,{resetHistory:true});notify('أُلغي التجهيز الخاص؛ لم يُرسل للطالب.');};
  const publishPreparation=()=>{if(!ready||conflict||!editable()||!canPublishPreparation(preparation,remote))return;const snapshot=scene();preparation=null;setPreparing(false);latest={...snapshot,lessonId:remote.activeLesson,op:'scene'};save();};
  const adjustSelection=change=>{if(!ready||conflict||!editable()||!api)return;api.updateScene({elements:transformSelection(api.getSceneElementsIncludingDeleted(),api.getAppState().selectedElementIds,change),...(change.remove?{appState:{selectedElementIds:{},selectedGroupIds:{}}}:{}),captureUpdate:CaptureUpdateAction.IMMEDIATELY});};
  const selectView=value=>{if(preparation){notify('أرسل التجهيز الخاص أو ألغِه قبل تغيير مساحة العمل.');return;}if(latest||saving){notify('انتظر حفظ العمل أو صدّره قبل تغيير العرض.');return;}view=value;setViewState(value);apply(remote);};
  const moderate=async op=>{try{const next=await send('board',{op,rev:remote.rev,lessonId:remote.activeLesson});apply(next);notify(op==='publish'?'نُشرت نسخة المشاركة المعتمدة.':'حُجبت المشاركة المعتمدة.');}catch(e){notify(e.message);}};
  const [exiting,setExiting]=useState(false);openExit=()=>setExiting(true);
  const leave=()=>{location.href=document.getElementById('leave').href;};
  const clearAndLeave=async()=>{try{const next=await send('board',{op:'clear',confirm:true,rev:remote.rev,lessonId:remote.activeLesson});latest=null;clearTimeout(timer);apply(next);leave();}catch(e){notify('لم يُمسح العمل: '+e.message);}};
  const [MathPanel,setMathPanel]=useState(null),[mathLoading,setMathLoading]=useState(false),[mathFailed,setMathFailed]=useState(false);
  const loadMath=async()=>{if(mathFailed){if(latest||saving||conflict||preparation){notify('احفظ أو صدّر التغييرات أولًا قبل إعادة تحميل الأدوات.');return;}location.reload();return;}setMathLoading(true);try{const m=await import('./MathPanel.jsx');setMathPanel(()=>m.MathPanel);}catch{setMathFailed(true);notify('تعذر تحميل محرر المعادلات. إعادة المحاولة تعيد تحميل الصفحة بعد حفظ العمل.');}finally{setMathLoading(false);}};
  const input=useRef();notify=setStatus;refresh=setState;
  const available=state?.resources||[];
  const selectedLesson=choices.find(l=>l.id===state?.activeLesson);
  const changeLesson=async id=>{if(!id||latest||saving||conflict||preparation)return;try{const s=await send('board',{op:'lesson',rev:remote.rev,lessonId:id});if(apply(s))focus(s.elements);}catch(e){notify(e.message);}};
  const addAid=a=>{if(!ready||conflict||!api||!editable())return;if(seat==='teacher'&&!startPreparation()){notify('انتظر حفظ العمل قبل تجهيز وسيلة جديدة.');return;}const position=nextPosition();const elements=a.kind==='library'?libraryElements(a.elements,position.x,position.y,Math.min(520,api.getAppState().width*0.8),280):convertToExcalidrawElements(a.kind==='protractor'?protractorElements(position.x,position.y,'protractor-'+crypto.randomUUID()):a.kind==='ruler'?rulerElements(position.x,position.y,'ruler-'+crypto.randomUUID()):[{type:'text',...position,text:wrapAidText(a.title+'\n'+a.text+'\n'+a.explanation),fontSize:24,fontFamily:2}],{regenerateIds:false});api.updateScene({elements:[...api.getSceneElements(),...elements],appState:selectionState(elements),captureUpdate:CaptureUpdateAction.IMMEDIATELY});api.setActiveTool({type:'selection'});focus(elements);if(['ruler','protractor'].includes(a.kind))notify(a.explanation);};
  const adjustRuler=change=>{if(!ready||conflict||!editable())return;api.updateScene({elements:transformRuler(api.getSceneElements(),change),captureUpdate:CaptureUpdateAction.IMMEDIATELY});};
  const adjustAngle=delta=>{if(!ready||conflict||!editable())return;const elements=api.getSceneElements(),reading=protractorReading(elements);if(reading)api.updateScene({elements:setProtractorAngle(elements,reading.degrees+delta),captureUpdate:CaptureUpdateAction.IMMEDIATELY});};
  const toggle=async()=>{try{const s=await send('board',{op:'permission',rev:remote.rev,allow:!remote.studentDraw});apply(s);}catch(e){notify(e.message);}};
  return <div ref={workspace} className={'teaching-board'+(expanded?' board-expanded':'')+(!properties?' board-hide-properties':'')} dir="rtl">
   <header className="board-heading"><div><strong>سبورة الشرح</strong><small>{preparing?'معاينة خاصة بالمعلم':viewState==='shared'?'شرح مباشر للطالب':viewState==='draft'?'مسودة الطالب':'مشاركة معتمدة'}</small></div><div className="board-heading-actions"><button ref={expandButton} aria-pressed={expanded} onClick={()=>{setExpanded(!expanded);requestAnimationFrame(()=>workspace.current?.scrollTo({top:0}));}}>{expanded?'العودة إلى الفصل':'توسيع مساحة السبورة'}</button><button disabled={!ready} onClick={()=>api&&focus(api.getSceneElements())}>ملاءمة المحتوى</button></div></header>
   <div className="engine" id="board-canvas"><Excalidraw excalidrawAPI={receiveAPI}
    onChange={changed} langCode="ar-SA" viewModeEnabled={!ready||conflict||!state||!editable()} initialData={initialData}
    UIOptions={{canvasActions:{loadScene:false,saveToActiveFile:false,export:false,toggleTheme:false},tools:{image:true}}}
    onLinkOpen={(element,event)=>event.preventDefault()} validateEmbeddable={()=>false}>
     <MainMenu><MainMenu.Item onSelect={()=>download(JSON.stringify({format:'khatwa-board',version:1,...scene()}),'lesson-board.json','application/json')}>تصدير ملف السبورة</MainMenu.Item></MainMenu>
    </Excalidraw></div>

   <div className="board-status"><span role="status" id="board-status">{status}</span></div>
   {preparing&&<section className="board-preparation" aria-label="التجهيز الخاص"><div><strong>تجهيز خاص قبل الإرسال</strong><p>كل تعديل هنا يبقى على جهاز المعلم حتى التأكيد. اضبط المكان والحجم ثم أرسل؛ التحريك بعد الإرسال يظهر مباشرة للطالب.</p></div><button disabled={!ready||conflict||!canPublishPreparation(preparation,state)} onClick={publishPreparation}>تأكيد المكان وإرسال للطالب</button><button onClick={cancelPreparation}>إلغاء التجهيز</button></section>}
   <div className="board-selection" role="group" aria-label="تحريك وتعديل التحديد"><button disabled={!ready||conflict||!editable()} onClick={()=>api?.setActiveTool({type:'selection'})}>تحديد وتحريك</button><button aria-pressed={properties} onClick={()=>{setProperties(!properties);api?.updateScene({appState:{openMenu:properties?null:'shape'}});}}>{properties?'إخفاء خصائص الرسم':'خصائص الرسم'}</button><button disabled={!ready||conflict||!editable()||!selectionCount} onClick={()=>adjustSelection({scale:1.15})}>تكبير التحديد +</button><button disabled={!ready||conflict||!editable()||!selectionCount} onClick={()=>adjustSelection({scale:1/1.15})}>تصغير التحديد −</button><button disabled={!ready||conflict||!editable()||!selectionCount} onClick={()=>adjustSelection({remove:true})}>حذف التحديد</button>{seat==='teacher'&&!preparing&&<button disabled={!ready||conflict||!editable()||saving||!!latest} onClick={startPreparation}>تجهيز خاص</button>}<small>اسحب الأداة لتحريكها، واسحب مقابض الزوايا لتغيير حجمها.</small></div>
   <div className="board-tools" aria-label="أدوات الحصة أسفل السبورة">
   <details className="aid-library board-toolgroup"><summary>وسائل الدرس</summary>
    <p>المحتوى تجريبي؛ توزيع الصفوف هنا لا يمثل اعتمادًا لمنهج رسمي.</p>
    {seat==='teacher'?<label>الدرس <select aria-label="الدرس" value={state?.activeLesson||''} disabled={!ready||saving||!!latest||conflict||preparing} onChange={e=>changeLesson(e.target.value)}><option value="">اختر درسًا</option>{choices.map(l=><option key={l.id} value={l.id}>{({math:'رياضيات',science:'علوم',arabic:'العربية',english:'الإنجليزية',islamic:'الدراسات الإسلامية'})[l.subject]||l.subject} · الصف {l.grade} · {l.title}</option>)}</select></label>:<p>الدرس: {selectedLesson?.title||'ينتظر اختيار المعلم'}</p>}
    {seat==='teacher'&&selectedLesson&&<p>الدرس الحالي: {selectedLesson.title}</p>}
    {!selectedLesson&&<p>يختار المعلم الدرس قبل عرض الوسائل.</p>}
    {selectedLesson&&!selectedLesson.aidIds.length&&<p>لا توجد وسائل جاهزة لهذا الدرس بعد؛ تتوفر السبورة الحرة.</p>}
    {available.some(a=>a.kind==='protractor')&&toolReading.angle!==null&&<div role="group" aria-label="آخر منقلة"><span>آخر منقلة — عرض تعليمي للزاوية</span><output aria-label="قراءة زاوية المنقلة" dir="ltr">{toolReading.angle!==null?toolReading.angle+'°':'—'}</output><button disabled={!ready||conflict||!editable()} onClick={()=>adjustRuler({prefix:'protractor-',dx:20})}>منقلة يمين</button><button disabled={!ready||conflict||!editable()} onClick={()=>adjustRuler({prefix:'protractor-',rotate:Math.PI/12})}>تدوير المنقلة 15°</button><button disabled={!ready||conflict||!editable()} onClick={()=>adjustAngle(5)}>زيادة الزاوية 5°</button><button disabled={!ready||conflict||!editable()} onClick={()=>adjustAngle(-5)}>تقليل الزاوية 5°</button></div>}
    {available.some(a=>a.kind==='ruler')&&toolReading.ruler&&<div role="group" aria-label="تحريك آخر مسطرة"><span>آخر مسطرة: وحدات نسبية وليست سنتيمترات فعلية</span><button disabled={!ready||conflict||!editable()} onClick={()=>adjustRuler({dx:20})}>مسطرة يمين</button><button disabled={!ready||conflict||!editable()} onClick={()=>adjustRuler({dx:-20})}>مسطرة يسار</button><button disabled={!ready||conflict||!editable()} onClick={()=>adjustRuler({rotate:Math.PI/12})}>تدوير المسطرة 15°</button></div>}
    {available.filter(a=>selectedLesson?.aidIds.includes(a.id)).map(a=><button key={a.id} disabled={!ready||conflict||!editable()} onClick={()=>addAid(a)}>{a.title} +</button>)}
    <p>محتوى أصلي للمشروع. يجهّز المعلم الوسيلة محليًا ثم يرسلها للطالب. بعدها يمكن تحريكها مباشرة أثناء الشرح. صورك تُخزن على خدمة التجربة؛ استخدم مواد وهمية فقط.</p>
   {selectedLesson?.subject==='math'&&!MathPanel&&<button disabled={mathLoading} onClick={loadMath}>{mathLoading?'جاري تحميل محرر المعادلات…':mathFailed?'إعادة تحميل الأدوات':'تحميل محرر المعادلات'}</button>}
   {selectedLesson?.subject==='math'&&MathPanel&&<MathPanel enabled={ready&&!conflict&&editable()} notify={notify} insert={(dataURL,width,height)=>{if(seat==='teacher'&&!startPreparation()){notify('انتظر حفظ العمل قبل تجهيز وسيلة جديدة.');return;}const id=crypto.randomUUID();api.addFiles([{id,dataURL,mimeType:'image/png',created:Date.now()}]);api.updateScene({elements:[...api.getSceneElements(),...convertToExcalidrawElements([{type:'image',...nextPosition(),...fitDimensions(width,height),fileId:id,status:'saved'}])]});focus(api.getSceneElements().slice(-1));}}/>}
   </details>

    <details className="board-toolgroup"><summary>المشاركة والصلاحيات</summary><div className="board-controls"><label>مساحة العمل <select aria-label="مساحة العمل" value={viewState} disabled={!ready||saving||!!latest||conflict||preparing} onChange={e=>selectView(e.target.value)}><option value="shared">سبورة المعلم المشتركة</option><option value="draft">مسودة الطالب الخاصة بالطالب والمعلم</option><option value="published">مشاركة الطالب المعتمدة</option></select></label>{seat==='teacher'&&<><button disabled={!ready||saving||!!latest||conflict||preparing||!state?.studentDraft} onClick={()=>moderate('publish')}>نشر نسخة من مسودة الطالب</button><button disabled={!ready||saving||!!latest||conflict||preparing||!state?.publishedStudent} onClick={()=>moderate('hide')}>حجب المشاركة المعتمدة</button><button disabled={!ready||saving||!!latest||conflict||preparing} onClick={toggle}>{state?.studentDraw?'إيقاف تحرير الطالب':'السماح للطالب بالتحرير'}</button></>}</div><p>إذن الطالب يفتح مسودته. المعلم يراجعها ثم ينشر نسخة معتمدة.</p></details>
    <details className="board-toolgroup"><summary>الحفظ والاستعادة</summary><div className="board-controls">
    <button onClick={()=>download(JSON.stringify({format:'khatwa-board',version:1,engine:'excalidraw',...scene()}),'lesson-board.json','application/json')}>تصدير قابل للاستعادة</button>
    <button onClick={async()=>{try{const s=scene();const blob=await exportToBlob({...s,appState:{exportBackground:true},mimeType:'image/png'});download(blob,'lesson-board.png','image/png');}catch(e){notify('تعذّر تصدير الصورة؛ استخدم ملف الاستعادة.');}}}>صورة PNG</button>
    <button onClick={()=>{if((latest||preparation)&&!window.confirm('قد تفقد العمل غير المحفوظ. هل صدّرت نسخة وتريد تحميل آخر حفظ؟'))return;location.reload();}}>تحميل آخر حفظ</button>
    {seat==='teacher'&&<><button disabled={!ready||conflict||!editable()||preparing} onClick={()=>input.current.click()}>استعادة ملف</button></>}
    <input ref={input} type="file" accept=".json,.excalidraw" hidden onChange={async e=>{try{if(!ready||conflict||!editable()||preparation)return;const f=e.target.files[0];if(f.size>2000000)throw Error();const s=JSON.parse(await f.text());if(!Array.isArray(s.elements)||s.elements.length>1000||s.elements.some(x=>!['rectangle','diamond','ellipse','arrow','line','freedraw','text','image'].includes(x.type)))throw Error();for(const f of Object.values(s.files||{})){if(typeof f.dataURL!=='string'||f.dataURL.length>700000||!/^data:image\/(png|jpeg|webp);base64,/.test(f.dataURL))throw Error();}s.elements=s.elements.map(x=>({...x,link:null}));api.addFiles(Object.values(s.files||{}));api.updateScene({elements:s.elements});}catch{notify('ملف غير صالح أو أكبر من الحد.');}e.target.value='';}}/>

    </div></details>
    <details className="board-toolgroup"><summary>مؤقت الحصة</summary><ClassTimer timer={state?.classTimer} serverNow={state?.serverNow} teacher={seat==='teacher'} enabled={ready&&!saving&&!latest&&!conflict&&!preparing} command={async(op,extra={})=>{try{const next=await send('board',{op,...extra,rev:remote.rev});apply(next);}catch(e){notify(e.message);}}}/></details>
   </div>
   {exiting&&<section role="dialog" aria-modal="false" aria-label="مغادرة الحصة" className="panel"><h3>هل تريد مسح أعمال الدرس الحالي قبل المغادرة؟</h3><p>يشمل سبورة المعلم ومسودة الطالب والنسخة المنشورة لهذا الدرس فقط. الدروس الأخرى وسجلات الطلاب تبقى محفوظة. التجهيز الخاص غير المرسل سيُفقد عند المغادرة؛ يمكنك تصديره أولًا.</p><button onClick={()=>download(JSON.stringify(preparation?{format:'khatwa-board',version:1,...scene()}:remote),'current-lesson-backup.json','application/json')}>تصدير أعمال الدرس بصيغة JSON</button><button onClick={leave}>مغادرة مع الاحتفاظ بالعمل المرسل</button><button disabled={saving||!!latest||conflict||!remote||preparing} onClick={clearAndLeave}>أوافق: مسح هذا الدرس والمغادرة</button><button onClick={()=>setExiting(false)}>إلغاء</button></section>}
   <p className="board-note">التحكم والتمرير والتكبير في واجهتك محليّة؛ لا تغيّر شاشة الطرف الآخر. أعمال الشرح المباشر تتزامن، والتجهيز الخاص ينتظر الإرسال. الحفظ على الاستضافة مؤقت؛ احتفظ بتصدير محلي.</p>
  </div>;
 }
 createRoot(document.getElementById('board-pro')).render(<App/>);
}

