// Keep price mutation parsing strict in the SQLite and preview administration.
export async function readLessonPricingFields(req,UserError){
 const fail=(message,status=400)=>{throw new UserError(message,status);};
 if(req.headers['content-type']?.split(';')[0].trim()!=='application/x-www-form-urlencoded')fail('صيغة نموذج غير صالحة.',415);
 const chunks=[];let bytes=0;for await(const chunk of req){bytes+=Buffer.byteLength(chunk);if(bytes>32768)fail('حجم الإدخال كبير.',413);chunks.push(Buffer.from(chunk));}
 const allowed=new Set(['gradeId','subjectId','teacherId','amount','mode','effectiveFrom','revision','request']),values={};
 for(const [key,value] of new URLSearchParams(Buffer.concat(chunks).toString())){if(!allowed.has(key)||Object.hasOwn(values,key))fail('حقل غير مسموح أو مكرر.');values[key]=value;}
 return values;
}
