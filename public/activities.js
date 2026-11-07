// Registry of interactive activities used in the group lesson. Each lesson adds one entry:
// its controls (params), how to draw it, how to animate between states, the facts line and the narrated tour.
import {renderScene, lessonState, formatHour, formatNumber, MATERIALS} from './science-shadow-model.js';
import {renderMatter, matterFacts, formatTemp, TEMP_MIN, TEMP_MAX} from './matter-model.js';
import {NARRATOR_SCRIPTS} from './narrator-scripts.js';
import {renderCells, cellsFacts, formatLevel, KINDS, PARTS} from './cells-model.js';
import {renderDigestive, digestiveFacts, DIGEST_PARTS, DIGEST_STAGES, renderUrinary, urinaryFacts, URINE_PARTS, URINE_STAGES, renderNervous, nervousFacts, NERVE_PARTS, formatNerveLevel} from './body-models.js';
import {renderSolid, solidFacts, SOLIDS, MARKS, formatUnfold} from './solids-model.js';
import {EXPLAINERS} from './explain-registry.js';
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
  },
  digestive: {
    id: 'digestive', title: 'الجهاز الهضمي — رحلة اللقمة', lesson: 'science-body-digestive',
    params: [
      {key: 'stage', label: 'المرحلة', kind: 'range', min: 1, max: 6, step: 1, big: 1, format: v => DIGEST_STAGES[Math.round(v) - 1], earlier: '◀ المرحلة السابقة', later: 'المرحلة التالية ▶', quick: true},
      {key: 'part', label: 'العضو المظلل', kind: 'choice', options: Object.fromEntries(Object.entries(DIGEST_PARTS).map(([k, p]) => [k, p.name])), quick: true}
    ],
    initial: () => ({stage: 1, part: 'none'}),
    render: (v, {hidden}) => renderDigestive(v, {hidden}),
    facts: (v, hidden) => digestiveFacts(v, hidden),
    hideLabel: 'إخفاء الأسماء ليتوقع الطلاب', revealLabel: 'اكشف الأسماء', exploreKey: 'stage',
    narrator: () => [
      {id: 'd1', values: {stage: 1, part: 'mouth'}, text: 'تبدأ رحلة الطعام في الفم: الأسنان تقطع اللقمة وتطحنها، واللعاب يبلّلها ويبدأ هضمها.'},
      {id: 'd2', values: {stage: 2, part: 'esophagus'}, text: 'نبلع اللقمة فتنزل في المريء، وهو أنبوب عضلي يدفعها إلى المعدة بانقباضات متتالية.'},
      {id: 'd3', values: {stage: 3, part: 'stomach'}, text: 'في المعدة يُخلط الطعام بالعصارة الهاضمة ساعات حتى يصير كالعصيدة.'},
      {id: 'd4', values: {stage: 4, part: 'smallint'}, text: 'ثم ينتقل إلى الأمعاء الدقيقة، وهي أطول جزء في القناة الهضمية. هنا يكتمل الهضم، ويُمتص الغذاء إلى الدم.'},
      {id: 'd5', values: {stage: 4, part: 'liver'}, text: 'الكبد والبنكرياس لا يمر فيهما الطعام، لكنهما يرسلان عصارات تساعد الأمعاء الدقيقة على الهضم.'},
      {id: 'd6', values: {stage: 5, part: 'largeint'}, text: 'ما تبقى ينتقل إلى الأمعاء الغليظة، فتمتص منه الماء وتتكوّن الفضلات.'},
      {id: 'd7', values: {stage: 6, part: 'rectum'}, text: 'تُخزَّن الفضلات في المستقيم حتى تخرج من الجسم. والآن: من يعيد ترتيب الرحلة من الفم إلى المستقيم؟'}
    ]
  },
  urinary: {
    id: 'urinary', title: 'الجهاز البولي — من الدم إلى الخارج', lesson: 'science-body-urinary',
    params: [
      {key: 'stage', label: 'المرحلة', kind: 'range', min: 1, max: 5, step: 1, big: 1, format: v => URINE_STAGES[Math.round(v) - 1], earlier: '◀ المرحلة السابقة', later: 'المرحلة التالية ▶', quick: true},
      {key: 'part', label: 'العضو المظلل', kind: 'choice', options: Object.fromEntries(Object.entries(URINE_PARTS).map(([k, p]) => [k, p.name])), quick: true}
    ],
    initial: () => ({stage: 1, part: 'none'}),
    render: (v, {hidden}) => renderUrinary(v, {hidden}),
    facts: (v, hidden) => urinaryFacts(v, hidden),
    hideLabel: 'إخفاء الأسماء ليتوقع الطلاب', revealLabel: 'اكشف الأسماء', exploreKey: 'stage',
    narrator: () => [
      {id: 'u1', values: {stage: 1, part: 'vessels'}, text: 'الدم يجمع الفضلات من خلايا الجسم، ويحملها الشريان إلى الكليتين.'},
      {id: 'u2', values: {stage: 2, part: 'kidney'}, text: 'الكليتان تنقّيان الدم من الفضلات والماء الزائد، فيتكوّن البول، ويعود الدم نظيفًا في الوريد.'},
      {id: 'u3', values: {stage: 3, part: 'ureter'}, text: 'ينزل البول في الحالبين، وهما أنبوبان رفيعان، إلى المثانة.'},
      {id: 'u4', values: {stage: 4, part: 'bladder'}, text: 'المثانة كيس عضلي مرن يخزّن البول ويتمدد كلما امتلأ.'},
      {id: 'u5', values: {stage: 5, part: 'urethra'}, text: 'وعندما تمتلئ يخرج البول عبر قناة مجرى البول. لنحافظ على الكليتين: نشرب الماء الكافي ولا نؤخر قضاء الحاجة.'}
    ]
  },
  nervous: {
    id: 'nervous', title: 'الجهاز العصبي — من الجسم إلى الدماغ والخلية العصبية', lesson: 'science-body-nervous',
    params: [
      {key: 'level', label: 'التكبير', kind: 'range', min: 1, max: 3, step: 1, big: 1, format: formatNerveLevel, earlier: '🔍− تصغير', later: '🔍+ تكبير', quick: true},
      {key: 'part', label: 'الجزء المظلل', kind: 'choice', options: Object.fromEntries(Object.entries(NERVE_PARTS).map(([k, p]) => [k, p.name])), quick: true}
    ],
    initial: () => ({level: 1, part: 'none'}),
    render: (v, {hidden}) => renderNervous(v, {hidden}),
    facts: (v, hidden) => nervousFacts(v, hidden),
    hideLabel: 'إخفاء الأسماء ليتوقع الطلاب', revealLabel: 'اكشف الأسماء', exploreKey: 'level',
    narrator: () => [
      {id: 'n1', values: {level: 1, part: 'brain'}, text: 'الجهاز العصبي يتحكم في كل ما نفعله. مركزه الدماغ، يحميه عظم الجمجمة.'},
      {id: 'n2', values: {level: 1, part: 'spinal'}, text: 'من الدماغ ينزل الحبل الشوكي داخل العمود الفقري، ينقل الرسائل بين الدماغ والجسم.'},
      {id: 'n3', values: {level: 1, part: 'nerves'}, text: 'والأعصاب تتفرع إلى كل الجسم: تحمل الإحساس إلى الدماغ، وتحمل أوامر الحركة إلى العضلات.'},
      {id: 'n4', values: {level: 2, part: 'frontal'}, text: 'نكبّر الدماغ. في المقدمة الفص الجبهي: به نفكر ونقرر ونتكلم ونحرك عضلاتنا.'},
      {id: 'n5', values: {level: 2, part: 'occipital'}, text: 'وفي الخلف الفص القذالي: يفسّر ما تراه العين، فالرؤية تتم في الدماغ.'},
      {id: 'n6', values: {level: 2, part: 'cerebellum'}, text: 'والمخيخ تحته يحفظ توازننا وينسّق حركتنا، وجذع الدماغ يتحكم في التنفس ونبض القلب.'},
      {id: 'n7', values: {level: 3, part: 'neuron'}, text: 'والجهاز العصبي مبني من خلايا عصبية: تستقبل الإشارة بزوائدها، وتنقلها بسرعة كبيرة عبر محورها الطويل.'}
    ]
  },
  solids: {
    id: 'solids', title: 'المجسمات وشبكاتها', lesson: 'math-solids',
    params: [
      {key: 'unfold', label: 'فتح المجسم', kind: 'range', min: 0, max: 1, step: 0.25, big: 1, format: formatUnfold, earlier: '📦 أغلق', later: '🗺 افتح الشبكة', quick: true},
      {key: 'shape', label: 'المجسم', kind: 'choice', options: Object.fromEntries(Object.entries(SOLIDS).map(([k, s]) => [k, s.name])), quick: true},
      {key: 'mark', label: 'عُدّ', kind: 'choice', options: MARKS, quick: true}
    ],
    initial: () => ({unfold: 0, shape: 'cube', mark: 'none'}),
    render: (v, {hidden}) => renderSolid(v, {hidden}),
    facts: (v, hidden) => solidFacts(v, hidden),
    hideLabel: 'إخفاء العدد ليعدّ الطلاب', revealLabel: 'اكشف العدد', exploreKey: 'unfold',
    narrator: () => [
      {id: 's1', values: {unfold: 0, shape: 'cube', mark: 'faces'}, text: 'هذا مكعب. له ستة أوجه مربعة متطابقة. عدّوها معي.'},
      {id: 's2', values: {unfold: 0, shape: 'cube', mark: 'edges'}, text: 'الحرف هو الخط الذي يلتقي فيه وجهان. للمكعب اثنا عشر حرفًا.'},
      {id: 's3', values: {unfold: 0, shape: 'cube', mark: 'vertices'}, text: 'والرأس نقطة تلتقي فيها الأحرف. للمكعب ثمانية رؤوس.'},
      {id: 's4', values: {unfold: 1, shape: 'cube', mark: 'none'}, text: 'لنفتح المكعب ونفرده على السطح. هذه شبكة المكعب: ستة مربعات متصلة، إذا طويناها عاد مكعبًا.'},
      {id: 's5', values: {unfold: 1, shape: 'pyramid', mark: 'none'}, text: 'وهذه شبكة الهرم الرباعي: قاعدة مربعة وأربعة مثلثات.'},
      {id: 's6', values: {unfold: 1, shape: 'cylinder', mark: 'none'}, text: 'والأسطوانة: سطحها المنحني يُفرد مستطيلًا، ومعه دائرتان.'},
      {id: 's7', values: {unfold: 1, shape: 'cone', mark: 'none'}, text: 'والمخروط: سطحه المنحني يُفرد قطاعًا من دائرة، ومعه قاعدة دائرية.'}
    ]
  }
};

Object.assign(ACTIVITIES, EXPLAINERS); // stage 060: elementary and intermediate science and mathematics

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
