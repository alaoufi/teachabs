// HTML scaffolds for the group lesson. Dynamic parts are filled by same-origin modules.
import {e} from './views.mjs';
import {STEP_TYPES, STEP_ORDER} from './public/group-plan.js';

const css = '<link rel="stylesheet" href="/group-lesson.css?v=1">';
const dateText = t => new Intl.DateTimeFormat('ar-SA', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh'}).format(t);

export function plansPage(plans, sessions) {
  const list = plans.length ? plans.map(p => `<li class="gl-row"><div><b>${e(p.title)}</b><small>آخر تعديل ${dateText(p.updated)}</small></div>
   <div class="gl-actions"><a class="outline" href="/teach/plans/${p.id}">ترتيب الدرس</a>
   <form method="post" action="/teach/plans/${p.id}/start"><button class="btn">بدء الحصة</button></form></div></li>`).join('') : '<li class="gl-empty">لا توجد دروس بعد. ابدأ بالنموذج الجاهز ثم عدّله.</li>';
  const live = sessions.length ? `<h2>حصص سابقة وجارية</h2><ul class="gl-list">${sessions.map(s => `<li class="gl-row"><div><b>${e(s.title)}</b><small>الرمز ${e(s.code)} · ${dateText(s.created)} · ${s.live ? 'جارية' : 'انتهى العرض'}</small></div><a class="outline" href="/teach/live/${e(s.code)}">فتح إدارة الحصة</a></li>`).join('')}</ul>` : '';
  return `${css}<section class="gl-wrap" dir="rtl"><div class="section-head welcome-panel"><div class="eyebrow">الحصة الجماعية</div><h1>دروسي</h1>
  <p>رتّب درسك قبل الحصة بالتسلسل: ${STEP_ORDER.map(t => STEP_TYPES[t].short).join(' ← ')}. أثناء الحصة تتحكم بما يظهر للطلاب وما يختفي.</p></div>
  <form method="post" action="/teach/plans/new"><button class="btn">درس جديد من النموذج الجاهز (الضوء والظل)</button></form>
  <ul class="gl-list">${list}</ul>${live}
  <p class="gl-note">الحفظ في خدمة التجربة مؤقت. استخدم أسماء أولى فقط وبيانات وهمية.</p></section>`;
}

export function plannerPage(id, title) {
  return `${css}<section class="gl-wrap" dir="rtl" id="planner" data-id="${e(id)}">
  <div class="gl-top"><div><div class="eyebrow">ترتيب الدرس قبل الحصة</div><h1 id="pl-heading">${e(title)}</h1></div>
  <div class="gl-actions"><a class="outline" href="/teach/plans">دروسي</a><button type="button" class="btn" id="pl-save">حفظ الدرس</button></div></div>
  <p id="pl-status" class="gl-status" role="status" aria-live="polite">جارٍ تحميل الدرس…</p>
  <div class="gl-meta" id="pl-meta"></div>
  <ol class="gl-plan" id="pl-steps"></ol>
  <div class="gl-add" role="group" aria-label="إضافة خطوة">${STEP_ORDER.map(t => `<button type="button" class="outline" data-add="${t}">+ ${STEP_TYPES[t].short}</button>`).join('')}</div>
  <form method="post" action="/teach/plans/${e(id)}/start" class="gl-start"><button class="btn">بدء الحصة بهذا الترتيب</button><small>احفظ قبل البدء؛ تبدأ الحصة بآخر نسخة محفوظة.</small></form>
  <form method="post" action="/teach/plans/${e(id)}/delete" class="gl-delete"><button class="quiet">حذف الدرس</button></form>
  <noscript><p class="error">ترتيب الدرس يحتاج JavaScript.</p></noscript>
 </section><script type="module" src="/group-planner.js?v=1"></script>`;
}

const boardShell = (extra = '') => `<div class="gl-stage"><div class="gl-board" id="gl-board" aria-live="polite"><div class="gl-content" id="gl-content"></div><svg class="gl-ink" id="gl-ink" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true"></svg></div>${extra}</div>`;

export function teacherPage(code, title, base) {
  const join = `${base}/join?code=${code}`;
  return `${css}<section class="gl-wrap gl-teacher" dir="rtl" id="gl-app" data-code="${e(code)}" data-role="teacher">
  <div class="gl-top"><div><div class="eyebrow">إدارة الحصة الجماعية</div><h1>${e(title)}</h1>
   <p class="gl-join">رمز الحصة: <b class="gl-code">${e(code)}</b> · يدخل الطلاب من <a class="textlink" href="/join?code=${e(code)}" target="_blank" rel="noopener">${e(join)}</a></p></div>
   <div class="gl-actions"><a class="outline" href="/teach/live/${e(code)}/display" target="_blank" rel="noopener">فتح شاشة العرض للسبورة الذكية ↗</a><button type="button" class="outline" id="gl-live">إنهاء العرض</button></div></div>
  <p id="gl-status" class="gl-status" role="status" aria-live="polite">جارٍ الاتصال…</p>
  <div class="gl-layout">
   <nav class="gl-seq" aria-label="تسلسل الدرس"><h2>تسلسل الدرس</h2><ol id="gl-steps"></ol>
    <div class="gl-nav"><button type="button" id="gl-prev">السابق</button><button type="button" id="gl-next" class="btn">التالي</button></div></nav>
   <div class="gl-main">
    <div class="gl-toolbar" role="toolbar" aria-label="التحكم بالعرض">
     <button type="button" id="gl-show" aria-pressed="true">إخفاء عن الطلاب</button>
     <span class="gl-vis" id="gl-vis"></span>
     <span class="gl-pens" role="group" aria-label="قلم الكتابة"><button type="button" id="gl-pen" aria-pressed="false">✎ قلم</button>${['#173e34', '#c0392b', '#1f5fa8', '#e8890c'].map((c, i) => `<button type="button" class="gl-color" data-color="${c}" aria-label="لون ${i + 1}" aria-pressed="${i ? 'false' : 'true'}"><i data-swatch="${i}"></i></button>`).join('')}<button type="button" id="gl-undo">تراجع</button><button type="button" id="gl-clear">مسح الكتابة</button></span>
    </div>
    ${boardShell()}
    <div class="gl-narration" id="gl-narration" hidden></div>
    <section class="gl-panel" id="gl-panel" aria-label="أدوات الخطوة الحالية"></section>
   </div>
   <aside class="gl-side"><section><h2>الطلاب <small id="gl-count"></small></h2><ul id="gl-students" class="gl-students"></ul></section>
    <section><h2>الواجب</h2><div id="gl-homework"></div></section>
    <section><h2>التقييم</h2><div id="gl-evaluation"></div></section></aside>
  </div>
  <p class="gl-note">الصوت المباشر: في الفصل الحضوري يُسمع صوت المعلم مباشرة. البث الصوتي المباشر عن بُعد لعدة طلاب غير متوفر في هذه المرحلة.</p>
 </section><script type="module" src="/group-teacher.js?v=1"></script>`;
}

export function displayPage(code, title) {
  return `${css}<section class="gl-wrap gl-display" dir="rtl" id="gl-app" data-code="${e(code)}" data-role="display">
  <div class="gl-top"><h1>${e(title)}</h1><p class="gl-join">للانضمام: <b class="gl-code">${e(code)}</b></p><button type="button" id="gl-full" class="outline">ملء الشاشة</button></div>
  <p id="gl-status" class="gl-status" role="status" aria-live="polite">جارٍ الاتصال…</p>
  ${boardShell()}<p id="gl-wait" class="gl-wait" hidden></p>
  <button type="button" id="gl-audio" class="outline" hidden>تفعيل صوت الشرح على هذه الشاشة</button>
 </section><script type="module" src="/group-student.js?v=1"></script>`;
}

export function studentPage(code, name, title) {
  return `${css}<section class="gl-wrap gl-student" dir="rtl" id="gl-app" data-code="${e(code)}" data-role="student">
  <div class="gl-top"><div><div class="eyebrow">مرحبًا ${e(name)}</div><h1>${e(title)}</h1></div><span class="gl-progress" id="gl-progress"></span></div>
  <p id="gl-status" class="gl-status" role="status" aria-live="polite">جارٍ الاتصال…</p>
  <button type="button" id="gl-audio" class="outline" hidden>تفعيل صوت الشرح</button>
  ${boardShell()}<p id="gl-wait" class="gl-wait" hidden></p>
  <section class="gl-answer" id="gl-answer" hidden aria-label="أجب عن الأسئلة"></section>
  <section class="gl-homework" id="gl-hw" hidden aria-label="الواجب"></section>
  <section class="gl-myeval" id="gl-eval" hidden aria-label="تقييمي"></section>
 </section><script type="module" src="/group-student.js?v=1"></script>`;
}

export function joinPage(code) {
  return `${css}<section class="gl-wrap gl-joinpage narrow panel" dir="rtl"><div class="eyebrow">الحصة الجماعية</div><h1>الانضمام إلى الحصة</h1>
  <form method="post" action="/join" class="gl-form"><label>رمز الحصة<input name="code" required minlength="6" maxlength="6" autocomplete="off" autocapitalize="characters" inputmode="text" value="${e(code)}" dir="ltr"></label>
  <label>اسمك الأول<input name="name" required minlength="2" maxlength="30" autocomplete="given-name"></label>
  <button class="btn">دخول الحصة</button></form>
  <p class="gl-note">اكتب اسمك الأول فقط. يرى المعلم إجاباتك، ولا يظهر اسمك للآخرين إلا إذا اختار المعلم عرضه.</p></section>`;
}
