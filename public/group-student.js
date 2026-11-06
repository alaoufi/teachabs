// Student seat and classroom display screen: shows only what the teacher has made visible.
import {publicStep} from './group-plan.js';
import {el, renderStep, renderInk, playNarration} from './group-view.js';
import {attachBoardTools} from './group-board-tools.js';
import {renderScene, lessonState, formatHour, formatNumber} from './science-shadow-model.js';

const app = document.getElementById('gl-app'), code = app.dataset.code, role = app.dataset.role, student = role === 'student';
const $ = x => document.getElementById(x);
const status = (text, bad = false) => { $('gl-status').textContent = text; $('gl-status').classList.toggle('is-error', bad); };
const classBase = '/class/' + code;
let renderKey = '', shownStep = null;
const tools = attachBoardTools({mode: 'viewer'});
let view = null, content = null, contentKey = null, homework = null, lastNarration = 0, pendingNarration = null, plan = null;
let explore = {hour: 9, height: 1.5, material: 'wood'};
const sent = {};

async function getJSON(url) { const r = await fetch(url); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'تعذّر التحميل.'); return d; }
async function stepContent(stepId, key) {
  if (student) return getJSON(`${classBase}/content?step=${encodeURIComponent(stepId)}`);
  const step = plan.steps.find(s => s.id === stepId), revealed = key.split(':')[1] ? key.split(':')[1].split(',') : [];
  return publicStep(step, revealed);
}

// ---- answers ----
async function answer(body, button) {
  if (button) button.disabled = true;
  try {
    const r = await fetch(classBase + '/answer', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)});
    const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'لم تُرسل الإجابة.');
    sent[body.step + body.question] = true; status('وصلت إجابتك إلى المعلم.');
  } catch (e) { status(e.message, true); } finally { if (button) button.disabled = false; }
}
function questionForm(q, stepId, mine, {enabled, kind}) {
  const box = el('fieldset', {class: 'gl-aq', disabled: !enabled}, el('legend', {text: q.prompt}));
  const has = mine?.[q.id];
  if (q.kind === 'choice') {
    q.options.forEach((o, i) => box.append(el('label', {class: 'gl-choice' + (has?.choice === i ? ' is-chosen' : '')},
      el('input', {type: 'radio', name: kind + stepId + q.id, value: i, checked: has?.choice === i, onchange: () => answer({kind, step: stepId, question: q.id, choice: i})}), el('span', {text: o}))));
  } else {
    const t = el('textarea', {maxlength: 300, rows: 2, 'aria-label': 'إجابتك'}); t.value = has?.text || '';
    const b = el('button', {type: 'button', class: 'btn', onclick: () => t.value.trim() ? answer({kind, step: stepId, question: q.id, text: t.value}, b) : status('اكتب إجابتك أولًا.', true)}, has ? 'تحديث الإجابة' : 'إرسال');
    box.append(t, b);
  }
  if (has) box.append(el('small', {class: 'gl-sent', text: '✓ أُرسلت إجابتك'}));
  return box;
}

function renderAnswers() {
  const box = $('gl-answer');
  if (!box) return;
  if (!student || !view.step || view.step.type !== 'questions' || !content || content.type !== 'questions') { box.hidden = true; return; }
  if (box.contains(document.activeElement) && document.activeElement.tagName === 'TEXTAREA') return;
  box.hidden = false;
  box.replaceChildren(el('h2', {text: view.open ? 'أجب عن الأسئلة' : 'الأسئلة مغلقة الآن — ينتظر المعلم'}), ...content.questions.map(q => questionForm(q, content.id, view.mine, {enabled: view.open, kind: 'answer'})));
}

async function renderHomework() {
  const box = $('gl-hw');
  if (!box) return;
  if (!student || !view.homework) { box.hidden = true; return; }
  if (box.contains(document.activeElement) && document.activeElement.tagName === 'TEXTAREA') return;
  if (!homework || homework.id !== view.homework.step) homework = await stepContent(view.homework.step).catch(() => null);
  if (!homework) return;
  const open = view.homework.status === 'open', h = view.homework;
  box.hidden = false;
  box.replaceChildren(el('h2', {text: 'الواجب: ' + homework.title}), homework.instructions ? el('p', {text: homework.instructions}) : null,
    h.total ? el('p', {class: 'gl-score', text: `نتيجتك في أسئلة الاختيار: ${formatNumber(h.correct)} من ${formatNumber(h.total)}`}) : null,
    ...homework.questions.map(q => questionForm(q, homework.id, h.mine, {enabled: open, kind: 'homework'})),
    open ? null : el('p', {class: 'gl-hint', text: 'أغلق المعلم الواجب.'}));
}

