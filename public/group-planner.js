// Planner: the teacher orders the lesson steps before class and prepares content, questions and narration.
import {STEP_TYPES, NARRATION, SUBJECTS, ORIGINAL_PAGES, LIMITS, renderOriginalPage, validatePlan, boardLayout, gradeName, removeOption} from './group-plan.js';
import {el} from './group-view.js';
import {openTextPicker, downloadJSON, safeName} from './text-library.js';
import {ACTIVITIES, activityOf, segmentLabel} from './activities.js';
import {openLibrary} from './tool-library-ui.js';
import {toolOf} from './tool-library.js';
import {allLessons, BOOKS, bookOf, bookFor, lessonBookPage} from './book-catalog.js';

const root = document.getElementById('planner'), id = root.dataset.id;
const $ = x => document.getElementById(x);
const status = (text, bad = false) => { $('pl-status').textContent = text; $('pl-status').classList.toggle('is-error', bad); };
let plan = null, dirty = false;
const uid = prefix => prefix + '-' + Math.random().toString(36).slice(2, 8);
const DRAFT = 'gl-plan-draft-' + id;
let draftTimer = 0;
function saveDraft() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    try { localStorage.setItem(DRAFT, JSON.stringify({at: Date.now(), plan})); }
    catch { status('توجد تعديلات غير محفوظة. الدرس أكبر من مساحة الحفظ على الجهاز؛ احفظه في الخادم ونزّله كملف.', true); }
  }, 400);
}
const dropDraft = () => { clearTimeout(draftTimer); try { localStorage.removeItem(DRAFT); } catch { /* ignore */ } };
const touch = () => { dirty = true; status('توجد تعديلات غير محفوظة. تُحفظ مسودة على هذا الجهاز تلقائيًا.'); saveDraft(); };
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

function field(label, input) { return el('label', {class: 'pl-field'}, el('span', {text: label}), input); }
function textInput(value, max, onInput, attrs = {}) { return el('input', {value: value ?? '', maxlength: max, ...attrs, oninput: e => { onInput(e.target.value); touch(); }}); }
function area(value, max, onInput, rows = 2) { const t = el('textarea', {maxlength: max, rows, oninput: e => { onInput(e.target.value); touch(); }}); t.value = value ?? ''; return t; }
function move(list, i, d) { const j = i + d; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; touch(); render(); }
function smallButtons(list, i, label) {
  return el('span', {class: 'pl-move'},
    el('button', {type: 'button', 'aria-label': `تحريك ${label} لأعلى`, disabled: i === 0, onclick: () => move(list, i, -1)}, '▲'),
    el('button', {type: 'button', 'aria-label': `تحريك ${label} لأسفل`, disabled: i === list.length - 1, onclick: () => move(list, i, 1)}, '▼'),
    el('button', {type: 'button', class: 'quiet', 'aria-label': `حذف ${label}`, onclick: () => { if (confirm('حذف ' + label + '؟')) { list.splice(i, 1); touch(); render(); } }}, 'حذف'));
}

// Shrinks a picture so it fits the per-image limit; JPEG keeps photos small.
function readImage(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return reject(new Error('اختر صورة PNG أو JPEG أو WebP.'));
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      let scale = Math.min(1, 1600 / img.width, 1000 / img.height), data;
      for (let attempt = 0; attempt < 6; attempt++) {
        const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
        data = c.toDataURL('image/jpeg', 0.82);
        if (data.length <= LIMITS.image) break;
        scale *= 0.75;
      }
      URL.revokeObjectURL(url);
      data.length <= LIMITS.image ? resolve(data) : reject(new Error('الصورة كبيرة جدًا.'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('تعذّر قراءة الصورة.')); };
    img.src = url;
  });
}
function imagePicker(label, onPick) {
  return field(label, el('input', {type: 'file', accept: 'image/png,image/jpeg,image/webp', onchange: async e => {
    const file = e.target.files[0]; if (!file) return;
    try { onPick(await readImage(file)); touch(); render(); } catch (err) { status(err.message, true); }
  }}));
}

