import {UserError} from './store.mjs';
const need=(ok,message,status=403)=>{if(!ok)throw new UserError(message,status);};
export function replayPermissions(db){
 db.exec(`CREATE TABLE IF NOT EXISTS admin_teacher_scope(admin TEXT NOT NULL REFERENCES users(id),teacher TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(admin,teacher));
 CREATE TABLE IF NOT EXISTS replay_grants(instance TEXT PRIMARY KEY REFERENCES saved_lesson_instances(id),child TEXT NOT NULL REFERENCES children(id),enabled INTEGER NOT NULL,expires INTEGER NOT NULL,rev INTEGER NOT NULL,snapshot TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS replay_audit(id INTEGER PRIMARY KEY,admin TEXT NOT NULL REFERENCES users(id),instance TEXT NOT NULL,enabled INTEGER NOT NULL,expires INTEGER NOT NULL,rev INTEGER NOT NULL,at INTEGER NOT NULL);`);
 const one=(sql,...args)=>db.prepare(sql).get(...args);
 const instance=id=>one(`SELECT i.*,b.child,b.status,u.scope FROM saved_lesson_instances i JOIN bookings b ON b.id=i.booking JOIN users u ON u.id=i.teacher WHERE i.id=?`,id);
 function authorize(admin,row){
  const user=one('SELECT role,scope FROM users WHERE id=?',admin);
  need(user?.role==='admin'&&row&&user.scope===row.scope&&one('SELECT 1 FROM admin_teacher_scope WHERE admin=? AND teacher=?',admin,row.teacher),'Replay administration unavailable');
 }
 function decide(admin,id,{enabled,expires,rev}){
  db.exec('BEGIN IMMEDIATE');
  try{
   const row=instance(id);authorize(admin,row);
   need(typeof enabled==='boolean'&&Number.isInteger(rev),'Invalid decision',400);
   need(!enabled||row.status==='confirmed','Booking unavailable');
   need(!enabled||(Number.isSafeInteger(expires)&&expires>Date.now()&&expires<=Date.now()+30*86400000),'Use an expiry within 30 days',400);
   const existing=one('SELECT * FROM replay_grants WHERE instance=?',id);need((existing?.rev||0)===rev,'Decision changed',409);
   // Only the immutable teacher template is approved, never live student work.
   const template=one('SELECT state FROM teacher_lesson_templates WHERE id=?',row.template);
   const snapshot=existing?.snapshot||template.state,nextRev=rev+1,until=enabled?expires:0;
   db.prepare('INSERT INTO replay_grants VALUES(?,?,?,?,?,?) ON CONFLICT(instance) DO UPDATE SET enabled=excluded.enabled,expires=excluded.expires,rev=excluded.rev').run(id,row.child,enabled?1:0,until,nextRev,snapshot);
   db.prepare('INSERT INTO replay_audit(admin,instance,enabled,expires,rev,at) VALUES(?,?,?,?,?,?)').run(admin,id,enabled?1:0,until,nextRev,Date.now());
   db.exec('COMMIT');return {rev:nextRev,enabled,expires:until};
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 function read(parent,id,child){
  const grant=one(`SELECT g.*,b.status FROM replay_grants g JOIN saved_lesson_instances i ON i.id=g.instance JOIN bookings b ON b.id=i.booking JOIN children c ON c.id=g.child JOIN users u ON u.id=c.parent WHERE g.instance=? AND c.id=? AND c.parent=? AND u.role='parent'`,id,child,parent);
  need(grant&&grant.enabled===1&&grant.expires>Date.now()&&grant.status==='confirmed','Replay unavailable');
  return JSON.parse(grant.snapshot);
 }
 function list(admin){
  need(one("SELECT 1 FROM users WHERE id=? AND role='admin'",admin),'Administrator required');
  return db.prepare(`SELECT i.id,b.child,t.title,COALESCE(g.rev,0) rev,COALESCE(g.enabled,0) enabled,COALESCE(g.expires,0) expires FROM saved_lesson_instances i JOIN admin_teacher_scope a ON a.teacher=i.teacher AND a.admin=? JOIN users u ON u.id=i.teacher JOIN users ad ON ad.id=a.admin AND ad.scope=u.scope JOIN bookings b ON b.id=i.booking JOIN teacher_lesson_templates t ON t.id=i.template LEFT JOIN replay_grants g ON g.instance=i.id`).all(admin);
 }
 function available(parent){return db.prepare(`SELECT g.instance id,g.child,t.title FROM replay_grants g JOIN children c ON c.id=g.child JOIN users u ON u.id=c.parent JOIN saved_lesson_instances i ON i.id=g.instance JOIN bookings b ON b.id=i.booking JOIN teacher_lesson_templates t ON t.id=i.template WHERE c.parent=? AND u.role='parent' AND g.enabled=1 AND g.expires>? AND b.status='confirmed'`).all(parent,Date.now());}
 return {decide,read,list,available};
}