function renderEvaluation() {
  const box = $('gl-eval');
  if (!box) return;
  if (!student || !view.evaluation) { box.hidden = true; return; }
  box.hidden = false;
  const e = view.evaluation;
  box.replaceChildren(el('h2', {text: 'تقييمي من المعلم'}), e.ratings ? el('ul', {class: 'gl-myratings'}, e.criteria.map((c, i) => el('li', {}, el('span', {text: c}), el('b', {text: e.ratings[i]})))) : el('p', {text: 'لم يقيّمك المعلم بعد.'}), e.note ? el('p', {class: 'gl-note-box', text: e.note}) : null);
}

function renderExplore() {
  // Each student explores privately; nothing is sent while exploring. The slider is kept so dragging is smooth.
  let wrap = $('gl-content').querySelector('.gl-explore');
  if (!wrap) {
    const hour = el('input', {type: 'range', min: 7, max: 17, step: 0.25, value: explore.hour, 'aria-label': 'الوقت', oninput: e => { explore.hour = Number(e.target.value); renderExplore(); }});
    wrap = el('div', {class: 'gl-explore'}, el('h2', {class: 'gl-step-title', text: 'استكشف بنفسك'}), el('div', {class: 'gl-scene'}), el('label', {class: 'gl-field'}, el('span', {class: 'gl-explore-text'}), hour));
    $('gl-content').replaceChildren(wrap);
  }
  const s = lessonState(explore);
  wrap.querySelector('.gl-scene').innerHTML = renderScene(s);
  wrap.querySelector('.gl-explore-text').textContent = `الوقت: ${formatHour(s.hour)} · طول الظل ${formatNumber(s.length)} م`;
}

async function render() {
  $('gl-progress') && ($('gl-progress').textContent = `الخطوة ${formatNumber(view.index + 1)} من ${formatNumber(view.total)}`);
  const wait = $('gl-wait'), board = $('gl-board');
  if (!view.live || !view.step) {
    board.hidden = true; wait.hidden = false; content = null; contentKey = null;
    wait.textContent = !view.live ? (view.homework?.status === 'open' ? 'انتهت الحصة. الواجب متاح أدناه.' : 'انتهت الحصة. شكرًا لك!') : 'المعلم يجهز الخطوة… انتبه لشرحه.';
  } else {
    board.hidden = false; wait.hidden = true;
    if (view.step.key !== contentKey) { contentKey = view.step.key; content = await stepContent(view.step.id, view.step.key).catch(e => { status(e.message, true); return null; }); }
    if (student && view.step.type === 'interactive' && view.explore) { renderExplore(); renderKey = ''; }
    else {
      // Redraw content only when it changed, so camera moves and ink stay smooth.
      const key = JSON.stringify([contentKey, view.shadow, view.display, content ? 1 : 0]);
      if (key !== renderKey) { renderKey = key; renderStep($('gl-content'), content, {shadow: view.shadow, display: view.display}); }
      if (view.step.id !== shownStep) { shownStep = view.step.id; const c = $('gl-content'); c.classList.remove('gl-enter'); void c.offsetWidth; c.classList.add('gl-enter'); tools.resetForStep(); }
    }
    renderInk($('gl-ink'), view.strokes || []);
    tools.remoteCamera(view.camera);
  }
  renderAnswers(); await renderHomework(); renderEvaluation();
  if (view.narrate && view.narrate.seq > lastNarration) {
    lastNarration = view.narrate.seq;
    try {
      const n = student ? await getJSON(`${classBase}/narration?step=${encodeURIComponent(view.narrate.step)}`) : plan.steps.find(s => s.id === view.narrate.step).narration;
      if (!await playNarration(n)) { pendingNarration = n; $('gl-audio').hidden = false; $('gl-audio').textContent = 'استمع لشرح المعلم'; }
    } catch (e) { status(e.message, true); }
  }
}

$('gl-audio')?.addEventListener('click', async () => {
  $('gl-audio').hidden = true;
  if (pendingNarration) { const n = pendingNarration; pendingNarration = null; if (!await playNarration(n)) status('تعذّر تشغيل الشرح على هذا الجهاز.', true); }
  else if ('speechSynthesis' in window) speechSynthesis.speak(new SpeechSynthesisUtterance(''));
});
if ($('gl-audio')) $('gl-audio').hidden = false;
$('gl-full')?.addEventListener('click', () => document.documentElement.requestFullscreen?.());

let queue = Promise.resolve();
const ready = student ? Promise.resolve() : getJSON('/teach/live/' + code + '/plan').then(p => { plan = p; });
const events = new EventSource(student ? classBase + '/events' : '/teach/live/' + code + '/display-events');
events.addEventListener('view', ev => {
  const next = JSON.parse(ev.data);
  queue = queue.then(() => ready).then(async () => { view = next; status(student ? 'متصل بالحصة.' : 'شاشة العرض متصلة.'); await render(); }).catch(e => status(e.message, true));
});
events.addEventListener('removed', () => { events.close(); status('أخرجك المعلم من الحصة.', true); $('gl-board').hidden = true; });
events.onerror = () => status('انقطع الاتصال. تجري إعادة المحاولة…', true);