// ---- narration (live voice, recorded clip, or device speech) ----
let recorder = null;
/** Record / play / delete controls that store a voice clip on `holder.audio`. */
function audioControls(key, holder, label = 'التسجيل') {
  const parts = [];
  if (holder.audio) parts.push(el('audio', {controls: true, src: holder.audio}), el('button', {type: 'button', class: 'quiet', onclick: () => { delete holder.audio; touch(); render(); }}, 'حذف ' + label));
  const rec = el('button', {type: 'button', class: 'outline'}, recorder?.key === key ? '■ إيقاف التسجيل' : (holder.audio ? 'إعادة التسجيل' : '● سجّل بصوتك'));
  rec.addEventListener('click', async () => {
    if (recorder?.key === key) return recorder.media.stop();
    if (recorder) return status('أوقف التسجيل الجاري أولًا.', true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true}});
      const type = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported?.(t)) || '';
      const media = new MediaRecorder(stream, type ? {mimeType: type, audioBitsPerSecond: 48000} : {}), chunks = [];
      recorder = {key, media};
      media.ondataavailable = e => chunks.push(e.data);
      media.onstop = () => {
        stream.getTracks().forEach(t => t.stop()); clearTimeout(recorder?.timer); recorder = null;
        const reader = new FileReader();
        reader.onload = () => { if (reader.result.length > LIMITS.audio) status('التسجيل طويل؛ اجعله أقصر من دقيقة ونصف.', true); else { holder.audio = reader.result; touch(); } render(); };
        reader.readAsDataURL(new Blob(chunks, {type: media.mimeType || 'audio/webm'}));
      };
      media.start(); recorder.timer = setTimeout(() => media.state === 'recording' && media.stop(), 90_000);
      status('جارٍ التسجيل… تحدث بوضوح ثم اضغط إيقاف (حد أقصى دقيقة ونصف).'); render();
    } catch { recorder = null; status('تعذّر استخدام الميكروفون. اسمح للمتصفح باستخدامه ثم أعد المحاولة.', true); }
  });
  parts.push(rec);
  return parts;
}
/** Button that opens the explanatory text bank and passes the chosen (edited) text on. */
const libraryButton = (label, onText) => el('button', {type: 'button', class: 'outline tl-open', onclick: () => openTextPicker({onUse: text => { onText(text); touch(); render(); }})}, '📚 ' + label);
function narrationEditor(step) {
  const n = step.narration ||= {mode: 'live'};
  const box = el('div', {class: 'pl-narration'});
  const select = el('select', {onchange: e => { step.narration = {mode: e.target.value}; touch(); render(); }}, Object.entries(NARRATION).map(([k, v]) => el('option', {value: k, selected: k === n.mode}, v)));
  box.append(field('الشرح الصوتي لهذه الخطوة', select));
  if (n.mode === 'live') box.append(el('p', {class: 'pl-hint', text: 'تشرح بصوتك أثناء الحصة.'}));
  if (n.mode === 'speech') {
    box.append(field('النص الذي يقرؤه الجهاز', area(n.text, 600, v => { n.text = v; }, 3)), libraryButton('اختر من النصوص التوضيحية', t => { n.text = t; }));
    box.append(el('button', {type: 'button', class: 'outline', onclick: () => {
      if (window.App?.speak) { if (!window.App.speak(n.text || '', 'preview')) status('لا يوجد صوت عربي في هذا الجوال. ثبّته من الإعدادات: تحويل النص إلى كلام.', true); return; } // inside the Android app
      if (!('speechSynthesis' in window)) return status('هذا المتصفح لا يدعم القراءة الآلية.', true);
      speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(n.text || ''); u.lang = 'ar-SA';
      const arabic = speechSynthesis.getVoices().find(v => v.lang?.toLowerCase().startsWith('ar')); if (arabic) u.voice = arabic; else status('لا يوجد صوت عربي مثبت على هذا الجهاز؛ قد تختلف القراءة على أجهزة الطلاب.', true);
      speechSynthesis.speak(u);
    }}, 'استمع للتجربة'));
  }
  if (n.mode === 'recorded') box.append(...audioControls(step.id, n));
  return box;
}

