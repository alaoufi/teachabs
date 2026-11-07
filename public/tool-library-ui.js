// The «مكتبة الأدوات» window: filters by subject, grade and lesson; each tool can be pinned to the lesson (planner) or
// used at once (class). Shared by the planner and the teacher's class page.
import {el} from './group-view.js';
import {SUBJECTS} from './group-plan.js';
import {toolsFor, STAMPS} from './tool-library.js';
import {curriculumLessons} from './curriculum-g4.js';

const KIND = {stamp: 'على السبورة', activity: 'شرح تفاعلي', class: 'أداة فصل'};
const GRADES = ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'الأول المتوسط', 'الثاني المتوسط', 'الثالث المتوسط'];

/** A small picture of a board tool, drawn with the same drawing as on the board. */
function preview(id) {
  const st = STAMPS[id]; if (!st) return null;
  const SVG = 'http://www.w3.org/2000/svg', svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', `-6 -6 ${st.w + 12} ${st.h + 12}`); svg.setAttribute('class', 'tl-preview'); svg.setAttribute('aria-hidden', 'true');
  const g = document.createElementNS(SVG, 'g'); g.setAttribute('class', 'gl-stamp gl-stamp-' + id); svg.append(g);
  st.draw((tag, attrs, text) => { const n = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (text !== undefined) n.textContent = text; g.append(n); return n; });
  return svg;
}

/**
 * opts: {subject, grade, lesson, pinned: Set, onPin(tool, on), onUse(tool), useLabel}
 * Without onPin the cards only offer «use»; without onUse only «pin».
 */
export function openLibrary(opts) {
  const state = {subject: opts.subject || '', grade: opts.grade || '', lesson: opts.lesson || '', query: ''};
  const dlg = el('dialog', {class: 'tl-dialog', 'aria-label': 'مكتبة الأدوات'});
  const body = el('div', {class: 'tl-body'});
  const lessonSel = el('select', {'aria-label': 'الدرس', onchange: e => { state.lesson = e.target.value; draw(); }});
  const fillLessons = () => {
    const list = curriculumLessons().filter(l => !state.subject || l.subject === state.subject);
    lessonSel.replaceChildren(el('option', {value: ''}, 'كل الدروس'), ...list.map(l => el('option', {value: l.id, selected: l.id === state.lesson}, l.title)));
    lessonSel.disabled = !list.length || (state.grade && Number(state.grade) !== 4); // the lesson map covers grade 4, term 1
  };
  const head = el('div', {class: 'tl-head'},
    el('h2', {text: '🧰 مكتبة الأدوات'}),
    el('select', {'aria-label': 'المادة', onchange: e => { state.subject = e.target.value; state.lesson = ''; fillLessons(); draw(); }}, el('option', {value: ''}, 'كل المواد'), ...Object.entries(SUBJECTS).map(([k, v]) => el('option', {value: k, selected: k === state.subject}, v))),
    el('select', {'aria-label': 'الصف', onchange: e => { state.grade = e.target.value; fillLessons(); draw(); }}, el('option', {value: ''}, 'كل الصفوف'), ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(g => el('option', {value: g, selected: String(g) === String(state.grade)}, 'الصف ' + GRADES[g]))),
    lessonSel,
    el('input', {type: 'search', placeholder: 'ابحث: كسور، ساعة، مقارنة…', 'aria-label': 'بحث في الأدوات', oninput: e => { state.query = e.target.value; draw(); }}),
    el('button', {type: 'button', class: 'quiet', 'aria-label': 'إغلاق', onclick: () => dlg.close()}, '✕'));
  const card = t => {
    const on = opts.pinned?.has(t.id);
    return el('article', {class: 'tl-card' + (on ? ' is-pinned' : ''), 'data-tool': t.id},
      el('div', {class: 'tl-visual'}, preview(t.id) || el('span', {class: 'tl-icon', text: t.icon})),
      el('h3', {text: `${t.icon} ${t.title}`}), el('p', {text: t.desc}), el('small', {class: 'tl-kind', text: KIND[t.kind]}),
      el('div', {class: 'tl-actions'},
        opts.onPin ? el('button', {type: 'button', class: on ? 'outline tl-pin' : 'btn tl-pin', 'aria-pressed': String(on), onclick: () => { opts.onPin(t, !on); on ? opts.pinned.delete(t.id) : opts.pinned.add(t.id); draw(); }}, on ? '✓ مثبتة في الدرس' : '📌 ثبّت في الدرس') : null,
        opts.onUse ? el('button', {type: 'button', class: 'outline tl-use', onclick: () => { opts.onUse(t); dlg.close(); }}, opts.useLabel?.(t) || 'استخدم الآن') : null));
  };
  function draw() {
    const {forLesson, others} = toolsFor(state);
    body.replaceChildren(
      forLesson.length ? el('h3', {class: 'tl-group', text: '⭐ مقترحة لهذا الدرس'}) : null, forLesson.length ? el('div', {class: 'tl-grid'}, ...forLesson.map(card)) : null,
      el('h3', {class: 'tl-group', text: forLesson.length ? 'أدوات أخرى' : 'الأدوات'}), others.length ? el('div', {class: 'tl-grid'}, ...others.map(card)) : el('p', {class: 'gl-hint', text: 'لا توجد أدوات بهذا التصفية.'}));
  }
  fillLessons(); draw();
  dlg.append(head, body); document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();
  return dlg;
}
