import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {teacherRequestKey} from './teacher-registration.mjs';
export const MAX_QUALIFICATION_BYTES=5*1024*1024;
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function checkedPng(bytes,check){
 check(bytes.subarray(0,8).equals(signature),'صيغة PNG غير صالحة.');
 let offset=8,header=null,ended=false,idat=false,idatEnded=false,palette=false;const data=[];
 while(offset<bytes.length){
  check(offset+12<=bytes.length,'صورة PNG غير مكتملة.');const size=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8),end=offset+12+size;
  check(size<=MAX_QUALIFICATION_BYTES&&end<=bytes.length&&/^[A-Za-z]{4}$/.test(type),'بنية PNG غير صالحة.');
  check(crc32(bytes.subarray(offset+4,end-4))===bytes.readUInt32BE(end-4),'صورة PNG تالفة.');
  if(!header){check(type==='IHDR'&&size===13,'بداية PNG غير صالحة.');header=bytes.subarray(offset+8,end-4);const w=header.readUInt32BE(0),h=header.readUInt32BE(4);check(w>0&&h>0&&w<=4096&&h<=4096&&w*h<=16000000,'أبعاد الصورة كبيرة أو غير صالحة.');check(header[10]===0&&header[11]===0&&header[12]===0,'احفظ الصورة بصيغة PNG عادية دون تداخل.');}
  else if(type==='IHDR')check(false,'ترويسة PNG مكررة.');
  if(type==='PLTE'){check(!idat&&!palette&&size>0&&size%3===0&&size<=768,'لوحة PNG غير صالحة.');palette=true;}
  if(type==='IDAT'){check(!idatEnded,'أجزاء PNG غير متصلة.');idat=true;data.push(bytes.subarray(offset+8,end-4));}else if(idat)idatEnded=true;
  if(type==='IEND'){check(size===0&&idat&&end===bytes.length,'نهاية PNG غير صالحة.');ended=true;break;}
  check(['IHDR','PLTE','IDAT'].includes(type)||type[0]===type[0].toLowerCase(),'نوع PNG غير مدعوم.');
  offset=end;
 }
 check(ended,'صورة PNG غير مكتملة.');
 const width=header.readUInt32BE(0),height=header.readUInt32BE(4),depth=header[8],color=header[9],channels={0:1,2:3,3:1,4:2,6:4}[color],depths={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
 check(channels&&depths[color].includes(depth)&&(color!==3||palette),'ألوان PNG غير صالحة.');
 const stride=Math.ceil(width*channels*depth/8)+1,expected=stride*height;check(expected<=80000000,'أبعاد الصورة كبيرة.');
 let raw;try{raw=inflateSync(Buffer.concat(data),{maxOutputLength:expected});}catch{check(false,'بيانات PNG تالفة.');}
 check(raw.length===expected,'حجم بيانات PNG غير صحيح.');for(let at=0;at<raw.length;at+=stride)check(raw[at]<=4,'ترميز PNG غير صالح.');
 return bytes;
}
function checkedJpeg(bytes,check){
 check(bytes.length>=4&&bytes[0]===255&&bytes[1]===216,'صيغة JPEG غير صالحة.');
 let offset=2,frame=null,scan=false,ended=false;const quant=new Set(),huffman=new Set();
 while(offset<bytes.length){
  check(bytes[offset]===255,'بنية JPEG غير صالحة.');while(bytes[offset]===255)offset++;const marker=bytes[offset++];
  if(marker===217){check(frame&&scan&&offset===bytes.length,'نهاية JPEG غير صالحة.');ended=true;break;}
  check([192,194,196,219,221,218,254].includes(marker)||(marker>=224&&marker<=239),'جزء JPEG غير مدعوم.');
  check(offset+2<=bytes.length,'صورة JPEG غير مكتملة.');const size=bytes.readUInt16BE(offset),end=offset+size;check(size>=2&&end<=bytes.length,'صورة JPEG غير مكتملة.');
  if([192,194].includes(marker)){
   check(!frame&&size>=8,'ترويسة JPEG غير صالحة.');const h=bytes.readUInt16BE(offset+3),w=bytes.readUInt16BE(offset+5),count=bytes[offset+7];
   check(w>0&&h>0&&w<=4096&&h<=4096&&w*h<=16000000,'أبعاد الصورة كبيرة أو غير صالحة.');check(bytes[offset+2]===8&&[1,3,4].includes(count)&&size===8+3*count,'ألوان JPEG غير مدعومة.');
   frame={progressive:marker===194,components:new Map()};let blocks=0;
   for(let at=offset+8;at<end;at+=3){const id=bytes[at],h=bytes[at+1]>>4,v=bytes[at+1]&15,q=bytes[at+2];check(!frame.components.has(id)&&h>=1&&h<=4&&v>=1&&v<=4&&q<=3,'مكونات JPEG غير صالحة.');blocks+=h*v;frame.components.set(id,q);}check(blocks<=10,'عينات JPEG غير صالحة.');
  }
  if(marker===219){let at=offset+2;check(at<end,'جداول JPEG فارغة.');while(at<end){const info=bytes[at++],precision=info>>4,id=info&15;check(precision<=1&&id<=3&&at+64*(precision+1)<=end,'جدول JPEG غير صالح.');for(let i=0;i<64;i++){const value=precision?bytes.readUInt16BE(at):bytes[at];check(value>0,'جدول JPEG غير صالح.');at+=precision+1;}quant.add(id);}check(at===end,'جدول JPEG غير مكتمل.');}
  if(marker===196){let at=offset+2;check(at<end,'جداول JPEG فارغة.');while(at<end){check(at+17<=end,'جدول JPEG غير مكتمل.');const info=bytes[at++],kind=info>>4,id=info&15;check(kind<=1&&id<=3,'جدول JPEG غير صالح.');let total=0,slots=1;for(let i=0;i<16;i++){const count=bytes[at++];total+=count;slots=slots*2-count;check(slots>=0,'ترميز JPEG غير صالح.');}check(total>0&&total<=256&&at+total<=end,'جدول JPEG غير صالح.');if(kind===0)for(let i=0;i<total;i++)check(bytes[at+i]<=11,'ترميز JPEG غير صالح.');at+=total;huffman.add(kind+':'+id);}check(at===end,'جدول JPEG غير مكتمل.');}
  if(marker===221)check(size===4,'فاصل JPEG غير صالح.');
  if(marker===218){
   check(frame&&size>=6,'مسح JPEG غير صالح.');const count=bytes[offset+2];check(count>=1&&count<=frame.components.size&&size===6+2*count,'مسح JPEG غير صالح.');
   const spectralStart=bytes[end-3],spectralEnd=bytes[end-2],high=bytes[end-1]>>4,low=bytes[end-1]&15;
   check(frame.progressive?(spectralStart<=spectralEnd&&spectralEnd<=63&&(spectralStart!==0||spectralEnd===0)&&(spectralStart===0||count===1)&&high<=13&&low<=13&&(high===0||high===low+1)):(spectralStart===0&&spectralEnd===63&&high===0&&low===0),'ترميز مسح JPEG غير صالح.');
   const seen=new Set();for(let at=offset+3;at<end-3;at+=2){const id=bytes[at],dc=bytes[at+1]>>4,ac=bytes[at+1]&15;check(frame.components.has(id)&&!seen.has(id)&&quant.has(frame.components.get(id))&&dc<=3&&ac<=3,'مكونات المسح غير صالحة.');seen.add(id);if(spectralStart===0&&high===0)check(huffman.has('0:'+dc),'جدول JPEG المطلوب غير موجود.');if(spectralEnd>0)check(huffman.has('1:'+ac),'جدول JPEG المطلوب غير موجود.');}
   scan=true;offset=end;let entropy=false;while(offset<bytes.length){if(bytes[offset]!==255){entropy=true;offset++;continue;}const next=bytes[offset+1];if(next===0||next>=208&&next<=215){offset+=2;entropy=true;continue;}break;}check(entropy,'بيانات JPEG فارغة.');continue;
  }
  offset=end;
 }
 check(ended,'صورة JPEG غير مكتملة.');return bytes;
}
export async function validateQualificationImage(file,UserError=Error){
 const check=(ok,message,status=400)=>{if(!ok)throw new UserError(message,status);};
 check(file&&typeof file.arrayBuffer==='function'&&Number.isSafeInteger(file.size),'اختر صورة مؤهل.');check(file.size>0&&file.size<=MAX_QUALIFICATION_BYTES,'حجم الصورة يجب ألا يتجاوز ٥ ميجابايت.',413);
 check(['image/png','image/jpeg'].includes(file.type),'تُقبل صور PNG أو JPEG فقط.',415);
 const bytes=Buffer.from(await file.arrayBuffer());check(bytes.length===file.size&&bytes.length<=MAX_QUALIFICATION_BYTES,'حجم الصورة غير صالح.',413);
 if(file.type==='image/png')checkedPng(bytes,check);else checkedJpeg(bytes,check);
 return {bytes,mime:file.type,sha256:createHash('sha256').update(bytes).digest('hex'),size:bytes.length};
}
export async function readQualificationUpload(req,UserError=Error){
 const fail=(message,status=400)=>{throw new UserError(message,status);};
 const type=req.headers['content-type']||'';if(!/^multipart\/form-data;\s*boundary=(?:[A-Za-z0-9'()+_,./:=?-]{1,70}|"[A-Za-z0-9'()+_,./:=?-]{1,70}")$/.test(type))fail('استخدم نموذج رفع الصورة.',415);
 const max=MAX_QUALIFICATION_BYTES+16384;if(req.headers['content-length']&&Number(req.headers['content-length'])>max)fail('حجم الصورة كبير.',413);
 const chunks=[];let size=0;for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>max)fail('حجم الصورة كبير.',413);chunks.push(Buffer.from(chunk));}
 let form;try{form=await new Request('http://localhost/qualification',{method:'POST',headers:{'content-type':type},body:Buffer.concat(chunks)}).formData();}catch{fail('تعذر قراءة الصورة. أعد اختيارها.');}
 const entries=[...form];if(entries.length!==2||form.getAll('request').length!==1||form.getAll('image').length!==1||!teacherRequestKey(form.get('request'))||typeof form.get('image')==='string')fail('راجع حقول رفع الصورة.');
 return {request:form.get('request'),file:form.get('image')};
}