function questionsEditor(step) {
  const wrap = el('div', {class: 'pl-questions'});
  step.questions.forEach((q, i) => {
    const card = el('div', {class: 'pl-q'}, el('div', {class: 'pl-q-head'}, el('b', {text: `سؤال ${i + 1} · ${q.kind === 'text' ? 'إجابة مكتوبة' : 'اختيار'}`}), smallButtons(step.questions, i, `السؤال ${i + 1}`)),
      field('نص السؤال', textInput(q.prompt, 200, v => { q.prompt = v; })));
    if (q.kind !== 'text') {
      q.options.forEach((o, j) => card.append(el('div', {class: 'pl-option'},
        el('input', {type: 'radio', name: 'ans-' + q.id, checked: q.answer === j, 'aria-label': `الخيار ${j + 1} هو الصحيح`, onchange: () => { q.answer = j; touch(); }}),
        textInput(o, 100, v => { q.options[j] = v; }, {'aria-label': `الخيار ${j + 1}`}),
        q.options.length > 2 ? el('button', {type: 'button', class: 'quiet', onclick: () => { removeOption(q, j); touch(); render(); }}, 'حذف') : null)));
      if (q.options.length < 4) card.append(el('button', {type: 'button', class: 'quiet', onclick: () => { q.options.push(''); touch(); render(); }}, '+ خيار'));
      card.append(el('p', {class: 'pl-hint', text: 'حدد الدائرة بجانب الإجابة الصحيحة.'}));
    }
    wrap.append(card);
  });
  if (step.questions.length < LIMITS.questions) wrap.append(el('div', {class: 'pl-row'},
    el('button', {type: 'button', class: 'outline', onclick: () => { step.questions.push({id: uid('q'), kind: 'choice', prompt: '', options: ['', ''], answer: 0}); touch(); render(); }}, '+ سؤال اختيار'),
    el('button', {type: 'button', class: 'outline', onclick: () => { step.questions.push({id: uid('q'), kind: 'text', prompt: ''}); touch(); render(); }}, '+ سؤال بإجابة مكتوبة')));
  return wrap;
}

