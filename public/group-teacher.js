// Teacher console for the live group lesson: sequence, visibility, board ink, activity, results, homework, evaluation.
import {STEP_TYPES, NARRATION, RATING, publicStep} from './group-plan.js';
import {el, renderStep, renderInk, playNarration, stopNarration, renderDisplay} from './group-view.js';
import {attachBoardTools} from './group-board-tools.js';
import {renderNarrator, setSpeaking} from './group-view.js';
import {openTextPicker} from './text-library.js';
import {speakingMs} from './narrator-scripts.js';
import {MATERIALS, formatHour, formatNumber, lessonState} from './science-shadow-model.js';

const app = document.getElementById('gl-app'), code = app.dataset.code, base = '/teach/live/' + code;
const $ = x => document.getElementById(x);
const status = (text, bad = false) => { $('gl-status').textContent = text; $('gl-status').classList.toggle('is-error', bad); };
let plan = null, view = null, busy = false, lastStep = null, contentKey = '';
let autoAdvance = false, listenHere = false, lastSegmentSeq = 0, advanceTimer = 0, speakTimer = 0;
const INKABLE = ['page', 'board', 'interactive', 'questions'];

async function command(body) {
  if (busy && body.op !== 'stroke') return;
  try {
    const r = await fetch(base + '/command', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)});
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'تعذّر تنفيذ الأمر.');
  } catch (e) { status(e.message, true); }
}
async function post(path, body) {
  const r = await fetch(base + path, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)});
  const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(data.error || 'تعذّر الحفظ.');
}

const step = () => plan.steps[view.state.index];
const nameOf = id => view.students.find(s => s.id === id)?.name || 'طالب';

function renderSequence() {
  $('gl-steps').replaceChildren(...plan.steps.map((s, i) => el('li', {class: i === view.state.index ? 'is-current' : ''},
    el('button', {type: 'button', 'aria-current': i === view.state.index ? 'step' : null, onclick: () => command({op: 'go', index: i})},
      el('span', {class: 'gl-num', text: String(i + 1)}), el('span', {}, el('b', {text: s.title}), el('small', {text: STEP_TYPES[s.type].short + (i === view.state.index ? (view.state.shown ? ' · ظاهرة للطلاب' : ' · مخفية عن الطلاب') : '')}))))));
  $('gl-prev').disabled = view.state.index === 0; $('gl-next').disabled = view.state.index === plan.steps.length - 1;
}

function renderBoard() {
  const s = step(), revealed = view.state.revealed[s.id] || [];
  const content = s.type === 'board' ? {...publicStep(s, s.items.map(i => i.id))} : publicStep(s, revealed);
  const d = view.state.display[s.id];
  let display = null;
  if (d && s.type === 'questions') {
    const q = s.questions.find(x => x.id === d.question), r = view.results[s.id];
    if (d.mode === 'summary') display = {mode: 'summary', prompt: q.prompt, options: q.options, counts: r.counts[q.id]};
    else if (d.mode === 'correct') display = {mode: 'correct', prompt: q.prompt, options: q.options, answer: q.answer};
    else { const a = r.answers[d.student]?.[q.id]; display = {mode: 'spotlight', prompt: q.prompt, answer: a ? (q.kind === 'choice' ? q.options[a.choice] : a.text) : null, name: d.named ? nameOf(d.student) : null}; }
  }
  const places = view.state.places?.[s.id] || {};
  const key = JSON.stringify([s.id, revealed, view.state.shadow, display, places]);
  if (key !== contentKey) {
    contentKey = key; renderStep($('gl-content'), content, {teacher: true, revealed, shadow: view.state.shadow, display, places});
    if (s.id !== lastStep) { $('gl-content').classList.remove('gl-enter'); void $('gl-content').offsetWidth; $('gl-content').classList.add('gl-enter'); }
  }
  if (s.id !== lastStep) { lastStep = s.id; tools.resetForStep(); renderSnippets(s); }
  renderInk($('gl-ink'), view.state.strokes[s.id] || []);
  tools.remoteCamera(view.state.camera?.[s.id]);
  renderTeacherNarrator(s);
  const show = $('gl-show');
  show.textContent = view.state.shown ? 'إخفاء عن الطلاب' : 'إظهار للطلاب'; show.setAttribute('aria-pressed', String(view.state.shown));
  $('gl-vis').textContent = !view.state.live ? 'انتهى العرض للطلاب' : view.state.shown ? 'الطلاب يرون هذه الخطوة' : 'الطلاب لا يرون هذه الخطوة الآن';
  $('gl-vis').classList.toggle('is-hidden', !view.state.shown || !view.state.live);
  $('gl-board').classList.toggle('is-off', !view.state.shown);
  const canInk = INKABLE.includes(s.type);
  for (const b of document.querySelectorAll('.gl-tools button')) b.disabled = !canInk && !['select', 'hand'].includes(b.dataset.tool);
  $('gl-board').classList.toggle('no-ink', !canInk);
  $('gl-live').textContent = view.state.live ? 'إنهاء العرض للطلاب' : 'استئناف العرض';
}

