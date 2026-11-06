// HTML scaffolds for the group lesson. Dynamic parts are filled by same-origin modules.
import {e} from './views.mjs';
import {STEP_TYPES, STEP_ORDER, LESSON_TEMPLATES} from './public/group-plan.js';
import {COLORS, SIZE_NAMES} from './public/group-ink.js';

const TOOL_BUTTONS = [['select', '➤', 'تحريك', 'V'], ['hand', '✋', 'يد', 'H'], ['pen', '✎', 'قلم', 'P'], ['brush', '🖌', 'فرشاة', 'B'], ['marker', '▮', 'تظليل', 'M'], ['text', 'ت', 'كتابة', 'T'], ['eraser', '⌫', 'ممحاة', 'E']];

const css = '<link rel="stylesheet" href="/group-lesson.css?v=2">';
const dateText = t => new Intl.DateTimeFormat('ar-SA', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh'}).format(t);

export function plansPage(plans, sessions) {
  const list = plans.length ? plans.map(p => `<li class="gl-row"><div><b>${e(p.title)}</b><small>آخر تعديل ${dateText(p.updated)}</small></div>
   <div class="gl-actions"><a class="outline" href="/teach/plans/${p.id}">ترتيب الدرس</a>
   <a class="outline" href="/teach/plans/${p.id}.json" download="${e(p.title)}.json">تنزيل كملف</a>
   <form method="post" action="/teach/plans/${p.id}/start"><button class="btn">بدء الحصة</button></form></div></li>`).join('') : '<li class="gl-empty">لا توجد دروس بعد. ابدأ بالنموذج الجاهز ثم عدّله.</li>';
  const live = sessions.length ? `<h2>حصص سابقة وجارية</h2><ul class="gl-list">${sessions.map(s => `<li class="gl-row"><div><b>${e(s.title)}</b><small>الرمز ${e(s.code)} · ${dateText(s.created)} · ${s.live ? 'جارية' : 'انتهى العرض'}</small></div><a class="outline" href="/teach/live/${e(s.code)}">فتح إدارة الحصة</a></li>`).join('')}</ul>` : '';
  return `${css}<section class="gl-wrap" dir="rtl"><div class="section-head welcome-panel"><div class="eyebrow">الحصة الجماعية</div><h1>دروسي</h1>
  <p>رتّب درسك قبل الحصة بالتسلسل: ${STEP_ORDER.map(t => STEP_TYPES[t].short).join(' ← ')}. أثناء الحصة تتحكم بما يظهر للطلاب وما يختفي. <a class="textlink" href="/guide">دليل الاستخدام</a></p></div>
  <div class="gl-actions gl-templates"><span class="gl-tpl-label">درس جديد من نموذج جاهز (علوم الصف الرابع):</span>${Object.entries(LESSON_TEMPLATES).map(([id, t]) => `<form method="post" action="/teach/plans/new"><input type="hidden" name="template" value="${id}"><button class="btn">${e(t.title)}</button></form>`).join('')}
  <button type="button" class="outline" id="plans-import-btn">استيراد درس من ملف</button><input type="file" id="plans-import" accept=".json,application/json" hidden></div>
  <p id="plans-status" class="gl-status" role="status" aria-live="polite" hidden></p>
  <ul class="gl-list">${list}</ul>${live}
  <p class="gl-note">خادم التجربة مؤقت وقد يتوقف في أي وقت: نزّل دروسك كملفات واحتفظ بها، ويمكنك استيرادها لاحقًا. استخدم أسماء أولى فقط وبيانات وهمية.</p></section><script type="module" src="/group-plans.js?v=1"></script>`;
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
  const join = `${base}/join?code=${code}`;
  return `${css}<section class="gl-wrap gl-teacher" dir="rtl" id="gl-app" data-code="${e(code)}" data-role="teacher">
  <div class="gl-top gl-top-compact"><div><div class="eyebrow">إدارة الحصة الجماعية</div><h1>${e(title)}</h1>
   <p class="gl-join">رمز الحصة: <b class="gl-code">${e(code)}</b> · يدخل الطلاب من <a class="textlink" href="/join?code=${e(code)}" target="_blank" rel="noopener">${e(join)}</a></p></div>
   <div class="gl-actions"><a class="textlink" href="/guide" target="_blank" rel="noopener">دليل الاستخدام</a><a class="outline" href="/teach/live/${e(code)}/display" target="_blank" rel="noopener">فتح شاشة العرض للسبورة الذكية ↗</a><button type="button" class="outline" id="gl-live">إنهاء العرض</button></div></div>
  <p id="gl-status" class="gl-status" role="status" aria-live="polite">جارٍ الاتصال…</p>
  <div class="gl-layout">
   <nav class="gl-seq" aria-label="تسلسل الدرس"><h2>تسلسل الدرس</h2><ol id="gl-steps"></ol>
    <div class="gl-nav"><button type="button" id="gl-prev">السابق</button><button type="button" id="gl-next" class="btn">التالي</button></div></nav>
   <div class="gl-main">
    <div class="gl-tools" role="toolbar" aria-label="أدوات السبورة">
     <div class="gl-toolgroup gl-showgroup" role="group" aria-label="العرض للطلاب"><button type="button" id="gl-show" aria-pressed="true">إخفاء عن الطلاب</button><span class="gl-vis" id="gl-vis"></span></div>
     <div class="gl-toolgroup" role="group" aria-label="الأداة">${TOOL_BUTTONS.map(([tool, icon, label, key]) => `<button type="button" class="gl-tool" data-tool="${tool}" aria-pressed="${tool === 'select' ? 'true' : 'false'}" title="${label} (${key})"><span aria-hidden="true">${icon}</span><span>${label}</span></button>`).join('')}</div>
     <div class="gl-toolgroup gl-colors" role="group" aria-label="اللون">${COLORS.map((c, i) => `<button type="button" class="gl-color" data-color="${c.value}" aria-label="${c.name}" title="${c.name}" aria-pressed="${i ? 'false' : 'true'}"><i data-swatch="${i}"></i></button>`).join('')}</div>
     <div class="gl-toolgroup" role="group" aria-label="الحجم">${Object.entries(SIZE_NAMES).map(([k, n]) => `<button type="button" class="gl-size" data-size="${k}" aria-pressed="${k === 'm' ? 'true' : 'false'}" title="حجم ${n}"><i data-dot="${k}"></i><span>${n}</span></button>`).join('')}</div>
     <div class="gl-toolgroup" role="group" aria-label="إجراءات"><button type="button" id="gl-library" title="اختر نصًا توضيحيًا وعدّله ثم ضعه على السبورة">📚 نصوص توضيحية</button><button type="button" id="gl-undo" title="تراجع (Ctrl+Z)">↶ تراجع</button><button type="button" id="gl-clear">مسح كتابة الخطوة</button></div>
    </div>
    <div class="gl-snippets" id="gl-snippets" hidden></div>
    ${boardShell('<div class="gl-textbox" id="gl-textbox" hidden><input id="gl-textinput" maxlength="200" aria-label="اكتب على السبورة" placeholder="اكتب ثم Enter" dir="auto"><button type="button" id="gl-textok" class="btn">ضع</button><button type="button" id="gl-textcancel" class="quiet">إلغاء</button></div>')}
    <div class="gl-narration" id="gl-narration" hidden></div>
    <details class="gl-keys"><summary>اختصارات لوحة المفاتيح</summary><p>V تحريك · H يد · P قلم · B فرشاة · M تظليل · T كتابة · E ممحاة · + و − تكبير وتصغير · 0 ملاءمة · Ctrl+Z تراجع · PageDown أو ← للخطوة التالية، و PageUp أو → للسابقة (تناسب أجهزة التحكم بالعرض) · Esc إلغاء.</p></details>
    <section class="gl-panel" id="gl-panel" aria-label="أدوات الخطوة الحالية"></section>
   </div>
   <aside class="gl-side"><section><h2>الطلاب <small id="gl-count"></small></h2><ul id="gl-students" class="gl-students"></ul></section>
    <section><h2>الواجب</h2><div id="gl-homework"></div></section>
    <section><h2>التقييم</h2><div id="gl-evaluation"></div></section></aside>
  </div>
  <p class="gl-note">الصوت المباشر: في الفصل الحضوري يُسمع صوت المعلم مباشرة. البث الصوتي المباشر عن بُعد لعدة طلاب غير متوفر في هذه المرحلة.</p>
 </section><script type="module" src="/group-teacher.js?v=2"></script>`;
}

export function displayPage(code, title) {
  return `${css}<section class="gl-wrap gl-display" dir="rtl" id="gl-app" data-code="${e(code)}" data-role="display">
  <div class="gl-top"><h1>${e(title)}</h1><p class="gl-join">للانضمام: <b class="gl-code">${e(code)}</b></p><button type="button" id="gl-full" class="outline">ملء الشاشة</button></div>
  <p id="gl-status" class="gl-status" role="status" aria-live="polite">جارٍ الاتصال…</p>
  ${boardShell()}<p id="gl-wait" class="gl-wait" hidden></p>
  <button type="button" id="gl-audio" class="outline" hidden>تفعيل صوت الشرح على هذه الشاشة</button>
 </section><script type="module" src="/group-student.js?v=2"></script>`;
}

export function studentPage(code, name, title) {
  // The board floats on top: it stays in view while the student scrolls to answer, and can fill the screen.
  return `${css}<section class="gl-wrap gl-student" dir="rtl" id="gl-app" data-code="${e(code)}" data-role="student">
  <div class="gl-top gl-top-student"><div><span class="gl-hello">مرحبًا ${e(name)}</span><h1>${e(title)}</h1></div><div class="gl-actions"><span class="gl-progress" id="gl-progress"></span><button type="button" id="gl-audio" class="outline" hidden>تفعيل صوت الشرح</button></div></div>
  ${boardShell('', true)}<p id="gl-wait" class="gl-wait" hidden></p>
  <p id="gl-status" class="gl-status gl-status-small" role="status" aria-live="polite">جارٍ الاتصال…</p>
  <section class="gl-answer" id="gl-answer" hidden aria-label="أجب عن الأسئلة"></section>
  <section class="gl-homework" id="gl-hw" hidden aria-label="الواجب"></section>
  <section class="gl-myeval" id="gl-eval" hidden aria-label="تقييمي"></section>
 </section><script type="module" src="/group-student.js?v=2"></script>`;
}

export function joinPage(code) {
  return `${css}<section class="gl-wrap gl-joinpage narrow panel" dir="rtl"><div class="eyebrow">الحصة الجماعية</div><h1>الانضمام إلى الحصة</h1>
  <form method="post" action="/join" class="gl-form"><label>رمز الحصة<input name="code" required minlength="6" maxlength="6" autocomplete="off" autocapitalize="characters" inputmode="text" value="${e(code)}" dir="ltr"></label>
  <label>اسمك الأول<input name="name" required minlength="2" maxlength="30" autocomplete="given-name"></label>
  <button class="btn">دخول الحصة</button></form>
  <p class="gl-note">اكتب اسمك الأول فقط. يرى المعلم إجاباتك، ولا يظهر اسمك للآخرين إلا إذا اختار المعلم عرضه.</p></section>`;
}