function stepEditor(step) {
  const box = el('div', {class: 'pl-body'});
  if (step.type === 'page') {
    const src = step.source || 'original', original = src === 'original';
    const toBook = () => { const at = lessonBookPage(plan.lesson), b = at ? bookOf(at.book) : bookFor(plan.subject, plan.grade) || BOOKS[0]; Object.assign(step, {source: 'book', book: b.id, page: at?.page || 1}); delete step.image; touch(); render(); };
    box.append(el('div', {class: 'pl-row', role: 'radiogroup', 'aria-label': 'مصدر الصفحة'},
      el('label', {class: 'pl-radio'}, el('input', {type: 'radio', name: 'src-' + step.id, checked: src === 'book', onchange: toBook}), '📖 كتاب الوزارة (يُفتح على صفحة الدرس في الحصة)'),
      el('label', {class: 'pl-radio'}, el('input', {type: 'radio', name: 'src-' + step.id, checked: original, onchange: () => { Object.assign(step, {source: 'original', page: typeof step.page === 'string' ? step.page : 'science-4-light'}); delete step.image; delete step.book; touch(); render(); }}), 'صفحة أصلية للتجربة'),
      el('label', {class: 'pl-radio'}, el('input', {type: 'radio', name: 'src-' + step.id, checked: src === 'upload', onchange: () => { step.source = 'upload'; delete step.book; touch(); render(); }}), 'صورة صفحة (ارفعها)')));
    if (src === 'book') {
      const b = bookOf(step.book) || BOOKS[0];
      box.append(field('الكتاب', el('select', {'aria-label': 'الكتاب', onchange: e => { step.book = e.target.value; step.page = 1; touch(); render(); }}, BOOKS.map(x => el('option', {value: x.id, selected: x.id === b.id}, x.title)))),
        field('رقم الصفحة المطبوع', el('input', {type: 'number', min: 1, max: b.pages - b.offset, value: step.page, 'aria-label': 'رقم الصفحة', onchange: e => { step.page = Math.max(1, Math.min(b.pages - b.offset, Number(e.target.value) || 1)); touch(); }})),
        el('p', {class: 'gl-note', text: 'في الحصة اضغط «📖 كتاب الوزارة» فيفتح على هذه الصفحة، ثم اعرضها على السبورة. لا تُحفظ نسخة من الكتاب.'}));
    } else if (original) {
      box.append(field('الصفحة', el('select', {onchange: e => { step.page = e.target.value; touch(); render(); }}, Object.entries(ORIGINAL_PAGES).map(([k, p]) => el('option', {value: k, selected: k === step.page}, p.title)))));
      const preview = el('div', {class: 'pl-preview'}); preview.innerHTML = renderOriginalPage(step.page); box.append(preview);
    } else {
      box.append(imagePicker('صورة الصفحة', data => { step.image = data; }));
      if (step.image) box.append(el('img', {class: 'pl-preview', src: step.image, alt: 'معاينة الصفحة'}));
      box.append(el('label', {class: 'pl-check'}, el('input', {type: 'checkbox', checked: step.rights === true, onchange: e => { step.rights = e.target.checked; touch(); }}),
        'أؤكد أن لدي حق عرض هذه الصفحة على طلابي (مثل ترخيص المدرسة أو مادة من إعدادي). لا تنشر الصفحة خارج الحصة.'));
    }
  } else if (step.type === 'interactive') {
    box.append(field('النشاط', el('select', {onchange: e => { if (!confirm('تغيير النشاط يستبدل مقاطع المتحدث بجولة النشاط الجديد. متابعة؟')) { e.target.value = step.activity; return; } step.activity = e.target.value; step.narrator = {segments: activityOf(step.activity).narrator()}; touch(); render(); }},
      Object.values(ACTIVITIES).map(a => el('option', {value: a.id, selected: a.id === step.activity}, a.title)))),
      el('p', {class: 'pl-hint', text: 'تتحكم بالنشاط أثناء الحصة، وتخفي النتيجة ليتوقع الطلاب ثم تكشفها، ويمكن أن يشرحه المتحدث.'}), narratorEditor(step));
  } else if (step.type === 'board') {
    step.items.forEach((item, i) => {
      const card = el('div', {class: 'pl-item'}, el('div', {class: 'pl-q-head'}, el('b', {text: `عنصر ${i + 1} · ${item.kind === 'image' ? 'صورة' : 'نص'}`}), smallButtons(step.items, i, `العنصر ${i + 1}`)));
      if (item.kind === 'image') card.append(el('img', {class: 'pl-thumb', src: item.image, alt: ''}), field('وصف قصير (اختياري)', textInput(item.caption, 100, v => { item.caption = v; })));
      else card.append(field('النص', area(item.text, 300, v => { item.text = v; })));
      card.append(el('div', {class: 'pl-row pl-place-row'},
        el('label', {class: 'gl-field gl-inline'}, 'العرض', el('select', {'aria-label': `عرض البطاقة ${i + 1}`, onchange: e => { item.at = {...(item.at || pick(boardLayout(step.items)[item.id])), w: e.target.value}; touch(); render(); }},
          el('option', {value: 'half', selected: (item.at?.w || 'half') === 'half'}, 'نصف السبورة'), el('option', {value: 'full', selected: item.at?.w === 'full'}, 'السبورة كلها'))),
        item.at ? el('button', {type: 'button', class: 'quiet', onclick: () => { delete item.at; touch(); render(); }}, 'مكان تلقائي') : el('small', {class: 'pl-hint', text: 'مكانها تلقائي — اسحبها في المعاينة لتغييره'})));
      box.append(card);
    });
    box.append(layoutEditor(step));
    if (step.items.length < LIMITS.items) box.append(el('div', {class: 'pl-row'},
      el('button', {type: 'button', class: 'outline', onclick: () => { step.items.push({id: uid('i'), kind: 'text', text: ''}); touch(); render(); }}, '+ نص مجهز'),
      libraryButton('نص من المكتبة', t => step.items.push({id: uid('i'), kind: 'text', text: t.slice(0, 300)})),
      imagePicker('+ صورة مجهزة', data => { step.items.push({id: uid('i'), kind: 'image', image: data, caption: ''}); })));
    box.append(el('p', {class: 'pl-hint', text: 'تبدأ النصوص مخفية في الحصة. بضغطة «النص التالي» يظهر كل نص في مكانه بالترتيب الذي رتبته هنا، ثم تعلّق عليه بالقلم أو الفرشاة أو المستطيل أو الدائرة.'}));
  } else if (step.type === 'questions') {
    box.append(questionsEditor(step), el('p', {class: 'pl-hint', text: 'في الحصة تفتح الإجابة، وترى النتائج وحدك، ثم تختار ما تعرضه للجميع.'}));
  } else if (step.type === 'homework') {
    box.append(field('تعليمات الواجب', area(step.instructions, 300, v => { step.instructions = v; })), questionsEditor(step));
  } else {
    step.criteria.forEach((c, i) => box.append(el('div', {class: 'pl-option'}, textInput(c, 40, v => { step.criteria[i] = v; }, {'aria-label': `المعيار ${i + 1}`}),
      step.criteria.length > 1 ? el('button', {type: 'button', class: 'quiet', onclick: () => { step.criteria.splice(i, 1); touch(); render(); }}, 'حذف') : null)));
    if (step.criteria.length < LIMITS.criteria) box.append(el('button', {type: 'button', class: 'quiet', onclick: () => { step.criteria.push(''); touch(); render(); }}, '+ معيار'));
    box.append(el('p', {class: 'pl-hint', text: 'تقدير من ١ إلى ٤ لكل معيار مع ملاحظة. يرى كل طالب تقييمه وحده عندما تنشره.'}));
  }
  return box;
}

