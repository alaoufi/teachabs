import {createTechnicalStore} from './admin-technical.mjs';
import {randomUUID} from 'node:crypto';

export const ADMIN_ROLES = Object.freeze({supervisor:'الإشراف العام',finance:'المحاسبة المالية',registration:'التسجيل وشؤون الطلاب',education:'الشؤون التعليمية',deputy:'الوكيل الإداري',technical:'القسم الفني'});
export const ADMIN_PERMISSIONS = Object.freeze({'finance.read':'عرض السجل المالي','finance.write':'إضافة قيد مالي','registration.read':'عرض ملفات الطلاب','education.read':'عرض المعلمين والجداول','education.write':'إدارة المعلمين والجداول','operations.read':'عرض الأعمال الإدارية','operations.write':'إدارة الأعمال الإدارية','audit.read':'عرض سجل التغييرات','technical.read':'عرض الأعطال والدعم الفني','technical.write':'إدارة الأعطال والدعم الفني','libraries.read':'عرض فهرس المكتبات والوسائل','libraries.write':'إدارة فهرس المكتبات والوسائل'});
export const DEFAULT_GRANTS = Object.freeze({supervisor:Object.keys(ADMIN_PERMISSIONS),finance:['finance.read','finance.write'],registration:['registration.read'],education:['education.read','education.write'],deputy:['operations.read','operations.write'],technical:['technical.read','technical.write','libraries.read','libraries.write']});
const writes = {'finance.write':'finance.read','education.write':'education.read','operations.write':'operations.read','technical.write':'technical.read','libraries.write':'libraries.read'};
const validText=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.trim().length<=max;
const validKey=value=>typeof value==='string'&&/^[\da-f-]{36}$/i.test(value);

