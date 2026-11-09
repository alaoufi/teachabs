// Explanatory text bank: ready texts from the repository plus the teacher's own saved texts.
// The teacher picks a text, edits it, then uses it or saves the edit as a new text for later lessons.
// A copy of the teacher's texts is kept in this browser and can be downloaded, so nothing depends on the trial server.
import {open as openMotion} from './motion.js';
import {EXPLAIN_TEXTS, TEXT_TOPICS, TEXT_LESSONS} from './explain-texts.js';
import {el} from './group-view.js';

const BACKUP_KEY = 'gl-text-library-v1';
const readBackup = () => { try { return JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]'); } catch { return []; } };
const writeBackup = list => { try { localStorage.setItem(BACKUP_KEY, JSON.stringify(list)); } catch { /* private mode: server copy only */ } };

async function api(path, body) {
  const r = await fetch(path, body ? {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)} : {});
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'تعذّر الوصول إلى المكتبة.');
  return data;
}
export async function loadMyTexts() {
  try { const list = await api('/teach/texts'); writeBackup(list); return {list, offline: false}; }
  catch { return {list: readBackup(), offline: true}; }
}
export function downloadJSON(name, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], {type: 'application/json'}));
  const a = el('a', {href: url, download: name}); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export const safeName = text => String(text || 'درس').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) || 'درس';

/**
 * Opens the picker. onUse(text) receives the (possibly edited) body.
 * Resolves when the dialog closes.
 */
