// Group lesson service: planner, live teacher console, display screen and student seats.
import {TOOLS, colorAllowed} from './public/group-ink.js';
import {validatePlan, defaultPlan, PlanError, LIMITS, LESSON_TEMPLATES} from './public/group-plan.js';
import {validImage} from './public/group-plan.js';
import {speech, ttsReady} from './tts.mjs';
import {initialState, teacherCommand, teacherView, publicView, voiceOf, studentHand, speechText, speakerOf, classExtras, checkAnswer, checkEvaluation, contentFor, narrationFor, segmentAudio, MAX_STUDENTS} from './group-session.mjs';
import {UserError} from './store.mjs';
import * as v from './group-views.mjs';
import {BOOKS, bookOf, lessonBookPage, allLessons} from './public/book-catalog.js';
import {curriculumPlan} from './public/group-plan.js';
import {Readable} from 'node:stream';

const need = (ok, message, status = 400) => { if (!ok) throw new UserError(message, status); };
function cleanText(body) {
  const title = typeof body?.title === 'string' ? body.title.trim() : '', text = typeof body?.body === 'string' ? body.body.trim() : '';
  need(title.length >= 1 && title.length <= 60, 'اكتب عنوانًا للنص حتى ٦٠ حرفًا.');
  need(text.length >= 1 && text.length <= 600, 'اكتب النص حتى ٦٠٠ حرف.');
  return {title, body: text};
}
const CODE = /^[A-HJ-NP-Z2-9]{6}$/;
const UUID = /^[0-9a-f-]{36}$/;
const PAGE_CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'";