// The teacher sees the narrator exactly as the class does, and leads it: play, next, mute, hide, automatic advance.
function renderTeacherNarrator(s) {
  const n = view.state.narrator, g = s.type === 'interactive' ? s.narrator?.segments[n?.segment] : null;
  const info = g && n.visible ? {segment: n.segment, total: s.narrator.segments.length, text: g.text, muted: n.muted} : null;
  renderNarrator($('gl-board'), info);
  if (!g || n.seq === lastSegmentSeq) return;
  lastSegmentSeq = n.seq;
  clearTimeout(advanceTimer); clearTimeout(speakTimer);
  const duration = speakingMs(g.text) + 1600;
  if (listenHere && !n.muted) { stopNarration(); setSpeaking($('gl-board'), true); playNarration(g.audio ? {mode: 'recorded', audio: g.audio} : {mode: 'speech', text: g.text}, {onEnd: () => setSpeaking($('gl-board'), false)}); }
  else if (info) { setSpeaking($('gl-board'), true); speakTimer = setTimeout(() => setSpeaking($('gl-board'), false), duration - 1600); }
  if (autoAdvance && n.segment < s.narrator.segments.length - 1) advanceTimer = setTimeout(() => command({op: 'narrator', action: 'next'}), duration + 800);
}

function narratorPanel(s) {
  const n = view.state.narrator, segs = s.narrator.segments, on = n.segment >= 0;
  const act = (action, extra = {}) => command({op: 'narrator', action, ...extra});
  return el('section', {class: 'gl-narr-panel', 'aria-label': 'المتحدث'},
    el('h3', {text: '🎙 المتحدث: جولة مشروحة'}),
    el('div', {class: 'gl-row'},
      el('button', {type: 'button', class: on ? '' : 'btn', onclick: () => act(on ? 'replay' : 'start')}, on ? '↻ أعد المقطع' : '▶ ابدأ الجولة'),
      el('button', {type: 'button', disabled: !on || n.segment === 0, onclick: () => act('prev')}, 'السابق'),
      el('button', {type: 'button', class: on ? 'btn' : '', disabled: !on || n.segment === segs.length - 1, onclick: () => act('next')}, 'التالي'),
      el('button', {type: 'button', class: 'quiet', disabled: !on, onclick: () => { clearTimeout(advanceTimer); stopNarration(); act('stop'); }}, '■ إنهاء الجولة')),
    el('div', {class: 'gl-row'},
      el('button', {type: 'button', 'aria-pressed': String(!n.visible), onclick: () => act('visible', {on: !n.visible})}, n.visible ? 'إخفاء المتحدث' : 'إظهار المتحدث'),
      el('button', {type: 'button', 'aria-pressed': String(n.muted), onclick: () => { if (!n.muted) stopNarration(); act('mute', {on: !n.muted}); }}, n.muted ? '🔇 الصوت مكتوم — شغّله' : '🔊 اكتم الصوت'),
      el('label', {class: 'gl-field gl-inline'}, 'يُسمع على', el('select', {onchange: e => act('target', {to: e.target.value})},
        [['screen', 'شاشة العرض'], ['students', 'أجهزة الطلاب'], ['both', 'الاثنين']].map(([v, t]) => el('option', {value: v, selected: n.target === v}, t))))),
    el('div', {class: 'gl-row'},
      el('label', {class: 'gl-check'}, el('input', {type: 'checkbox', checked: autoAdvance, onchange: e => { autoAdvance = e.target.checked; clearTimeout(advanceTimer); }}), 'انتقال تلقائي بعد كل مقطع'),
      el('label', {class: 'gl-check'}, el('input', {type: 'checkbox', checked: listenHere, onchange: e => { listenHere = e.target.checked; if (!listenHere) stopNarration(); }}), 'أسمعه على جهازي أيضًا')),
    el('ol', {class: 'gl-segs'}, segs.map((g, i) => el('li', {class: i === n.segment ? 'is-current' : ''},
      el('button', {type: 'button', onclick: () => act('goto', {segment: i})}, el('small', {text: (g.audio ? '🎤 ' : '') + formatHour(g.hour)}), el('span', {text: g.text}))))),
    el('p', {class: 'gl-hint', text: 'يظهر كلام المتحدث مكتوبًا دائمًا. الصوت من تسجيلك إن سجلته، وإلا من صوت الجهاز العربي إن وُجد. يمكنك الشرح بصوتك بدلًا منه بكتم صوته.'}));
}