function snippetsEditor(step) {
  const list = step.snippets ||= [];
  const box = el('div', {class: 'pl-snippets'}, el('b', {text: 'نصوص جاهزة للكتابة على السبورة'}), el('p', {class: 'pl-hint', text: 'كلمات أو جمل تضعها على السبورة بلمسة أثناء الشرح بدل كتابتها وقت الحصة.'}));
  list.forEach((t, i) => box.append(el('div', {class: 'pl-option'}, textInput(t, 200, v => { list[i] = v; }, {'aria-label': `النص الجاهز ${i + 1}`}),
    el('button', {type: 'button', class: 'quiet', onclick: () => { list.splice(i, 1); touch(); render(); }}, 'حذف'))));
  if (list.length < LIMITS.snippets) box.append(el('div', {class: 'pl-row'}, el('button', {type: 'button', class: 'quiet', onclick: () => { list.push(''); touch(); render(); }}, '+ نص جاهز'), libraryButton('أضف من النصوص التوضيحية', t => list.push(t.slice(0, 200)))));
  return box;
}

function narratorEditor(step) {
  const a = activityOf(step.activity);
  step.narrator ||= {segments: a.narrator()};
  const segs = step.narrator.segments;
  const box = el('div', {class: 'pl-narrator'}, el('b', {text: '🎙 المتحدث: جولة مشروحة — ' + a.title}),
    el('p', {class: 'pl-hint', text: 'كل مقطع يضبط النشاط على قيم محددة ويشرح بجملة تظهر مكتوبة. يُقرأ بصوت الجهاز، أو بصوتك إن سجلته. في الحصة تتحكم بالتشغيل والكتم والإخفاء.'}));
  segs.forEach((g, i) => {
    g.values ||= Object.fromEntries(a.params.map(p => [p.key, g[p.key] ?? a.initial()[p.key]]));
    const fields = a.params.map(p => p.kind === 'range' && (p.max - p.min) / (p.segStep || p.step) > 200
      ? field(p.label, el('input', {type: 'number', min: p.min, max: p.max, step: p.segStep || p.step, value: g.values[p.key], inputmode: 'numeric', onchange: e => { const n = Math.min(p.max, Math.max(p.min, Number(e.target.value) || 0)); g.values[p.key] = n; e.target.value = n; touch(); render(); }}))
      : p.kind === 'range'
      ? field(p.label, el('select', {onchange: e => { g.values[p.key] = Number(e.target.value); touch(); render(); }},
        Array.from({length: Math.round((p.max - p.min) / (p.segStep || p.step)) + 1}, (_, k) => +(p.min + k * (p.segStep || p.step)).toFixed(3)).map(v => el('option', {value: v, selected: v === g.values[p.key]}, p.format(v)))))
      : field(p.label, el('select', {onchange: e => { g.values[p.key] = e.target.value; touch(); }}, Object.entries(p.options).map(([k, label]) => el('option', {value: k, selected: k === g.values[p.key]}, label)))));
    box.append(el('div', {class: 'pl-q pl-seg'}, el('div', {class: 'pl-q-head'}, el('b', {text: `مقطع ${i + 1} · ${segmentLabel(a.id, g.values)}`}), smallButtons(segs, i, `المقطع ${i + 1}`)),
      field('ما يقوله المتحدث', area(g.text, 300, v => { g.text = v; }, 2)),
      el('div', {class: 'pl-row'}, ...fields),
      el('div', {class: 'pl-row'}, libraryButton('من النصوص التوضيحية', t => { g.text = t.slice(0, 300); }), ...audioControls('seg-' + step.id + '-' + g.id, g, 'تسجيل المقطع'))));
  });
  box.append(el('div', {class: 'pl-row'},
    segs.length < LIMITS.segments ? el('button', {type: 'button', class: 'outline', onclick: () => { segs.push({id: uid('n'), values: a.initial(), text: ''}); touch(); render(); }}, '+ مقطع') : null,
    el('button', {type: 'button', class: 'quiet', onclick: () => { if (confirm('استبدال المقاطع بالجولة الجاهزة؟')) { step.narrator = {segments: a.narrator()}; touch(); render(); } }}, 'استعادة الجولة الجاهزة')));
  return box;
}

