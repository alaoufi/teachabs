// HTML scaffolds for the group lesson. Dynamic parts are filled by same-origin modules.
import {e} from './views.mjs';
import {STEP_TYPES, STEP_ORDER, LESSON_TEMPLATES, WORK_MODES, SUBJECTS} from './public/group-plan.js';
import {toolOf, toolsFor, STAMPS, LIBRARY} from './public/tool-library.js';
import {ACTIVITIES} from './public/activities.js';
import {GRADE_NAMES} from './public/group-plan.js';
import {COLORS, SIZE_NAMES} from './public/group-ink.js';
import {CURRICULUM_G4_T1, CURRICULUM_SOURCE, curriculumLessons} from './public/curriculum-g4.js';
import {LESSON_AIDS} from './public/lesson-preps-g4.js';

const TOOL_BUTTONS = [['select', '➤', 'تحريك', 'V'], ['hand', '✋', 'يد', 'H'], ['pen', '✎', 'قلم', 'P'], ['brush', '🖌', 'فرشاة', 'B'], ['marker', '▮', 'تظليل', 'M'], ['rect', '▭', 'مستطيل', 'R'], ['ellipse', '◯', 'دائرة', 'O'], ['line', '／', 'خط', 'L'], ['arrow', '↗', 'سهم', 'A'], ['laser', '🔴', 'مؤشر', 'K'], ['text', 'ت', 'كتابة', 'T'], ['eraser', '⌫', 'ممحاة', 'E']];

