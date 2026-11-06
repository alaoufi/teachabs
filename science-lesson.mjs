// Independent interactive science lesson prototype: no session, database, or external resources.
// All lesson text and drawings are original; no textbook text or images are reproduced.
import {CHALLENGES, QUIZ, MATERIALS, HOUR_MIN, HOUR_MAX, HOUR_STEP, HEIGHT_MIN, HEIGHT_MAX, HEIGHT_STEP, lessonState, renderScene, formatHour, formatNumber, compareText, DIRECTION_TEXT} from './public/science-shadow-model.js';

export const SCIENCE_SHADOW_ROUTE = '/interactive-lessons/science-4-shadows';

export function scienceShadowLesson() {
  const s = lessonState({hour: 8, height: 1.5, material: 'wood'});
  const materials = Object.entries(MATERIALS).map(([id, m]) => `<label class="sl-choice"><input type="radio" name="sl-material" value="${id}"${id === s.material ? ' checked' : ''}><span><b>${m.name}</b><small>${m.kind}</small></span></label>`).join('');
  const challenges = CHALLENGES.map((c, i) => `<li><label class="sl-challenge"><input type="radio" name="sl-challenge" value="${c.id}"${i === 0 ? ' checked' : ''}><span class="sl-mark" aria-hidden="true"></span><span>${c.title}<small>تلميح: ${c.hint}</small></span></label></li>`).join('');
  const quiz = QUIZ.map((q, i) => `<fieldset class="sl-question" data-question="${q.id}"><legend>${formatNumber(i + 1)}. ${q.question}</legend>${Object.entries(q.options).map(([key, text]) => `<label class="sl-option"><input type="radio" name="sl-${q.id}" value="${key}"><span>${text}</span></label>`).join('')}<p class="sl-feedback" role="status" aria-live="polite"></p></fieldset>`).join('');
  return `<link rel="stylesheet" href="/science-shadow.css">
<article class="science-lesson" dir="rtl" lang="ar">
 <header class="sl-hero">
  <span class="sl-badge">علوم · الصف الرابع الابتدائي · نموذج درس تفاعلي</span>
  <h1>الضوء والظل: لماذا يتغير ظلّي خلال اليوم؟</h1>
  <p>حرّك الشمس، وغيّر طول اللوح ومادته، وشاهد الظل يتغير أمامك مباشرة.</p>
  <nav class="sl-nav" aria-label="أقسام الدرس"><a href="#sl-explain">الفكرة</a><a href="#sl-lab">المختبر</a><a href="#sl-challenges">التحديات</a><a href="#sl-quiz">تحقّق من فهمك</a><a href="#sl-teacher">للمعلم</a></nav>
 </header>
 <p class="sl-notice"><strong>محتوى أصلي للتجربة.</strong> الشرح والرسوم من إعداد المشروع، وليست منقولة من كتاب مدرسي. النموذج مبسّط لتوضيح الفكرة، ولا يحفظ أي بيانات.</p>

 <section class="sl-panel" id="sl-explain"><h2>الفكرة في ثلاث خطوات</h2>
  <div class="sl-cards">
   <div class="sl-card"><span class="sl-step">١</span><h3>الضوء يسير في خطوط مستقيمة</h3><p>ينطلق ضوء الشمس في خطوط مستقيمة، ولا ينعطف من تلقاء نفسه حول الأجسام.</p></div>
   <div class="sl-card"><span class="sl-step">٢</span><h3>الظل منطقة لا يصلها الضوء</h3><p>عندما يحجب جسمٌ الضوءَ، تتكوّن خلفه منطقة مظلمة نسميها الظل، في الجهة المقابلة لمصدر الضوء.</p></div>
   <div class="sl-card"><span class="sl-step">٣</span><h3>موقع الشمس يغيّر الظل</h3><p>الشمس المنخفضة صباحًا ومساءً تصنع ظلًا طويلًا، والشمس المرتفعة قرب الظهر تصنع ظلًا قصيرًا.</p></div>
  </div>
 </section>

 <section class="sl-panel" id="sl-lab"><h2>مختبر الظل</h2>
  <p class="sl-lead">اسحب الشمس في الصورة أو استخدم شريط الوقت. راقب الخط المتقطع: إنه شعاع الضوء المار بأعلى اللوح، وعنده ينتهي الظل.</p>
  <div class="sl-lab">
   <figure class="sl-figure"><div id="sl-scene" class="sl-scene">${renderScene(s)}</div><figcaption>الخط المتقطع يمثل شعاع ضوء يمر بأعلى اللوح.</figcaption></figure>
   <div class="sl-controls">
    <div class="sl-control"><label for="sl-hour">الوقت: <output id="sl-hour-out" for="sl-hour">${formatHour(s.hour)}</output></label>
     <input id="sl-hour" type="range" min="${HOUR_MIN}" max="${HOUR_MAX}" step="${HOUR_STEP}" value="${s.hour}" aria-valuetext="${formatHour(s.hour)}">
     <div class="sl-range-ends" aria-hidden="true"><span>الصباح</span><span>الظهر</span><span>المساء</span></div>
     <div class="sl-buttons"><button type="button" id="sl-play" aria-pressed="false">▶ شغّل يومًا كاملًا</button><button type="button" id="sl-reset">إعادة البداية</button></div>
    </div>
    <div class="sl-control"><label for="sl-height">طول اللوح: <output id="sl-height-out" for="sl-height">${formatNumber(s.height)} م</output></label>
     <input id="sl-height" type="range" min="${HEIGHT_MIN}" max="${HEIGHT_MAX}" step="${HEIGHT_STEP}" value="${s.height}" aria-valuetext="${formatNumber(s.height)} متر"></div>
    <fieldset class="sl-control sl-materials"><legend>مادة اللوح</legend>${materials}</fieldset>
   </div>
  </div>
  <dl class="sl-readouts" id="sl-readouts" aria-live="polite">
   <div><dt>ارتفاع الشمس</dt><dd id="sl-elevation">${formatNumber(s.elevation)}°</dd></div>
   <div><dt>طول الظل</dt><dd id="sl-length">${formatNumber(s.length)} م</dd></div>
   <div><dt>اتجاه الظل</dt><dd id="sl-direction">${DIRECTION_TEXT[s.shadow]}</dd></div>
   <div class="sl-wide"><dt>المقارنة</dt><dd id="sl-compare">${compareText(s)}</dd></div>
   <div class="sl-wide"><dt>المادة</dt><dd id="sl-material-text">${MATERIALS[s.material].explain}</dd></div>
  </dl>
 </section>

 <section class="sl-panel" id="sl-challenges"><h2>تحديات المختبر <small id="sl-progress">٠ من ${formatNumber(CHALLENGES.length)}</small></h2>
  <p class="sl-lead">اختر تحديًا، ثم غيّر القيم في المختبر. ستظهر النتيجة فورًا.</p>
  <ol class="sl-challenge-list">${challenges}</ol>
  <p id="sl-challenge-feedback" class="sl-live" role="status" aria-live="polite"></p>
 </section>

 <section class="sl-panel" id="sl-quiz"><h2>تحقّق من فهمك</h2><p class="sl-lead">اختر إجابة لترى التصحيح والسبب مباشرة. يمكنك تغيير إجابتك.</p>${quiz}</section>

 <section class="sl-panel sl-teacher" id="sl-teacher"><h2>ملاحظات للمعلم</h2>
  <ul>
   <li><b>الهدف:</b> أن يفسّر الطالب تكوّن الظل بحجب الضوء، ويربط طول الظل واتجاهه بموقع الشمس، ويميّز بين المواد المعتمة وشبه الشفافة والشفافة.</li>
   <li><b>النموذج مبسّط:</b> ترتفع الشمس ١٥ درجة كل ساعة وتكون فوق الرأس ظهرًا، كما يقترب الحال في يوم صيفي قرب مدار السرطان. في أيام أخرى لا تصل الشمس إلى فوق الرأس، ويتجه ظل الظهر نحو الشمال في المملكة.</li>
   <li><b>مطابقة المنهج:</b> الموضوع مفهوم علمي عام مناسب للمرحلة. لم تُطابَق الصياغة مع وحدات كتاب العلوم المعتمد أو أرقام صفحاته، ويلزم التحقق قبل ربطه بدرس رسمي.</li>
   <li><b>الخصوصية:</b> الصفحة تعمل في المتصفح فقط، ولا ترسل الإجابات أو تحفظها.</li>
  </ul>
  <p><a href="/demo">العودة إلى أقسام التجربة</a></p>
 </section>
 <noscript><p class="sl-notice">فعّل JavaScript لتحريك الشمس والتحديات. الشرح وصورة البداية متاحان للقراءة.</p></noscript>
</article><script type="module" src="/science-shadow.js"></script>`;
}
