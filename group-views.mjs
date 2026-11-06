// HTML scaffolds for the group lesson. Dynamic parts are filled by same-origin modules.
import {e} from './views.mjs';
import {STEP_TYPES, STEP_ORDER, LESSON_TEMPLATES} from './public/group-plan.js';
import {COLORS, SIZE_NAMES} from './public/group-ink.js';
import {CURRICULUM_G4_T1, CURRICULUM_SOURCE, curriculumLessons} from './public/curriculum-g4.js';

const TOOL_BUTTONS = [['select', '➤', 'تحريك', 'V'], ['hand', '✋', 'يد', 'H'], ['pen', '✎', 'قلم', 'P'], ['brush', '🖌', 'فرشاة', 'B'], ['marker', '▮', 'تظليل', 'M'], ['text', 'ت', 'كتابة', 'T'], ['eraser', '⌫', 'ممحاة', 'E']];

const css = '<link rel="stylesheet" href="/group-lesson.css?v=4"><script type="module" src="/error-report.js"></script>';
const dateText = t => new Intl.DateTimeFormat('ar-SA', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh'}).format(t);

export function plansPage(plans, sessions) {
  const list = plans.length ? plans.map(p => `<li class="gl-row"><div><b>${e(p.title)}</b><small>آخر تعديل ${dateText(p.updated)}</small></div>
   <div class="gl-actions"><a class="outline" href="/teach/plans/${p.id}">ترتيب الدرس</a>
   <a class="outline" href="/teach/plans/${p.id}.json" download="${e(p.title)}.json">تنزيل كملف</a>
   <form method="post" action="/teach/plans/${p.id}/start"><button class="btn">بدء الحصة</button></form></div></li>`).join('') : '<li class="gl-empty">لا توجد دروس بعد. ابدأ بالنموذج الجاهز ثم عدّله.</li>';
  const live = sessions.length ? `<h2>حصص سابقة وجارية</h2><ul class="gl-list">${sessions.map(s => `<li class="gl-row"><div><b>${e(s.title)}</b><small>الرمز ${e(s.code)} · ${dateText(s.created)} · ${s.live ? 'جارية' : 'انتهى العرض'}</small></div><a class="outline" href="/teach/live/${e(s.code)}">فتح إدارة الحصة</a></li>`).join('')}</ul>` : '';
  return `${css}<section class="gl-wrap" dir="rtl"><div class="section-head welcome-panel"><div class="eyebrow">الحصة الجماعية</div><h1>دروسي</h1>
  <p>رتّب درسك قبل الحصة بالتسلسل: ${STEP_ORDER.map(t => STEP_TYPES[t].short).join(' ← ')}. أثناء الحصة تتحكم بما يظهر للطلاب وما يختفي. <a class="textlink" href="/guide">دليل الاستخدام</a></p></div>
  ${curriculumSection()}
  <div class="gl-actions gl-templates"><span class="gl-tpl-label">نماذج إضافية للتجربة (ليست ضمن الفصل الأول):</span>${Object.entries(LESSON_TEMPLATES).filter(([id]) => !TEMPLATE_IN_CURRICULUM.has(id)).map(([id, t]) => `<form method="post" action="/teach/plans/new"><input type="hidden" name="template" value="${id}"><button class="btn">${e(t.title)}</button></form>`).join('')}
  <button type="button" class="outline" id="plans-import-btn">استيراد درس من ملف</button><input type="file" id="plans-import" accept=".json,application/json" hidden></div>
  <p id="plans-status" class="gl-status" role="status" aria-live="polite" hidden></p>
  <ul class="gl-list">${list}</ul>${live}
  <p class="gl-note">خادم التجربة مؤقت وقد يتوقف في أي وقت: نزّل دروسك كملفات واحتفظ بها، ويمكنك استيرادها لاحقًا. استخدم أسماء أولى فقط وبيانات وهمية.</p></section><script type="module" src="/group-plans.js?v=1"></script>`;
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
const boardShell = (extra = '', follow = false) => `<div class="gl-stage"><div class="gl-board" id="gl-board" aria-live="polite"><div class="gl-camera" id="gl-camera"><div class="gl-content" id="gl-content"></div><svg class="gl-ink" id="gl-ink" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true"></svg></div>${follow ? '' : zoomBar(false)}</div>${follow ? zoomBar(true) : ''}${extra}</div>`;

export function teacherPage(code, title, base) {
  // Presentation mode: one screen, no page scroll. The raised board fills the middle; lesson controls sit above it,
  // drawing tools below it, and students, results, homework and evaluation open in a side drawer.
  const join = `${base}/join?code=${code}`;
  const tools = `<div class="gl-tools" role="toolbar" aria-label="أدوات السبورة">
     <div class="gl-toolgroup" role="group" aria-label="الأداة">${TOOL_BUTTONS.map(([tool, icon, label, key]) => `<button type="button" class="gl-tool" data-tool="${tool}" aria-pressed="${tool === 'select' ? 'true' : 'false'}" title="${label} (${key})"><span aria-hidden="true">${icon}</span><span>${label}</span></button>`).join('')}</div>
     <div class="gl-toolgroup gl-colors" role="group" aria-label="اللون">${COLORS.map((c, i) => `<button type="button" class="gl-color" data-color="${c.value}" aria-label="${c.name}" title="${c.name}" aria-pressed="${i ? 'false' : 'true'}"><i data-swatch="${i}"></i></button>`).join('')}</div>
     <div class="gl-toolgroup" role="group" aria-label="الحجم">${Object.entries(SIZE_NAMES).map(([k, n]) => `<button type="button" class="gl-size" data-size="${k}" aria-pressed="${k === 'm' ? 'true' : 'false'}" title="حجم ${n}"><i data-dot="${k}"></i><span>${n}</span></button>`).join('')}</div>
     <div class="gl-toolgroup" role="group" aria-label="إجراءات"><button type="button" id="gl-library" title="اختر نصًا توضيحيًا وعدّله ثم ضعه على السبورة">📚 نصوص</button><button type="button" id="gl-undo" title="تراجع (Ctrl+Z)">↶ تراجع</button><button type="button" id="gl-clear" title="مسح كتابة الخطوة">🗑 مسح</button></div>
    </div>`;
  return `${css}<section class="gl-wrap gl-teacher gl-present" dir="rtl" id="gl-app" data-code="${e(code)}" data-role="teacher">
  <header class="gl-bar gl-bar-top">
   <div class="gl-bar-title"><h1>${e(title)}</h1><button type="button" class="gl-code-chip" id="gl-code" data-join="${e(join)}" title="انسخ رابط الطلاب: ${e(join)}">الرمز <b class="gl-code">${e(code)}</b></button><span id="gl-status" class="gl-status-dot" role="status" aria-live="polite">جارٍ الاتصال…</span></div>
   <div class="gl-bar-actions"><a class="outline gl-mini" href="/teach/live/${e(code)}/display" target="_blank" rel="noopener" title="افتح على السبورة الذكية أو جهاز العرض">🖥 شاشة العرض</a><button type="button" id="gl-voice" class="outline gl-mini" aria-pressed="false" title="صوتك يصل إلى أجهزة الطلاب">🎙 صوتي: مغلق</button><button type="button" id="gl-mics" class="outline gl-mini" aria-pressed="true" title="هل يستطيع الطلاب فتح المايك؟">🎤 مايك الطلاب: مسموح</button><button type="button" class="outline gl-mini" id="gl-drawer-btn" aria-expanded="false" aria-controls="gl-drawer">👥 الطلاب والنتائج <span id="gl-count"></span></button><a class="quiet gl-mini" href="/guide" target="_blank" rel="noopener">الدليل</a><button type="button" class="quiet gl-mini" id="gl-live">إنهاء العرض</button></div>
  </header>
  <nav class="gl-bar gl-bar-steps" aria-label="تسلسل الدرس">
   <button type="button" id="gl-prev" class="gl-mini" title="السابق (PageUp)">→</button>
   <ol id="gl-steps" class="gl-steps-strip"></ol>
   <button type="button" id="gl-next" class="btn gl-mini" title="التالي (PageDown)">←</button>
   <span class="gl-sep"></span>
   <button type="button" id="gl-show" class="gl-mini" aria-pressed="true">إخفاء عن الطلاب</button><span class="gl-vis" id="gl-vis"></span>
   <div class="gl-quick" id="gl-quick" role="group" aria-label="أزرار الخطوة الحالية"></div>
  </nav>
  ${boardShell('<div class="gl-textbox" id="gl-textbox" hidden><input id="gl-textinput" maxlength="200" aria-label="اكتب على السبورة" placeholder="اكتب ثم Enter" dir="auto"><button type="button" id="gl-textok" class="btn">ضع</button><button type="button" id="gl-textcancel" class="quiet">إلغاء</button></div>')}
  <footer class="gl-bar gl-bar-bottom">${tools}<div class="gl-snippets" id="gl-snippets" hidden></div></footer>
  <aside class="gl-drawer" id="gl-drawer" aria-label="الخطوة والطلاب والنتائج" hidden>
   <div class="gl-drawer-head"><h2>الخطوة والطلاب</h2><button type="button" class="quiet" id="gl-drawer-close" aria-label="إغلاق">✕</button></div>
   <section class="gl-panel" id="gl-panel" aria-label="أدوات الخطوة الحالية"></section>
   <div class="gl-narration" id="gl-narration" hidden></div>
   <section><h2>الطلاب</h2><ul id="gl-students" class="gl-students"></ul></section>
   <section><h2>الواجب</h2><div id="gl-homework"></div></section>
   <section><h2>التقييم</h2><div id="gl-evaluation"></div></section>
   <details class="gl-keys"><summary>اختصارات لوحة المفاتيح</summary><p>V تحريك · H يد · P قلم · B فرشاة · M تظليل · T كتابة · E ممحاة · + و − تكبير وتصغير · 0 ملاءمة · Ctrl+Z تراجع · PageDown أو ← للخطوة التالية، و PageUp أو → للسابقة (تناسب أجهزة التحكم بالعرض) · Esc إلغاء.</p></details>
   <p class="gl-note">في الفصل الحضوري يُسمع صوت المعلم مباشرة. البث الصوتي المباشر عن بُعد لعدة طلاب غير متوفر بعد.</p>
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
  ${boardShell('', true)}<p id="gl-wait" class="gl-wait" hidden></p>
  <nav class="gl-sbar" aria-label="أدوات الطالب">
   <button type="button" class="gl-sbtn" id="gl-mic" aria-pressed="false">🎤 <span>المايك</span></button>
   <button type="button" class="gl-sbtn" id="gl-write" aria-expanded="false" aria-controls="gl-sheet">✏️ <span>كتابة</span><b class="gl-dot" id="gl-write-dot" hidden></b></button>
   <span id="gl-status" class="gl-status-dot" role="status" aria-live="polite">جارٍ الاتصال…</span>
   <button type="button" class="gl-sbtn" id="gl-audio" hidden>🔈 <span>استمع</span></button>
   <button type="button" class="gl-sbtn gl-leave" id="gl-leave" aria-label="مغادرة الحصة">✕</button>
  </nav>
  <section class="gl-sheet" id="gl-sheet" hidden aria-label="الكتابة والإجابات"><div class="gl-sheet-head"><b>✏️ كتابة</b><button type="button" class="outline gl-mini" id="gl-sheet-close">↓ العودة إلى السبورة</button></div>
   <p class="gl-hint" id="gl-sheet-empty">لا توجد أسئلة الآن. سيفتحها المعلم.</p>
   <section class="gl-answer" id="gl-answer" hidden aria-label="أجب عن الأسئلة"></section>
   <section class="gl-homework" id="gl-hw" hidden aria-label="الواجب"></section>
   <section class="gl-myeval" id="gl-eval" hidden aria-label="تقييمي"></section></section>
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
