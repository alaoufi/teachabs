// Registry of interactive activities used in the group lesson. Each lesson adds one entry:
// its controls (params), how to draw it, how to animate between states, the facts line and the narrated tour.
import {renderScene, lessonState, formatHour, formatNumber, MATERIALS} from './science-shadow-model.js';
import {renderMatter, matterFacts, formatTemp, TEMP_MIN, TEMP_MAX} from './matter-model.js';
import {NARRATOR_SCRIPTS} from './narrator-scripts.js';

export const ACTIVITIES = {
  shadows: {
    id: 'shadows', title: 'الضوء والظل — حركة الشمس', lesson: 'science-4-light',
    params: [
      {key: 'hour', label: 'الوقت', kind: 'range', min: 7, max: 17, step: 0.25, big: 1, format: formatHour, earlier: 'ساعة أبكر', later: 'ساعة لاحقة', segStep: 0.5},
      {key: 'height', label: 'طول اللوح', kind: 'range', min: 1, max: 2, step: 0.1, format: v => formatNumber(v) + ' م', segStep: 0.5},
      {key: 'material', label: 'المادة', kind: 'choice', options: Object.fromEntries(Object.entries(MATERIALS).map(([k, m]) => [k, `${m.name} (${m.kind})`]))}
    ],
    initial: () => ({hour: 8, height: 1.5, material: 'wood'}),
    render: (v, {hidden}) => renderScene(lessonState({...v, exact: true}), {hideShadow: hidden}),
    facts: (v, hidden) => { const s = lessonState({...v, exact: true}); return hidden ? 'الظل مخفي: توقّع أين سيكون، ثم انتظر الكشف.' : `ارتفاع الشمس ${formatNumber(s.elevation)}° · طول الظل ${formatNumber(s.length)} م`; },
    hideLabel: 'إخفاء الظل ليتوقع الطلاب', revealLabel: 'اكشف الظل', exploreKey: 'hour',
    narrator: () => structuredClone(NARRATOR_SCRIPTS.shadows.segments).map(({id, text, ...values}) => ({id, text, values}))
  },
  matter: {
    id: 'matter', title: 'حالات المادة — الماء يتجمد ويذوب ويغلي', lesson: 'science-4-matter',
    params: [
      {key: 'temp', label: 'درجة الحرارة', kind: 'range', min: TEMP_MIN, max: TEMP_MAX, step: 1, big: 10, format: formatTemp, earlier: 'برّد ١٠°', later: 'سخّن ١٠°', segStep: 5}
    ],
    initial: () => ({temp: 25}),
    render: (v, {hidden}) => renderMatter(v, {hidden}),
    facts: (v, hidden) => matterFacts(v, hidden),
    hideLabel: 'إخفاء الحالة ليتوقع الطلاب', revealLabel: 'اكشف الحالة', exploreKey: 'temp',
    narrator: () => [
      {id: 'm1', values: {temp: -10}, text: 'هذا جليد: الماء في الحالة الصلبة. جزيئاته متقاربة جدًا ومرتبة، وتهتز في مكانها فقط.'},
      {id: 'm2', values: {temp: 0}, text: 'عند صفر درجة يبدأ الجليد بالانصهار، أي يتحول من صلب إلى سائل.'},
      {id: 'm3', values: {temp: 25}, text: 'الآن ماء سائل. جزيئاته قريبة لكنها تنزلق وتتحرك، لذلك يأخذ السائل شكل الإناء.'},
      {id: 'm4', values: {temp: 100}, text: 'عند مئة درجة يغلي الماء، والفقاعات التي ترونها هي بخار ماء وليست هواء.'},
      {id: 'm5', values: {temp: 110}, text: 'صار الماء بخارًا: غاز تتباعد جزيئاته وتتحرك بسرعة وتنتشر في المكان كله.'},
      {id: 'm6', values: {temp: 50}, text: 'عندما يبرد البخار يتكاثف ويعود سائلًا، مثل القطرات التي تظهر على كأس ماء بارد.'},
      {id: 'm7', values: {temp: -10}, text: 'وإذا بردنا الماء أقل من صفر يتجمد ويصبح جليدًا من جديد. التسخين والتبريد يغيّران حالة المادة.'}
    ]
  }
};

export const activityOf = id => ACTIVITIES[id] || ACTIVITIES.shadows;

/** Validates a full or partial set of values for an activity; throws Error with an Arabic message. */
export function cleanValues(id, raw, base = activityOf(id).initial()) {
  const a = ACTIVITIES[id];
  if (!a) throw new Error('نشاط غير معروف.');
  if (!raw || typeof raw !== 'object') throw new Error('قيم غير صالحة.');
  const out = {...base};
  for (const p of a.params) {
    if (!Object.hasOwn(raw, p.key)) continue;
    const v = raw[p.key];
    if (p.kind === 'range') {
      if (!Number.isFinite(Number(v))) throw new Error(`${p.label}: قيمة غير صالحة.`);
      const snapped = Math.round(Math.min(p.max, Math.max(p.min, Number(v))) / p.step) * p.step;
      out[p.key] = Number(snapped.toFixed(3));
    } else {
      if (!Object.hasOwn(p.options, v)) throw new Error(`${p.label}: اختيار غير معروف.`);
      out[p.key] = v;
    }
  }
  return out;
}

/** Intermediate values for smooth animation; choices switch at the end. */
export function tweenValues(id, a, b, t) {
  const out = {...b};
  for (const p of activityOf(id).params) if (p.kind === 'range') out[p.key] = a[p.key] + (b[p.key] - a[p.key]) * t; else out[p.key] = t < 1 ? a[p.key] : b[p.key];
  return out;
}

export const segmentLabel = (id, values) => activityOf(id).params.filter(p => p.kind === 'range').map(p => p.format(values[p.key])).join(' · ');
