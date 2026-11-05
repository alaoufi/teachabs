import { UserError } from './store.mjs';
const need=(ok,message,status=400)=>{if(!ok)throw new UserError(message,status);};
export const emptyBoard=()=>({format:'khatwa-board',version:1,rev:0,studentDraw:false,elements:[],files:{}});
export function changeBoard(current,seat,command){
 const state=current||emptyBoard();
 need(command&&Number.isInteger(command.rev)&&command.rev===state.rev,'تغيّرت السبورة. صدّر عملك المحلي قبل تحميل نسخة الخادم.',409);
 if(command.op==='permission'){
  need(seat==='teacher'&&typeof command.allow==='boolean','الإذن للمعلم فقط.',403);
  return {...state,rev:state.rev+1,studentDraw:command.allow};
 }
 need(command.op==='scene','أمر غير معروف.');
 need(seat==='teacher'||state.studentDraw,'السبورة للعرض الآن؛ اطلب الإذن من المعلم.',403);
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
