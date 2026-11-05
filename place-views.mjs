import { e } from './views.mjs';
import { ratings } from './place-value.mjs';

const num=n=>Number(n).toLocaleString('ar-SA');
const ratingOptions=Object.entries(ratings).map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
const gradeFields=`<label>تقييم المعلم<select name="rating" required><option value="">اختر التقييم</option>${ratingOptions}</select></label>
  <label>ملاحظة لولي الأمر (اختياري)<textarea name="note" maxlength="350" rows="2"></textarea></label>`;
function tray(unit,label){
  const name=unit==='tens'?'عشرة':'واحد';
  return `<section class="pv-tray" data-tray="${unit}"><h3>${label} <span data-count="${unit}">٠</span></h3>
    <div class="pv-blocks" data-blocks="${unit}" aria-hidden="true"></div>
    <button type="button" class="quiet" data-sub="${unit}" aria-label="إزالة ${name}" disabled>إزالة ${name}</button></section>`;
}
export function placeBoard(seat,preview){
  return `<section class="panel place" id="place-activity" aria-labelledby="place-title">
    <div class="lesson-head"><div><div class="eyebrow"><i></i>رياضيات · القيمة المنزلية</div><h2 id="place-title">الآحاد والعشرات</h2></div>
    <span class="tag" id="pv-phase">شرح المعلم</span></div>
    <div class="pv-task"><span>مثّل العدد</span> <strong id="pv-target" dir="ltr">٣٤</strong></div>
    <p id="pv-prompt" role="status">جارٍ تحميل النشاط…</p>
    ${seat==='teacher'?`<form id="pv-setup" class="pv-tools"><label>العدد المطلوب <input name="target" inputmode="numeric" maxlength="2" value="٣٤" required></label>
      <button type="submit" class="outline" disabled>تعيين العدد</button><button id="pv-turn" type="button" class="btn" disabled>دور الطالب</button></form>`:''}
    <div class="pv-bank"><b>صندوق القطع</b>
      <button type="button" class="outline" data-add="tens" draggable="true" disabled><i class="sample-rod" aria-hidden="true"></i>إضافة عشرة</button>
      <button type="button" class="outline" data-add="ones" draggable="true" disabled><i class="pv-piece ones" aria-hidden="true"></i>إضافة واحد</button></div>
    <div class="pv-trays">${tray('tens','العشرات')}${tray('ones','الآحاد')}</div>
    <small>اسحب القطعة إلى خانتها أو اضغط لإضافتها. كل قضيب يساوي عشرة مكعبات.</small>
    <div class="pv-tools pv-exchange"><button type="button" class="outline" id="pv-split" disabled>فكّ عشرة إلى ١٠ آحاد</button>
      <button type="button" class="outline" id="pv-bundle" disabled>اجمع ١٠ آحاد في عشرة</button></div>
    ${seat==='teacher'?'<aside id="pv-observe" hidden><strong>ما يبنيه الطالب الآن</strong> <bdi id="pv-equation" dir="ltr"></bdi></aside>':''}
    ${seat==='student'?'<button type="button" class="btn" id="pv-submit" hidden>تسليم الحل</button>':
      `<form id="pv-grade" class="form" hidden>${gradeFields}<div class="pv-tools"><button class="btn" type="submit">اعتماد النتيجة</button>
      <button id="pv-retry" class="outline" type="button">إعادة المحاولة للطالب</button></div></form>`}
    <p id="pv-answer" aria-live="polite"></p><p role="alert" id="pv-error"></p>
    ${preview?'<a id="pv-preview-result" class="textlink" href="/lesson/preview/result" target="_blank" rel="noopener" hidden>عرض نتيجة ولي الأمر التجريبية ←</a>':''}
  </section>`;
}
export function resultCard(state){
  const answer=state.answer;
  if(!answer)return '<h3>نشاط الآحاد والعشرات</h3><p>انتهت الحصة دون تسليم حل لهذا النشاط.</p>';
  const value=answer.tens*10+answer.ones;
  return `<h3>نتيجة الآحاد والعشرات</h3><dl>
    <div><dt>العدد المطلوب</dt><dd>${num(state.target)}</dd></div>
    <div><dt>آخر حل سلّمه الطالب</dt><dd>${num(value)} (العشرات ${num(answer.tens)}، الآحاد ${num(answer.ones)})</dd></div>
    <div><dt>مطابقة العدد</dt><dd>${value===state.target?'إجابة صحيحة':'الإجابة تحتاج تصحيحًا'}</dd></div>
    <div><dt>عدد المحاولات المسلّمة</dt><dd>${num(state.attempts)}</dd></div>
    <div><dt>تقييم المعلم</dt><dd>${ratings[state.rating]||'بانتظار تقييم المعلم'}</dd></div>
    ${state.note?'<div><dt>ملاحظة المعلم</dt><dd>'+e(state.note)+'</dd></div>':''}</dl>`;
}
export function progressPage({child,results}){
  return `<section class="narrow"><div class="section-head"><div class="eyebrow"><i></i>ملف الطفل</div><h1>نتائج ${e(child.name)}</h1></div>
    ${results.map(row=>`<article class="panel"><small>${new Intl.DateTimeFormat('ar-SA-u-ca-gregory',{dateStyle:'medium',timeZone:'Asia/Riyadh'}).format(row.start)} · ${e(row.teacherName)}</small>
      ${resultCard(row.state)}<a class="textlink" href="/booking/${row.id}">تفاصيل الحصة</a></article>`).join('')||'<div class="empty">تظهر هنا نتائج أنشطة الرياضيات بعد انتهاء الحصص.</div>'}
    <a class="textlink back" href="/app">العودة إلى أبنائي</a></section>`;
}
export function bookingResult(b,state,role){
  if(!state || b.status!=='confirmed' || b.subject!=='math' || state.phase==='model')return '';
  if(Date.now()<b.start+b.minutes*60000)return role==='parent'?'<p>تظهر نتيجة النشاط هنا بعد انتهاء موعد الحصة.</p>':'';
  const form=role==='teacher'&&state.answer&&state.phase!=='graded'?
    `<form class="form" method="post" action="/booking/${b.id}/grade"><input type="hidden" name="rev" value="${state.rev}">${gradeFields}<button class="btn">اعتماد النتيجة</button></form>`:'';
  return `<section class="panel narrow">${resultCard(state)}${form}</section>`;
}