const openSteps = new Set();
function render() {
  $('pl-heading').textContent = plan.title || 'درس بلا عنوان';
  $('pl-meta').replaceChildren(
    field('عنوان الدرس', textInput(plan.title, 80, v => { plan.title = v; $('pl-heading').textContent = v; })),
    field('المادة', el('select', {onchange: e => { plan.subject = e.target.value; touch(); }}, Object.entries(SUBJECTS).map(([k, v]) => el('option', {value: k, selected: k === plan.subject}, v)))),
    field('الصف', el('select', {onchange: e => { plan.grade = Number(e.target.value); touch(); }}, [1, 2, 3, 4, 5, 6, 7, 8, 9].map(g => el('option', {value: g, selected: g === plan.grade}, gradeName(g))))),
    field('الدرس من المنهج', el('select', {'aria-label': 'الدرس من المنهج', onchange: e => { plan.lesson = e.target.value || undefined; touch(); render(); }}, el('option', {value: ''}, '— بلا —'),
      ...allLessons().filter(l => l.subject === plan.subject && l.grade === plan.grade).map(l => el('option', {value: l.id, selected: l.id === plan.lesson}, `${l.title} — ص ${l.page}`)))),
    toolsField(),
    field('صوت المتحدث', el('select', {'aria-label': 'صوت المتحدث', onchange: e => { plan.speaker = e.target.value; touch(); }}, el('option', {value: 'male', selected: plan.speaker !== 'female'}, '🧔 رجل (حامد)'), el('option', {value: 'female', selected: plan.speaker === 'female'}, '🧕 امرأة (زارية)'))));
  $('pl-steps').replaceChildren(...plan.steps.map((step, i) => {
    const details = el('details', {class: 'pl-step', open: openSteps.has(step.id), ontoggle: e => e.target.open ? openSteps.add(step.id) : openSteps.delete(step.id)},
      el('summary', {}, el('span', {class: 'pl-num', text: String(i + 1)}), el('span', {class: 'pl-type', text: STEP_TYPES[step.type].short}), el('span', {class: 'pl-title', text: step.title || 'بلا عنوان'})),
      el('div', {class: 'pl-step-tools'}, smallButtons(plan.steps, i, `الخطوة ${i + 1}`)),
      field('عنوان الخطوة', textInput(step.title, 80, v => { step.title = v; details.querySelector('.pl-title').textContent = v || 'بلا عنوان'; })),
      el('label', {class: 'pl-check'}, el('input', {type: 'checkbox', checked: step.startHidden === true, onchange: e => { step.startHidden = e.target.checked; touch(); }}), 'تبدأ مخفية عن الطلاب حتى أظهرها'),
      stepEditor(step), ['homework', 'evaluation'].includes(step.type) ? null : snippetsEditor(step), narrationEditor(step));
    return el('li', {}, details);
  }));
}

const templates = {
  page: () => ({type: 'page', title: 'صفحة المنهج', source: 'original', page: 'science-4-light'}),
  interactive: () => ({type: 'interactive', title: 'شرح تفاعلي', activity: plan.steps.find(x => x.type === 'interactive')?.activity || 'shadows'}),
  board: () => ({type: 'board', title: 'على السبورة', items: [{id: uid('i'), kind: 'text', text: ''}]}),
  questions: () => ({type: 'questions', title: 'أسئلة', questions: [{id: uid('q'), kind: 'choice', prompt: '', options: ['', ''], answer: 0}]}),
  homework: () => ({type: 'homework', title: 'الواجب', instructions: '', questions: [{id: uid('q'), kind: 'choice', prompt: '', options: ['', ''], answer: 0}]}),
  evaluation: () => ({type: 'evaluation', title: 'تقييم الطلاب', criteria: ['المشاركة', 'فهم الدرس']})
};
for (const button of document.querySelectorAll('[data-add]')) button.addEventListener('click', () => {
  if (plan.steps.length >= LIMITS.steps) return status('وصلت إلى الحد الأقصى للخطوات.', true);
  const step = {id: uid('s'), narration: {mode: 'live'}, ...templates[button.dataset.add]()};
  plan.steps.push(step); openSteps.add(step.id); touch(); render();
  document.querySelector('#pl-steps li:last-child summary')?.scrollIntoView({block: 'center'});
});