export function openTextPicker({title = 'النصوص التوضيحية', useLabel = 'استخدم النص', onUse}) {
  const dialog = el('dialog', {class: 'gl-dialog tl-dialog', 'aria-label': title});
  const status = el('p', {class: 'tl-status', role: 'status'});
  const search = el('input', {type: 'search', placeholder: 'ابحث في النصوص', 'aria-label': 'بحث'});
  const list = el('div', {class: 'tl-list'});
  const editTitle = el('input', {maxlength: 60, 'aria-label': 'عنوان النص'});
  const editBody = el('textarea', {maxlength: 600, rows: 5, 'aria-label': 'النص'});
  const count = el('small', {class: 'tl-count'});
  let mine = [], selected = null;
  const say = (text, bad = false) => { status.textContent = text; status.classList.toggle('is-error', bad); };
  const updateCount = () => { count.textContent = `${editBody.value.length} / ٦٠٠`; };
  editBody.addEventListener('input', updateCount);

  function choose(item, own) {
    selected = {...item, own};
    editTitle.value = item.title; editBody.value = item.body; updateCount();
    for (const b of list.querySelectorAll('.tl-item')) b.setAttribute('aria-pressed', String(b.dataset.key === (own ? 'm:' : 'p:') + item.id));
    saveEdit.hidden = !own; remove.hidden = !own;
    editBody.focus();
  }
  function renderList() {
    const q = search.value.trim();
    const match = t => !q || t.title.includes(q) || t.body.includes(q);
    const item = (t, own) => el('button', {type: 'button', class: 'tl-item', 'data-key': (own ? 'm:' : 'p:') + t.id, 'aria-pressed': 'false', onclick: () => choose(t, own)}, el('b', {text: t.title}), el('span', {text: t.body}));
    const groups = [];
    const own = mine.filter(match);
    groups.push(el('h3', {text: 'نصوصي المحفوظة'}), own.length ? el('div', {class: 'tl-group'}, own.map(t => item(t, true))) : el('p', {class: 'tl-empty', text: 'لم تحفظ نصوصًا بعد. اختر نصًا جاهزًا وعدّله ثم «احفظ كنص جديد».'}));
    for (const [lesson, lessonName] of Object.entries(TEXT_LESSONS)) for (const [topic, name] of Object.entries(TEXT_TOPICS)) {
      const items = EXPLAIN_TEXTS.filter(t => t.lesson === lesson && t.topic === topic && match(t));
      if (items.length) groups.push(el('h3', {text: `جاهز · ${lessonName}: ${name}`}), el('div', {class: 'tl-group'}, items.map(t => item(t, false))));
    }
    list.replaceChildren(...groups);
  }
  search.addEventListener('input', renderList);

  const current = () => ({title: editTitle.value.trim(), body: editBody.value.trim()});
  const use = el('button', {type: 'button', class: 'btn', onclick: () => { const t = current(); if (!t.body) return say('اختر نصًا أو اكتب نصًا أولًا.', true); onUse(t.body, t); dialog.close(); }}, useLabel);
  const saveNew = el('button', {type: 'button', class: 'outline', onclick: async () => {
    const t = current(); if (!t.title || !t.body) return say('اكتب العنوان والنص.', true);
    try { const r = await api('/teach/texts', {...t, origin: selected && !selected.own ? selected.id : selected?.origin || null}); say('حُفظ نصًا جديدًا في مكتبتك.'); await refresh(); const saved = mine.find(m => m.id === r.id); if (saved) choose(saved, true); }
    catch (e) { say(e.message, true); }
  }}, 'احفظ كنص جديد');
  const saveEdit = el('button', {type: 'button', class: 'outline', hidden: true, onclick: async () => {
    const t = current(); try { await api('/teach/texts/' + selected.id, t); say('حُفظ التعديل.'); await refresh(); } catch (e) { say(e.message, true); }
  }}, 'حفظ التعديل على نصي');
  const remove = el('button', {type: 'button', class: 'quiet', hidden: true, onclick: async () => {
    if (!confirm('حذف هذا النص من مكتبتك؟')) return;
    try { await api('/teach/texts/' + selected.id + '/delete', {}); say('حُذف النص.'); selected = null; editTitle.value = editBody.value = ''; await refresh(); } catch (e) { say(e.message, true); }
  }}, 'حذف');
  const exportBtn = el('button', {type: 'button', class: 'quiet', onclick: () => downloadJSON('مكتبة-النصوص-التوضيحية.json', {format: 'teachabs-texts', version: 1, texts: mine.map(({title, body, origin}) => ({title, body, origin}))})}, 'تنزيل مكتبتي كملف');
  const importInput = el('input', {type: 'file', accept: '.json,application/json', hidden: true, onchange: async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data?.format !== 'teachabs-texts' || !Array.isArray(data.texts)) throw new Error('الملف ليس مكتبة نصوص.');
      let n = 0; for (const t of data.texts.slice(0, 200)) { try { await api('/teach/texts', {title: String(t.title || '').slice(0, 60), body: String(t.body || '').slice(0, 600), origin: t.origin || null}); n++; } catch { /* skip invalid */ } }
      say(`استُورد ${n} نص.`); await refresh();
    } catch (err) { say(err.message, true); }
    e.target.value = '';
  }});
  const importBtn = el('button', {type: 'button', class: 'quiet', onclick: () => importInput.click()}, 'استيراد مكتبة من ملف');

  async function refresh() { const r = await loadMyTexts(); mine = r.list; if (r.offline) say('تعذّر الوصول للخادم؛ تُعرض نسختك المحفوظة على هذا الجهاز.', true); renderList(); }

  dialog.append(
    el('div', {class: 'tl-head'}, el('h2', {text: title}), el('button', {type: 'button', class: 'quiet', 'aria-label': 'إغلاق', onclick: () => dialog.close()}, '✕')),
    el('div', {class: 'tl-body'},
      el('div', {class: 'tl-browse'}, search, list),
      el('div', {class: 'tl-edit'}, el('label', {}, 'العنوان', editTitle), el('label', {}, 'النص — عدّله كما تريد', editBody), count,
        el('div', {class: 'tl-actions'}, use, saveNew, saveEdit, remove), status,
        el('div', {class: 'tl-actions tl-files'}, exportBtn, importBtn, importInput))));
  document.body.append(dialog);
  dialog.addEventListener('close', () => dialog.remove());
  dialog.showModal(); search.focus(); openMotion(dialog);
  refresh();
  return new Promise(resolve => dialog.addEventListener('close', resolve));
}
