import {UserError} from './store.mjs';
import {teacherRegistrationFields} from './teacher-registration.mjs';
import {readQualificationUpload} from './teacher-images.mjs';
import * as ui from './admin-views.mjs';
const uuid='[a-f\\d]{8}-[a-f\\d]{4}-[a-f\\d]{4}-[a-f\\d]{4}-[a-f\\d]{12}';
const detail=new RegExp('^/admin/education/teachers/('+uuid+')$','i'),upload=new RegExp('^/admin/education/teachers/('+uuid+')/qualifications$','i'),image=new RegExp('^/admin/education/teachers/('+uuid+')/qualifications/('+uuid+')$','i');
async function read(req){
 if(req.headers['content-type']?.split(';')[0].trim()!=='application/x-www-form-urlencoded')throw new UserError('صيغة نموذج غير صالحة.',415);
 const chunks=[];let size=0;for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>32768)throw new UserError('حجم الإدخال كبير.',413);chunks.push(Buffer.from(chunk));}
 const values={},params=new URLSearchParams(Buffer.concat(chunks).toString());for(const [k,v] of params){if(Object.hasOwn(values,k))throw new UserError('حقل مكرر في النموذج.');values[k]=v;}return values;
}
export function teacherService(admin){return {
 matches:path=>path==='/admin/education/teachers/new'||path==='/admin/education/teachers/register'||detail.test(path)||upload.test(path)||image.test(path),
 async handle({req,res,url,u,base,html,redirect,limit}){
  if(!u)return redirect('/login');if(url.searchParams.size)throw new UserError('لا تقبل هذه الصفحة معاملات إضافية.');
  const path=url.pathname,p=admin.profile(u.id),d=detail.exec(path),a=upload.exec(path),i=image.exec(path);
  if(req.method==='GET'){
   if(path.endsWith('/new')){admin.requireAccess(u.id,'education.write');return html('تسجيل المعلم',ui.adminTeacherForm(p));}
   if(d)return html('ملف المعلم',ui.adminTeacherProfile(p,admin.teacherProfile(u.id,d[1])));
   if(i){const file=admin.teacherQualification(u.id,i[1],i[2]);res.writeHead(200,{'Content-Type':file.mime,'Content-Length':file.size,'Content-Disposition':`inline; filename="qualification-${file.id}.${file.mime==='image/png'?'png':'jpg'}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"});return res.end(Buffer.from(file.bytes));}
  }
  if(req.method==='POST'){
   if(req.headers.origin!==base)throw new UserError('تعذّر التحقق من مصدر الطلب.',403);admin.requireAccess(u.id,'education.write');limit(req,'admin-write',180);
   if(d){const data=await read(req);admin.updateSpecialization(u.id,d[1],data.previous,data.specialization);return redirect(path);}
   if(path.endsWith('/register')){let data={};try{data=await read(req);const result=admin.registerTeacher(u.id,teacherRegistrationFields(data,UserError));return redirect('/admin/education/teachers/'+encodeURIComponent(result.id));}catch(error){if(!(error instanceof UserError)||![400,409].includes(error.status))throw error;return html('راجع بيانات المعلم',ui.adminTeacherForm(admin.profile(u.id),{values:data,error:error.message}),error.status);}}
   if(a){admin.teacherProfile(u.id,a[1]);if(p.scope)throw new UserError('لا يمكن رفع صور مؤهلات في المعاينة التجريبية.',403);try{const data=await readQualificationUpload(req,UserError);await admin.addTeacherQualification(u.id,a[1],data);return redirect('/admin/education/teachers/'+encodeURIComponent(a[1]));}catch(error){if(!(error instanceof UserError)||![400,409,413,415].includes(error.status))throw error;return html('راجع صورة المؤهل',ui.adminTeacherProfile(admin.profile(u.id),admin.teacherProfile(u.id,a[1]),{error:error.message}),error.status);}}
  }
  throw new UserError('الصفحة غير موجودة.',404);
 }
};}