export function groupService(store) {
  const g = store.group, listeners = new Map();
  g.seedBooks(BOOKS, Object.fromEntries(allLessons().map(l => [l.id, lessonBookPage(l.id)]).filter(([, at]) => at)));
  // a ministry book page shown in a class: kept in memory for that class only, never saved
  const bookPages = new Map();
  const withBook = (plan, code) => { const b = bookPages.get(code); if (!b) return plan; return {...plan, steps: plan.steps.map(s => s.id === b.step ? {...s, source: 'upload', image: b.image, rights: true, book: {id: b.book, page: b.page}} : s)}; };
  /** Teachers, and administration with academic affairs or libraries permissions, may open the books. */
  const booksAllowed = u => u && (u.role === 'teacher' || (u.role === 'admin' && (p => p.permissions.includes('education.read') || p.permissions.includes('libraries.read')))(store.admin.profile(u.id)));
  /** The book from its source, only the parts asked for (byte ranges), to this one viewer; nothing is cached or stored. */
  async function relayBook(req, res, book) {
    const url = process.env.BOOKS_SOURCE_ORIGIN ? book.pdf.replace(/^https:\/\/[^/]+/, process.env.BOOKS_SOURCE_ORIGIN) : book.pdf;
    const ctl = new AbortController(); req.on('close', () => ctl.abort());
    let r; try { r = await fetch(url, {headers: req.headers.range ? {range: req.headers.range} : {}, signal: ctl.signal}); } catch { throw new UserError('تعذّر الوصول إلى مصدر الكتاب الآن.', 502); }
    need(r.status === 200 || r.status === 206, 'مصدر الكتاب لا يستجيب الآن.', 502);
    const h = {'content-type': 'application/pdf', 'accept-ranges': 'bytes', 'cache-control': 'no-store, private', 'x-robots-tag': 'noindex', 'content-disposition': 'inline'};
    for (const k of ['content-length', 'content-range']) if (r.headers.get(k)) h[k] = r.headers.get(k);
    res.writeHead(r.status, h);
    Readable.fromWeb(r.body).on('error', () => res.destroy()).pipe(res);
  }

  async function json(req, base, max) {
    need(req.headers.origin === base, 'مصدر الطلب غير معتمد.', 403);
    need(req.headers['content-type']?.split(';')[0] === 'application/json', 'صيغة غير صالحة.', 415);
    const chunks = []; let length = 0;
    for await (const chunk of req) { length += chunk.length; need(length <= max, 'حجم الطلب كبير.', 413); chunks.push(chunk); }
    try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new UserError('طلب غير صالح.'); }
  }
  const send = (res, data, status = 200) => { res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(data)); };
  const page = (res, html, title, body, mic = false, cam = false) => { res.setHeader('Content-Security-Policy', PAGE_CSP); res.setHeader('Permissions-Policy', `camera=(${cam ? 'self' : ''}), microphone=(${mic ? 'self' : ''}), display-capture=(), geolocation=()`); return html(title, body); };

  const firstName = n => String(n).trim().split(/\s+/)[0].slice(0, 30); // only the first name is shown in class
  function teacherOnly(u) { need(u, 'سجّل الدخول بحساب معلم.', 401); need(u.role === 'teacher', 'هذه الصفحة للمعلم.', 403); return u; }
  function ownSession(u, code) {
    need(CODE.test(code), 'رمز الحصة غير صالح.', 404);
    const s = g.session(code); need(s && s.teacher === u.id, 'الحصة غير متاحة.', 404); return s;
  }
  const studentToken = (req, code) => (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)gl_${code}=([a-f0-9]{64})(?:;|$)`))?.[1];

  // ---- live updates ----
  function views(code) {
    const s = g.session(code); if (!s) return null;
    const students = g.students(code), responses = g.responses(code), names = Object.fromEntries(students.map(x => [x.id, x.name]));
    return {s, students, responses, names};
  }
  function broadcast(code) {
    const set = listeners.get(code); if (!set?.size) return;
    const d = views(code); if (!d) return;
    const ids = new Set(d.students.map(x => x.id));
    for (const l of set) {
      if (l.kind === 'student' && !ids.has(l.id)) { l.res.write('event: removed\ndata: {}\n\n'); l.res.end(); set.delete(l); continue; }
      const data = {...(l.kind === 'teacher' ? teacherView(d.s.state, d.s.plan, d.students, d.responses) : publicView(d.s.state, d.s.plan, l.kind === 'student' ? l.id : null, d.responses, d.names)), ...(d.s.state.live ? classExtras(d.s.state, d.s.plan) : {}), natural: ttsReady()}; // natural: the server has the man/woman voice
      l.res.write('event: view\ndata: ' + JSON.stringify(data) + '\n\n');
    }
  }
  function subscribe(req, res, code, kind, id) {
    res.writeHead(200, {'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no'});
    const entry = {kind, id, res}; if (!listeners.has(code)) listeners.set(code, new Set());
    listeners.get(code).add(entry);
    const timer = setInterval(() => res.write(': heartbeat\n\n'), 15000); timer.unref();
    res.on('close', () => { clearInterval(timer); listeners.get(code)?.delete(entry); });
    const d = views(code);
    res.write('event: view\ndata: ' + JSON.stringify({...(kind === 'teacher' ? teacherView(d.s.state, d.s.plan, d.students, d.responses) : publicView(d.s.state, d.s.plan, kind === 'student' ? id : null, d.responses, d.names)), ...(d.s.state.live ? classExtras(d.s.state, d.s.plan) : {}), natural: ttsReady()}) + '\n\n');
  }

  // ---- natural voice: the narrator's text as MP3 in the class's chosen voice (404 → the page uses the device's voice) ----
  async function sendSpeech(res, text, speaker) {
    if (!text || !ttsReady()) throw new UserError('لا يوجد صوت طبيعي لهذا الشرح.', 404);
    let audio; try { audio = await speech(text, speaker); } catch (e) { console.error('tts', e.message); throw new UserError('تعذّر توليد الصوت الآن.', 502); }
    if (!audio) throw new UserError('لا يوجد صوت طبيعي لهذا الشرح.', 404);
    res.writeHead(200, {'content-type': 'audio/mpeg', 'content-length': audio.length, 'cache-control': 'private, max-age=86400'}); res.end(audio);
  }
  // ---- live voice signalling: each student connects to the teacher only; messages are relayed, never stored ----
  const RTC_TYPES = ['hello', 'offer', 'answer', 'ice', 'mic', 'bye'];
  async function rtcMessage(req, base) {
    const body = await json(req, base, 24_000);
    need(body && RTC_TYPES.includes(body.type), 'رسالة صوت غير صالحة.');
    return {type: body.type, data: body.data ?? null, to: typeof body.to === 'string' ? body.to : null, cid: typeof body.cid === 'string' && body.cid.length <= 40 ? body.cid : null}; // cid: which connection attempt
  }
  /** The laser pointer: a passing trail for students and the display screen, never stored. */
  function laser(code, payload) {
    for (const l of listeners.get(code) || []) if (l.kind !== 'teacher') l.res.write('event: laser\ndata: ' + JSON.stringify(payload) + '\n\n');
  }
  function relay(code, target, payload) {
    let sent = 0;
    for (const l of listeners.get(code) || []) {
      if (target === 'teacher' ? l.kind !== 'teacher' : !(l.kind === 'student' && l.id === target)) continue;
      l.res.write('event: rtc\ndata: ' + JSON.stringify(payload) + '\n\n'); sent++;
    }
    return sent;
  }

  const joinLimits = new Map();
  function joinLimit(req) {
    const now = Date.now(), key = req.socket.remoteAddress;
    for (const [k, e] of joinLimits) if (e.until <= now) joinLimits.delete(k);
    const e = joinLimits.get(key) || {n: 0, until: now + 600_000};
    need(++e.n <= 30, 'محاولات كثيرة. انتظر قليلًا ثم حاول.', 429); joinLimits.set(key, e);
  }

  return {
    matches: path => path === '/join' || path === '/start/student' || path.startsWith('/teach/') || path === '/teach' || path.startsWith('/class/'),
    async handle(ctx) {
      const {req, res, url} = ctx, path = url.pathname;
      const api = /\/(events|content|narration|answer|hand|speech|laser|command|evaluate|remove|plan|display-events|texts|delete|import|rtc|page-image|book-page|file)$/.test(path) || /^\/teach\/texts\//.test(path) || path.endsWith('.json') || req.headers['content-type']?.startsWith('application/json');
      try { return await route(ctx); } catch (err) {
        if (api && err instanceof UserError && !res.headersSent) return send(res, {error: err.message}, err.status);
        throw err;
      }
    }
  };
  async function route({req, res, url, u, base, html, redirect, fields}) {
      const path = url.pathname, method = req.method;
      if (method === 'POST' && req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')) need(req.headers.origin === base, 'مصدر الطلب غير معتمد.', 403);

      // ---------- students ----------
      if (path === '/join') {
        // two ways in: a parent's account shows their children to choose from; anyone can enter with the student's name
        const kids = u?.role === 'parent' ? store.children(u.id).map(c => ({id: c.id, name: firstName(c.name), grade: c.grade})) : [];
        if (method === 'GET') return page(res, html, 'الانضمام إلى الحصة', v.joinPage(String(url.searchParams.get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6), url.searchParams.has('none'), kids));
        need(method === 'POST', 'إجراء غير متاح.', 405);
        joinLimit(req);
        const data = await fields(req), code = String(data.code || '').toUpperCase().trim();
        let name = String(data.name || '').trim().replace(/\s+/g, ' '), child = null;
        if (data.child) { need(u?.role === 'parent', 'سجّل الدخول بحساب ولي الأمر لتختار أحد أبنائك.', 403); const c = store.ownedChild(u.id, String(data.child)); child = c.id; name = firstName(c.name); }
        need(CODE.test(code), 'تأكد من رمز الحصة المكوّن من ستة أحرف وأرقام.');
        need(name.length >= 2 && name.length <= 30, 'اكتب اسمك الأول (من حرفين إلى ٣٠ حرفًا).');
        const s = g.session(code); need(s && (s.state.live || s.state.homework === 'open'), 'الحصة غير متاحة أو انتهت.', 404);
        const joined = g.join(code, name, MAX_STUDENTS, child); need(joined, 'اكتمل عدد الطلاب في هذه الحصة.', 409);
        res.setHeader('Set-Cookie', `gl_${code}=${joined.token}; Path=/class/${code}; Max-Age=1209600; HttpOnly; SameSite=Lax${base.startsWith('https:') ? '; Secure' : ''}`);
        broadcast(code); return redirect('/class/' + code);
      }
      // The app's «أنا الطالب» in the trial: straight into the class a trial teacher is running — no code, no name.
      if (path === '/start/student' && method === 'GET') {
        const code = g.latestTrialLive(Date.now() - 6 * 3600_000);
        if (!code) return redirect('/join?none=1');
        if (g.student(code, studentToken(req, code))) return redirect('/class/' + code);
        if (u?.role === 'parent' && store.children(u.id).length) return redirect('/join?code=' + code); // the parent chooses which child
        joinLimit(req);
        const joined = g.join(code, 'طالب ' + (g.students(code).length + 1), MAX_STUDENTS); need(joined, 'اكتمل عدد الطلاب في هذه الحصة.', 409);
        res.setHeader('Set-Cookie', `gl_${code}=${joined.token}; Path=/class/${code}; Max-Age=1209600; HttpOnly; SameSite=Lax${base.startsWith('https:') ? '; Secure' : ''}`);
        broadcast(code); return redirect('/class/' + code);
      }
      const cls = path.match(/^\/class\/([A-Z0-9]{6})(?:\/(events|content|narration|answer|rtc|hand|speech))?$/);
      if (cls) {
        const [, code, action] = cls; need(CODE.test(code), 'رمز الحصة غير صالح.', 404);
        const s = g.session(code), me = s && g.student(code, studentToken(req, code));
        if (!me) { if (!action && method === 'GET') return redirect('/join?code=' + code); throw new UserError('انضم إلى الحصة أولًا.', 401); }
        if (!action && method === 'GET') return page(res, html, 'الحصة', v.studentPage(code, me.name, s.plan.title), true); // the student may open the microphone
        if (action === 'events' && method === 'GET') return subscribe(req, res, code, 'student', me.id);
        if (action === 'rtc' && method === 'POST') {
          const m = await rtcMessage(req, base);
          need(s.state.live, 'انتهت الحصة.', 409);
          if (m.type === 'mic' && m.data === true) need(voiceOf(s.state).mics, 'أغلق المعلم مايك الطلاب الآن.', 409);
          relay(code, 'teacher', {from: me.id, name: me.name, type: m.type, data: m.data, cid: m.cid});
          return send(res, {ok: true});
        }
        if (action === 'speech' && method === 'GET') { // only what is shown in class now
          const step = url.searchParams.get('step') || '', seg = url.searchParams.get('segment');
          const n = seg === null ? narrationFor(s.state, s.plan, step) : segmentAudio(s.state, s.plan, step, Number(seg));
          return sendSpeech(res, n.mode === 'speech' ? n.text : null, speakerOf(s.state));
        }
        if (action === 'hand' && method === 'POST') { // ✋ raise or lower the hand
          const body = await json(req, base, 256);
          need(s.state.live, 'انتهت الحصة.', 409);
          g.saveState(code, studentHand(s.state, me.id, body.up)); broadcast(code);
          return send(res, {ok: true});
        }
        if (action === 'content' && method === 'GET') return send(res, contentFor(s.state, withBook(s.plan, code), url.searchParams.get('step') || ''));
        if (action === 'narration' && method === 'GET') {
          const segment = url.searchParams.get('segment');
          return send(res, segment === null ? narrationFor(s.state, s.plan, url.searchParams.get('step') || '') : segmentAudio(s.state, s.plan, url.searchParams.get('step') || '', Number(segment)));
        }
        if (action === 'answer' && method === 'POST') {
          const body = await json(req, base, 8192), kind = body.kind === 'homework' ? 'homework' : 'answer';
          const a = checkAnswer(s.state, s.plan, body, kind);
          g.respond(code, me.id, a.step, a.question, kind, a.data); broadcast(code);
          return send(res, {ok: true});
        }
        throw new UserError('إجراء غير متاح.', 405);
      }

      // ---------- «مكتبة الكتب المدرسية»: the ministry books by grade and subject, each opening at a lesson's page
      const bm = path.match(/^\/teach\/books(?:\/([a-z0-9-]{1,30})(\/file)?)?$/);
      if (bm) {
        if (!u) return redirect('/login');
        need(method === 'GET', 'إجراء غير متاح.', 405); need(booksAllowed(u), 'الكتب للمعلمين والشؤون التعليمية.', 403);
        if (!bm[1]) return page(res, html, 'مكتبة الكتب المدرسية', v.booksPage(g.books(), u.role === 'teacher'));
        const book = bookOf(bm[1]); need(book, 'الكتاب غير موجود.', 404);
        if (bm[2]) return relayBook(req, res, book);
        const at = Number(url.searchParams.get('page')) || 1;
        return page(res, html, book.title, v.bookViewerPage(book, Math.min(book.pages - book.offset, Math.max(1, at)), g.bookLessons(book.id)));
      }

      // ---------- «مكتبة الوسائل الدراسية»: teachers, academic affairs and the libraries section
      if (path === '/teach/aids') {
        if (!u) return redirect('/login');
        need(method === 'GET', 'إجراء غير متاح.', 405);
        if (u.role !== 'teacher') { need(u.role === 'admin', 'هذه الصفحة للمعلمين والإدارة.', 403); const p = store.admin.profile(u.id); need(p.permissions.includes('education.read') || p.permissions.includes('libraries.read'), 'تحتاج صلاحية الشؤون التعليمية أو المكتبات.', 403); }
        const q = url.searchParams, subject = ['science', 'math', 'arabic', 'english', 'islamic'].includes(q.get('subject')) ? q.get('subject') : '', grade = /^[1-9]$/.test(q.get('grade') || '') ? q.get('grade') : '';
        return page(res, html, 'مكتبة الوسائل الدراسية', v.aidsPage({subject, grade, teacher: u.role === 'teacher'}));
      }

      // ---------- academic affairs: every teacher's lesson prep in the school; read it, assign a copy to a teacher ----------
      if (path === '/teach/review' || path.startsWith('/teach/review/')) {
        if (!u && method === 'GET') return redirect('/login');
        need(u && u.role === 'admin', 'هذه الصفحة للشؤون التعليمية.', 403);
        const actor = store.admin.requireAccess(u.id, 'education.read'), canWrite = actor.permissions.includes('education.write');
        if (path === '/teach/review') { need(method === 'GET', 'إجراء غير متاح.', 405); return page(res, html, 'تحضيرات الدروس', v.reviewPage(g.scopePlans(actor.scope), url.searchParams.get('assigned') === '1')); }
        const rm = path.match(/^\/teach\/review\/([0-9a-f-]{36})(\/assign)?$/); need(rm, 'الصفحة غير موجودة.', 404);
        const p = g.scopePlan(actor.scope, rm[1]); need(p, 'التحضير غير موجود.', 404);
        if (!rm[2] && method === 'GET') return page(res, html, 'تحضير: ' + p.title, v.reviewPlanPage(p, canWrite ? g.colleagues(actor.scope) : null));
        need(rm[2] && method === 'POST', 'إجراء غير متاح.', 405);
        need(canWrite, 'تحويل التحضير يحتاج صلاحية «إدارة المعلمين والجداول».', 403);
        const data = await fields(req), to = g.colleagues(actor.scope).find(t => t.id === data.to); need(to, 'اختر معلمًا من المدرسة.');
        g.copyPlan(p.id, to.id, `من الشؤون التعليمية (${actor.name}) — تحضير ${p.teacherName}`);
        return redirect('/teach/review?assigned=1');
      }

      // ---------- teacher ----------
      if (!u && method === 'GET' && !/events$/.test(path)) return redirect('/login');
      const teacher = teacherOnly(u);
      if (path === '/teach' || path === '/teach/plans') {
        need(method === 'GET', 'إجراء غير متاح.', 405);
        const grade = /^[1-6]$/.test(url.searchParams.get('grade') || '') ? Number(url.searchParams.get('grade')) : 4;
        return page(res, html, 'دروسي للحصة الجماعية', v.plansPage(g.plans(teacher.id), g.sessions(teacher.id), g.colleagues(teacher.scope).filter(c => c.id !== teacher.id), url.searchParams.get('sent') === '1', grade));
      }
      if (path === '/teach/texts') {
        if (method === 'GET') return send(res, g.texts(teacher.id));
        need(method === 'POST', 'إجراء غير متاح.', 405);
        const body = await json(req, base, 16384), t = cleanText(body);
        need(g.textCount(teacher.id) < 500, 'وصلت مكتبتك إلى ٥٠٠ نص. احذف بعضها أولًا.', 409);
        return send(res, {id: g.createText(teacher.id, {...t, origin: typeof body.origin === 'string' ? body.origin.slice(0, 60) : null})});
      }
      const tm = path.match(/^\/teach\/texts\/([0-9a-f-]{36})(\/delete)?$/);
      if (tm && method === 'POST') {
        const body = await json(req, base, 16384);
        if (tm[2]) { need(g.deleteText(teacher.id, tm[1]), 'النص غير موجود.', 404); return send(res, {ok: true}); }
        need(g.updateText(teacher.id, tm[1], cleanText(body)), 'النص غير موجود.', 404); return send(res, {ok: true});
      }
      if (path === '/teach/plans/import' && method === 'POST') {
        const body = await json(req, base, LIMITS.plan + 100_000);
        let clean; try { clean = validatePlan(body); } catch (e) { if (e instanceof PlanError) throw new UserError(e.message); throw e; }
        return send(res, {id: g.createPlan(teacher.id, clean)});
      }
      if (path === '/teach/plans/new' && method === 'POST') {
        const data = await fields(req), cur = /^cur-([a-z0-9-]{1,20})$/.exec(data.template || ''); // any curriculum lesson: a new prep at its book page
        if (cur) { const p = curriculumPlan(cur[1]); need(p, 'الدرس غير موجود في المنهج.', 404); return redirect('/teach/plans/' + g.createPlan(teacher.id, validatePlan(p))); }
        const t = LESSON_TEMPLATES[data.template] || LESSON_TEMPLATES.light; return redirect('/teach/plans/' + g.createPlan(teacher.id, validatePlan(t.plan())));
      }
      const pm = path.match(/^\/teach\/plans\/([0-9a-f-]{36})(\.json|\/delete|\/start|\/send)?$/);
      if (pm) {
        const [, id, action] = pm; need(UUID.test(id), 'الدرس غير موجود.', 404);
        const plan = g.plan(teacher.id, id); need(plan, 'الدرس غير موجود.', 404);
        if (!action && method === 'GET') return page(res, html, 'ترتيب الدرس', v.plannerPage(id, plan.title), true);
        if (action === '.json' && method === 'GET') return send(res, plan.plan);
        if (!action && method === 'POST') {
          const body = await json(req, base, LIMITS.plan + 100_000);
          let clean; try { clean = validatePlan(body); } catch (e) { if (e instanceof PlanError) throw new UserError(e.message); throw e; }
          g.savePlan(teacher.id, id, clean); return send(res, {ok: true, title: clean.title});
        }
        if (action === '/delete' && method === 'POST') { await fields(req); g.deletePlan(teacher.id, id); return redirect('/teach/plans'); }
        if (action === '/send' && method === 'POST') { // a copy of the prep, with its board arrangement, to a colleague of the same school
          const data = await fields(req), to = g.colleagues(teacher.scope).find(t => t.id === data.to && t.id !== teacher.id); need(to, 'اختر معلمًا من مدرستك.');
          g.copyPlan(id, to.id, `أرسله إليك ${teacher.name}`); return redirect('/teach/plans?sent=1');
        }
        if (action === '/start' && method === 'POST') { await fields(req); const clean = validatePlan(plan.plan); return redirect('/teach/live/' + g.startSession(teacher.id, clean, initialState(clean))); }
        throw new UserError('إجراء غير متاح.', 405);
      }
      const lm = path.match(/^\/teach\/live\/([A-Z0-9]{6})(?:\/(events|plan|command|evaluate|remove|display|display-events|rtc|page-image|book-page|speech|laser))?$/);
      if (lm) {
        const [, code, action] = lm, s = ownSession(teacher, code);
        if (!action && method === 'GET') return page(res, html, 'إدارة الحصة', v.teacherPage(code, s.plan.title, base), true, true); // the teacher's microphone and camera
        if (action === 'display' && method === 'GET') return page(res, html, 'شاشة العرض', v.displayPage(code, s.plan.title, base));
        if (action === 'plan' && method === 'GET') return send(res, withBook(s.plan, code));
        if (action === 'book-page' && method === 'POST') { // a page of the ministry book, rendered on the teacher's device: this class only, in memory
          const body = await json(req, base, 1_000_000), step = s.plan.steps.find(x => x.id === body.step && x.type === 'page'), book = bookOf(body.book);
          need(step, 'خطوة المنهج غير موجودة.', 404); need(book && Number.isInteger(body.page) && body.page >= 1 && body.page <= book.pages, 'صفحة غير صالحة.'); need(validImage(body.image), 'صورة الصفحة غير صالحة.');
          bookPages.set(code, {step: step.id, book: book.id, page: body.page, image: body.image});
          const next = {...s.state, pageVer: (s.state.pageVer || 0) + 1, seq: s.state.seq + 1}; g.saveState(code, next); broadcast(code);
          return send(res, {ok: true});
        }
        if (action === 'laser' && method === 'POST') {
          const b = await json(req, base, 8192), pts = Array.isArray(b.p) ? b.p : [];
          need(pts.length <= 120 && pts.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p[0] >= 0 && p[0] <= 1000 && p[1] >= 0 && p[1] <= 600), 'مسار غير صالح.');
          const p = pts.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
          // live writing: students see the line grow while the teacher writes; the finished line then arrives as a stroke
          if (b.ink) {
            const k = b.ink; need(typeof k.g === 'string' && /^[a-z0-9]{1,12}$/.test(k.g) && Object.hasOwn(TOOLS, k.tool) && Object.hasOwn(TOOLS[k.tool].widths, k.size) && colorAllowed(k.color), 'كتابة غير صالحة.');
            need(Number.isInteger(k.at) && k.at >= 0 && k.at <= 600, 'كتابة غير صالحة.');
            laser(code, {ink: {g: k.g, tool: k.tool, size: k.size, color: k.color, at: k.at, replace: k.replace === true, end: k.end === true}, p}); return send(res, {ok: true});
          }
          laser(code, {p: p.map(([x, y]) => [Math.round(x), Math.round(y)]), start: b.start === true}); return send(res, {ok: true});
        }
        if (action === 'speech' && method === 'GET') { // the teacher (and the display screen) may hear any step of their lesson
          const seg = url.searchParams.get('segment'), sample = url.searchParams.get('sample');
          const speaker = ['male', 'female'].includes(url.searchParams.get('v')) && sample ? url.searchParams.get('v') : speakerOf(s.state);
          return sendSpeech(res, sample ? 'مرحبًا، أنا صوت المتحدث في حصتكم. أشرح لكم الدرس خطوة بخطوة.' : speechText(s.plan, url.searchParams.get('step') || '', seg === null ? null : Number(seg)), speaker);
        }
        if (action === 'events' && method === 'GET') return subscribe(req, res, code, 'teacher', teacher.id);
        if (action === 'display-events' && method === 'GET') return subscribe(req, res, code, 'display', null);
        if (action === 'page-image' && method === 'POST') { // the teacher photographs the book page during the class; it stays in this class only
          const body = await json(req, base, 1_000_000);
          const step = s.plan.steps.find(x => x.id === body.step && x.type === 'page');
          need(step, 'خطوة المنهج غير موجودة.', 404);
          need(validImage(body.image), 'الصورة يجب أن تكون PNG أو JPEG أو WebP صغيرة.');
          Object.assign(step, {source: 'upload', image: body.image, rights: true}); bookPages.delete(code); // a photographed page replaces a book page
          g.saveSessionPlan(code, s.plan);
          const next = {...s.state, pageVer: (s.state.pageVer || 0) + 1, seq: s.state.seq + 1}; g.saveState(code, next); broadcast(code);
          return send(res, {ok: true});
        }
        if (action === 'rtc' && method === 'POST') {
          const m = await rtcMessage(req, base);
          need(m.to && g.students(code).some(x => x.id === m.to), 'الطالب غير موجود في الحصة.', 404);
          return send(res, {ok: true, delivered: relay(code, m.to, {from: 'teacher', type: m.type, data: m.data, cid: m.cid})});
        }
        if (action === 'command' && method === 'POST') {
          const body = await json(req, base, 65536);
          const next = teacherCommand(s.state, s.plan, body); g.saveState(code, next); broadcast(code);
          return send(res, {ok: true, seq: next.seq});
        }
        if (action === 'evaluate' && method === 'POST') {
          const body = await json(req, base, 8192), e = checkEvaluation(s.plan, body, g.students(code).map(x => x.id));
          g.respond(code, body.student, e.step, 'evaluation', 'evaluation', e.data); broadcast(code); return send(res, {ok: true});
        }
        if (action === 'remove' && method === 'POST') {
          const body = await json(req, base, 1024); need(g.removeStudent(code, body.student), 'الطالب غير موجود.', 404); broadcast(code); return send(res, {ok: true});
        }
        throw new UserError('إجراء غير متاح.', 405);
      }
      throw new UserError('الصفحة غير موجودة.', 404);
  }
}
