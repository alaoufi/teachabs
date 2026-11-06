// Registry of interactive activities used in the group lesson. Each lesson adds one entry:
// its controls (params), how to draw it, how to animate between states, the facts line and the narrated tour.
import {renderScene, lessonState, formatHour, formatNumber, MATERIALS} from './science-shadow-model.js';
import {renderMatter, matterFacts, formatTemp, TEMP_MIN, TEMP_MAX} from './matter-model.js';
import {NARRATOR_SCRIPTS} from './narrator-scripts.js';
import {renderCells, cellsFacts, formatLevel, KINDS, PARTS} from './cells-model.js';
import {renderPlaceValue, placeValueFacts, formatNumber as formatPV, PLACES, PV_MAX} from './placevalue-model.js';

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
  },
  cells: {
    id: 'cells', title: 'الخلايا — من المخلوق الحي إلى الخلية', lesson: 'science-4-cells',
    params: [
      {key: 'zoom', label: 'التكبير', kind: 'range', min: 1, max: 4, step: 1, big: 1, format: formatLevel, earlier: '🔍− تصغير', later: '🔍+ تكبير', quick: true},
      {key: 'kind', label: 'نوع الخلية', kind: 'choice', options: KINDS, quick: true},
      {key: 'part', label: 'الجزء المظلل', kind: 'choice', options: Object.fromEntries(Object.entries(PARTS).map(([k, p]) => [k, p.name])), quick: true}
    ],
    initial: () => ({zoom: 1, kind: 'plant', part: 'none'}),
    render: (v, {hidden}) => renderCells(v, {hidden}),
    facts: (v, hidden) => cellsFacts(v, hidden),
    hideLabel: 'إخفاء الأسماء ليتوقع الطلاب', revealLabel: 'اكشف الأسماء', exploreKey: 'zoom',
    narrator: () => [
      {id: 'c1', values: {zoom: 1, kind: 'plant', part: 'none'}, text: 'هذا نبات، مخلوق حي. هل تعرفون مِمَّ يتكوّن؟ سنكبّر لنرى.'},
      {id: 'c2', values: {zoom: 2, kind: 'plant', part: 'none'}, text: 'كبّرنا ورقة النبات. الورقة عضو، والعضو يتكون من أنسجة.'},
      {id: 'c3', values: {zoom: 3, kind: 'plant', part: 'none'}, text: 'تحت المجهر نرى نسيج الورقة: خلايا كثيرة متشابهة متلاصقة تعمل معًا.'},
      {id: 'c4', values: {zoom: 4, kind: 'plant', part: 'none'}, text: 'وهذه خلية نباتية واحدة. الخلية أصغر وحدة في بناء المخلوق الحي.'},
      {id: 'c5', values: {zoom: 4, kind: 'plant', part: 'nucleus'}, text: 'النواة تتحكم في أنشطة الخلية، وفيها المادة الوراثية.'},
      {id: 'c6', values: {zoom: 4, kind: 'plant', part: 'chloroplast'}, text: 'البلاستيدات الخضراء فيها الكلوروفيل، يصنع بها النبات غذاءه بضوء الشمس.'},
      {id: 'c7', values: {zoom: 4, kind: 'plant', part: 'wall'}, text: 'جدار الخلية غلاف صلب يدعم الخلية النباتية ويحميها.'},
      {id: 'c8', values: {zoom: 4, kind: 'animal', part: 'none'}, text: 'وهذه خلية حيوانية. قارنوا: ليس لها جدار خلية ولا بلاستيدات خضراء، وفجواتها صغيرة.'},
      {id: 'c9', values: {zoom: 1, kind: 'animal', part: 'none'}, text: 'وجسم الإنسان كذلك: خلايا تكوّن أنسجة، والأنسجة أعضاء، والأعضاء أجهزة حيوية.'}
    ]
  },
  placevalue: {
    id: 'placevalue', title: 'القيمة المنزلية ضمن مئات الألوف', lesson: 'math-4-placevalue',
    params: [
      {key: 'number', label: 'العدد', kind: 'range', min: 0, max: PV_MAX, step: 1, tween: false, format: formatPV, quick: true,
        big: v => PLACES[v.place]?.unit || 1, earlier: v => `− ${formatPV(PLACES[v.place]?.unit || 1)}`, later: v => `+ ${formatPV(PLACES[v.place]?.unit || 1)}`},
      {key: 'place', label: 'المنزلة', kind: 'choice', options: Object.fromEntries(Object.entries(PLACES).map(([k, p]) => [k, p.name])), quick: true}
    ],
    initial: () => ({number: 345678, place: 'tenThousands'}),
    render: (v, {hidden}) => renderPlaceValue(v, {hidden}),
    facts: (v, hidden) => placeValueFacts(v, hidden),
    hideLabel: 'إخفاء القيمة ليحسبها الطلاب', revealLabel: 'اكشف القيمة', exploreKey: 'number',
    narrator: () => [
      {id: 'p1', values: {number: 7, place: 'ones'}, text: 'نبدأ بعدد صغير: الرقم سبعة في منزلة الآحاد، وقيمته سبعة.'},
      {id: 'p2', values: {number: 70, place: 'tens'}, text: 'إذا انتقل الرقم سبعة إلى منزلة العشرات صارت قيمته سبعين. المنزلة هي التي تحدد قيمة الرقم.'},
      {id: 'p3', values: {number: 700, place: 'hundreds'}, text: 'وفي منزلة المئات قيمته سبعمئة.'},
      {id: 'p4', values: {number: 7000, place: 'thousands'}, text: 'وفي منزلة آحاد الألوف قيمته سبعة آلاف. كل منزلة قيمتها عشرة أمثال المنزلة التي على يمينها.'},
      {id: 'p5', values: {number: 345678, place: 'tenThousands'}, text: 'هذا العدد ثلاثمئة وخمسة وأربعون ألفًا وستمئة وثمانية وسبعون. الرقم أربعة في منزلة عشرات الألوف، فقيمته أربعون ألفًا.'},
      {id: 'p6', values: {number: 345678, place: 'hundredThousands'}, text: 'والرقم ثلاثة في منزلة مئات الألوف، فقيمته ثلاثمئة ألف. الصيغة التحليلية تكتب العدد مجموعًا لقيم أرقامه.'},
      {id: 'p7', values: {number: 305070, place: 'thousands'}, text: 'انتبهوا للصفر: يحفظ المنزلة الفارغة. في هذا العدد قيمة الرقم خمسة في منزلة آحاد الألوف خمسة آلاف، والأصفار تحفظ بقية المنازل.'}
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
  for (const p of activityOf(id).params) if (p.kind === 'range' && p.tween !== false) out[p.key] = a[p.key] + (b[p.key] - a[p.key]) * t; else out[p.key] = t < 1 ? a[p.key] : b[p.key];
  return out;
}

export const segmentLabel = (id, values) => activityOf(id).params.filter(p => p.kind === 'range').map(p => p.format(values[p.key])).join(' · ');

/** A control's step and button labels may depend on the other values (e.g. +١٠٠٠ when «آحاد الألوف» is chosen). */
export const bigOf = (p, v) => typeof p.big === 'function' ? p.big(v) : p.big;
export const textOf = (x, v, fallback = '') => (typeof x === 'function' ? x(v) : x) || fallback;
/** Controls shown in the quick bar above the board: those marked `quick`, else the first stepped range. */
export const quickParams = a => { const marked = a.params.filter(p => p.quick); return marked.length ? marked : a.params.filter(p => p.kind === 'range' && p.big).slice(0, 1); };
