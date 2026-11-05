import {experiment,validateExperiment,template,MAX_SHAPES} from './classroom-lab-model.js';
const $=id=>document.getElementById('lab-'+id),board=$('board'),key='teachabs.classroom-lab.v1';
const ns='http://www.w3.org/2000/svg';
let shapes=[],undo=[],redo=[],stroke=null,pointer=null,dirty=false;
const status=text=>$('status').textContent=text;
const editable=()=>$('role').value==='teacher';
const saveState=()=>experiment(shapes,$('title').value,$('notes').value);
const changed=()=>{dirty=true;status('تغييرات غير محفوظة. اضغط حفظ أو نزّل التجربة.');};
function render(){
 board.replaceChildren();
 for(const s of [...shapes,...(stroke?[stroke]:[])]){
  const [a,b=a]=s.points;let node;
  const create=(tag,attrs)=>{const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
  if(s.type==='pen')node=create('polyline',{points:s.points.map(p=>p.join(',')).join(' '),fill:'none'});
  if(s.type==='line')node=create('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1]});
  if(s.type==='rect')node=create('rect',{x:Math.min(a[0],b[0]),y:Math.min(a[1],b[1]),width:Math.abs(a[0]-b[0]),height:Math.abs(a[1]-b[1]),fill:'none'});
  if(s.type==='ellipse')node=create('ellipse',{cx:(a[0]+b[0])/2,cy:(a[1]+b[1])/2,rx:Math.abs(a[0]-b[0])/2,ry:Math.abs(a[1]-b[1])/2,fill:'none'});
  if(s.type==='text'){node=create('text',{x:a[0],y:a[1],fill:s.color,'font-size':26,'font-family':'sans-serif',direction:'rtl','text-anchor':'start'});node.textContent=s.text;}
  else {node.setAttribute('stroke',s.color);node.setAttribute('stroke-width',s.width);node.setAttribute('stroke-linecap','round');node.setAttribute('stroke-linejoin','round');}
  board.append(node);
 }
 $('undo').disabled=!editable()||!undo.length;$('redo').disabled=!editable()||!redo.length;
}
function commit(next){if(!editable())return;if(next.length>MAX_SHAPES){status('وصلت إلى حد ٥٠٠ عنصر؛ نزّل عملك ثم ابدأ تجربة جديدة.');render();return;}try{experiment(next);}catch{status('بلغ الرسم حد التفاصيل؛ نزّل عملك وابدأ تجربة جديدة.');render();return;}undo.push(shapes);if(undo.length>30)undo.shift();shapes=next;redo=[];changed();render();}
function point(event){const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(board.getScreenCTM().inverse());return [Math.max(0,Math.min(1000,p.x)),Math.max(0,Math.min(600,p.y))];}
board.addEventListener('pointerdown',e=>{
 if(!editable()||pointer!==null||e.button!==0||!e.isPrimary)return;
 e.preventDefault();const p=point(e),type=$('tool').value;
 const next={type,color:$('color').value,width:Number($('width').value),points:[p]};
 if(type==='text'){if(!$('text').value.trim()){status('اكتب النص في الحقل أولًا ثم المس مكانه.');return;}commit([...shapes,{...next,text:$('text').value}]);return;}
 pointer=e.pointerId;board.setPointerCapture(pointer);stroke={...next,points:[p,p]};render();
});
board.addEventListener('pointermove',e=>{if(e.pointerId!==pointer||!stroke)return;const p=point(e);if(stroke.type==='pen'){if(stroke.points.length<4000)stroke.points.push(p);}else stroke.points[1]=p;render();});
function finish(e,cancel=false){if(e.pointerId!==pointer)return;const current=stroke;stroke=null;pointer=null;if(current&&!cancel)commit([...shapes,current]);else render();}
board.addEventListener('pointerup',e=>finish(e));board.addEventListener('pointercancel',e=>finish(e,true));board.addEventListener('lostpointercapture',e=>finish(e,true));
$('role').addEventListener('change',()=>{stroke=null;pointer=null;for(const id of ['tool','color','width','text','axes','curve','clear','import','title','notes'])$(id).disabled=!editable();board.dataset.readonly=String(!editable());render();status(editable()?'معاينة المعلم — التعديل متاح محليًا.':'معاينة الطالب — القراءة فقط؛ ليست صلاحية أمنية أو جلسة مشتركة.');});
$('undo').onclick=()=>{if(!editable()||!undo.length)return;redo.push(shapes);shapes=undo.pop();changed();render();};
$('redo').onclick=()=>{if(!editable()||!redo.length)return;undo.push(shapes);shapes=redo.pop();changed();render();};
$('axes').onclick=()=>commit([...shapes,...template('axes')]);$('curve').onclick=()=>commit([...shapes,...template('curve')]);
$('clear').onclick=()=>{if(editable()&&shapes.length&&confirm('مسح سبورة التجربة؟ يمكنك التراجع بعد المسح.'))commit([]);};
for(const id of ['title','notes'])$(id).addEventListener('input',changed);
$('save').onclick=()=>{try{localStorage.setItem(key,JSON.stringify(saveState()));dirty=false;status('حُفظت السبورة والملاحظات على هذا المتصفح فقط.');}catch{status('تعذر الحفظ المحلي؛ نزّل JSON للاحتفاظ بالتجربة.');}};
function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').onclick=()=>{download(JSON.stringify(saveState(),null,2),'teachabs-classroom-experiment.json','application/json');status('طُلب تنزيل التجربة والملاحظات بصيغة JSON.');};
$('svg').onclick=()=>{const copy=board.cloneNode(true);copy.removeAttribute('id');copy.removeAttribute('data-readonly');copy.setAttribute('xmlns',ns);copy.setAttribute('width','1000');copy.setAttribute('height','600');const bg=document.createElementNS(ns,'rect');for(const [k,v] of Object.entries({width:1000,height:600,fill:'white'}))bg.setAttribute(k,v);copy.prepend(bg);download(new XMLSerializer().serializeToString(copy),'teachabs-board.svg','image/svg+xml');status('طُلب تنزيل صورة السبورة SVG. الملاحظات موجودة في JSON فقط.');};
function restore(data){shapes=data.shapes;undo=[];redo=[];$('title').value=data.title;$('notes').value=data.notes;render();}
$('import').addEventListener('change',async e=>{const file=e.target.files[0];try{if(!file||!editable())return;if(file.size>2000000)throw Error();const data=validateExperiment(JSON.parse(await file.text()));if(!editable())return;if((shapes.length||$('notes').value||$('title').value)&&!confirm('استبدال التجربة الحالية بالملف؟ نزّل نسخة منها أولًا عند الحاجة.'))return;restore(data);changed();status('استُعيد الملف محليًا. اضغط حفظ للاحتفاظ به في هذا المتصفح.');}catch{status('ملف غير صالح أو أكبر من ٢ ميغابايت. لم تتغير التجربة.');}finally{e.target.value='';}});
try{const saved=localStorage.getItem(key);if(saved){if(saved.length>2000000)throw Error();restore(validateExperiment(JSON.parse(saved)));status('استُعيدت التجربة المحفوظة على هذا المتصفح.');}}catch{status('تعذر استعادة الحفظ المحلي؛ يمكنك استيراد نسخة JSON.');}
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});render();
