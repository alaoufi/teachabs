import {UserError} from './store.mjs';
const routes={
 '/api/academics/teacher/classes':['teacherCalendarClasses',['termId']],
 '/api/academics/teacher/materials':['teacherCalendarMaterials',['termId','classId']],
 '/api/academics/teacher/periods':['teacherCalendarPeriods',['termId','classId','date']],
 '/api/academics/teacher/lessons':['teacherCalendarLessons',['termId','assignmentId']],
 '/api/academics/student/materials':['studentCalendarMaterials',['termId','childId','profileType']],
 '/api/academics/period/teacher':['resolvePeriodTeacher',['periodId','date','childId','profileType']],
 '/api/academics/session':['currentLessonSession',['periodId','date','childId','profileType']],
 '/api/academics/current':['currentCalendarSession',['childId','profileType']]
};
const choose='/api/academics/teacher/lesson';
export const academicApiRoutes=Object.freeze({get:Object.freeze(Object.keys(routes)),post:Object.freeze([choose])});
export function academicApi(store){return {matches:path=>path.startsWith('/api/academics/'),async handle({req,res,url,u,base,fields,limit}){
 const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
 try{
  if(!u)throw new UserError('يلزم تسجيل الدخول.',401);
  if(!['teacher','parent'].includes(u.role))throw new UserError('الواجهة لحساب المعلم أو ولي أمر الطالب فقط.',403);
  if(req.method==='GET'&&Object.hasOwn(routes,url.pathname)){
   const [method,keys]=routes[url.pathname];
   for(const [key] of url.searchParams)if(!keys.includes(key)||url.searchParams.getAll(key).length!==1)throw new UserError('معامل غير مسموح أو مكرر.',400);
   limit(req,'academic-read',180);return send(200,{data:store.admin[method](u.id,Object.fromEntries(url.searchParams))});
  }
  if(req.method==='POST'&&url.pathname===choose){
   if(req.headers.origin!==base)throw new UserError('مصدر الطلب غير معتمد.',403);
   limit(req,'academic-write',60);const input=await fields(req);
   for(const key of Object.keys(input))if(!['periodId','date','lessonId','request','revision'].includes(key))throw new UserError('يمكن للمعلم اختيار الدرس فقط.',403);
   const values={...input};if(input.revision!==undefined)values.revision=Number(input.revision);
   return send(200,{id:store.admin.selectPeriodLesson(u.id,values)});
  }
  throw new UserError('الواجهة غير موجودة.',404);
 }catch(error){return send(error instanceof UserError?error.status:500,{error:error instanceof UserError?error.message:'تعذر تنفيذ الطلب.'});}
}};}
