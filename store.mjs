import {savedLessonLibrary} from './saved-lessons.mjs';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, createHash, scryptSync, timingSafeEqual } from 'node:crypto';

export const subjects = {math:'الرياضيات',arabic:'اللغة العربية',science:'العلوم',english:'اللغة الإنجليزية',islamic:'الدراسات الإسلامية'};
export const grades = ['','الأول','الثاني','الثالث','الرابع','الخامس','السادس'];
export const duration = grade => grade <= 3 ? 30 : 45;
export class UserError extends Error {
  constructor(message,status=400){ super(message); this.status=status; }
}
const check = (condition,message,status) => { if(!condition) throw new UserError(message,status); };
const clean = (v,max) => typeof v==='string' && v.trim().length>0 && v.trim().length<=max;
const hash = text => createHash('sha256').update(text).digest('hex');
const secret = () => randomBytes(32).toString('hex');
function passwordHash(password) {
  check(typeof password==='string' && password.length>=10 && password.length<=128,'اختر كلمة مرور من ١٠ إلى ١٢٨ حرفًا.');
  const salt=secret();
  return salt+':'+scryptSync(password,salt,64).toString('hex');
}
function validEmail(email) {
  check(clean(email,180) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'أدخل بريدًا إلكترونيًا صحيحًا.');
  return email.trim().toLowerCase();
}

