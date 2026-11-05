import React,{useEffect,useRef,useState}from'react';
import{MathfieldElement}from'mathlive';
import katex from'katex';import'katex/dist/katex.min.css';
import html2canvas from'html2canvas';
MathfieldElement.fontsDirectory='/board-assets/mathlive-fonts';MathfieldElement.soundsDirectory=null;
export function MathPanel({insert,enabled,notify}){
 const field=useRef(),preview=useRef();const[value,setValue]=useState('\\frac{1}{2}+\\frac{1}{4}=\\frac{3}{4}');
 useEffect(()=>{const f=field.current;f.value=value;f.mathVirtualKeyboardPolicy='manual';const change=()=>setValue(f.value);f.addEventListener('input',change);return()=>f.removeEventListener('input',change);},[]);
 useEffect(()=>{try{katex.render(value,preview.current,{throwOnError:false,trust:false,strict:'warn',displayMode:true});}catch{notify('صيغة غير صالحة.');}},[value]);
 return <details className="math-panel"><summary>محرر المعادلات — كسور وأسّ وجذور</summary><p>اكتب المعادلة من اليسار لليمين. أضف الشرح العربي بأداة النص. تُدرج المعادلة كصورة؛ احتفظ بصيغتها لتعديلها لاحقًا.</p>
 <math-field ref={field} dir="ltr" aria-label="محرر المعادلة" style={{width:'100%',minHeight:48}}/>
 <div ref={preview} className="equation-preview" dir="ltr"/>
 <button disabled={!enabled} onClick={async()=>{try{await document.fonts.ready;const canvas=await html2canvas(preview.current,{backgroundColor:'#ffffff',scale:1.5,logging:false});const dataURL=canvas.toDataURL('image/png');if(dataURL.length>700000)throw Error();insert(dataURL,canvas.width/1.5,canvas.height/1.5);}catch{notify('تعذّر إدراج المعادلة أو حجمها كبير.');}}}>إضافة المعادلة إلى السبورة</button>
 </details>
}