$('pl-save').addEventListener('click', async () => {
  const button = $('pl-save'); button.disabled = true; status('جارٍ الحفظ…');
  try {
    const r = await fetch(location.pathname, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(plan)});
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'تعذّر الحفظ.');
    dirty = false; dropDraft(); status('حُفظ الدرس. يمكنك بدء الحصة. نزّله كملف للاحتفاظ بنسخة.');
  } catch (e) { status(e.message, true); } finally { button.disabled = false; }
});
for (const form of document.querySelectorAll('.gl-start, .gl-delete')) form.addEventListener('submit', e => {
  if (form.classList.contains('gl-delete') && !confirm('حذف الدرس نهائيًا؟')) return e.preventDefault();
  if (form.classList.contains('gl-start') && dirty && !confirm('توجد تعديلات غير محفوظة. البدء بآخر نسخة محفوظة؟')) return e.preventDefault();
  dirty = false;
});

function checkDraft(serverPlan) {
  let draft = null; try { draft = JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch { /* ignore */ }
  if (!draft?.plan || JSON.stringify(draft.plan) === JSON.stringify(serverPlan)) { dropDraft(); return; }
  $('pl-draft').hidden = false;
  $('pl-draft-restore').onclick = () => { plan = draft.plan; $('pl-draft').hidden = true; dirty = true; render(); status('استُعيد التعديل من هذا الجهاز. اضغط «حفظ الدرس».'); };
  $('pl-draft-drop').onclick = () => { dropDraft(); $('pl-draft').hidden = true; };
}
$('pl-export').addEventListener('click', () => downloadJSON(safeName(plan?.title) + '.json', {format: 'teachabs-lesson', version: 1, saved: new Date().toISOString(), plan}));
$('pl-import-btn').addEventListener('click', () => $('pl-import').click());
$('pl-import').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text()), imported = data?.format === 'teachabs-lesson' ? data.plan : data;
    validatePlan(imported);
    if (!confirm('استبدال محتوى هذا الدرس بالملف؟ يمكنك التراجع بعدم الحفظ.')) return;
    plan = imported; touch(); render(); status('استُورد الدرس من الملف. راجعه ثم اضغط «حفظ الدرس».');
  } catch (err) { status(err instanceof SyntaxError ? 'الملف ليس درسًا صالحًا.' : 'الملف غير صالح: ' + err.message, true); }
  e.target.value = '';
});