export function openStore(path) {
  const db=new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,role TEXT NOT NULL,name TEXT NOT NULL,email TEXT UNIQUE,pass TEXT,scope TEXT NOT NULL DEFAULT '',subjects TEXT,grades TEXT,language TEXT);
    CREATE TABLE IF NOT EXISTS invites(token TEXT PRIMARY KEY,user TEXT REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user TEXT REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS children(id TEXT PRIMARY KEY,parent TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,grade INTEGER NOT NULL,curriculum TEXT NOT NULL,language TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS slots(id TEXT PRIMARY KEY,teacher TEXT NOT NULL REFERENCES users(id),subject TEXT NOT NULL,minutes INTEGER NOT NULL,start INTEGER NOT NULL,instructions TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS bookings(id TEXT PRIMARY KEY,parent TEXT NOT NULL REFERENCES users(id),child TEXT NOT NULL REFERENCES children(id),slot TEXT NOT NULL REFERENCES slots(id),request TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'confirmed',cancelled_at INTEGER,cancelled_by TEXT,UNIQUE(parent,request));
    CREATE TABLE IF NOT EXISTS place_value_activities(booking TEXT PRIMARY KEY REFERENCES bookings(id),state TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS single_slot ON bookings(slot) WHERE status='confirmed';
    CREATE INDEX IF NOT EXISTS slot_schedule ON slots(teacher,start);
    CREATE INDEX IF NOT EXISTS child_schedule ON bookings(child,status);`);
  const one=(sql,...args)=>db.prepare(sql).get(...args);
  const all=(sql,...args)=>db.prepare(sql).all(...args);
  const run=(sql,...args)=>db.prepare(sql).run(...args);
  function transaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try {const value=fn();db.exec('COMMIT');return value;}
    catch(e){db.exec('ROLLBACK');throw e;}
  }
  function user(id) {
    const u=one('SELECT id,role,name,scope,subjects,grades,language FROM users WHERE id=?',id);
    check(u,'الحساب غير متاح.',403);
    return {...u,subjects:JSON.parse(u.subjects||'[]'),grades:JSON.parse(u.grades||'[]')};
  }
  function parent(name,email,password) {
    check(clean(name,60),'اكتب اسم ولي الأمر.');
    email=validEmail(email);
    check(!one('SELECT id FROM users WHERE email=?',email),'تعذر إنشاء الحساب بهذا البريد. يمكنك تسجيل الدخول.');
    const id=randomUUID();
    run("INSERT INTO users(id,role,name,email,pass) VALUES(?,'parent',?,?,?)",id,name.trim(),email,passwordHash(password));
    return id;
  }
  function invite({name,email,subjects:allowed,grades:years,language}) {
    email=validEmail(email);
    check(clean(name,60) && Array.isArray(allowed) && allowed.length && allowed.every(k=>Object.hasOwn(subjects,k)),'راجع الاسم والمواد.');
    check(Array.isArray(years) && years.length && years.every(g=>Number.isInteger(g)&&g>=1&&g<=6) && ['ar','en'].includes(language),'راجع الصفوف ولغة التدريس.');
    return transaction(()=>{
      const existing=one('SELECT id,role,pass FROM users WHERE email=?',email);
      check(!existing || (existing.role==='teacher' && !existing.pass),'البريد مرتبط بحساب مُفعّل.');
      const id=existing?.id || randomUUID(), token=secret();
      if(existing){
        run('DELETE FROM invites WHERE user=?',id);
        run('UPDATE users SET name=?,subjects=?,grades=?,language=? WHERE id=?',name.trim(),JSON.stringify(allowed),JSON.stringify(years),language,id);
      }else{
        run("INSERT INTO users(id,role,name,email,subjects,grades,language) VALUES(?,'teacher',?,?,?,?,?)",id,name.trim(),email,JSON.stringify(allowed),JSON.stringify(years),language);
      }
      run('INSERT INTO invites VALUES(?,?,?)',hash(token),id,Date.now()+86400000);
      return token;
    });
  }
  function activate(token,password) {
    return transaction(()=>{
      const row=one('SELECT user FROM invites WHERE token=? AND expires>?',hash(String(token)),Date.now());
      check(row,'انتهت الدعوة أو استُخدمت من قبل.');
      run('UPDATE users SET pass=? WHERE id=?',passwordHash(password),row.user);
      run('DELETE FROM invites WHERE token=?',hash(token));
      return row.user;
    });
  }
  function login(email,password) {
    email=validEmail(email);
    check(typeof password==='string' && password.length<=128,'تعذّر الدخول.',403);
    const u=one('SELECT id,pass FROM users WHERE email=?',email);
    const [salt,digest]=(u?.pass||('unknown:'+ '0'.repeat(128))).split(':');
    const ok=timingSafeEqual(scryptSync(password,salt,64),Buffer.from(digest,'hex'));
    check(ok && u?.pass,'تحقق من البريد وكلمة المرور.',403);
    return u.id;
  }
  function child(parentId,{name,grade,curriculum,language}) {
    check(user(parentId).role==='parent','هذا الإجراء لولي الأمر.',403);
    check(clean(name,40) && Number.isInteger(grade) && grade>=1 && grade<=6 && curriculum==='sa' && ['ar','en'].includes(language),'راجع اسم الطفل وصفّه ومنهجه ولغة التدريس.');
    const id=randomUUID();
    run('INSERT INTO children VALUES(?,?,?,?,?,?)',id,parentId,name.trim(),grade,curriculum,language);
    return id;
  }
  function ownedChild(owner,id) {
    const c=one('SELECT * FROM children WHERE id=? AND parent=?',id,owner);
    check(c,'ملف الطفل غير متاح.',404);return c;
  }
  function slot(teacherId,{subject,minutes,start,instructions}) {
    const teacher=user(teacherId);
    check(teacher.role==='teacher' && teacher.subjects.includes(subject),'المادة خارج نطاق اعتماد المعلم.',403);
    check([30,45].includes(minutes) && teacher.grades.some(g=>duration(g)===minutes),'راجع مدة الحصة وصفوف الاعتماد.');
    check(Number.isSafeInteger(start) && start>Date.now() && start<Date.now()+366*86400000,'اختر وقتًا مستقبليًا خلال السنة القادمة.');
    instructions=instructions??'';
    check(typeof instructions==='string' && instructions.length<=350,'اكتب الملاحظات في ٣٥٠ حرفًا أو أقل.');
    instructions=instructions.trim() || 'افتح تفاصيل الحجز واضغط «دخول الحصة».';
    return transaction(()=>{
      check(!one('SELECT id FROM slots WHERE teacher=? AND active=1 AND start<? AND start+minutes*60000>?',teacherId,start+minutes*60000,start),'لديك موعد متداخل في هذه الفترة.',409);
      const id=randomUUID();
      run('INSERT INTO slots(id,teacher,subject,minutes,start,instructions) VALUES(?,?,?,?,?,?)',id,teacherId,subject,minutes,start,instructions.trim());
      return id;
    });
  }
  function offers(owner,id,subject,slotId=null) {
    const c=ownedChild(owner,id);
    return all(`SELECT s.id,s.teacher,s.subject,s.minutes,s.start,u.name teacherName
      FROM slots s JOIN users u ON u.id=s.teacher JOIN users p ON p.id=?
      WHERE u.scope=p.scope AND u.role='teacher' AND u.language=? AND s.minutes=? AND s.active=1 AND s.start>?
      AND s.subject=? AND (? IS NULL OR s.id=?)
      AND EXISTS(SELECT 1 FROM json_each(u.grades) WHERE value=?)
      AND EXISTS(SELECT 1 FROM json_each(u.subjects) WHERE value=s.subject)
      AND NOT EXISTS(SELECT 1 FROM bookings b JOIN slots other ON other.id=b.slot WHERE b.status='confirmed'
        AND (b.child=? OR other.teacher=s.teacher) AND other.start<s.start+s.minutes*60000 AND other.start+other.minutes*60000>s.start)
      ORDER BY s.start,u.name`,owner,c.language,duration(c.grade),Date.now(),subject,slotId,slotId,c.grade,id);
  }
  function book(owner,childId,slotId,key) {
    check(clean(key,100),'تعذر التحقق من طلب الحجز.');
    return transaction(()=>{
      ownedChild(owner,childId);
      const previous=one('SELECT id,child,slot FROM bookings WHERE parent=? AND request=?',owner,key);
      if(previous){
        check(previous.child===childId && previous.slot===slotId,'تغيّرت تفاصيل طلب الحجز.',409);
        return previous.id;
      }
      const s=one('SELECT subject FROM slots WHERE id=?',slotId);
      check(s && offers(owner,childId,s.subject,slotId).length,'لم يعد الموعد متاحًا. اختر موعدًا آخر.',409);
      const id=randomUUID();
      run('INSERT INTO bookings(id,parent,child,slot,request) VALUES(?,?,?,?,?)',id,owner,childId,slotId,key);
      return id;
    });
  }
  function bookings(id,bookingId=null) {
    return all(`SELECT b.id,b.status,b.cancelled_by,s.start,s.minutes,s.instructions,s.subject,u.name teacherName,c.name childName,c.grade,c.language
      FROM bookings b JOIN slots s ON s.id=b.slot JOIN users u ON u.id=s.teacher JOIN children c ON c.id=b.child
      WHERE (b.parent=? OR s.teacher=?) AND (? IS NULL OR b.id=?) ORDER BY s.start DESC,b.rowid DESC`,id,id,bookingId,bookingId);
  }
  function cancel(id,bookingId) {
    return transaction(()=>{
      const b=one('SELECT b.*,s.teacher,s.start FROM bookings b JOIN slots s ON s.id=b.slot WHERE b.id=? AND (b.parent=? OR s.teacher=?)',bookingId,id,id);
      check(b,'الحجز غير متاح.',404);
      if(b.status!=='confirmed') return;
      check(b.start>Date.now(),'بدأ وقت الحصة بالفعل.');
      const role=b.teacher===id?'teacher':'parent';
      run("UPDATE bookings SET status='cancelled',cancelled_at=?,cancelled_by=? WHERE id=?",Date.now(),role,bookingId);
      if(role==='teacher') run('UPDATE slots SET active=0 WHERE id=?',b.slot);
    });
  }
  function withdraw(teacherId,id) {
    transaction(()=>{
      const s=one('SELECT id FROM slots WHERE teacher=? AND id=? AND active=1 AND start>?',teacherId,id,Date.now());
      check(s,'الموعد غير متاح.',404);
      check(!one("SELECT id FROM bookings WHERE slot=? AND status='confirmed'",id),'ألغِ الحجز المؤكد أولًا.',409);
      run('UPDATE slots SET active=0 WHERE id=?',id);
    });
  }
  function tour() {
    const scope=randomUUID(),p=randomUUID(),t=randomUUID();
    transaction(()=>{
      run("INSERT INTO users(id,role,name,scope) VALUES(?,'parent','ولي الأمر',?)",p,scope);
      run("INSERT INTO users(id,role,name,scope,subjects,grades,language) VALUES(?,'teacher','سارة أحمد',?,'[\"math\",\"science\"]','[1,2,3,4,5,6]','ar')",t,scope);
    });
    const ch=child(p,{name:'نورة',grade:4,curriculum:'sa',language:'ar'});
    const day=new Date();day.setUTCHours(13,0,0,0);
    for(let i=1;i<=3;i++)for(const [h,m,sub] of [[0,45,'math'],[1,30,'math'],[2,45,'science']])
      slot(t,{start:+day+i*86400000+h*3600000,minutes:m,subject:sub,instructions:'هذه جولة توضيحية. لن تُعقد حصة بهذا الموعد.'});
    return {parent:p,teacher:t,child:ch};
  }
  function placeActivity(id) {
    const row=one('SELECT state FROM place_value_activities WHERE booking=?',id);
    return row ? JSON.parse(row.state) : null;
  }
  function changePlace(id, transition) {
    return transaction(()=>{
      const next=transition(placeActivity(id));
      run('INSERT INTO place_value_activities(booking,state) VALUES(?,?) ON CONFLICT(booking) DO UPDATE SET state=excluded.state',id,JSON.stringify(next));
      return next;
    });
  }
  function childResults(owner,childId) {
    const child=ownedChild(owner,childId);
    const rows=all(`SELECT b.id,s.start,u.name teacherName,a.state
      FROM place_value_activities a JOIN bookings b ON b.id=a.booking
      JOIN slots s ON s.id=b.slot JOIN users u ON u.id=s.teacher
      WHERE b.parent=? AND b.child=? AND b.status='confirmed' AND s.subject='math'
        AND s.start+s.minutes*60000<=? AND json_extract(a.state,'$.phase')<>'model'
      ORDER BY s.start DESC`,owner,childId,Date.now());
    return {child,results:rows.map(row=>({...row,state:JSON.parse(row.state)}))};
  }
  db.exec('CREATE TABLE IF NOT EXISTS lesson_boards(id TEXT PRIMARY KEY,state TEXT NOT NULL,updated INTEGER NOT NULL)');
  const readBoard=id=>{const r=one('SELECT state FROM lesson_boards WHERE id=?',id);return r?JSON.parse(r.state):null;};
  const writeBoard=(id,state)=>run('INSERT INTO lesson_boards VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state,updated=excluded.updated',id,JSON.stringify(state),Date.now());
  return {savedLessons:savedLessonLibrary(db),readBoard,writeBoard,close:()=>db.close(),user,parent,invite,activate,login,child,ownedChild,slot,offers,book,bookings,cancel,withdraw,tour,
    placeActivity,changePlace,childResults,
    children:id=>all('SELECT * FROM children WHERE parent=? ORDER BY rowid',id),
    schedule:id=>all(`SELECT s.*,EXISTS(SELECT 1 FROM bookings b WHERE b.slot=s.id AND b.status='confirmed') booked FROM slots s WHERE teacher=? AND active=1 AND start>? ORDER BY start`,id,Date.now()),
    switchTour:id=>{const u=user(id);check(u.scope,'هذه الميزة للجولة فقط.',403);return one('SELECT id FROM users WHERE scope=? AND id<>?',u.scope,id).id;},
    session:id=>{const key=secret();run('DELETE FROM sessions WHERE expires<=?',Date.now());run('INSERT INTO sessions VALUES(?,?,?)',hash(key),id,Date.now()+7*86400000);return key;},
    resolve:key=>key && one('SELECT user FROM sessions WHERE token=? AND expires>?',hash(key),Date.now())?.user,
    logout:key=>{if(key)run('DELETE FROM sessions WHERE token=?',hash(key));}
  };
}
