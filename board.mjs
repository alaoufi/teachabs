import {changeModel3d} from './model3d.mjs';
import {changeClassTimer} from './class-timer.mjs';
import {changeLivePages} from './live-pages.mjs';
import {allowedLessons} from './lesson-catalog.mjs';
import { UserError } from './store.mjs';
const need=(ok,message,status=400)=>{if(!ok)throw new UserError(message,status);};
export const emptyBoard=()=>({format:'khatwa-board',version:1,rev:0,studentDraw:false,elements:[],files:{}});
export function changeBoard(current,seat,command,context={}){
 const state=current||emptyBoard();
 need(['teacher','student'].includes(seat),'مقعد غير مصرح.',403);
 need(command&&Number.isInteger(command.rev)&&command.rev===state.rev,'تغيّرت السبورة. صدّر عملك المحلي قبل تحميل نسخة الخادم.',409);
 if(command.op==='model3d')return changeModel3d(state,seat,command,context);
 if(command.op?.startsWith('timer-'))return {...state,rev:state.rev+1,classTimer:changeClassTimer(state.classTimer,seat,command)};
 if(command.op?.startsWith('pages-'))return changeLivePages(state,seat,command,context.savedInstance);
 if(command.op==='lesson'){
  need(!state.pageSession,'Close the saved lesson before changing subject',409);
  need(seat==='teacher','تغيير الدرس للمعلم فقط.',403);
  need(allowedLessons(context).some(l=>l.id===command.lessonId),'الدرس غير متاح لهذه المادة والصف.',403);
  const archive={...(state.lessonScenes||{}),[state.activeLesson||'unassigned']:{elements:state.elements,files:state.files,studentDraft:state.studentDraft||null,publishedStudent:state.publishedStudent||null,model3d:state.model3d||null}};
  const target=archive[command.lessonId]||{elements:[],files:{},studentDraft:null,publishedStudent:null,model3d:null};
  const next={...state,...target,activeLesson:command.lessonId,lessonScenes:archive,studentDraw:false,rev:state.rev+1};
  need(JSON.stringify(next).length<=2000000,'تجاوزت مساحة حفظ الدروس الحد المسموح.');return next;
 }
 if(['scene','draft','publish','hide','clear'].includes(command.op)&&state.activeLesson)need(command.lessonId===state.activeLesson,'تغير الدرس؛ احتفظ بعملك وأعد التحميل.',409);
 if(command.op==='clear'){
  need(seat==='teacher'&&command.confirm===true,'مسح الدرس يحتاج موافقة المعلم.',403);
  return {...state,rev:state.rev+1,elements:[],files:{},studentDraft:null,publishedStudent:null,studentDraw:false};
 }
 if(command.op==='draft'){
  need(seat==='student'&&state.studentDraw,'كتابة المسودة تحتاج إذن المعلم.',403);
  const checked=changeBoard(emptyBoard(),'teacher',{...command,op:'scene',rev:0});
  const next={...state,rev:state.rev+1,studentDraft:{elements:checked.elements,files:checked.files}};
  need(JSON.stringify(next).length<=2000000,'تجاوزت مساحة الحفظ.');return next;
 }
 if(command.op==='publish'||command.op==='hide'){
  need(seat==='teacher','نشر المشاركة وحجبها للمعلم فقط.',403);
  need(command.op==='hide'||state.studentDraft,'لا توجد مسودة للمراجعة.');
  const next={...state,rev:state.rev+1,publishedStudent:command.op==='hide'?null:structuredClone(state.studentDraft)};
  need(JSON.stringify(next).length<=2000000,'تجاوزت مساحة الحفظ.');return next;
 }
 if(command.op==='permission'){
  need(seat==='teacher'&&typeof command.allow==='boolean','الإذن للمعلم فقط.',403);
  return {...state,rev:state.rev+1,studentDraw:command.allow};
 }
 need(command.op==='scene','أمر غير معروف.');
 need(seat==='teacher','السبورة للعرض الآن؛ اطلب الإذن من المعلم.',403);
 need(Array.isArray(command.elements)&&command.elements.length<=1000,'حد السبورة ألف عنصر.');
 const allowed=new Set(['rectangle','diamond','ellipse','arrow','line','freedraw','text','image']),ids=new Set();
 const elements=command.elements.map(raw=>{
  need(raw&&typeof raw.id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(raw.id)&&!ids.has(raw.id)&&allowed.has(raw.type),'عنصر غير مدعوم.');ids.add(raw.id);
  need(['x','y','width','height','angle'].every(k=>Number.isFinite(raw[k])&&Math.abs(raw[k])<=100000),'أبعاد غير صالحة.');
  need(raw.type!=='text'||(typeof raw.text==='string'&&raw.text.length<=10000),'نص طويل.');
  const e=structuredClone(raw);e.link=null;delete e.customData;return e;
 });
 const files={};
 for(const e of elements.filter(e=>e.type==='image'&&!e.isDeleted)){
  need(typeof e.fileId==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(e.fileId)&&!['__proto__','constructor','prototype'].includes(e.fileId),'Invalid image id.');
  const f=command.files?.[e.fileId];
  need(f&&typeof f.dataURL==='string'&&f.dataURL.length<=700000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(f.dataURL),'الصورة يجب أن تكون PNG/JPEG/WebP محلية حتى ٥٠٠ كيلوبايت.');
  files[e.fileId]={id:e.fileId,mimeType:f.dataURL.slice(5,f.dataURL.indexOf(';')),dataURL:f.dataURL,created:Number(f.created)||Date.now()};
 }
 const next={...state,rev:state.rev+1,elements,files};
 need(JSON.stringify(next).length<=2000000,'حجم السبورة تجاوز الحد؛ صدّر نسخة وقلل الصور.');return next;
}