fetch(location.pathname + '.json').then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => { plan = data; render(); status('رتّب الخطوات وجهزها، ثم احفظ.'); checkDraft(data); })
  .catch(() => {
    // The server is unreachable: open the last draft from this device so the work is not lost.
    let draft = null; try { draft = JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch { /* ignore */ }
    if (draft?.plan) { plan = draft.plan; render(); status('تعذّر الوصول للخادم. فُتحت آخر مسودة من هذا الجهاز؛ نزّلها كملف للاحتفاظ بها.', true); }
    else status('تعذّر تحميل الدرس.', true);
  });


// ---- where each prepared text sits on the board: a small copy of the board where the cards are dragged ----
const pick = p => ({x: p.x, y: p.y, w: p.w});
function layoutEditor(step) {
  const layout = boardLayout(step.items);
  const content = el('div', {class: 'gl-content pl-layout-content'}, el('h2', {class: 'gl-step-title', text: step.title || 'على السبورة'}));
  step.items.forEach((item, i) => {
    const at = layout[item.id];
    const card = item.kind === 'image'
      ? el('figure', {class: 'gl-item gl-item-image'}, el('img', {src: item.image, alt: ''}))
      : el('div', {class: 'gl-item gl-item-text', text: item.text || '…'});
    card.prepend(el('b', {class: 'gl-card-num', text: String(i + 1)}));
    card.classList.add('is-placed', at.w === 'full' ? 'is-full' : 'is-half');
    card.style.left = at.x / 10 + '%'; card.style.top = at.y / 6 + '%';
    card.dataset.item = item.id; card.title = 'اسحب البطاقة إلى مكانها على السبورة';
    card.addEventListener('pointerdown', e => {
      e.preventDefault(); card.setPointerCapture(e.pointerId); card.classList.add('is-dragging');
      const k = board.clientWidth / 1000, start = [e.clientX, e.clientY], from = [at.x, at.y]; let to = from;
      const move = ev => { to = [Math.max(0, Math.min(1000 - 120, from[0] + (ev.clientX - start[0]) / k)), Math.max(0, Math.min(600 - 40, from[1] + (ev.clientY - start[1]) / k))]; card.style.left = to[0] / 10 + '%'; card.style.top = to[1] / 6 + '%'; };
      const up = () => { card.removeEventListener('pointermove', move); card.removeEventListener('pointerup', up); card.classList.remove('is-dragging');
        if (to !== from) { item.at = {x: Math.round(to[0]), y: Math.round(to[1]), w: at.w}; touch(); render(); } };
      card.addEventListener('pointermove', move); card.addEventListener('pointerup', up);
    });
    content.append(card);
  });
  const board = el('div', {class: 'pl-layout-board'}, content), warn = el('p', {class: 'pl-hint pl-layout-warn', hidden: true});
  // The copy has the board's real size, scaled to fit; a warning appears when cards touch or leave the board.
  new ResizeObserver(() => {
    board.style.setProperty('--k', board.clientWidth / 1000);
    const cards = [...content.querySelectorAll('.gl-item')].map(c => ({x: c.offsetLeft, y: c.offsetTop, r: c.offsetLeft + c.offsetWidth, b: c.offsetTop + c.offsetHeight}));
    const over = cards.some((a, i) => cards.some((b, j) => j > i && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b)), out = cards.some(c => c.b > 600 || c.r > 1000);
    warn.hidden = !(over || out);
    warn.textContent = over ? '⚠ بطاقتان فوق بعضهما — اسحب إحداهما.' : out ? '⚠ بطاقة تخرج من السبورة — اسحبها أو قصّر نصها أو اجعلها «نصف السبورة».' : '';
  }).observe(board);
  return el('section', {class: 'pl-layout', 'aria-label': 'مكان النصوص على السبورة'},
    el('div', {class: 'pl-row'}, el('b', {text: 'مكان النصوص على السبورة'}),
      el('button', {type: 'button', class: 'quiet', onclick: () => { step.items.forEach(it => delete it.at); touch(); render(); }}, 'ترتيب تلقائي للكل')),
    el('p', {class: 'pl-hint', text: 'هكذا تظهر في الحصة. اسحب كل بطاقة إلى مكانها؛ الرقم ترتيب ظهورها.'}), board, warn);
}


// ---- «🧰 أدوات الدرس»: pinned from the library for this lesson; ready in class with one tap ----
function toolsField() {
  plan.tools ||= [];
  const chips = plan.tools.map(id => toolOf(id)).filter(Boolean).map(t => el('span', {class: 'pl-tool-chip', title: t.desc}, `${t.icon} ${t.title}`,
    el('button', {type: 'button', class: 'quiet', 'aria-label': 'إزالة ' + t.title, onclick: () => { plan.tools = plan.tools.filter(x => x !== t.id); touch(); render(); }}, '✕')));
  return el('div', {class: 'pl-tools', 'aria-label': 'أدوات الدرس'},
    el('div', {class: 'pl-row'}, el('b', {text: '🧰 أدوات الدرس'}), el('button', {type: 'button', class: 'btn', id: 'pl-library', onclick: () => openLibrary({
      subject: plan.subject, grade: plan.grade, lesson: plan.lesson || '', pinned: new Set(plan.tools),
      onPin: (t, on) => {
        plan.tools = on ? [...new Set([...plan.tools, t.id])] : plan.tools.filter(x => x !== t.id);
        // an interactive explanation pinned for the first time becomes a step of the lesson
        if (on && t.kind === 'activity' && !plan.steps.some(st => st.type === 'interactive' && st.activity === t.id)) {
          const a = activityOf(t.id), at = plan.steps.findIndex(st => ['questions', 'homework', 'evaluation'].includes(st.type));
          const step = {id: uid('s'), type: 'interactive', title: t.title, activity: t.id, narration: {mode: 'live'}, narrator: {segments: a.narrator()}};
          plan.steps.splice(at < 0 ? plan.steps.length : at, 0, step); status(`أُضيفت خطوة «${t.title}» إلى الدرس.`);
        }
        touch(); render();
      }})}, 'افتح المكتبة')),
    chips.length ? el('div', {class: 'pl-tool-chips'}, ...chips) : el('p', {class: 'pl-hint', text: 'لم تثبّت أدوات بعد. افتح المكتبة واختر ما يناسب درسك؛ تظهر لك في الحصة تحت «🧰».'}));
}