function narratorQuick(s) {
  const n = view.state.narrator, segs = s.narrator.segments, on = n.segment >= 0;
  const act = (action, extra = {}) => command({op: 'narrator', action, ...extra});
  return el('div', {class: 'gl-narr-quick', role: 'group', 'aria-label': 'تحكم سريع بالمتحدث'},
    el('span', {class: 'gl-narr-label', text: on ? `🎙 المتحدث ${formatNumber(n.segment + 1)}/${formatNumber(segs.length)}` : '🎙 المتحدث'}),
    el('button', {type: 'button', class: on ? '' : 'btn', 'data-narr': on ? 'replay' : 'start', onclick: () => act(on ? 'replay' : 'start')}, on ? '↻ أعد' : '▶ شغّل الجولة'),
    on ? el('button', {type: 'button', 'data-narr': 'next', class: 'btn', disabled: n.segment === segs.length - 1, onclick: () => act('next')}, 'المقطع التالي') : null,
    el('button', {type: 'button', 'data-narr': 'mute', 'aria-pressed': String(n.muted), onclick: () => { if (!n.muted) stopNarration(); act('mute', {on: !n.muted}); }}, n.muted ? '🔇 مكتوم' : '🔊 كتم'),
    el('button', {type: 'button', 'data-narr': 'visible', 'aria-pressed': String(!n.visible), onclick: () => act('visible', {on: !n.visible})}, n.visible ? 'إخفاء' : 'إظهار'),
    on ? el('button', {type: 'button', class: 'quiet', 'data-narr': 'stop', onclick: () => { clearTimeout(advanceTimer); stopNarration(); act('stop'); }}, '■ إنهاء') : null);
}

function renderNarration() {
  const s = step(), box = $('gl-narration');
  box.hidden = false;
  if (s.type === 'interactive' && s.narrator) { box.replaceChildren(narratorQuick(s)); return; }
  if (s.narration.mode === 'live') { box.replaceChildren(el('span', {class: 'gl-live-voice', text: '🎙 ' + NARRATION.live + ': اشرح هذه الخطوة بصوتك.'})); return; }
  box.replaceChildren(el('span', {text: NARRATION[s.narration.mode] + ':'}),
    el('button', {type: 'button', class: 'outline', onclick: async () => { if (!await playNarration(s.narration)) status('تعذّر تشغيل الشرح على هذا الجهاز (قد لا يتوفر صوت عربي).', true); }}, 'تشغيل هنا'),
    el('button', {type: 'button', class: 'outline', onclick: () => command({op: 'narrate', target: 'screen'})}, 'تشغيل على شاشة العرض'),
    el('button', {type: 'button', class: 'outline', onclick: () => command({op: 'narrate', target: 'students'})}, 'تشغيل على أجهزة الطلاب'),
    el('button', {type: 'button', class: 'quiet', onclick: stopNarration}, 'إيقاف'));
}