const css = '<link rel="stylesheet" href="/group-lesson.css?v=4"><script type="module" src="/error-report.js"></script>';
const dateText = t => new Intl.DateTimeFormat('ar-SA', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh'}).format(t);

/** «↗ أرسل لمعلم»: a copy of the prep, with its board arrangement, goes to a colleague of the same school. */
const sendForm = (action, colleagues, label) => colleagues.length ? `<form method="post" action="${action}" class="gl-send"><select name="to" required aria-label="${label}"><option value="">${label}…</option>${colleagues.map(c => `<option value="${e(c.id)}">${e(c.name)}</option>`).join('')}</select><button class="outline">${label.startsWith('حوّل') ? '↪ حوّل' : '↗ أرسل'}</button></form>` : '';
const originBadge = o => o ? `<span class="gl-origin">📥 ${e(o)}</span>` : '';

export function plansPage(plans, sessions, colleagues = [], sent = false) {
  const list = plans.length ? plans.map(p => `<li class="gl-row"><div><b>${e(p.title)}</b><small>آخر تعديل ${dateText(p.updated)}</small>${originBadge(p.origin)}</div>
   <div class="gl-actions"><a class="outline" href="/teach/plans/${p.id}">ترتيب الدرس</a>
   <a class="outline" href="/teach/plans/${p.id}.json" download="${e(p.title)}.json">تنزيل كملف</a>
   <form method="post" action="/teach/plans/${p.id}/start"><button class="btn">بدء الحصة</button></form>${sendForm(`/teach/plans/${p.id}/send`, colleagues, 'أرسل لمعلم')}</div></li>`).join('') : '<li class="gl-empty">لا توجد دروس بعد. ابدأ بالنموذج الجاهز ثم عدّله.</li>';
  const live = sessions.length ? `<h2>حصص سابقة وجارية</h2><ul class="gl-list">${sessions.map(s => `<li class="gl-row"><div><b>${e(s.title)}</b><small>الرمز ${e(s.code)} · ${dateText(s.created)} · ${s.live ? 'جارية' : 'انتهى العرض'}</small></div><a class="outline" href="/teach/live/${e(s.code)}">فتح إدارة الحصة</a></li>`).join('')}</ul>` : '';
  return `${css}<section class="gl-wrap" dir="rtl"><div class="section-head welcome-panel"><div class="eyebrow">الحصة الجماعية</div><h1>دروسي</h1>
  <p>رتّب درسك قبل الحصة بالتسلسل: ${STEP_ORDER.map(t => STEP_TYPES[t].short).join(' ← ')}. أثناء الحصة تتحكم بما يظهر للطلاب وما يختفي. <a class="textlink" href="/guide">دليل الاستخدام</a> · <a class="textlink" href="/teach/aids">📚 مكتبة الوسائل الدراسية</a></p></div>
  ${curriculumSection()}
  <div class="gl-actions gl-templates"><span class="gl-tpl-label">نماذج إضافية للتجربة (ليست ضمن الفصل الأول):</span>${Object.entries(LESSON_TEMPLATES).filter(([id]) => !TEMPLATE_IN_CURRICULUM.has(id)).map(([id, t]) => `<form method="post" action="/teach/plans/new"><input type="hidden" name="template" value="${id}"><button class="btn">${e(t.title)}</button></form>`).join('')}
  <button type="button" class="outline" id="plans-import-btn">استيراد درس من ملف</button><input type="file" id="plans-import" accept=".json,application/json" hidden></div>
  <p id="plans-status" class="gl-status" role="status" aria-live="polite" hidden></p>
  ${sent ? '<p class="gl-status" role="status">✓ أُرسلت نسخة من التحضير مع ترتيب السبورة إلى المعلم، وتبقى نسختك كما هي.</p>' : ''}
  <p class="gl-note">كل درس تحضّره يُحفظ هنا مع ترتيب السبورة وأدواته، فتستعمله في الحصص القادمة. يمكنك إرسال نسخة لمعلم من مدرستك، وتطّلع الشؤون التعليمية على التحضيرات وتحوّلها.</p>
  <ul class="gl-list">${list}</ul>${live}
  <p class="gl-note">خادم التجربة مؤقت وقد يتوقف في أي وقت: نزّل دروسك كملفات واحتفظ بها، ويمكنك استيرادها لاحقًا. استخدم أسماء أولى فقط وبيانات وهمية.</p></section><script type="module" src="/group-plans.js?v=1"></script>`;
}

/** A board tool or an interactive explanation drawn as a small picture (same drawings as on the board). */
function aidPicture(t) {
  if (STAMPS[t.id]) { const st = STAMPS[t.id], parts = []; st.draw((tag, attrs, text) => { parts.push(`<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${e(v)}"`).join(' ')}>${text === undefined ? '' : e(text)}</${tag}>`); });
    return `<svg viewBox="-6 -6 ${st.w + 12} ${st.h + 12}" class="tl-preview" aria-hidden="true"><g class="gl-stamp gl-stamp-${e(t.id)}">${parts.join('')}</g></svg>`; }
  if (ACTIVITIES[t.id]) { const a = ACTIVITIES[t.id], v = {...a.initial(), ...(a.narrator()[1]?.values || {})}; return a.render(v, {hidden: false}).replace('<svg ', '<svg aria-hidden="true" '); }
  return `<span class="aid-icon" aria-hidden="true">${t.icon}</span>`;
}
const AID_KIND = {activity: 'شرح تفاعلي', stamp: 'وسيلة على السبورة', class: 'أداة فصل'};
const gradesText = gs => gs.length === 9 ? 'كل الصفوف' : gs.map(g => GRADE_NAMES[g]).join('، ');

/**
 * «مكتبة الوسائل الدراسية»: every aid with its picture, kind, grades and the lessons that use it; and every lesson of the
 * term with its aids and its ready prep. Filters by subject and grade. Teachers can start a lesson from its ready prep.
 */
export function aidsPage({subject = '', grade = '', teacher = false} = {}) {
  const subjects = {'': 'كل المواد', science: 'العلوم', math: 'الرياضيات', arabic: 'لغتي', english: 'الإنجليزية', islamic: 'الدراسات الإسلامية'};
  const {forLesson, others} = toolsFor({subject, grade: Number(grade) || 0}), aids = [...forLesson, ...others];
  const usedBy = id => curriculumLessons().filter(l => (LESSON_AIDS[l.id] || []).includes(id));
  const cards = aids.map(t => { const ls = usedBy(t.id); return `<article class="aid-card" data-aid="${e(t.id)}"><div class="aid-pic">${aidPicture(t)}</div><div class="aid-body"><h3>${t.icon} ${e(t.title)}</h3><p>${e(t.desc)}</p>
<small><b>${AID_KIND[t.kind]}</b> · ${e(gradesText(t.grades))}</small>${ls.length ? `<small class="aid-lessons">في دروس الصف الرابع: ${ls.map(l => e(l.title)).join('، ')}</small>` : ''}</div></article>`; }).join('') || '<p class="gl-empty">لا توجد وسائل بهذا الاختيار.</p>';
  const lessonsBlock = (!grade || grade === '4') ? Object.entries(CURRICULUM_G4_T1).filter(([k]) => !subject || k === subject).map(([k, sub]) => `<details class="aid-term" open><summary>${e(sub.name)} — الصف الرابع، الفصل الدراسي الأول</summary><ol class="aid-lesson-list">${sub.units.flatMap(u => u.chapters.flatMap(c => c.lessons)).map(l => `<li data-lesson="${e(l.id)}"><b>${e(l.title)}</b><span class="aid-chips">${(LESSON_AIDS[l.id] || []).map(id => toolOf(id)).filter(Boolean).map(t => `<span class="gl-origin">${t.icon} ${e(t.title)}</span>`).join(' ')}</span>${teacher && l.template ? `<form method="post" action="/teach/plans/new"><input type="hidden" name="template" value="${e(l.template)}"><button class="btn gl-mini">ابدأ من الدرس الجاهز</button></form>` : ''}</li>`).join('')}</ol></details>`).join('') : '';
  const sel = (name, opts, cur) => `<select name="${name}" aria-label="${name === 'subject' ? 'المادة' : 'الصف'}">${Object.entries(opts).map(([k, v]) => `<option value="${e(k)}"${String(k) === String(cur) ? ' selected' : ''}>${e(v)}</option>`).join('')}</select>`;
  const grades = {'': 'كل الصفوف', ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map(g => [g, 'الصف ' + GRADE_NAMES[g]]))};
  return `${css}<section class="gl-wrap aids-page" dir="rtl"><div class="section-head welcome-panel"><div class="eyebrow">مكتبة المدرسة</div><h1>مكتبة الوسائل الدراسية</h1>
  <p>${new Intl.NumberFormat('ar-SA').format(LIBRARY.length)} وسيلة: شروح تفاعلية، ووسائل توضع على السبورة، وأدوات للفصل. لكل درس من دروس الصف الرابع (الفصل الأول) وسائله وتحضيره الجاهز، ويثبّت المعلم ما يريد منها في تحضير درسه.</p>
  <form method="get" action="/teach/aids" class="gl-actions aid-filters">${sel('subject', subjects, subject)}${sel('grade', grades, grade)}<noscript><button class="btn">عرض</button></noscript></form></div>
  ${lessonsBlock ? `<h2>وسائل كل درس وتحضيره الجاهز</h2>${lessonsBlock}` : ''}
  <h2>الوسائل (${new Intl.NumberFormat('ar-SA').format(aids.length)})</h2><div class="aid-grid">${cards}</div>
  <p class="gl-note">الرسوم والشروح من إعداد المشروع، وليست منسوخة من الكتب. ترتيب الدروس من فهرس كتب وزارة التعليم ١٤٤٧هـ.</p>
  <p>${teacher ? '<a class="textlink" href="/teach/plans">دروسي</a>' : '<a class="textlink" href="/admin">العودة إلى الإدارة</a>'}</p></section><script type="module" src="/aids-page.js"></script>`;
}

/** Academic affairs: the school's lesson preps. */
export function reviewPage(plans, assigned) {
  const rows = plans.length ? plans.map(p => `<li class="gl-row gl-review-row"><div><b>${e(p.title)}</b><small>${e(p.teacherName)} · ${e(SUBJECTS[p.subject] || '')}${p.grade ? ' · الصف ' + e(p.grade) : ''} · آخر تعديل ${dateText(p.updated)}</small>${originBadge(p.origin)}</div>
   <div class="gl-actions"><a class="outline" href="/teach/review/${p.id}">عرض التحضير</a></div></li>`).join('') : '<li class="gl-empty">لم يحضّر معلمو المدرسة دروسًا بعد.</li>';
  return `${css}<section class="gl-wrap" dir="rtl"><div class="section-head welcome-panel"><div class="eyebrow">الشؤون التعليمية</div><h1>تحضيرات الدروس</h1>
  <p>تحضيرات معلمي المدرسة كما حفظوها مع ترتيب السبورة والأدوات. افتح أي تحضير لتطّلع عليه، وحوّل نسخة منه لمعلم آخر عند الحاجة (يبقى الأصل عند صاحبه).</p></div>
  ${assigned ? '<p class="gl-status" role="status">✓ حُوّلت نسخة من التحضير إلى المعلم، وستظهر في «دروسي» عنده.</p>' : ''}
  <ul class="gl-list">${rows}</ul><p><a class="textlink" href="/admin">العودة إلى الإدارة</a></p></section>`;
}

/** One prep, read only, with «حوّل لمعلم» when the admin may manage teachers. */
export function reviewPlanPage(p, colleagues) {
  const plan = p.plan, tools = (plan.tools || []).map(toolOf).filter(Boolean);
  const steps = plan.steps.map((s, i) => `<li><b>${i + 1}. ${e(s.title)}</b> <small>${e(STEP_TYPES[s.type]?.label || s.type)}${s.startHidden ? ' · مخفية في البداية' : ''}</small>${s.narration?.text ? `<p class="gl-note">🔊 ${e(s.narration.text.slice(0, 220))}${s.narration.text.length > 220 ? '…' : ''}</p>` : ''}</li>`).join('');
  return `${css}<section class="gl-wrap" dir="rtl"><div class="section-head welcome-panel"><div class="eyebrow">الشؤون التعليمية · تحضير ${e(p.teacherName)}</div><h1>${e(p.title)}</h1>
  <p>${e(SUBJECTS[plan.subject] || '')} · الصف ${e(plan.grade)} · ${plan.steps.length} خطوات · آخر تعديل ${dateText(p.updated)}</p>${originBadge(p.origin)}</div>
  ${tools.length ? `<h2>أدوات الدرس المثبتة</h2><p class="gl-review-tools">${tools.map(t => `<span class="gl-origin">${t.icon} ${e(t.title)}</span>`).join(' ')}</p>` : ''}
  <h2>ترتيب الدرس</h2><ol class="gl-list gl-review-steps">${steps}</ol>
  ${colleagues ? (colleagues.length ? `<h2>تحويل نسخة لمعلم</h2>${sendForm(`/teach/review/${p.id}/assign`, colleagues.filter(c => c.id !== p.teacher), 'حوّل لمعلم')}` : '<p class="gl-note">لا يوجد معلمون آخرون في المدرسة.</p>') : '<p class="gl-note">تحويل التحضير يحتاج صلاحية «إدارة المعلمين والجداول».</p>'}
  <p><a class="textlink" href="/teach/review">كل التحضيرات</a></p></section>`;
}

const TEMPLATE_IN_CURRICULUM = new Set(curriculumLessons().map(l => l.template).filter(Boolean));

/** The term's lessons in the book's order; a ready lesson starts from its template in one click. */
function curriculumSection() {
  const subjects = Object.entries(CURRICULUM_G4_T1).map(([key, sub]) => {
    const all = sub.units.flatMap(u => u.chapters.flatMap(c => c.lessons)), ready = all.filter(l => l.template && LESSON_TEMPLATES[l.template]).length;
    const units = sub.units.map(u => `<div class="gl-cur-unit"><h4>${e(u.title)}</h4>${u.chapters.map(c => `${c.title ? `<h5>${e(c.title)}</h5>` : ''}<ol>${c.lessons.map(l => `<li class="${l.template ? 'is-ready' : ''}"><span>${e(l.title)}</span>${l.template && LESSON_TEMPLATES[l.template]
      ? `<form method="post" action="/teach/plans/new"><input type="hidden" name="template" value="${e(l.template)}"><button class="btn gl-mini">ابدأ من الدرس الجاهز</button></form>` : '<small class="gl-soon">قريبًا</small>'}</li>`).join('')}</ol>`).join('')}</div>`).join('');
    return `<details class="gl-cur-subject" open data-subject="${e(key)}"><summary>${e(sub.name)} <small>${ready} جاهز من ${all.length} درسًا</small></summary>${units}</details>`;
  }).join('');
  return `<section class="gl-curriculum" aria-labelledby="cur-title"><h2 id="cur-title">منهج الصف الرابع — الفصل الدراسي الأول</h2><p class="gl-note">${e(CURRICULUM_SOURCE)}</p><div class="gl-cur-grid">${subjects}</div></section>`;
}

export function plannerPage(id, title) {
  return `${css}<section class="gl-wrap" dir="rtl" id="planner" data-id="${e(id)}">
  <div class="gl-top"><div><div class="eyebrow">ترتيب الدرس قبل الحصة</div><h1 id="pl-heading">${e(title)}</h1></div>
  <div class="gl-actions"><a class="textlink" href="/guide" target="_blank" rel="noopener">دليل الاستخدام</a><a class="outline" href="/teach/plans">دروسي</a><button type="button" class="outline" id="pl-export">تنزيل الدرس كملف</button><button type="button" class="outline" id="pl-import-btn">استيراد من ملف</button><input type="file" id="pl-import" accept=".json,application/json" hidden><button type="button" class="btn" id="pl-save">حفظ الدرس</button></div></div>
  <p id="pl-status" class="gl-status" role="status" aria-live="polite">جارٍ تحميل الدرس…</p>
  <div id="pl-draft" class="gl-draft" role="alert" hidden><span>يوجد تعديل محفوظ على هذا الجهاز لم يصل إلى الخادم.</span><button type="button" class="btn" id="pl-draft-restore">استعادة التعديل</button><button type="button" class="quiet" id="pl-draft-drop">تجاهل</button></div>
  <p class="gl-note">يحفظ هذا الجهاز مسودة تلقائية أثناء العمل. خادم التجربة قد يتوقف في أي وقت، فنزّل الدرس كملف بعد إنهائه واحتفظ به.</p>
  <div class="gl-meta" id="pl-meta"></div>
  <ol class="gl-plan" id="pl-steps"></ol>
  <div class="gl-add" role="group" aria-label="إضافة خطوة">${STEP_ORDER.map(t => `<button type="button" class="outline" data-add="${t}">+ ${STEP_TYPES[t].short}</button>`).join('')}</div>
  <form method="post" action="/teach/plans/${e(id)}/start" class="gl-start"><button class="btn">بدء الحصة بهذا الترتيب</button><small>احفظ قبل البدء؛ تبدأ الحصة بآخر نسخة محفوظة.</small></form>
  <form method="post" action="/teach/plans/${e(id)}/delete" class="gl-delete"><button class="quiet">حذف الدرس</button></form>
  <noscript><p class="error">ترتيب الدرس يحتاج JavaScript.</p></noscript>
 </section><script type="module" src="/group-planner.js?v=2"></script>`;
}

const zoomBar = (follow = false) => `<div class="gl-zoom" role="group" aria-label="تكبير السبورة"><button type="button" data-zoom="in" aria-label="تكبير" title="تكبير (+)">＋</button><button type="button" data-zoom="out" aria-label="تصغير" title="تصغير (−)">－</button><button type="button" data-zoom="fit" title="ملاءمة (0)">ملاءمة</button>${follow ? '<button type="button" data-zoom="follow" hidden>اتبع المعلم</button><button type="button" data-zoom="max" aria-pressed="false" title="السبورة بملء الشاشة">⛶</button>' : ''}</div>`;
// Students get the zoom controls under the board so they never cover the lesson on a small phone.
const boardShell = (extra = '', follow = false) => `<div class="gl-stage"><div class="gl-board" id="gl-board" aria-live="polite"><div class="gl-camera" id="gl-camera"><div class="gl-content" id="gl-content"></div><svg class="gl-ink" id="gl-ink" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true"></svg></div></div>${zoomBar(follow)}${extra}</div>`; // zoom sits under the board, never on it

export function teacherPage(code, title, base) {
  // Presentation mode: one screen, no page scroll. The raised board fills the middle; lesson controls sit above it,
  // drawing tools below it, and students, results, homework and evaluation open in a side drawer.
  const join = `${base}/join?code=${code}`;
  // Tools grouped like a drawing app: one button per family that opens its family (pens, shapes, colour, size, more),
  // so the board keeps the space. Everything here is the teacher's alone; students never see these menus.
  const toolBtn = ([tool, icon, label, key]) => `<button type="button" class="gl-tool" data-tool="${tool}" aria-pressed="${tool === 'select' ? 'true' : 'false'}" title="${label} (${key})"><span aria-hidden="true">${icon}</span><span>${label}</span></button>`;
  const byTool = Object.fromEntries(TOOL_BUTTONS.map(b => [b[0], b]));
  const fly = (id, icon, label, inner, cls = '') => `<div class="gl-fly ${cls}" data-fly="${id}"><button type="button" class="gl-fly-btn" aria-expanded="false" aria-haspopup="true" title="${label}"><span class="gl-fly-icon" aria-hidden="true">${icon}</span><span class="gl-fly-label">${label}</span><b aria-hidden="true">▾</b></button><div class="gl-fly-menu" role="group" aria-label="${label}" hidden>${inner}</div></div>`;
  const tools = `<div class="gl-tools" role="toolbar" aria-label="أدوات السبورة">
     <div class="gl-toolgroup gl-main-tools" role="group" aria-label="الأداة">${['select', 'hand'].map(t => toolBtn(byTool[t])).join('')}
      ${fly('pens', '✎', 'أقلام', ['pen', 'brush', 'marker', 'text'].map(t => toolBtn(byTool[t])).join(''))}
      ${fly('shapes', '◯', 'أشكال', ['rect', 'ellipse', 'line', 'arrow'].map(t => toolBtn(byTool[t])).join(''))}
      ${['laser', 'eraser'].map(t => toolBtn(byTool[t])).join('')}</div>
     <div class="gl-toolgroup gl-lesson-tools" role="group" aria-label="أدوات الدرس">${fly('lesson', '🧰', 'أدوات الدرس', '<span id="gl-lesson-tools" class="gl-lesson-tools-list"></span><button type="button" id="gl-open-library" class="btn">📚 المكتبة كاملة</button>', 'gl-lesson-fly')}</div>
     <div class="gl-toolgroup gl-look" role="group" aria-label="اللون والحجم">
      ${fly('colors', '<i class="gl-current-color"></i>', 'اللون', COLORS.map((c, i) => `<button type="button" class="gl-color" data-color="${c.value}" aria-label="${c.name}" title="${c.name}" aria-pressed="${i ? 'false' : 'true'}"><i data-swatch="${i}"></i></button>`).join(''), 'gl-colors')}
      ${fly('sizes', '<i class="gl-current-size" data-dot="m"></i>', 'الحجم', Object.entries(SIZE_NAMES).map(([k, n]) => `<button type="button" class="gl-size" data-size="${k}" aria-pressed="${k === 'm' ? 'true' : 'false'}" title="حجم ${n}"><i data-dot="${k}"></i><span>${n}</span></button>`).join(''))}</div>
     <div class="gl-toolgroup" role="group" aria-label="إجراءات"><button type="button" id="gl-undo" title="تراجع (Ctrl+Z)">↶ تراجع</button>
      ${fly('more', '⋯', 'المزيد', '<button type="button" id="gl-library" title="اختر نصًا توضيحيًا وعدّله ثم ضعه على السبورة">📚 نصوص</button><button type="button" id="gl-clear" title="مسح كتابة الخطوة">🗑 مسح</button>'
        + '<b class="gl-fly-head">⏱ مؤقت يراه الطلاب</b><button type="button" class="gl-timer-btn" data-sec="60">١ د</button><button type="button" class="gl-timer-btn" data-sec="180">٣ د</button><button type="button" class="gl-timer-btn" data-sec="300">٥ د</button><button type="button" class="gl-timer-btn" data-sec="0">⏹ إيقاف</button>'
        + '<b class="gl-fly-head">🎭 ستارة على السبورة</b><button type="button" class="gl-curtain-btn" data-level="100">إسدال</button><button type="button" class="gl-curtain-btn" data-level="-25">كشف ربع</button><button type="button" class="gl-curtain-btn" data-level="0">رفع</button>'
        + '<b class="gl-fly-head">أدوات القياس</b><button type="button" class="gl-stamp-btn" data-stamp="ruler">📏 مسطرة</button><button type="button" class="gl-stamp-btn" data-stamp="protractor">📐 منقلة</button>')}</div>
    </div>`;
  return `${css}<section class="gl-wrap gl-teacher gl-present" dir="rtl" id="gl-app" data-code="${e(code)}" data-role="teacher">
  <header class="gl-bar gl-bar-top">
   <div class="gl-bar-title"><h1>${e(title)}</h1><button type="button" class="gl-code-chip" id="gl-code" data-join="${e(join)}" title="انسخ رابط الطلاب: ${e(join)}">الرمز <b class="gl-code">${e(code)}</b></button><span id="gl-status" class="gl-status-dot" role="status" aria-live="polite">جارٍ الاتصال…</span></div>
   <div class="gl-bar-actions"><a class="outline gl-mini" href="/teach/live/${e(code)}/display" target="_blank" rel="noopener" title="افتح على السبورة الذكية أو جهاز العرض">🖥 شاشة العرض</a><div class="gl-fly gl-class-fly" data-fly="class"><button type="button" class="gl-fly-btn gl-mini" aria-expanded="false" aria-haspopup="true" title="إدارة الفصل: اختيار طالب، الانتباه، وضع العمل"><span class="gl-fly-icon" aria-hidden="true">🧭</span><span class="gl-fly-label">إدارة الفصل</span><b aria-hidden="true">▾</b></button><div class="gl-fly-menu gl-class-menu" role="group" aria-label="إدارة الفصل" hidden>
     <button type="button" id="gl-pick" class="btn">🎲 اختر طالبًا</button><button type="button" id="gl-pick-reset" class="quiet">↺ ابدأ الدور من جديد</button>
     <button type="button" id="gl-attention" aria-pressed="false">👀 انتباه: اقفل شاشات الطلاب</button>
     <b class="gl-fly-head">🚦 وضع العمل يراه الطلاب</b>${Object.entries(WORK_MODES).map(([k, v]) => `<button type="button" class="gl-work-btn" data-mode="${k}" aria-pressed="${k === 'none'}">${k === 'none' ? '✖ إلغاء' : v}</button>`).join('')}
    </div></div><button type="button" class="gl-mini gl-hands" id="gl-hands" hidden title="طلاب رفعوا أيديهم">✋ <b id="gl-hands-n"></b></button><button type="button" class="outline gl-mini" id="gl-drawer-btn" aria-expanded="false" aria-controls="gl-drawer">👥 الطلاب <span id="gl-count"></span></button><a class="quiet gl-mini" href="/guide" target="_blank" rel="noopener">الدليل</a><button type="button" class="quiet gl-mini" id="gl-live">إنهاء العرض</button></div>
  </header>
  <nav class="gl-bar gl-bar-steps" aria-label="تسلسل الدرس">
   <button type="button" id="gl-prev" class="gl-mini" title="السابق (PageUp)">→</button>
   <ol id="gl-steps" class="gl-steps-strip"></ol>
   <button type="button" id="gl-next" class="btn gl-mini" title="التالي (PageDown)">←</button>
   <span class="gl-sep"></span>
   <button type="button" id="gl-show" class="gl-mini" aria-pressed="true">إخفاء عن الطلاب</button><span class="gl-vis" id="gl-vis"></span>
   <div class="gl-quick" id="gl-quick" role="group" aria-label="أزرار الخطوة الحالية"></div>
  </nav>
  ${boardShell('<video class="gl-cam gl-selfcam" id="gl-selfcam" muted playsinline autoplay hidden aria-label="صورتك كما يراها الطلاب"></video><div class="gl-textbox" id="gl-textbox" hidden><input id="gl-textinput" maxlength="200" aria-label="اكتب على السبورة" placeholder="اكتب ثم Enter" dir="auto"><button type="button" id="gl-textok" class="btn">ضع</button><button type="button" id="gl-textcancel" class="quiet">إلغاء</button></div>')}
  <footer class="gl-bar gl-bar-bottom"><div class="gl-av" id="gl-av" role="group" aria-label="الصوت والكاميرا — تحكم سريع">
   <button type="button" id="gl-voice" class="gl-avbtn" aria-pressed="false" title="صوتك يصل إلى أجهزة الطلاب"><span class="gl-avl">🎙 صوتي</span><span class="gl-avs">: مغلق</span></button>
   <button type="button" id="gl-cam" class="gl-avbtn" aria-pressed="false" title="صورتك تظهر للطلاب"><span class="gl-avl">📷 الكاميرا</span><span class="gl-avs">: مغلقة</span></button>
   <button type="button" id="gl-mics" class="gl-avbtn" aria-pressed="true" title="هل يستطيع الطلاب فتح المايك؟"><span class="gl-avl">🎤 مايك الطلاب</span><span class="gl-avs">: مسموح</span></button>
   <button type="button" id="gl-test-voice" class="gl-avbtn" title="يقرأ جملة تجريبية بصوت المتحدث، ويخبرك إن لم يُسمع ولماذا"><span class="gl-avl">🔈 اختبار</span><span class="gl-avs"> الصوت</span></button>
   <button type="button" id="gl-stop" class="gl-avbtn gl-danger" title="يغلق صوتك وكاميرتك ومايك كل الطلاب فورًا">⛔ إيقاف الكل</button>
  </div>${tools}<div class="gl-snippets" id="gl-snippets" hidden></div></footer>
  <div class="gl-ended gl-voice-help" id="gl-voice-help" hidden role="alertdialog" aria-modal="true" aria-labelledby="gl-voice-help-title"><div class="gl-start-card"><h2 id="gl-voice-help-title">صوت المتحدث</h2><div id="gl-voice-help-text"></div><button type="button" class="btn" id="gl-voice-help-close">حسنًا</button></div></div>
  <aside class="gl-drawer" id="gl-drawer" aria-label="الخطوة والطلاب والنتائج" hidden>
   <div class="gl-drawer-head"><h2>الخطوة والطلاب</h2><button type="button" class="quiet" id="gl-drawer-close" aria-label="إغلاق">✕</button></div>
   <section class="gl-panel" id="gl-panel" aria-label="أدوات الخطوة الحالية"></section>
   <div class="gl-narration" id="gl-narration" hidden></div>
   <section><h2>الطلاب</h2><ul id="gl-students" class="gl-students"></ul></section>
   <section><h2>الواجب</h2><div id="gl-homework"></div></section>
   <section><h2>التقييم</h2><div id="gl-evaluation"></div></section>
   <details class="gl-keys"><summary>اختصارات لوحة المفاتيح</summary><p>V تحريك · H يد · P قلم · B فرشاة · M تظليل · R مستطيل · O دائرة · L خط · A سهم · K مؤشر ليزر · T كتابة · E ممحاة · + و − تكبير وتصغير · 0 ملاءمة · Ctrl+Z تراجع · PageDown أو ← للخطوة التالية، و PageUp أو → للسابقة (تناسب أجهزة التحكم بالعرض) · Esc إلغاء.</p></details>
   <p class="gl-note">الصوت والصورة مباشران بين جهازك وكل طالب. في بعض الشبكات المقيّدة قد لا يصل الصوت أو الصورة؛ السبورة وبقية الحصة تعمل دائمًا.</p>
  </aside>
 </section><script type="module" src="/group-teacher.js?v=4"></script>`;
}

export function displayPage(code, title) {
  // Made for a smart board or projector: one thin bar, and the board takes every remaining pixel.
  return `${css}<section class="gl-wrap gl-display gl-show" dir="rtl" id="gl-app" data-code="${e(code)}" data-role="display">
  <header class="gl-show-bar"><h1>${e(title)}</h1><p class="gl-join">للانضمام: <b class="gl-code">${e(code)}</b></p>
   <p id="gl-status" class="gl-status-dot" role="status" aria-live="polite">جارٍ الاتصال…</p>
   <span class="gl-show-actions"><button type="button" id="gl-audio" class="outline gl-mini" hidden>تفعيل صوت الشرح على هذه الشاشة</button><button type="button" id="gl-full" class="outline gl-mini">⛶ ملء الشاشة</button></span></header>
  ${boardShell()}<p id="gl-wait" class="gl-wait" hidden></p>
 </section><script type="module" src="/group-student.js?v=3"></script>`;
}

export function studentPage(code, name, title) {
  // Nothing but the board: it pops up over everything. A slim bar holds the microphone, «كتابة» (answers and
  // homework open in a sheet over the board) and ✕ to leave, which asks first. The teacher controls the rest.
  return `${css}<section class="gl-wrap gl-student gl-solo" dir="rtl" id="gl-app" data-code="${e(code)}" data-role="student">
  <div class="gl-entry" id="gl-start" role="dialog" aria-modal="true" aria-labelledby="gl-start-title"><div class="gl-start-card"><p class="gl-hello">مرحبًا ${e(name)}</p><h1 id="gl-start-title">${e(title)}</h1>
   <button type="button" class="btn" id="gl-enter">ادخل الحصة</button><p class="gl-hint">تفتح السبورة على الشاشة كلها، ويُسمع صوت المعلم.</p></div></div>
  ${boardShell('<video class="gl-cam" id="gl-teachercam" playsinline autoplay muted hidden aria-label="المعلم"></video>', true)}<p id="gl-wait" class="gl-wait" hidden></p>
  <nav class="gl-sbar" aria-label="أدوات الطالب">
   <button type="button" class="gl-sbtn" id="gl-mic" aria-pressed="false">🎤 <span>المايك</span></button>
   <button type="button" class="gl-sbtn" id="gl-hand" aria-pressed="false">✋ <span>ارفع يدك</span></button>
   <button type="button" class="gl-sbtn" id="gl-write" aria-expanded="false" aria-controls="gl-sheet">✏️ <span>كتابة</span><b class="gl-dot" id="gl-write-dot" hidden></b></button>
   <span id="gl-status" class="gl-status-dot" role="status" aria-live="polite">جارٍ الاتصال…</span>
   <button type="button" class="gl-sbtn" id="gl-audio" hidden>🔈 <span>استمع</span></button>
   <span class="gl-stars" id="gl-stars" hidden aria-label="نجومك"></span>
   <button type="button" class="gl-sbtn gl-leave" id="gl-leave" aria-label="مغادرة الحصة">✕</button>
  </nav>
  <section class="gl-sheet" id="gl-sheet" hidden aria-label="الكتابة والإجابات"><div class="gl-sheet-head"><b>✏️ كتابة</b><button type="button" class="outline gl-mini" id="gl-sheet-close">↓ العودة إلى السبورة</button></div>
   <p class="gl-hint" id="gl-sheet-empty">لا توجد أسئلة الآن. سيفتحها المعلم.</p>
   <section class="gl-answer" id="gl-answer" hidden aria-label="أجب عن الأسئلة"></section>
   <section class="gl-homework" id="gl-hw" hidden aria-label="الواجب"></section>
   <section class="gl-myeval" id="gl-eval" hidden aria-label="تقييمي"></section></section>
  <div class="gl-attention" id="gl-attention-cover" hidden role="alertdialog" aria-label="انتباه"><span>👀</span><b>انظروا إلى المعلم</b></div>
  <div class="gl-pick-pop" id="gl-pick-pop" hidden aria-live="assertive"></div>
  <div class="gl-work" id="gl-work" hidden></div>
  <div class="gl-star-pop" id="gl-star-pop" hidden aria-live="assertive"><span>⭐</span><b>أحسنت!</b></div>
  <div class="gl-ended" id="gl-ended" hidden role="alertdialog" aria-modal="true" aria-labelledby="gl-ended-title"><div class="gl-start-card"><h2 id="gl-ended-title">انتهت الحصة</h2><p id="gl-ended-text">شكرًا لك!</p>
   <button type="button" class="btn" id="gl-ended-close">إغلاق</button></div></div>
 </section><script type="module" src="/group-student.js?v=3"></script>`;
}

export function joinPage(code, none = false) {
  return `${css}<section class="gl-wrap gl-joinpage narrow panel" dir="rtl"><div class="eyebrow">الحصة الجماعية</div><h1>الانضمام إلى الحصة</h1>
  ${none ? '<p class="gl-status">لا توجد حصة تجريبية جارية الآن. افتح «أنا المعلم» على جهاز آخر وابدأ حصة، ثم اضغط «أنا الطالب» من جديد، أو اكتب رمز الحصة هنا.</p>' : ''}<form method="post" action="/join" class="gl-form"><label>رمز الحصة<input name="code" required minlength="6" maxlength="6" autocomplete="off" autocapitalize="characters" inputmode="text" value="${e(code)}" dir="ltr"></label>
  <label>اسمك الأول<input name="name" required minlength="2" maxlength="30" autocomplete="given-name"></label>
  <button class="btn">دخول الحصة</button></form>
  <p class="gl-note">اكتب اسمك الأول فقط. يرى المعلم إجاباتك، ولا يظهر اسمك للآخرين إلا إذا اختار المعلم عرضه.</p></section>`;
}
