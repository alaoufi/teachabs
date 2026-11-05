import {UserError} from './store.mjs';
import {randomUUID} from 'node:crypto';
import {changeBoard,emptyBoard} from './board.mjs';
const requireValue=(ok,message,status=400)=>{if(!ok){throw new UserError(message,status);}};
const clone=value=>JSON.parse(JSON.stringify(value));
export function savedLessonLibrary(db){
 db.exec(`CREATE TABLE IF NOT EXISTS teacher_lesson_templates(id TEXT PRIMARY KEY,teacher TEXT NOT NULL REFERENCES users(id),subject TEXT NOT NULL,grade INTEGER NOT NULL,title TEXT NOT NULL,version INTEGER NOT NULL,state TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS saved_lesson_instances(id TEXT PRIMARY KEY,booking TEXT NOT NULL REFERENCES bookings(id),teacher TEXT NOT NULL REFERENCES users(id),template TEXT NOT NULL REFERENCES teacher_lesson_templates(id),rev INTEGER NOT NULL,state TEXT NOT NULL);`);
 const teacher=id=>{const u=db.prepare('SELECT role,subjects,grades FROM users WHERE id=?').get(id);requireValue(u?.role==='teacher','Teacher access required',403);return u;};
 const ownedTemplate=(owner,id)=>{teacher(owner);const row=db.prepare('SELECT * FROM teacher_lesson_templates WHERE id=? AND teacher=?').get(id,owner);requireValue(row,'Template unavailable',404);return row;};
 const ownedInstance=(owner,id)=>{teacher(owner);const row=db.prepare('SELECT * FROM saved_lesson_instances WHERE id=? AND teacher=?').get(id,owner);requireValue(row,'Lesson instance unavailable',404);return row;};
 function createTemplate(owner,{subject,grade,title,pages}){
  const u=teacher(owner);requireValue(JSON.parse(u.subjects||'[]').includes(subject)&&JSON.parse(u.grades||'[]').includes(grade),'Subject or grade unavailable',403);
  requireValue(typeof title==='string'&&title.trim().length>0&&title.length<=100,'Invalid title');
  requireValue(Array.isArray(pages)&&pages.length>0&&pages.length<=30,'Use 1–30 numbered pages');
  const cleanPages=pages.map((p,i)=>{const scene=changeBoard(emptyBoard(),'teacher',{op:'scene',rev:0,elements:p.elements,files:p.files||{}});return {number:i+1,elements:scene.elements,files:scene.files};});
  const state={format:'teaching-template',version:1,pages:cleanPages};requireValue(JSON.stringify(state).length<=4000000,'Template too large');
  const id=randomUUID();db.prepare('INSERT INTO teacher_lesson_templates VALUES(?,?,?,?,?,?,?)').run(id,owner,subject,grade,title.trim(),1,JSON.stringify(state));return id;
 }
 function instantiate(owner,templateId,bookingId){
  const template=ownedTemplate(owner,templateId);
  const booking=db.prepare(`SELECT s.subject,c.grade FROM bookings b JOIN slots s ON s.id=b.slot JOIN children c ON c.id=b.child WHERE b.id=? AND s.teacher=? AND b.status='confirmed'`).get(bookingId,owner);
  requireValue(booking&&booking.subject===template.subject&&booking.grade===template.grade,'Booking does not match template',403);
  const id=randomUUID(),state={format:'teaching-instance',version:1,pageIndex:0,pages:clone(JSON.parse(template.state).pages)};
  db.prepare('INSERT INTO saved_lesson_instances VALUES(?,?,?,?,?,?)').run(id,bookingId,owner,templateId,0,JSON.stringify(state));return {id,rev:0,...state};
 }
 function navigate(owner,id,expectedRev,pageIndex){
  const row=ownedInstance(owner,id),state=JSON.parse(row.state);
  requireValue(Number.isInteger(pageIndex)&&pageIndex>=0&&pageIndex<state.pages.length,'Page outside lesson');requireValue(row.rev===expectedRev,'Lesson changed',409);
  state.pageIndex=pageIndex;const result=db.prepare('UPDATE saved_lesson_instances SET rev=rev+1,state=? WHERE id=? AND rev=?').run(JSON.stringify(state),id,expectedRev);requireValue(result.changes===1,'Lesson changed',409);return {id,rev:expectedRev+1,...state};
 }
 return {createTemplate,instantiate,navigate,
  forLiveBooking:(owner,id,booking)=>{const row=ownedInstance(owner,id);requireValue(row.booking===booking,'Instance belongs to another booking',403);return {id,...JSON.parse(row.state)};},
  listTemplates:owner=>{teacher(owner);return db.prepare('SELECT id,subject,grade,title,version FROM teacher_lesson_templates WHERE teacher=? ORDER BY rowid DESC').all(owner);},
  fromBooking:(owner,bookingId,title,baseId=null)=>{
   teacher(owner);const booking=db.prepare('SELECT s.subject,c.grade FROM bookings b JOIN slots s ON s.id=b.slot JOIN children c ON c.id=b.child WHERE b.id=? AND s.teacher=?').get(bookingId,owner);requireValue(booking,'Booking unavailable',404);
   const row=db.prepare('SELECT state FROM lesson_boards WHERE id=?').get(bookingId);requireValue(row,'No saved teacher board');const board=JSON.parse(row.state);
   let pages=[];if(baseId){const base=ownedTemplate(owner,baseId);requireValue(base.subject===booking.subject&&base.grade===booking.grade,'Template mismatch',403);pages=JSON.parse(base.state).pages;}
   return createTemplate(owner,{...booking,title,pages:[...pages,{elements:board.elements,files:board.files}]});
  },
  exportTemplate:(owner,id)=>{const row=ownedTemplate(owner,id);return {format:'teacher-template-export',version:1,subject:row.subject,grade:row.grade,title:row.title,pages:JSON.parse(row.state).pages};},
  importTemplate:(owner,data)=>{requireValue(data?.format==='teacher-template-export'&&data.version===1,'Unsupported template format');return createTemplate(owner,data);},
  readTemplate:(owner,id)=>JSON.parse(ownedTemplate(owner,id).state),
  readInstance:(owner,id)=>{const row=ownedInstance(owner,id);return {id,rev:row.rev,...JSON.parse(row.state)};},
  studentReplay:()=>{requireValue(false,'Student replay is disabled until administrative grants and student identity are implemented',403);}
 };
}