function renderPanel() {
  const s = step(), panel = $('gl-panel');
  const head = el('h2', {text: STEP_TYPES[s.type].label});
  if (s.type === 'page') return panel.replaceChildren(head, el('p', {text: 'اكتب على الصفحة بالقلم أثناء الشرح. الطلاب يرون الكتابة مباشرة. انتقل إلى «التالي» للشرح التفاعلي.'}));
  if (s.type === 'interactive') {
    const sh = view.state.shadow, full = lessonState(sh);
    const set = values => command({op: 'shadow', command: {op: 'set', ...values}});
    const hour = el('input', {type: 'range', min: 7, max: 17, step: 0.25, value: sh.hour, 'aria-label': 'وقت اليوم', onchange: e => set({hour: Number(e.target.value)})});
    const height = el('input', {type: 'range', min: 1, max: 2, step: 0.1, value: sh.height, 'aria-label': 'طول اللوح', onchange: e => set({height: Number(e.target.value)})});
    return panel.replaceChildren(head,
      el('div', {class: 'gl-row'}, el('button', {type: 'button', onclick: () => set({hour: Math.max(7, sh.hour - 1)})}, 'ساعة أبكر'), el('output', {text: formatHour(sh.hour)}), el('button', {type: 'button', onclick: () => set({hour: Math.min(17, sh.hour + 1)})}, 'ساعة لاحقة')),
      el('label', {class: 'gl-field'}, 'الوقت', hour), el('label', {class: 'gl-field'}, `طول اللوح ${formatNumber(sh.height)} م`, height),
      el('div', {class: 'gl-row', role: 'group', 'aria-label': 'مادة اللوح'}, Object.entries(MATERIALS).map(([k, m]) => el('button', {type: 'button', 'aria-pressed': String(sh.material === k), onclick: () => set({material: k})}, `${m.name} (${m.kind})`))),
      el('div', {class: 'gl-row'},
        el('button', {type: 'button', class: sh.reveal ? '' : 'is-warn', 'aria-pressed': String(!sh.reveal), onclick: () => command({op: 'shadow', command: {op: 'reveal', show: !sh.reveal}})}, sh.reveal ? 'إخفاء الظل ليتوقع الطلاب' : 'اكشف الظل'),
        el('button', {type: 'button', 'aria-pressed': String(view.state.explore), onclick: () => command({op: 'explore', on: !view.state.explore})}, view.state.explore ? 'إيقاف الاستكشاف الفردي' : 'اسمح للطلاب بالاستكشاف على أجهزتهم'),
        el('button', {type: 'button', class: 'quiet', onclick: () => command({op: 'shadow', command: {op: 'reset'}})}, 'إعادة')),
      el('p', {class: 'gl-hint', text: `الآن: ارتفاع الشمس ${formatNumber(full.elevation)}° وطول الظل ${formatNumber(full.length)} م.`}),
      s.narrator ? narratorPanel(s) : null);
  }
  if (s.type === 'board') {
    const revealed = view.state.revealed[s.id] || [];
    return panel.replaceChildren(head, el('div', {class: 'gl-row'},
      el('button', {type: 'button', onclick: () => command({op: 'reveal', all: true})}, 'إظهار الكل'), el('button', {type: 'button', class: 'quiet', onclick: () => command({op: 'reveal', all: false})}, 'إخفاء الكل')),
      el('ul', {class: 'gl-reveal'}, s.items.map((item, i) => {
        const on = revealed.includes(item.id);
        return el('li', {}, el('span', {text: `${i + 1}. ` + (item.kind === 'image' ? 'صورة' + (item.caption ? ': ' + item.caption : '') : item.text)}),
          el('button', {type: 'button', 'aria-pressed': String(on), onclick: () => command({op: 'reveal', item: item.id, show: !on})}, on ? 'إخفاء' : 'إظهار'));
      })));
  }
  if (s.type === 'questions') {
    const open = Boolean(view.state.open[s.id]), r = view.results[s.id], d = view.state.display[s.id];
    const answered = Object.keys(r.answers).length;
    const blocks = s.questions.map((q, i) => {
      const card = el('div', {class: 'gl-q'}, el('b', {text: `${i + 1}. ${q.prompt}`}));
      if (q.kind === 'choice') {
        const counts = r.counts[q.id], total = counts.reduce((a, b) => a + b, 0);
        card.append(renderDisplay({mode: 'summary', prompt: '', options: q.options.map((o, j) => (j === q.answer ? '✓ ' : '') + o), counts}),
          el('div', {class: 'gl-row'}, el('small', {text: `${formatNumber(total)} إجابة`}),
            el('button', {type: 'button', 'aria-pressed': String(d?.mode === 'summary' && d.question === q.id), onclick: () => command({op: 'display', mode: 'summary', question: q.id})}, 'اعرض النتائج للجميع'),
            el('button', {type: 'button', 'aria-pressed': String(d?.mode === 'correct' && d.question === q.id), onclick: () => command({op: 'display', mode: 'correct', question: q.id})}, 'اعرض الإجابة الصحيحة')));
      }
      const list = el('ul', {class: 'gl-answers'});
      for (const st of view.students) {
        const a = r.answers[st.id]?.[q.id];
        const shown = d?.mode === 'spotlight' && d.question === q.id && d.student === st.id;
        list.append(el('li', {class: a && q.kind === 'choice' ? (a.choice === q.answer ? 'is-right' : 'is-wrong') : ''},
          el('span', {text: `${st.name}: ` + (a ? (q.kind === 'choice' ? q.options[a.choice] : a.text) : '—')}),
          a ? el('span', {class: 'gl-row'},
            el('button', {type: 'button', class: 'quiet', 'aria-pressed': String(shown && !d.named), onclick: () => command({op: 'display', mode: 'spotlight', question: q.id, student: st.id, named: false})}, 'اعرضها دون اسم'),
            el('button', {type: 'button', class: 'quiet', 'aria-pressed': String(shown && d.named), onclick: () => command({op: 'display', mode: 'spotlight', question: q.id, student: st.id, named: true})}, 'مع الاسم')) : null));
      }
      card.append(list);
      return card;
    });
    return panel.replaceChildren(head, el('div', {class: 'gl-row'},
      el('button', {type: 'button', class: open ? 'is-warn' : 'btn', onclick: () => command({op: 'open', open: !open})}, open ? 'إيقاف استقبال الإجابات' : 'افتح الإجابة للطلاب'),
      el('button', {type: 'button', class: 'quiet', disabled: !d, onclick: () => command({op: 'display', mode: 'none'})}, 'إخفاء العرض عن الجميع'),
      el('span', {class: 'gl-hint', text: `أجاب ${formatNumber(answered)} من ${formatNumber(view.students.length)}. النتائج تظهر لك وحدك حتى تختار عرضها.`})), ...blocks);
  }
  if (s.type === 'homework') return panel.replaceChildren(head, el('p', {text: 'أسند الواجب ليظهر للطلاب على أجهزتهم ويحلوه حتى بعد انتهاء الحصة. تتابع التسليم في الجانب.'}), homeworkButtons());
  return panel.replaceChildren(head, el('p', {text: 'قيّم كل طالب في قائمة «التقييم» بالجانب، ثم انشر التقييم ليرى كل طالب تقييمه وحده.'}));
}

