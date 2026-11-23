// Prices are integer halalas, never floating-point currency calculations.
export function priceValues(i,check,now=Date.now()) {
 check(i&&typeof i==='object'&&!Array.isArray(i)&&Object.keys(i).every(k=>['gradeId','subjectId','teacherId','amount','mode','effectiveFrom','revision','request'].includes(k)),'حقل غير مسموح في التسعير.');
 const teacherId=i.teacherId||'',mode=i.mode||'price';
 check(typeof i.gradeId==='string'&&i.gradeId.length>0&&typeof i.subjectId==='string'&&i.subjectId.length>0&&typeof teacherId==='string','اختر الصف والمادة والمعلم من القوائم.');
 check(['price','inherit'].includes(mode)&&(mode!=='inherit'||teacherId),'العودة للسعر الأساسي متاحة لتسعير المعلم فقط.');
 let amountCents=null;
 if(mode==='price'){
  check(typeof i.amount==='string'&&/^\d{1,6}(?:\.\d{1,2})?$/.test(i.amount),'اكتب السعر بالريال من صفر إلى ٩٩٩٩٩٩٫٩٩، وبمنزلتين عشريتين كحد أقصى.');
  const [whole,part='']=i.amount.split('.');amountCents=Number(whole)*100+Number(part.padEnd(2,'0'));
 }else check(i.amount===undefined||i.amount==='','اترك المبلغ فارغًا عند العودة للسعر الأساسي.');
 check(Number.isSafeInteger(i.revision)&&i.revision>=0,'حدّث الصفحة ثم أعد المحاولة.');
 check(typeof i.request==='string'&&i.request.length>0&&i.request.length<=120,'حدّث نموذج التسعير.');
 let effectiveFrom=i.effectiveFrom;
 if(effectiveFrom===undefined||effectiveFrom==='')effectiveFrom=null;
 if(typeof effectiveFrom==='string'){
  check(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(effectiveFrom),'راجع تاريخ السريان بتوقيت الرياض.');
  const stamp=Date.parse(effectiveFrom+':00+03:00');
  check(Number.isFinite(stamp)&&new Date(stamp+10800000).toISOString().slice(0,16)===effectiveFrom,'راجع تاريخ السريان بتوقيت الرياض.');effectiveFrom=stamp;
 }
 check(effectiveFrom===null||(Number.isSafeInteger(effectiveFrom)&&effectiveFrom>=0&&effectiveFrom<=now+5*366*86400000),'اختر تاريخ سريان صالحًا خلال خمس سنوات.');
 return {gradeId:i.gradeId,subjectId:i.subjectId,teacherId,mode,amountCents,effectiveFrom,revision:i.revision,request:i.request};
}
export const pricingRow=r=>r&&({...r,ruleId:r.rule_id,gradeId:r.grade_id,subjectId:r.subject_id,teacherId:r.teacher_id||'',amountCents:r.amount_cents===null?null:Number(r.amount_cents),effectiveFrom:Number(r.effective_from),created:Number(r.created)});
export function chooseLessonPrice(rows,{gradeId,subjectId,teacherId='',at=Date.now()}){
 const applicable=rows.filter(r=>r.gradeId===gradeId&&r.subjectId===subjectId&&r.effectiveFrom<=at);
 const latest=teacher=>applicable.filter(r=>r.teacherId===teacher).sort((a,b)=>b.effectiveFrom-a.effectiveFrom||b.revision-a.revision)[0];
 const override=teacherId?latest(teacherId):null,row=override?.amountCents!==null&&override?override:latest('');
 return row?{...row,currency:'SAR',source:row.teacherId?'teacher':'base'}:null;
}
