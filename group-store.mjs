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
  // where a plan came from when it was sent by a colleague or assigned by academic affairs
  try { db.exec('ALTER TABLE group_plans ADD COLUMN origin TEXT'); } catch {}
  // the registered child when a parent's account enters the class for one of their children
  try { db.exec('ALTER TABLE group_students ADD COLUMN child TEXT REFERENCES children(id)'); } catch {}
  // «مكتبة الكتب المدرسية»: book metadata and source links only (no book files); the printed page of each lesson
  db.exec(`CREATE TABLE IF NOT EXISTS school_books(id TEXT PRIMARY KEY,track TEXT NOT NULL,stage TEXT NOT NULL,grade INTEGER NOT NULL,term INTEGER NOT NULL,subject TEXT NOT NULL,title TEXT NOT NULL,edition TEXT NOT NULL,pages INTEGER NOT NULL,page_offset INTEGER NOT NULL,offset_checked INTEGER NOT NULL,source TEXT NOT NULL,pdf TEXT NOT NULL,checked TEXT NOT NULL,stored INTEGER NOT NULL DEFAULT 0 CHECK(stored=0));
  CREATE TABLE IF NOT EXISTS book_lessons(lesson TEXT PRIMARY KEY,book TEXT NOT NULL REFERENCES school_books(id),page INTEGER NOT NULL);`);
  const parse = row => row && {...row, plan: JSON.parse(row.plan), ...(row.state ? {state: JSON.parse(row.state)} : {})};
  return {
    /** Keep the catalogue in the database in step with book-catalog.js (upsert; nothing is downloaded). */
    seedBooks(books, lessonPage) {
      transaction(() => {
        for (const b of books) run('INSERT INTO school_books(id,track,stage,grade,term,subject,title,edition,pages,page_offset,offset_checked,source,pdf,checked) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,edition=excluded.edition,pages=excluded.pages,page_offset=excluded.page_offset,offset_checked=excluded.offset_checked,source=excluded.source,pdf=excluded.pdf,checked=excluded.checked',
          b.id, b.track, b.stage, b.grade, b.term, b.subject, b.title, b.edition, b.pages, b.offset, b.offsetChecked ? 1 : 0, b.source, b.pdf, b.checked);
        for (const [lesson, at] of Object.entries(lessonPage)) run('INSERT INTO book_lessons VALUES(?,?,?) ON CONFLICT(lesson) DO UPDATE SET book=excluded.book,page=excluded.page', lesson, at.book, at.page);
      });
    },
    books: () => all('SELECT b.*,(SELECT COUNT(*) FROM book_lessons l WHERE l.book=b.id) lessons FROM school_books b ORDER BY grade,subject DESC,term'),
    book: id => one('SELECT * FROM school_books WHERE id=?', id),
    bookLessons: book => all('SELECT lesson,page FROM book_lessons WHERE book=? ORDER BY page', book),
    texts: teacher => all('SELECT id,title,body,origin,updated FROM group_texts WHERE teacher=? ORDER BY updated DESC', teacher),
    textCount: teacher => one('SELECT COUNT(*) n FROM group_texts WHERE teacher=?', teacher).n,
    createText(teacher, {title, body, origin}) { const id = randomUUID(); run('INSERT INTO group_texts VALUES(?,?,?,?,?,?)', id, teacher, title, body, origin || null, Date.now()); return id; },
    updateText: (teacher, id, {title, body}) => run('UPDATE group_texts SET title=?,body=?,updated=? WHERE id=? AND teacher=?', title, body, Date.now(), id, teacher).changes === 1,
    deleteText: (teacher, id) => run('DELETE FROM group_texts WHERE id=? AND teacher=?', id, teacher).changes === 1,
    plans: teacher => all('SELECT id,title,updated,origin FROM group_plans WHERE teacher=? ORDER BY updated DESC', teacher),
    /** A copy of a plan in another teacher's lessons, marked with where it came from. */
    copyPlan(fromId, toTeacher, origin) {
      const row = one('SELECT title,plan FROM group_plans WHERE id=?', fromId); if (!row) return null;
      const id = randomUUID(); run('INSERT INTO group_plans(id,teacher,title,plan,updated,origin) VALUES(?,?,?,?,?,?)', id, toTeacher, row.title, row.plan, Date.now(), origin); return id;
    },
    /** Teachers of the same school (scope), for «send to a colleague» and for academic affairs. */
    colleagues: scope => all("SELECT id,name FROM users WHERE role='teacher' AND scope=? ORDER BY name", scope),
    /** Every lesson prep of a school's teachers, for academic affairs. */
    scopePlans: scope => all("SELECT p.id,p.title,p.updated,p.origin,p.teacher,u.name teacherName,json_extract(p.plan,'$.subject') subject,json_extract(p.plan,'$.grade') grade FROM group_plans p JOIN users u ON u.id=p.teacher WHERE u.scope=? AND u.role='teacher' ORDER BY p.updated DESC LIMIT 500", scope),
    scopePlan: (scope, id) => parse(one("SELECT p.*,u.name teacherName FROM group_plans p JOIN users u ON u.id=p.teacher WHERE p.id=? AND u.scope=? AND u.role='teacher'", id, scope)),
    plan: (teacher, id) => parse(one('SELECT * FROM group_plans WHERE id=? AND teacher=?', id, teacher)),
    createPlan(teacher, plan) { const id = randomUUID(); run('INSERT INTO group_plans(id,teacher,title,plan,updated) VALUES(?,?,?,?,?)', id, teacher, plan.title, JSON.stringify(plan), Date.now()); return id; },
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
    join(code, name, max, child = null) {
      return transaction(() => {
        // the same child entering again (another device, a new tab) keeps their place and answers
        const again = child && one('SELECT id FROM group_students WHERE code=? AND child=? AND removed=0', code, child);
        if (again) { const token = randomBytes(32).toString('hex'); run('UPDATE group_students SET token=? WHERE id=?', sha(token), again.id); return {id: again.id, token}; }
        const count = one('SELECT COUNT(*) n FROM group_students WHERE code=? AND removed=0', code).n;
        if (count >= max) return null;
        const id = randomUUID(), token = randomBytes(32).toString('hex');
        run('INSERT INTO group_students(id,code,name,token,joined,removed,child) VALUES(?,?,?,?,?,0,?)', id, code, name, sha(token), Date.now(), child);
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
