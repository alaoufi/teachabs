import {schoolSelection} from './admin-school-selection.mjs';
import {validSchoolLevel} from './school-catalog.mjs';
import {UserError,subjects} from './store.mjs';
import * as ui from './admin-views.mjs';
import {ADMIN_PERMISSIONS} from './admin-model.mjs';
const selectedPermissions=data=>Object.keys(ADMIN_PERMISSIONS).filter(key=>data['permission_'+key]==='1');
const csv=value=>String(value||'').split(',').map(v=>v.trim()).filter(Boolean);
export function adminService(store) {
  const admin=store.admin;
  return {matches:path=>path==='/admin'||path.startsWith('/admin/'),async handle({req,url,u,base,html,redirect,fields,limit,enter}) {
    if(!u)return redirect('/login');
    const path=url.pathname;
    if(path==='/admin/demo/switch'&&req.method==='POST'){if(req.headers.origin!==base)throw new UserError('Untrusted origin',403);limit(req,'admin-write',180);const data=await fields(req);return enter(admin.switchDemo(u.id,data.adminRole));}
    const profile=admin.profile(u.id);
    const classDestination=classId=>{if(!classId)return '/admin/school';const row=admin.school(u.id).classes.find(c=>c.id===classId);if(!row)throw new UserError('الفصل غير متاح.',404);return '/admin/school?'+new URLSearchParams({trackId:row.track_id,stage:row.stage,grade:String(row.grade),classId:row.id});};
    const invitation=(result,section='accounts')=>ui.adminInviteResult(profile,{...result,activationUrl:new URL('/activate?code='+result.token,base).href,section});
    if(req.method==='GET') {
      if(path==='/admin')return html('الإدارة',ui.adminHome(profile,admin.overview(u.id)));
      if(path==='/admin/school/assignments')return html('إسناد المعلمين للطلاب',ui.adminSchoolIndividuals(profile,admin.schoolTeacherStudents(u.id,{gradeId:url.searchParams.get('gradeId')||'',subject:url.searchParams.get('subject')||'',teacherId:url.searchParams.get('teacherId')||'',page:url.searchParams.has('page')?Number(url.searchParams.get('page')):1})));
      if(path==='/admin/school'||path==='/admin/school/enrollment'){
        for(const key of ['trackId','stage','grade','classId'])if(url.searchParams.getAll(key).length>1)throw new UserError('اختر قيمة واحدة لكل خطوة.');
        if(path.endsWith('/enrollment'))admin.requireAccess(u.id,'school.students');
        const school=admin.school(u.id),selection=schoolSelection(school,Object.fromEntries(url.searchParams));
        if(path.endsWith('/enrollment')){
          if(!selection.grade||selection.classId)throw new UserError('اختر المسار والمرحلة والصف أولًا، ثم حدد الطلاب قبل الفصل.');
          return html('إضافة طلاب الصف إلى فصل',ui.adminSchoolEnrollment(profile,school,selection));
        }
        return html('الصفوف والفصول',ui.adminSchool(profile,school,selection));
      }
      if(path==='/admin/accounts')return html('أعضاء الإدارة',ui.adminAccounts(profile,admin.members(u.id)));
      if(path==='/admin/agents')return html('وكلاء التسجيل',ui.adminRegistrationAgents(profile,store.registration.agents(u.id)));
      if(path==='/admin/accounts/new'){admin.requireAccess(u.id,'supervisor');return html('إضافة عضو إدارة',ui.adminAccountForm(profile));}
      const account=path.match(/^\/admin\/accounts\/([\da-f-]{36})$/i);
      if(account){const member=admin.members(u.id).find(m=>m.id===account[1]);if(!member)throw new UserError('العضو غير متاح.',404);return html('صلاحيات العضو',ui.adminAccountForm(profile,member));}
      if(path==='/admin/finance')return html('المحاسبة المالية',ui.adminFinance(profile,admin.ledger(u.id)));
      if(path==='/admin/registration')return html('التسجيل وشؤون الطلاب',ui.adminRegistration(profile,admin.registration(u.id)));
      if(path==='/admin/education')return html('الشؤون التعليمية',ui.adminEducation(profile,admin.education(u.id)));
      if(path==='/admin/education/teachers/new'){admin.requireAccess(u.id,'education.write');return html('دعوة معلم',ui.adminTeacherForm(profile));}
      if(path==='/admin/operations')return html('الأعمال الإدارية',ui.adminOperations(profile,admin.operations(u.id)));
      if(path==='/admin/technical')return html('القسم الفني',ui.adminTechnical(profile,admin.technical(u.id)));
      if(path==='/admin/libraries')return html('المكتبات والوسائل',ui.adminLibraries(profile,admin.libraries(u.id)));
      if(path==='/admin/audit')return html('سجل التغييرات',ui.adminAudit(profile,admin.auditLog(u.id)));
    }else if(req.method==='POST') {
      if(req.headers.origin!==base)throw new UserError('تعذّر التحقق من مصدر الطلب. افتح التطبيق مجددًا.',403);
      limit(req,'admin-write',180);
      const data=await fields(req);
      if(path==='/admin/agents'){
        store.registration.setPermissions(u.id,data.agent,{register_parent:data.register_parent==='on',register_child:data.register_child==='on',manage_status:data.manage_status==='on'},Number(data.rev));
        return redirect('/admin/agents');
      }
      if(path==='/admin/registration-agents/new'||path==='/admin/agents/new')return html('دعوة وكيل تسجيل',invitation(admin.createRegistrationAgent(u.id,{...data,register_parent:data.register_parent==='on',register_child:data.register_child==='on',manage_status:data.manage_status==='on'}),'registration-agents'),201);
      if(path==='/admin/registration-agents/renew'||path==='/admin/agents/renew')return html('تجديد دعوة وكيل',invitation(admin.renewInvitation(u.id,data.agent,'agent'),'registration-agents'));
      const renew=path.match(/^\/admin\/(accounts|education\/teachers)\/([\da-f-]{36})\/renew$/i);
      if(renew)return html('تجديد رابط التفعيل',invitation(admin.renewInvitation(u.id,renew[2],renew[1]==='accounts'?'member':'teacher')));
      if(path==='/admin/demo/switch')return enter(admin.switchDemo(u.id,data.adminRole));
      if(path==='/admin/accounts/new')return html('رابط التفعيل',invitation(admin.createMember(u.id,{...data,permissions:selectedPermissions(data)})),201);
      const account=path.match(/^\/admin\/accounts\/([\da-f-]{36})$/i);
      if(account){
        if(!['0','1'].includes(data.active))throw new UserError('راجع حالة الحساب.');
        admin.updateMember(u.id,account[1],{...data,active:data.active==='1',revision:Number(data.revision),permissions:selectedPermissions(data)});
        return redirect('/admin/accounts');
      }
      if(path==='/admin/school/assignments'||path==='/admin/school/assignments/remove'){
        const selection={gradeId:data.gradeId||'',subject:data.subject||'',teacherId:data.teacherId||'',page:1};
        if(path.endsWith('/remove')){admin.removeSchoolTeacherStudent(u.id,{assignmentId:data.assignmentId});selection.teacherId='';}
        else admin.assignSchoolTeacherStudents(u.id,{...selection,childIds:Object.keys(data).filter(k=>k.startsWith('child_')&&data[k]==='1').map(k=>k.slice(6))});
        return redirect('/admin/school/assignments?'+new URLSearchParams({...selection,page:'1'}));
      }
      if(path==='/admin/school/tracks/initialize'){const track=admin.initializeSchoolLegacyTrack(u.id);return redirect('/admin/school?'+new URLSearchParams({trackId:track.id}));}
      if(path==='/admin/school/tracks'){const trackId=admin.addSchoolTrack(u.id,data);return redirect('/admin/school?'+new URLSearchParams({trackId}));}
      if(path==='/admin/school/grades'){admin.addSchoolGrade(u.id,{...data,grade:Number(data.grade)});return redirect('/admin/school');}
      if(path==='/admin/school/classes'){
        if(data.stage!==undefined||data.grade!==undefined){
          if(data.gradeId!==undefined||data.levelKey!==undefined||!validSchoolLevel(data.stage,Number(data.grade)))throw new UserError('اختر المسار والمرحلة والصف الثابت دون حقول متعارضة.');
          const classId=admin.addSchoolClass(u.id,{trackId:data.trackId,levelKey:data.stage+':'+Number(data.grade),name:data.name,capacity:Number(data.capacity)});
          return redirect(classDestination(classId));
        }
        const classId=admin.addSchoolClass(u.id,{...data,capacity:Number(data.capacity)});return redirect(classDestination(classId));
      }
      if(path==='/admin/school/classes/capacity'){const destination=classDestination(data.classId);admin.updateSchoolClassCapacity(u.id,{...data,capacity:Number(data.capacity),revision:Number(data.revision)});return redirect(destination);}
      if(path==='/admin/school/classes/update'){const destination=classDestination(data.classId);admin.updateSchoolClass(u.id,{...data,revision:Number(data.revision)});return redirect(destination);}
      if(path==='/admin/school/teachers'){const destination=classDestination(data.classId);admin.assignSchoolTeacher(u.id,data);return redirect(destination);}
      if(path==='/admin/school/students/batch'){
        if(data.childId!==undefined)throw new UserError('استخدم اختيار الطلاب للدفعة دون حقول متعارضة.');
        const destination=classDestination(data.classId);
        admin.assignSchoolStudents(u.id,{classId:data.classId,childIds:Object.keys(data).filter(k=>k.startsWith('child_')&&data[k]==='1').map(k=>k.slice(6))});
        return redirect(destination);
      }
      if(path==='/admin/school/students'){const destination=classDestination(data.classId);admin.assignSchoolStudent(u.id,data);return redirect(destination);}
      if(path==='/admin/school/supervisors'){admin.assignSchoolSupervisor(u.id,data);return redirect('/admin/school');}
      if(path==='/admin/school/remove'){const destination=classDestination(data.classId);admin.removeSchoolAssignment(u.id,data);return redirect(destination);}
      if(path==='/admin/technical'){admin.addTicket(u.id,{...data,description:data.description||''});return redirect(path);}
      const ticket=path.match(/^\/admin\/technical\/([\da-f-]{36})$/i);
      if(ticket){admin.updateTicket(u.id,ticket[1],{status:data.status,priority:data.priority,revision:Number(data.revision)});return redirect('/admin/technical');}
      if(path==='/admin/libraries'){admin.addLibrary(u.id,{...data,description:data.description||'',attribution:data.attribution||''});return redirect(path);}
      const library=path.match(/^\/admin\/libraries\/([\da-f-]{36})$/i);
      if(library){if(!['0','1'].includes(data.active))throw new UserError('راجع حالة المورد.');admin.updateLibrary(u.id,library[1],{active:data.active==='1',revision:Number(data.revision)});return redirect('/admin/libraries');}
      if(path==='/admin/finance'){admin.addLedger(u.id,data);return redirect(path);}
      if(path==='/admin/education/teachers')return html('رابط تفعيل المعلم',invitation(admin.createTeacher(u.id,{...data,subjects:data.subjects?csv(data.subjects):Object.keys(subjects).filter(key=>data['teacher_subject_'+key]==='1'),grades:data.grades?csv(data.grades).map(Number):[1,2,3,4,5,6].filter(grade=>data['teacher_grade_'+grade]==='1')})),201);
      if(path==='/admin/education/slots'){
        const start=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(data.start)?Date.parse(data.start+':00+03:00'):NaN;
        admin.addSlot(u.id,{...data,start,minutes:Number(data.minutes),instructions:data.instructions||''});return redirect('/admin/education');
      }
      if(path==='/admin/operations'){admin.addOperation(u.id,data);return redirect(path);}
      const task=path.match(/^\/admin\/operations\/([\da-f-]{36})$/i);
      if(task){admin.updateOperation(u.id,task[1],{status:data.status,revision:Number(data.revision)});return redirect('/admin/operations');}
    }
    throw new UserError('الصفحة غير موجودة.',404);
  }};
}