function homeworkButtons() {
  const st = view.state.homework;
  return el('div', {class: 'gl-row'},
    el('button', {type: 'button', class: st === 'open' ? 'is-warn' : 'btn', onclick: () => command({op: 'homework', status: st === 'open' ? 'closed' : 'open'})}, st === 'open' ? 'إغلاق الواجب' : st === 'closed' ? 'إعادة فتح الواجب' : 'أسند الواجب للطلاب'),
    el('small', {text: {none: 'لم يُسند بعد', open: 'الواجب مفتوح', closed: 'الواجب مغلق'}[st]}));
}

function renderSide() {
  $('gl-count').textContent = `(${formatNumber(view.students.length)})`;
  $('gl-students').replaceChildren(...(view.students.length ? view.students.map(st => el('li', {}, el('span', {text: st.name}),
    el('button', {type: 'button', class: 'quiet', 'aria-label': 'إخراج ' + st.name, onclick: async () => { if (!confirm(`إخراج ${st.name} من الحصة؟`)) return; try { await post('/remove', {student: st.id}); } catch (e) { status(e.message, true); } }}, 'إخراج'))) : [el('li', {class: 'gl-empty', text: 'بانتظار انضمام الطلاب برمز الحصة.'})]));
  const hw = plan.steps.find(s => s.type === 'homework');
  $('gl-homework').replaceChildren(...(hw ? [homeworkButtons(), el('ul', {class: 'gl-hw'}, view.students.map(st => {
    const h = view.homework[st.id];
    return el('li', {}, el('span', {text: st.name}), el('span', {text: h?.submitted ? `${formatNumber(h.correct)}/${formatNumber(h.total)} صحيحة · ${formatNumber(h.submitted)} إجابة` : 'لم يسلّم'}));
  }))] : [el('p', {text: 'لا يوجد واجب في هذا الدرس.'})]));
  const ev = plan.steps.find(s => s.type === 'evaluation');
  if (!ev) return $('gl-evaluation').replaceChildren(el('p', {text: 'لا توجد خطوة تقييم.'}));
  const publish = el('button', {type: 'button', class: view.state.evaluationPublished ? 'is-warn' : 'btn', onclick: () => command({op: 'publish-evaluation', on: !view.state.evaluationPublished})}, view.state.evaluationPublished ? 'إخفاء التقييم عن الطلاب' : 'نشر التقييم للطلاب');
  const forms = view.students.map(st => {
    const saved = view.evaluations[st.id], form = el('form', {class: 'gl-eval'});
    form.append(el('b', {text: st.name}), ...ev.criteria.map((c, i) => el('label', {class: 'gl-field'}, c, el('select', {name: 'r' + i}, RATING.map((label, v) => el('option', {value: v, selected: (saved?.ratings[i] ?? 0) === v}, v ? `${v} — ${label}` : 'بدون تقدير'))))),
      el('label', {class: 'gl-field'}, 'ملاحظة', Object.assign(el('textarea', {name: 'note', maxlength: 300, rows: 2}), {value: saved?.note || ''})),
      el('button', {type: 'submit', class: 'outline'}, saved ? 'تحديث التقييم' : 'حفظ التقييم'));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      try { await post('/evaluate', {student: st.id, ratings: ev.criteria.map((_, i) => Number(form.elements['r' + i].value)), note: form.elements.note.value}); status('حُفظ تقييم ' + st.name + '.'); } catch (err) { status(err.message, true); }
    });
    return form;
  });
  // Keep a form the teacher is typing in from being replaced by a live update.
  if ($('gl-evaluation').contains(document.activeElement) && document.activeElement.tagName !== 'BUTTON') return;
  $('gl-evaluation').replaceChildren(publish, ...(forms.length ? forms : [el('p', {text: 'لا يوجد طلاب بعد.'})]));
}