// Every operation reloads the actor and permissions from storage. Form fields and
// session snapshots never supply authority. Every query is bound to actor scope.
export function createAdminStore({db,one,all,run,transaction,user,UserError,subjects,grades,duration,validEmail,secret,hash,tour}) {
  const check=(ok,message,status=400)=>{if(!ok)throw new UserError(message,status);};
  db.exec(`CREATE TABLE IF NOT EXISTS admin_demo_agents(scope TEXT PRIMARY KEY,agent TEXT UNIQUE NOT NULL REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS admin_members(user TEXT PRIMARY KEY REFERENCES users(id),department TEXT NOT NULL,permissions TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,revision INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS admin_audit(id TEXT PRIMARY KEY,scope TEXT NOT NULL,actor TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,target TEXT NOT NULL,details TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS admin_ledger(id TEXT PRIMARY KEY,scope TEXT NOT NULL,actor TEXT NOT NULL REFERENCES users(id),description TEXT NOT NULL,amount_cents INTEGER NOT NULL CHECK(amount_cents>0),kind TEXT NOT NULL CHECK(kind IN ('income','expense')),request TEXT NOT NULL,created INTEGER NOT NULL,UNIQUE(actor,request));
    CREATE TABLE IF NOT EXISTS admin_operations(id TEXT PRIMARY KEY,scope TEXT NOT NULL,title TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',revision INTEGER NOT NULL DEFAULT 1,actor TEXT NOT NULL REFERENCES users(id),request TEXT NOT NULL,created INTEGER NOT NULL,UNIQUE(actor,request));
    CREATE TABLE IF NOT EXISTS admin_slot_requests(actor TEXT NOT NULL REFERENCES users(id),request TEXT NOT NULL,slot TEXT NOT NULL REFERENCES slots(id),payload TEXT NOT NULL,PRIMARY KEY(actor,request));
    CREATE INDEX IF NOT EXISTS admin_audit_scope ON admin_audit(scope,created);
    CREATE INDEX IF NOT EXISTS admin_ledger_scope ON admin_ledger(scope,created);`);
  function profile(id) {
    const u=user(id),m=one('SELECT department,permissions,active,revision FROM admin_members WHERE user=?',id);
    check(u.role==='admin'&&m&&m.active===1,'هذا القسم غير متاح لهذا الحساب.',403);
    const adminRole=m.department;
    check(Object.hasOwn(ADMIN_ROLES,adminRole),'هذا القسم غير متاح لهذا الحساب.',403);
    const permissions=adminRole==='supervisor'?[...DEFAULT_GRANTS.supervisor]:JSON.parse(m.permissions);
    return {...u,adminRole,permissions,active:!!m.active,revision:m.revision};
  }
  function requireAccess(id,permission) {
    const actor=profile(id);
    check(permission==='supervisor'?actor.adminRole==='supervisor':actor.permissions.includes(permission),'ليست لديك صلاحية لهذه العملية. تواصل مع المشرف العام.',403);
    return actor;
  }
  function audit(actor,action,target,details={}) {
    run('INSERT INTO admin_audit VALUES(?,?,?,?,?,?,?)',randomUUID(),actor.scope,actor.id,action,target,JSON.stringify(details),Date.now());
  }
  function grants(role,values) {
    check(Object.hasOwn(ADMIN_ROLES,role),'اختر قسمًا إداريًا صحيحًا.');
    check(Array.isArray(values)&&values.length<=Object.keys(ADMIN_PERMISSIONS).length&&values.every(v=>Object.hasOwn(ADMIN_PERMISSIONS,v)),'الصلاحيات غير صالحة.');
    const selected=[...new Set(values)].sort();
    check(selected.every(v=>!writes[v]||selected.includes(writes[v])),'صلاحية التعديل تحتاج إلى صلاحية العرض للقسم نفسه.');
    return role==='supervisor'?[...DEFAULT_GRANTS.supervisor]:selected;
  }
  function emailForScope(email,scope) {
    const value=validEmail(email);
    check(!scope||value.endsWith('@example.invalid'),'استخدم بريدًا افتراضيًا ينتهي بـ @example.invalid في الجولة.');
    return value;
  }
  function insertMember(scope,{name,email,adminRole,permissions}) {
    check(validText(name,60),'اكتب اسم العضو في ٦٠ حرفًا أو أقل.');
    email=emailForScope(email,scope);permissions=grants(adminRole,permissions);
    check(!one('SELECT id FROM users WHERE email=?',email),'البريد مستخدم بالفعل. اختر بريدًا آخر.',409);
    const id=randomUUID(),token=secret();
    run("INSERT INTO users(id,role,name,email,scope) VALUES(?,'admin',?,?,?)",id,name.trim(),email,scope);
    run('INSERT INTO admin_members(user,department,permissions) VALUES(?,?,?)',id,adminRole,JSON.stringify(permissions));
    run('INSERT INTO invites VALUES(?,?,?)',hash(token),id,Date.now()+86400000);
    return {id,name:name.trim(),token};
  }
  function bootstrap(values) {
    return transaction(()=>{
      const existing=one("SELECT u.id,u.name,u.email,u.pass,m.active FROM admin_members m JOIN users u ON u.id=m.user WHERE u.scope='' AND m.department='supervisor' ORDER BY u.rowid LIMIT 1");
      if(existing){
        check(!existing.pass&&existing.active===1&&existing.email===validEmail(values.email),'تم إنشاء الإشراف العام بالفعل. أضف الأعضاء من حساب المشرف.',409);
        const token=secret();run('DELETE FROM invites WHERE user=?',existing.id);run('INSERT INTO invites VALUES(?,?,?)',hash(token),existing.id,Date.now()+86400000);
        audit({id:existing.id,scope:''},'supervisor.invitation_renewed',existing.id,{});return {id:existing.id,name:existing.name,token};
      }
      const result=insertMember('',{...values,adminRole:'supervisor',permissions:[...DEFAULT_GRANTS.supervisor]});
      audit({id:result.id,scope:''},'supervisor.bootstrap',result.id,{adminRole:'supervisor'});
      return result;
    });
  }
  function members(actorId) {
    const a=requireAccess(actorId,'supervisor');
    return all(`SELECT u.id,u.name,u.email,m.department adminRole,m.permissions,m.active,m.revision,(u.pass IS NOT NULL OR (u.scope<>'' AND u.email IS NULL)) activated FROM admin_members m JOIN users u ON u.id=m.user WHERE u.scope=? ORDER BY m.department,u.name`,a.scope).map(v=>({...v,permissions:v.adminRole==='supervisor'?[...DEFAULT_GRANTS.supervisor]:JSON.parse(v.permissions),active:!!v.active,activated:!!v.activated}));
  }
  function createMember(actorId,values) {
    return transaction(()=>{const a=requireAccess(actorId,'supervisor'),result=insertMember(a.scope,values);audit(a,'member.created',result.id,{adminRole:values.adminRole,permissions:grants(values.adminRole,values.permissions)});return result;});
  }
  function createRegistrationAgent(actorId,values){return transaction(()=>{const a=requireAccess(actorId,'supervisor');check(validText(values.name,60),'Invalid agent name');const email=emailForScope(values.email,a.scope);check(!one('SELECT id FROM users WHERE email=?',email),'Email already registered',409);const keys=['register_parent','register_child','manage_status'];check(keys.every(k=>typeof values[k]==='boolean'),'Invalid agent permissions');const id=randomUUID(),token=secret();run("INSERT INTO users(id,role,name,email,scope) VALUES(?,'registration_agent',?,?,?)",id,values.name.trim(),email,a.scope);run('INSERT INTO registration_permissions VALUES(?,?,?,?,0)',id,...keys.map(k=>values[k]?1:0));run('INSERT INTO invites VALUES(?,?,?)',hash(token),id,Date.now()+86400000);audit(a,'registration_agent.invited',id,{permissions:Object.fromEntries(keys.map(k=>[k,values[k]]))});return {id,name:values.name.trim(),token};});}
  function renewInvitation(actorId,targetId,type='member') {
    return transaction(()=>{
      const a=requireAccess(actorId,type==='teacher'?'education.write':'supervisor');
      check(['member','teacher','agent'].includes(type),'نوع الدعوة غير صالح.');
      const target=one('SELECT id,name,role,pass,email FROM users WHERE id=? AND scope=?',targetId,a.scope);
      check(target&&target.role===(type==='teacher'?'teacher':type==='agent'?'registration_agent':'admin'),'الحساب غير متاح.',404);
      check(target.email,'حسابات الجولة الأساسية جاهزة للتبديل ولا تحتاج إلى دعوة.',409);
      check(!target.pass,'هذا الحساب مفعّل بالفعل.',409);
      if(type==='member')check(one('SELECT active FROM admin_members WHERE user=?',targetId)?.active===1,'فعّل حالة العضو قبل تجديد الدعوة.',409);
      const token=secret();run('DELETE FROM invites WHERE user=?',targetId);run('INSERT INTO invites VALUES(?,?,?)',hash(token),targetId,Date.now()+86400000);
      audit(a,type+'.invitation_renewed',targetId,{});return {id:targetId,name:target.name,token};
    });
  }
  function updateMember(actorId,targetId,values) {
    return transaction(()=>{
      const a=requireAccess(actorId,'supervisor');
      const target=one('SELECT u.id,u.scope,m.* FROM users u JOIN admin_members m ON m.user=u.id WHERE u.id=? AND u.scope=?',targetId,a.scope);
      check(target,'العضو غير متاح.',404);
      check(Number.isSafeInteger(values.revision)&&values.revision===target.revision,'تغيّر الحساب منذ فتح النموذج. حدّث الصفحة ثم أعد المحاولة.',409);
      check(validText(values.name,60)&&typeof values.active==='boolean','راجع اسم العضو وحالة الحساب.');
      const permissions=grants(values.adminRole,values.permissions);
      check(targetId!==actorId||(values.active&&values.adminRole==='supervisor'),'لا يمكنك إيقاف حسابك أو إزالة دور الإشراف عنه.',409);
      if(target.active===1&&target.department==='supervisor'&&(!values.active||values.adminRole!=='supervisor')){
        const count=one("SELECT count(*) n FROM admin_members m JOIN users u ON u.id=m.user WHERE u.scope=? AND m.department='supervisor' AND m.active=1",a.scope).n;
        check(count>1,'يجب الإبقاء على مشرف عام فعّال واحد على الأقل.',409);
      }
      run('UPDATE users SET name=? WHERE id=?',values.name.trim(),targetId);
      run('UPDATE admin_members SET department=?,permissions=?,active=?,revision=revision+1 WHERE user=?',values.adminRole,JSON.stringify(permissions),values.active?1:0,targetId);
      // All existing sessions are revoked after an authority change, including a
      // changed supervisor account. The actor must sign in again if editing self.
      if(target.department!==values.adminRole||target.permissions!==JSON.stringify(permissions)||target.active!==Number(values.active))run('DELETE FROM sessions WHERE user=?',targetId);
      audit(a,'member.updated',targetId,{before:{adminRole:target.department,permissions:JSON.parse(target.permissions),active:!!target.active},after:{adminRole:values.adminRole,permissions,active:values.active}});
    });
  }
  function overview(actorId) {
    const a=profile(actorId),has=p=>a.permissions.includes(p),count=(sql,...args)=>one(sql,...args).n;
    return {members:a.adminRole==='supervisor'?count('SELECT count(*) n FROM admin_members m JOIN users u ON u.id=m.user WHERE u.scope=? AND m.active=1',a.scope):null,
      students:has('registration.read')?count('SELECT count(*) n FROM children c JOIN users p ON p.id=c.parent WHERE p.scope=?',a.scope):null,
      teachers:has('education.read')?count("SELECT count(*) n FROM users WHERE scope=? AND role='teacher'",a.scope):null,
      slots:has('education.read')?count('SELECT count(*) n FROM slots s JOIN users u ON u.id=s.teacher WHERE u.scope=? AND s.active=1 AND s.start>?',a.scope,Date.now()):null,
      entries:has('finance.read')?count('SELECT count(*) n FROM admin_ledger WHERE scope=?',a.scope):null,
      tickets:has('technical.read')?count("SELECT count(*) n FROM admin_technical_tickets WHERE scope=? AND status<>'resolved'",a.scope):null,
      libraries:has('libraries.read')?count('SELECT count(*) n FROM admin_libraries WHERE scope=? AND active=1',a.scope):null,
      tasks:has('operations.read')?count("SELECT count(*) n FROM admin_operations WHERE scope=? AND status<>'done'",a.scope):null};
  }
  function ledger(actorId) {const a=requireAccess(actorId,'finance.read');return all('SELECT l.id,l.description,l.amount_cents amountCents,l.kind,l.created,u.name actorName FROM admin_ledger l JOIN users u ON u.id=l.actor WHERE l.scope=? ORDER BY l.created DESC,l.rowid DESC',a.scope);}
  function addLedger(actorId,values) {
    return transaction(()=>{
      const a=requireAccess(actorId,'finance.write');
      check(validText(values.description,160)&&['income','expense'].includes(values.kind)&&typeof values.amount==='string'&&/^\d{1,7}(\.\d{1,2})?$/.test(values.amount),'راجع وصف القيد ونوعه والمبلغ بالريال.');
      const [whole,fraction='']=values.amount.split('.'),cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
      check(cents>0&&cents<=100000000&&validKey(values.request),'أدخل مبلغًا موجبًا لا يتجاوز مليون ريال ونموذجًا صالحًا.');
      const existing=one('SELECT * FROM admin_ledger WHERE actor=? AND request=?',a.id,values.request);
      if(existing){check(existing.description===values.description.trim()&&existing.amount_cents===cents&&existing.kind===values.kind,'استُخدم هذا النموذج لقيد مختلف. حدّث الصفحة.',409);return existing.id;}
      const id=randomUUID();run('INSERT INTO admin_ledger VALUES(?,?,?,?,?,?,?,?)',id,a.scope,a.id,values.description.trim(),cents,values.kind,values.request,Date.now());audit(a,'finance.created',id,{kind:values.kind,amountCents:cents});return id;
    });
  }
  function registration(actorId) {const a=requireAccess(actorId,'registration.read');return all('SELECT c.id,c.name,c.grade,c.curriculum,c.language,p.name parentName FROM children c JOIN users p ON p.id=c.parent WHERE p.scope=? ORDER BY c.name',a.scope);}
  function education(actorId) {
    const a=requireAccess(actorId,'education.read');
    return {teachers:all("SELECT id,name,subjects,grades,language,(pass IS NOT NULL OR (scope<>'' AND email IS NULL)) activated FROM users WHERE scope=? AND role='teacher' ORDER BY name",a.scope).map(t=>({...t,activated:!!t.activated,subjects:JSON.parse(t.subjects||'[]'),grades:JSON.parse(t.grades||'[]')})),slots:all("SELECT s.id,s.teacher,u.name teacherName,s.subject,s.start,s.minutes,(u.pass IS NOT NULL OR (u.scope<>'' AND u.email IS NULL)) teacherActivated,EXISTS(SELECT 1 FROM bookings b WHERE b.slot=s.id AND b.status='confirmed') booked FROM slots s JOIN users u ON u.id=s.teacher WHERE u.scope=? AND s.active=1 AND s.start>? ORDER BY s.start",a.scope,Date.now()).map(s=>({...s,teacherActivated:!!s.teacherActivated}))};
  }
  function createTeacher(actorId,values) {
    return transaction(()=>{
      const a=requireAccess(actorId,'education.write'),email=emailForScope(values.email,a.scope);
      check(validText(values.name,60)&&Array.isArray(values.subjects)&&values.subjects.length&&values.subjects.every(k=>Object.hasOwn(subjects,k)),'راجع اسم المعلم ومواده.');
      check(Array.isArray(values.grades)&&values.grades.length&&values.grades.every(g=>Number.isInteger(g)&&g>=1&&g<=6)&&['ar','en'].includes(values.language),'راجع الصفوف ولغة التدريس.');
      check(!one('SELECT id FROM users WHERE email=?',email),'البريد مستخدم بالفعل. اختر بريدًا آخر.',409);
      const id=randomUUID(),token=secret();
      run("INSERT INTO users(id,role,name,email,scope,subjects,grades,language) VALUES(?,'teacher',?,?,?,?,?,?)",id,values.name.trim(),email,a.scope,JSON.stringify([...new Set(values.subjects)]),JSON.stringify([...new Set(values.grades)]),values.language);
      run('INSERT INTO invites VALUES(?,?,?)',hash(token),id,Date.now()+86400000);
      audit(a,'teacher.invited',id,{subjects:values.subjects,grades:values.grades,language:values.language});return {id,name:values.name.trim(),token};
    });
  }
  function addSlot(actorId,values) {
    return transaction(()=>{
      const a=requireAccess(actorId,'education.write');
      const teacher=one("SELECT * FROM users WHERE id=? AND role='teacher' AND scope=?",values.teacher||'',a.scope);
      check(teacher,'المعلم غير متاح.',404);
      check(JSON.parse(teacher.subjects||'[]').includes(values.subject),'المادة خارج اعتماد المعلم.',403);
      check([30,45].includes(values.minutes)&&JSON.parse(teacher.grades||'[]').some(g=>duration(g)===values.minutes),'راجع مدة الحصة وصفوف المعلم.');
      check(Number.isSafeInteger(values.start)&&values.start>Date.now()&&values.start<Date.now()+366*86400000,'اختر وقتًا مستقبليًا خلال السنة القادمة.');
      check(typeof values.instructions==='string'&&values.instructions.length<=350&&validKey(values.request),'راجع ملاحظات الموعد وحدّث النموذج.');
      const instructions=values.instructions.trim()||'افتح تفاصيل الحجز واضغط «دخول الحصة».',payload=JSON.stringify([teacher.id,values.subject,values.minutes,values.start,instructions]);
      const existing=one('SELECT slot,payload FROM admin_slot_requests WHERE actor=? AND request=?',a.id,values.request);
      if(existing){check(existing.payload===payload,'استُخدم النموذج لموعد مختلف. حدّث الصفحة.',409);return existing.slot;}
      check(!one('SELECT id FROM slots WHERE teacher=? AND active=1 AND start<? AND start+minutes*60000>?',teacher.id,values.start+values.minutes*60000,values.start),'للمعلم موعد متداخل في هذه الفترة.',409);
      const id=randomUUID();run('INSERT INTO slots(id,teacher,subject,minutes,start,instructions) VALUES(?,?,?,?,?,?)',id,teacher.id,values.subject,values.minutes,values.start,instructions);
      run('INSERT INTO admin_slot_requests VALUES(?,?,?,?)',a.id,values.request,id,payload);audit(a,'schedule.created',id,{teacher:teacher.id,subject:values.subject,start:values.start,minutes:values.minutes});return id;
    });
  }
  function operations(actorId) {const a=requireAccess(actorId,'operations.read');return all('SELECT id,title,status,revision,created FROM admin_operations WHERE scope=? ORDER BY created DESC,rowid DESC',a.scope);}
  function addOperation(actorId,values) {
    return transaction(()=>{const a=requireAccess(actorId,'operations.write');check(validText(values.title,160)&&validKey(values.request),'اكتب عنوان العمل في ١٦٠ حرفًا أو أقل.');
      const existing=one('SELECT id,title FROM admin_operations WHERE actor=? AND request=?',a.id,values.request);if(existing){check(existing.title===values.title.trim(),'استُخدم النموذج لعمل مختلف. حدّث الصفحة.',409);return existing.id;}
      const id=randomUUID();run('INSERT INTO admin_operations(id,scope,title,actor,request,created) VALUES(?,?,?,?,?,?)',id,a.scope,values.title.trim(),a.id,values.request,Date.now());audit(a,'operation.created',id,{status:'open'});return id;});
  }
  function updateOperation(actorId,id,values) {
    return transaction(()=>{const a=requireAccess(actorId,'operations.write'),row=one('SELECT * FROM admin_operations WHERE id=? AND scope=?',id,a.scope);check(row,'العمل غير متاح.',404);check(Number.isSafeInteger(values.revision)&&values.revision===row.revision,'تغيّر العمل منذ فتح الصفحة. حدّث الصفحة.',409);check(['open','in_progress','done'].includes(values.status),'اختر حالة صحيحة.');run('UPDATE admin_operations SET status=?,revision=revision+1 WHERE id=?',values.status,id);audit(a,'operation.updated',id,{before:row.status,after:values.status});});
  }
  function auditLog(actorId) {const a=requireAccess(actorId,'audit.read');return all('SELECT a.id,u.name actorName,a.action,a.target,a.details,a.created FROM admin_audit a JOIN users u ON u.id=a.actor WHERE a.scope=? ORDER BY a.created DESC,a.rowid DESC LIMIT 300',a.scope).map(r=>({...r,details:JSON.parse(r.details)}));}
  function demo() {
    // Reuse only freshly created synthetic teaching records, never the current
    // user's live records. Every demo receives a new isolated random scope.
    const teaching=tour(),scope=user(teaching.parent).scope;
    return transaction(()=>{
      const result={};
      for(const [adminRole,label] of Object.entries(ADMIN_ROLES)){
        const id=randomUUID();run("INSERT INTO users(id,role,name,scope) VALUES(?,'admin',?,?)",id,'عضو '+label+' التجريبي',scope);
        run('INSERT INTO admin_members(user,department,permissions) VALUES(?,?,?)',id,adminRole,JSON.stringify(DEFAULT_GRANTS[adminRole]));result[adminRole]=id;
      }
      const agent=randomUUID();run("INSERT INTO users(id,role,name,scope) VALUES(?,'registration_agent','سارة أحمد — وكيل تسجيل تجريبي',?)",agent,scope);run('INSERT INTO admin_demo_agents VALUES(?,?)',scope,agent);run('INSERT INTO registration_permissions VALUES(?,1,1,1,0)',agent);
        audit({id:result.supervisor,scope},'demo.created',scope,{synthetic:true});
      addLedger(result.finance,{description:'مثال توضيحي: رسوم حصة افتراضية',amount:'120',kind:'income',request:randomUUID()});
      addOperation(result.deputy,{title:'مراجعة جاهزية الفصل التجريبي',request:randomUUID()});
      technicalStore.addTicket(result.technical,{title:'فحص الدخول إلى الفصل التجريبي',description:'بلاغ افتراضي لتجربة متابعة الدعم الفني فقط.',category:'support',priority:'normal',request:randomUUID()});
      return result;
    });
  }
  function isDemoAgent(id){const u=user(id);return u.role==='registration_agent'&&!!u.scope&&!!one('SELECT agent FROM admin_demo_agents WHERE scope=? AND agent=?',u.scope,id);}
  function switchDemo(actorId,adminRole) {const a=isDemoAgent(actorId)?user(actorId):profile(actorId);check(a.scope&&(adminRole==='registration_agent'||Object.hasOwn(ADMIN_ROLES,adminRole)),'التبديل متاح داخل الجولة الإدارية فقط.',403);if(adminRole==='registration_agent'){const r=one('SELECT agent FROM admin_demo_agents WHERE scope=?',a.scope);check(r,'Start a new administrative demo to use the agent',404);return r.agent;}const row=one('SELECT u.id FROM users u JOIN admin_members m ON m.user=u.id WHERE u.scope=? AND m.department=? AND m.active=1 ORDER BY u.rowid LIMIT 1',a.scope,adminRole);check(row,'حساب القسم غير متاح في هذه الجولة.',404);return row.id;}
  const technicalStore=createTechnicalStore({db,one,all,run,transaction,requireAccess,audit,check});
  return {...technicalStore,profile,requireAccess,bootstrap,members,createMember,createRegistrationAgent,renewInvitation,updateMember,overview,ledger,addLedger,registration,education,createTeacher,addSlot,operations,addOperation,updateOperation,auditLog,demo,switchDemo,isDemoAgent};
}
