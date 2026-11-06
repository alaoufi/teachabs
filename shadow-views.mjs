// Classroom panel for the teacher-led light-and-shadow activity (original content).
import {CHALLENGES, MATERIALS, HOUR_MIN, HOUR_MAX, HOUR_STEP, HEIGHT_MIN, HEIGHT_MAX, HEIGHT_STEP, renderScene, formatHour, formatNumber} from './public/science-shadow-model.js';
import {initialShadow} from './shadow-activity.mjs';
import {SCIENCE_SHADOW_ROUTE} from './science-lesson.mjs';

const TALKING_POINTS = [
  'شغّل الميكروفون، وابدأ والشمس منخفضة صباحًا. اسأل: أين ترى الظل؟ ولماذا هناك؟',
  'اضغط «إخفاء الظل للتوقع»، ثم اسأل: ماذا سيحدث للظل إذا ارتفعت الشمس؟ اطلب من الطالب أن يرسم توقعه على السبورة.',
  'حرّك الشمس ساعة بساعة وأنت تشرح، ثم اكشف الظل وقارن بالتوقع.',
  'سلّم التحكم للطالب واختر تحدي «ظل يساوي الطول». اطلب منه أن يشرح بصوته ما يفعله.',
  'غيّر المادة إلى الورق ثم الزجاج: ماذا يحدث للضوء؟ اربطها بالمعتم وشبه الشفاف والشفاف.',
  'اختم: اطلب من الطالب أن يفسر بكلماته لماذا يقصر الظل قرب الظهر.'
];

export function shadowPanel(seat) {
  const s = initialShadow(), teacher = seat === 'teacher';
  const materials = Object.entries(MATERIALS).map(([id, m]) => `<label class="sa-choice"><input type="radio" name="sa-material" value="${id}"${id === s.material ? ' checked' : ''} disabled><span><b>${m.name}</b><small>${m.kind}</small></span></label>`).join('');
  const lead = teacher ? `<div class="sa-teacher" role="group" aria-label="قيادة النشاط">
   <button type="button" id="sa-handover" disabled>سلّم التحكم للطالب</button>
   <button type="button" id="sa-reveal" disabled aria-pressed="false">إخفاء الظل للتوقع</button>
   <label>تحدٍّ للطالب <select id="sa-challenge" disabled><option value="">بدون تحدٍّ</option>${CHALLENGES.map(c => `<option value="${c.id}">${c.title}</option>`).join('')}</select></label>
   <button type="button" id="sa-reset" class="quiet" disabled>إعادة النشاط</button>
  </div>` : '';
  const notes = teacher ? `<details class="sa-notes"><summary>نقاط تشرحها بصوتك</summary><ol>${TALKING_POINTS.map(t => `<li>${t}</li>`).join('')}</ol><p>هذه النقاط تظهر لك وحدك. أنت تقود الشرح؛ النشاط لا يتقدم تلقائيًا.</p></details>` : '';
  return `<div id="shadow-activity" class="sa" data-seat="${seat}">
  <div class="sa-head"><p id="sa-role" class="sa-role" role="status">${teacher ? 'أنت تقود النشاط' : 'المعلم يقود النشاط'}</p><p id="sa-error" class="error" role="alert" hidden></p></div>
  ${lead}
  <div class="sa-body">
   <figure class="sa-figure"><div id="sa-scene" class="sa-scene">${renderScene(s)}</div><figcaption id="sa-scene-note">${teacher ? 'يرى الطالب ما تراه هنا مباشرة.' : 'يتحرك المشهد مع شرح المعلم.'}</figcaption></figure>
   <div class="sa-controls">
    <div class="sa-control"><label for="sa-hour">الوقت: <output id="sa-hour-out">${formatHour(s.hour)}</output></label>
     <input id="sa-hour" type="range" min="${HOUR_MIN}" max="${HOUR_MAX}" step="${HOUR_STEP}" value="${s.hour}" disabled aria-valuetext="${formatHour(s.hour)}">
     <div class="sa-steps"><button type="button" id="sa-earlier" disabled>ساعة أبكر</button><button type="button" id="sa-later" disabled>ساعة لاحقة</button></div></div>
    <div class="sa-control"><label for="sa-height">طول اللوح: <output id="sa-height-out">${formatNumber(s.height)} م</output></label>
     <input id="sa-height" type="range" min="${HEIGHT_MIN}" max="${HEIGHT_MAX}" step="${HEIGHT_STEP}" value="${s.height}" disabled aria-valuetext="${formatNumber(s.height)} متر"></div>
    <fieldset class="sa-control sa-materials"><legend>مادة اللوح</legend>${materials}</fieldset>
   </div>
  </div>
  <dl class="sa-readouts" id="sa-readouts" aria-live="polite">
   <div><dt>ارتفاع الشمس</dt><dd id="sa-elevation">—</dd></div><div><dt>طول الظل</dt><dd id="sa-length">—</dd></div><div><dt>اتجاه الظل</dt><dd id="sa-direction">—</dd></div>
  </dl>
  <p id="sa-challenge-box" class="sa-challenge" role="status" aria-live="polite" hidden></p>
  ${notes}
  <p class="sa-more"><a class="textlink" href="${SCIENCE_SHADOW_ROUTE}" target="_blank" rel="noopener noreferrer">الدرس الكامل للمراجعة الذاتية ↗</a></p>
 </div>`;
}
