import {randomUUID} from 'node:crypto';
import {isIP} from 'node:net';
const text=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=max;
const key=v=>typeof v==='string'&&/^[\da-f-]{36}$/i.test(v);
export function createTechnicalStore({db,one,all,run,transaction,requireAccess,audit,check}) {
  db.exec(`CREATE TABLE IF NOT EXISTS admin_technical_tickets(id TEXT PRIMARY KEY,scope TEXT NOT NULL,actor TEXT NOT NULL REFERENCES users(id),title TEXT NOT NULL,description TEXT NOT NULL,category TEXT NOT NULL,priority TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',revision INTEGER NOT NULL DEFAULT 1,request TEXT NOT NULL,created INTEGER NOT NULL,UNIQUE(actor,request));
    CREATE TABLE IF NOT EXISTS admin_libraries(id TEXT PRIMARY KEY,scope TEXT NOT NULL,actor TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,description TEXT NOT NULL,url TEXT NOT NULL,category TEXT NOT NULL,license TEXT NOT NULL,attribution TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,revision INTEGER NOT NULL DEFAULT 1,request TEXT NOT NULL,created INTEGER NOT NULL,UNIQUE(actor,request));
    CREATE INDEX IF NOT EXISTS admin_tickets_scope ON admin_technical_tickets(scope,status);
    CREATE INDEX IF NOT EXISTS admin_libraries_scope ON admin_libraries(scope,active);`);
  function technical(actorId){const a=requireAccess(actorId,'technical.read');return all('SELECT t.id,t.title,t.description,t.category,t.priority,t.status,t.revision,t.created,u.name actorName FROM admin_technical_tickets t JOIN users u ON u.id=t.actor WHERE t.scope=? ORDER BY t.created DESC,t.rowid DESC',a.scope);}
  function addTicket(actorId,v){return transaction(()=>{
    const a=requireAccess(actorId,'technical.write');
    check(text(v.title,160)&&typeof v.description==='string'&&v.description.length<=1000&&['outage','support'].includes(v.category)&&['normal','high','urgent'].includes(v.priority)&&key(v.request),'راجع عنوان البلاغ ونوعه وأولويته ووصفه.');
    const title=v.title.trim(),description=v.description.trim(),existing=one('SELECT * FROM admin_technical_tickets WHERE actor=? AND request=?',a.id,v.request);
    if(existing){check(existing.title===title&&existing.description===description&&existing.category===v.category&&existing.priority===v.priority,'استُخدم هذا النموذج لبلاغ مختلف. حدّث الصفحة.',409);return existing.id;}
    const id=randomUUID();run('INSERT INTO admin_technical_tickets(id,scope,actor,title,description,category,priority,request,created) VALUES(?,?,?,?,?,?,?,?,?)',id,a.scope,a.id,title,description,v.category,v.priority,v.request,Date.now());audit(a,'technical.created',id,{category:v.category,priority:v.priority,status:'open'});return id;
  });}
  function updateTicket(actorId,id,v){return transaction(()=>{
    const a=requireAccess(actorId,'technical.write'),row=one('SELECT * FROM admin_technical_tickets WHERE id=? AND scope=?',id,a.scope);check(row,'البلاغ غير متاح.',404);
    check(Number.isSafeInteger(v.revision)&&row.revision===v.revision,'تغيّر البلاغ منذ فتح الصفحة. حدّث الصفحة.',409);
    check(['open','in_progress','resolved'].includes(v.status)&&['normal','high','urgent'].includes(v.priority),'راجع حالة البلاغ وأولويته.');
    run('UPDATE admin_technical_tickets SET status=?,priority=?,revision=revision+1 WHERE id=?',v.status,v.priority,id);audit(a,'technical.updated',id,{before:{status:row.status,priority:row.priority},after:{status:v.status,priority:v.priority}});
  });}
  function resourceUrl(value){
    check(text(value,1000),'أدخل رابط مصدر صالحًا.');
    let url;try{url=new URL(value);}catch{check(false,'أدخل رابط HTTPS صالحًا.');}
    const host=url.hostname.toLowerCase().replace(/\.$/,'');
    check(url.protocol==='https:'&&!url.username&&!url.password&&(!url.port||url.port==='443')&&host.includes('.')&&!isIP(host)&&!host.startsWith('[')&&!/(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host),'استخدم رابط HTTPS عامًا دون بيانات دخول أو عنوان شبكة داخلية.');
    return url.href;
  }
  function libraries(actorId){const a=requireAccess(actorId,'libraries.read');return all('SELECT l.id,l.name,l.description,l.url,l.category,l.license,l.attribution,l.active,l.revision,l.created,u.name actorName FROM admin_libraries l JOIN users u ON u.id=l.actor WHERE l.scope=? ORDER BY l.created DESC,l.rowid DESC',a.scope).map(r=>({...r,active:!!r.active}));}
  function addLibrary(actorId,v){return transaction(()=>{
    const a=requireAccess(actorId,'libraries.write');
    check(text(v.name,100)&&typeof v.description==='string'&&v.description.length<=400&&['teaching_aid','board_shape'].includes(v.category)&&['own','cc0','cc_by','cc_by_sa','permission'].includes(v.license)&&typeof v.attribution==='string'&&v.attribution.length<=160&&key(v.request),'راجع اسم المورد ونوعه ووصفه والترخيص.');
    check(!['cc_by','cc_by_sa','permission'].includes(v.license)||text(v.attribution,160),'أضف اسم صاحب الحق ونسبة العمل أو مرجع الإذن.');
    const url=resourceUrl(v.url),name=v.name.trim(),description=v.description.trim(),attribution=v.attribution.trim();
    const existing=one('SELECT * FROM admin_libraries WHERE actor=? AND request=?',a.id,v.request);
    if(existing){check(existing.name===name&&existing.description===description&&existing.url===url&&existing.category===v.category&&existing.license===v.license&&existing.attribution===attribution,'استُخدم هذا النموذج لمورد مختلف. حدّث الصفحة.',409);return existing.id;}
    const id=randomUUID();run('INSERT INTO admin_libraries(id,scope,actor,name,description,url,category,license,attribution,request,created) VALUES(?,?,?,?,?,?,?,?,?,?,?)',id,a.scope,a.id,name,description,url,v.category,v.license,attribution,v.request,Date.now());audit(a,'library.created',id,{category:v.category,license:v.license,catalogOnly:true});return id;
  });}
  function updateLibrary(actorId,id,v){return transaction(()=>{
    const a=requireAccess(actorId,'libraries.write'),row=one('SELECT * FROM admin_libraries WHERE id=? AND scope=?',id,a.scope);check(row,'المورد غير متاح.',404);check(Number.isSafeInteger(v.revision)&&v.revision===row.revision,'تغيّر المورد منذ فتح الصفحة. حدّث الصفحة.',409);check(typeof v.active==='boolean','راجع حالة المورد.');
    run('UPDATE admin_libraries SET active=?,revision=revision+1 WHERE id=?',v.active?1:0,id);audit(a,'library.updated',id,{before:{active:!!row.active},after:{active:v.active}});
  });}
  return {technical,addTicket,updateTicket,libraries,addLibrary,updateLibrary};
}
