// Additive storage for group lessons. No existing table is altered.
import {randomUUID, randomBytes, createHash} from 'node:crypto';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const sha = value => createHash('sha256').update(value).digest('hex');

export function createGroupStore({db, one, all, run, transaction}) {
  db.exec(`CREATE TABLE IF NOT EXISTS group_plans(id TEXT PRIMARY KEY,teacher TEXT NOT NULL REFERENCES users(id),title TEXT NOT NULL,plan TEXT NOT NULL,updated INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS group_sessions(code TEXT PRIMARY KEY,teacher TEXT NOT NULL REFERENCES users(id),plan TEXT NOT NULL,state TEXT NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS group_students(id TEXT PRIMARY KEY,code TEXT NOT NULL REFERENCES group_sessions(code),name TEXT NOT NULL,token TEXT NOT NULL UNIQUE,joined INTEGER NOT NULL,removed INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS group_texts(id TEXT PRIMARY KEY,teacher TEXT NOT NULL REFERENCES users(id),title TEXT NOT NULL,body TEXT NOT NULL,origin TEXT,updated INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS group_responses(code TEXT NOT NULL REFERENCES group_sessions(code),student TEXT NOT NULL REFERENCES group_students(id),step TEXT NOT NULL,item TEXT NOT NULL,kind TEXT NOT NULL,data TEXT NOT NULL,updated INTEGER NOT NULL,PRIMARY KEY(code,student,step,item,kind));`);
  const parse = row => row && {...row, plan: JSON.parse(row.plan), ...(row.state ? {state: JSON.parse(row.state)} : {})};
  return {
    texts: teacher => all('SELECT id,title,body,origin,updated FROM group_texts WHERE teacher=? ORDER BY updated DESC', teacher),
    textCount: teacher => one('SELECT COUNT(*) n FROM group_texts WHERE teacher=?', teacher).n,
    createText(teacher, {title, body, origin}) { const id = randomUUID(); run('INSERT INTO group_texts VALUES(?,?,?,?,?,?)', id, teacher, title, body, origin || null, Date.now()); return id; },
    updateText: (teacher, id, {title, body}) => run('UPDATE group_texts SET title=?,body=?,updated=? WHERE id=? AND teacher=?', title, body, Date.now(), id, teacher).changes === 1,
    deleteText: (teacher, id) => run('DELETE FROM group_texts WHERE id=? AND teacher=?', id, teacher).changes === 1,
    plans: teacher => all('SELECT id,title,updated FROM group_plans WHERE teacher=? ORDER BY updated DESC', teacher),
    plan: (teacher, id) => parse(one('SELECT * FROM group_plans WHERE id=? AND teacher=?', id, teacher)),
    createPlan(teacher, plan) { const id = randomUUID(); run('INSERT INTO group_plans VALUES(?,?,?,?,?)', id, teacher, plan.title, JSON.stringify(plan), Date.now()); return id; },
    savePlan: (teacher, id, plan) => run('UPDATE group_plans SET title=?,plan=?,updated=? WHERE id=? AND teacher=?', plan.title, JSON.stringify(plan), Date.now(), id, teacher).changes === 1,
    deletePlan: (teacher, id) => run('DELETE FROM group_plans WHERE id=? AND teacher=?', id, teacher).changes === 1,
    startSession(teacher, plan, state) {
      return transaction(() => {
        let code;
        do { code = Array.from(randomBytes(6), b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join(''); } while (one('SELECT 1 FROM group_sessions WHERE code=?', code));
        run('INSERT INTO group_sessions VALUES(?,?,?,?,?,?)', code, teacher, JSON.stringify(plan), JSON.stringify(state), Date.now(), Date.now());
        return code;
      });
    },
    session: code => parse(one('SELECT * FROM group_sessions WHERE code=?', code)),
    sessions: teacher => all('SELECT code,created,json_extract(plan,\'$.title\') title,json_extract(state,\'$.live\') live FROM group_sessions WHERE teacher=? ORDER BY created DESC LIMIT 20', teacher),
    /** The trial's most recent running class (trial teachers only, active in the last few hours): the app's «أنا الطالب». */
    latestTrialLive: since => one("SELECT s.code FROM group_sessions s JOIN users u ON u.id=s.teacher WHERE u.scope<>'' AND json_extract(s.state,'$.live')=1 AND s.updated>? ORDER BY s.updated DESC LIMIT 1", since)?.code || null,
    saveSessionPlan: (code, plan) => run('UPDATE group_sessions SET plan=?,updated=? WHERE code=?', JSON.stringify(plan), Date.now(), code),
    saveState: (code, state) => run('UPDATE group_sessions SET state=?,updated=? WHERE code=?', JSON.stringify(state), Date.now(), code),
    join(code, name, max) {
      return transaction(() => {
        const count = one('SELECT COUNT(*) n FROM group_students WHERE code=? AND removed=0', code).n;
        if (count >= max) return null;
        const id = randomUUID(), token = randomBytes(32).toString('hex');
        run('INSERT INTO group_students VALUES(?,?,?,?,?,0)', id, code, name, sha(token), Date.now());
        return {id, token};
      });
    },
    student: (code, token) => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token) ? one('SELECT id,name FROM group_students WHERE code=? AND token=? AND removed=0', code, sha(token)) : undefined,
    students: code => all('SELECT id,name FROM group_students WHERE code=? AND removed=0 ORDER BY joined', code),
    removeStudent: (code, id) => run('UPDATE group_students SET removed=1 WHERE code=? AND id=?', code, id).changes === 1,
    respond: (code, student, step, item, kind, data) => run('INSERT INTO group_responses VALUES(?,?,?,?,?,?,?) ON CONFLICT(code,student,step,item,kind) DO UPDATE SET data=excluded.data,updated=excluded.updated', code, student, step, item, kind, JSON.stringify(data), Date.now()),
    responses: code => all('SELECT r.student,r.step,r.item,r.kind,r.data FROM group_responses r JOIN group_students s ON s.id=r.student AND s.removed=0 WHERE r.code=?', code).map(r => ({...r, data: JSON.parse(r.data)}))
  };
}
