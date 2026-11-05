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
    const invitation=result=>ui.adminInviteResult(profile,{...result,activationUrl:new URL('/activate?code='+result.token,base).href});
    if(req.method==='GET') {
      if(path==='/admin')return html('الإدارة',ui.adminHome(profile,admin.overview(u.id)));
      if(path==='/admin/accounts')return html('أعضاء الإدارة',ui.adminAccounts(profile,admin.members(u.id)));
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