function render() {
  if (!plan || !view) return;
  renderSequence(); renderBoard(); renderNarration();
  // Re-render the step tools but keep keyboard focus on the same control.
  const active = $('gl-panel').contains(document.activeElement) ? document.activeElement : null;
  const key = active && (active.getAttribute('aria-label') || active.textContent);
  renderPanel();
  if (key) [...$('gl-panel').querySelectorAll('button, input')].find(x => (x.getAttribute('aria-label') || x.textContent) === key)?.focus();
  renderSide();
}

// ---- controls ----
$('gl-prev').addEventListener('click', () => command({op: 'go', index: view.state.index - 1}));
$('gl-next').addEventListener('click', () => command({op: 'go', index: view.state.index + 1}));
$('gl-show').addEventListener('click', () => command({op: 'show', shown: !view.state.shown}));
$('gl-live').addEventListener('click', () => { if (!view.state.live || confirm('إنهاء العرض للطلاب؟ يبقى الواجب متاحًا إن كان مفتوحًا.')) command({op: 'live', on: !view.state.live}); });
$('gl-undo').addEventListener('click', () => command({op: 'undo-stroke'}));
$('gl-library').addEventListener('click', () => openTextPicker({title: 'نصوص توضيحية للسبورة', useLabel: 'ضعه على السبورة', onUse: text => tools.prepareSnippet(text)}));
$('gl-clear').addEventListener('click', () => { if (confirm('مسح كل الكتابة في هذه الخطوة؟')) command({op: 'clear-strokes'}); });

const tools = attachBoardTools({
  mode: 'teacher', send: command, items: () => view?.state.strokes[step().id] || [], canInk: () => view && INKABLE.includes(step().type),
  onStatus: text => status(text), onUndo: () => command({op: 'undo-stroke'}),
  onNext: () => view.state.index < plan.steps.length - 1 && command({op: 'go', index: view.state.index + 1}),
  onPrev: () => view.state.index > 0 && command({op: 'go', index: view.state.index - 1})
});
function renderSnippets(s) {
  const box = $('gl-snippets'), list = s.snippets || [];
  box.hidden = !list.length;
  box.replaceChildren(el('span', {class: 'gl-snip-label', text: 'نصوص جاهزة:'}), ...list.map(t => el('button', {type: 'button', class: 'gl-snip', onclick: () => tools.prepareSnippet(t)}, t)));
}

// ---- connection ----
const plansReady = fetch(base + '/plan').then(r => r.json()).then(p => { plan = p; });
const events = new EventSource(base + '/events');
events.addEventListener('view', async ev => { await plansReady; view = JSON.parse(ev.data); status(view.state.live ? 'متصل. أنت تقود الحصة.' : 'العرض متوقف للطلاب.'); render(); });
events.onerror = () => status('انقطع الاتصال. تجري إعادة المحاولة…', true);
