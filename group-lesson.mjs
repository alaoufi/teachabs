// Group lesson service: planner, live teacher console, display screen and student seats.
import {validatePlan, defaultPlan, PlanError, LIMITS, LESSON_TEMPLATES} from './public/group-plan.js';
import {initialState, teacherCommand, teacherView, publicView, checkAnswer, checkEvaluation, contentFor, narrationFor, segmentAudio, MAX_STUDENTS} from './group-session.mjs';
import {UserError} from './store.mjs';
import * as v from './group-views.mjs';

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

  async function json(req, base, max) {
    need(req.headers.origin === base, 'مصدر الطلب غير معتمد.', 403);
    need(req.headers['content-type']?.split(';')[0] === 'application/json', 'صيغة غير صالحة.', 415);
    const chunks = []; let length = 0;
    for await (const chunk of req) { length += chunk.length; need(length <= max, 'حجم الطلب كبير.', 413); chunks.push(chunk); }
    try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new UserError('طلب غير صالح.'); }
  }
  const send = (res, data, status = 200) => { res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(data)); };
  const page = (res, html, title, body, mic = false) => { res.setHeader('Content-Security-Policy', PAGE_CSP); res.setHeader('Permissions-Policy', `camera=(), microphone=(${mic ? 'self' : ''}), display-capture=(), geolocation=()`); return html(title, body); };

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
      const data = l.kind === 'teacher' ? teacherView(d.s.state, d.s.plan, d.students, d.responses) : publicView(d.s.state, d.s.plan, l.kind === 'student' ? l.id : null, d.responses, d.names);
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
    res.write('event: view\ndata: ' + JSON.stringify(kind === 'teacher' ? teacherView(d.s.state, d.s.plan, d.students, d.responses) : publicView(d.s.state, d.s.plan, kind === 'student' ? id : null, d.responses, d.names)) + '\n\n');
  }

  const joinLimits = new Map();
  function joinLimit(req) {
    const now = Date.now(), key = req.socket.remoteAddress;
    for (const [k, e] of joinLimits) if (e.until <= now) joinLimits.delete(k);
    const e = joinLimits.get(key) || {n: 0, until: now + 600_000};
    need(++e.n <= 30, 'محاولات كثيرة. انتظر قليلًا ثم حاول.', 429); joinLimits.set(key, e);
  }

  return {
    matches: path => path === '/join' || path.startsWith('/teach/') || path === '/teach' || path.startsWith('/class/'),
    async handle(ctx) {
      const {req, res, url} = ctx, path = url.pathname;
      const api = /\/(events|content|narration|answer|command|evaluate|remove|plan|display-events|texts|delete|import)$/.test(path) || /^\/teach\/texts\//.test(path) || path.endsWith('.json') || req.headers['content-type']?.startsWith('application/json');
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
        if (method === 'GET') return page(res, html, 'الانضمام إلى الحصة', v.joinPage(String(url.searchParams.get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)));
        need(method === 'POST', 'إجراء غير متاح.', 405);
        joinLimit(req);
        const data = await fields(req), code = String(data.code || '').toUpperCase().trim(), name = String(data.name || '').trim().replace(/\s+/g, ' ');
        need(CODE.test(code), 'تأكد من رمز الحصة المكوّن من ستة أحرف وأرقام.');
        need(name.length >= 2 && name.length <= 30, 'اكتب اسمك الأول (من حرفين إلى ٣٠ حرفًا).');
        const s = g.session(code); need(s && (s.state.live || s.state.homework === 'open'), 'الحصة غير متاحة أو انتهت.', 404);
        const joined = g.join(code, name, MAX_STUDENTS); need(joined, 'اكتمل عدد الطلاب في هذه الحصة.', 409);
        res.setHeader('Set-Cookie', `gl_${code}=${joined.token}; Path=/class/${code}; Max-Age=1209600; HttpOnly; SameSite=Lax${base.startsWith('https:') ? '; Secure' : ''}`);
        broadcast(code); return redirect('/class/' + code);
      }
      const cls = path.match(/^\/class\/([A-Z0-9]{6})(?:\/(events|content|narration|answer))?$/);
      if (cls) {
        const [, code, action] = cls; need(CODE.test(code), 'رمز الحصة غير صالح.', 404);
        const s = g.session(code), me = s && g.student(code, studentToken(req, code));
        if (!me) { if (!action && method === 'GET') return redirect('/join?code=' + code); throw new UserError('انضم إلى الحصة أولًا.', 401); }
        if (!action && method === 'GET') return page(res, html, 'الحصة', v.studentPage(code, me.name, s.plan.title));
        if (action === 'events' && method === 'GET') return subscribe(req, res, code, 'student', me.id);
        if (action === 'content' && method === 'GET') return send(res, contentFor(s.state, s.plan, url.searchParams.get('step') || ''));
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

      // ---------- teacher ----------
      if (!u && method === 'GET' && !/events$/.test(path)) return redirect('/login');
      const teacher = teacherOnly(u);
      if (path === '/teach' || path === '/teach/plans') {
        need(method === 'GET', 'إجراء غير متاح.', 405);
        return page(res, html, 'دروسي للحصة الجماعية', v.plansPage(g.plans(teacher.id), g.sessions(teacher.id)));
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
      if (path === '/teach/plans/new' && method === 'POST') { const data = await fields(req), t = LESSON_TEMPLATES[data.template] || LESSON_TEMPLATES.light; return redirect('/teach/plans/' + g.createPlan(teacher.id, validatePlan(t.plan()))); }
      const pm = path.match(/^\/teach\/plans\/([0-9a-f-]{36})(\.json|\/delete|\/start)?$/);
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
        if (action === '/start' && method === 'POST') { await fields(req); const clean = validatePlan(plan.plan); return redirect('/teach/live/' + g.startSession(teacher.id, clean, initialState(clean))); }
        throw new UserError('إجراء غير متاح.', 405);
      }
      const lm = path.match(/^\/teach\/live\/([A-Z0-9]{6})(?:\/(events|plan|command|evaluate|remove|display|display-events))?$/);
      if (lm) {
        const [, code, action] = lm, s = ownSession(teacher, code);
        if (!action && method === 'GET') return page(res, html, 'إدارة الحصة', v.teacherPage(code, s.plan.title, base), true);
        if (action === 'display' && method === 'GET') return page(res, html, 'شاشة العرض', v.displayPage(code, s.plan.title, base));
        if (action === 'plan' && method === 'GET') return send(res, s.plan);
        if (action === 'events' && method === 'GET') return subscribe(req, res, code, 'teacher', teacher.id);
        if (action === 'display-events' && method === 'GET') return subscribe(req, res, code, 'display', null);
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
