// Original interactive models of human body systems for the board: the digestive system (food travels the tract),
// the urinary system (a drop goes from the blood to the outside) and the nervous system (body → brain lobes → neuron).
// Drawings and wording are the project's own simplified school diagrams, not copied from a book; facts are checked
// against public health references (NIDDK digestive and urinary pages, NINDS brain basics).
import {ar, clamp, esc, layer, along, tags, organ, stageChips, scene} from './model-kit.js';

// The figure is drawn in design space (y 8–266) and placed between the stage chips and the caption.
const FIG = 'translate(300 31) scale(0.95) translate(-300 -8)';
const fit = anchors => Object.fromEntries(Object.entries(anchors).map(([k, [x, y, s]]) => [k, [+(300 + (x - 300) * 0.95).toFixed(1), +(31 + (y - 8) * 0.95).toFixed(1), s]]));
const torso = (fill = '#fbe6d8', line = '#d9a98f') => `<ellipse cx="300" cy="34" rx="23" ry="27" fill="${fill}" stroke="${line}" stroke-width="2"/><rect x="290" y="58" width="20" height="16" fill="${fill}"/>
<path d="M232 94 Q236 74 264 72 L336 72 Q364 74 368 94 L372 210 Q372 262 300 266 Q228 262 228 210 Z" fill="${fill}" stroke="${line}" stroke-width="2"/>
<path d="M232 96 Q214 150 212 196 M368 96 Q386 150 388 196" stroke="${line}" stroke-width="2" fill="none" opacity=".7"/>`;

// ---------------------------------------------------------------- digestive system
export const DIGEST_STAGES = ['الفم', 'المريء', 'المعدة', 'الأمعاء الدقيقة', 'الأمعاء الغليظة', 'المستقيم'];
export const DIGEST_PARTS = {
  none: {name: 'كل الأعضاء'},
  mouth: {name: 'الفم', about: 'تقطع الأسنان الطعام وتطحنه، ويبلّله اللعاب ويبدأ هضمه.'},
  esophagus: {name: 'المريء', about: 'أنبوب عضلي يدفع الطعام إلى المعدة بانقباضات متتالية.'},
  stomach: {name: 'المعدة', about: 'كيس عضلي يخلط الطعام بالعصارة الهاضمة حتى يصير كالعصيدة.'},
  liver: {name: 'الكبد', about: 'يفرز العصارة الصفراء (تُخزَّن في المرارة) لتساعد على هضم الدهون.'},
  pancreas: {name: 'البنكرياس', about: 'يفرز عصارة هاضمة تصبّ في الأمعاء الدقيقة.'},
  smallint: {name: 'الأمعاء الدقيقة', about: 'أنبوب طويل يكتمل فيه الهضم، ويُمتص الغذاء المهضوم منه إلى الدم.'},
  largeint: {name: 'الأمعاء الغليظة', about: 'تمتص الماء من بقايا الطعام فتتكوّن الفضلات.'},
  rectum: {name: 'المستقيم', about: 'تُخزَّن فيه الفضلات حتى تخرج من الجسم عبر فتحة الشرج.'}
};
const STAGE_TEXT = ['المضغ: الأسنان تقطع الطعام واللعاب يبلّله', 'البلع: المريء يدفع اللقمة إلى المعدة', 'المعدة تخلط الطعام بالعصارة الهاضمة', 'الأمعاء الدقيقة: يكتمل الهضم ويُمتص الغذاء إلى الدم', 'الأمعاء الغليظة تمتص الماء', 'المستقيم يخزّن الفضلات حتى تخرج'];
const FOOD = [[300, 46], [300, 60], [300, 95], [302, 112], [318, 124], [336, 140], [326, 160], [304, 186], [318, 198], [282, 210], [300, 222], [300, 238], [264, 242], [258, 196], [300, 182], [344, 200], [344, 238], [322, 248], [302, 258]];
const FOOD_STOPS = [0, 2, 5, 9, 14, 18];

export function renderDigestive(values, {hidden = false} = {}) {
  const part = DIGEST_PARTS[values.part] ? values.part : 'none', stage = clamp(Number(values.stage ?? 1), 1, 6);
  const [fx, fy] = along(FOOD, FOOD_STOPS, stage), absorb = clamp(1 - Math.abs(stage - 4) * 1.6, 0, 1), water = clamp(1 - Math.abs(stage - 5) * 1.6, 0, 1);
  const body = torso() +
    organ('mouth', part, `<path d="M288 44 Q300 56 312 44 Q300 50 288 44Z" fill="#c4504f"/><path d="M291 45 L309 45" stroke="#fff" stroke-width="2"/>`) +
    organ('esophagus', part, `<path d="M300 54 L300 108 Q300 118 318 124" stroke="#d98a6a" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M300 56 L300 108 Q300 116 316 122" stroke="#f3b79c" stroke-width="4" fill="none" stroke-linecap="round"/>`) +
    organ('liver', part, `<path d="M244 114 Q258 98 300 102 Q324 104 328 114 Q318 128 296 136 Q270 148 250 142 Q236 130 244 114Z" fill="#9c4a3a" stroke="#6e2f24" stroke-width="1.5"/><ellipse cx="292" cy="142" rx="6" ry="8" fill="#6aa84f" stroke="#3f7a2e"/>`) +
    organ('stomach', part, `<path d="M316 118 Q338 106 354 120 Q364 140 352 160 Q340 174 318 170 Q304 168 300 160 Q314 162 324 156 Q334 146 330 134 Q326 126 316 124Z" fill="#e88a8a" stroke="#b55454" stroke-width="1.5"/><path d="M326 126 Q344 132 346 152" stroke="#c96a6a" stroke-width="1.2" fill="none"/>`) +
    organ('pancreas', part, `<path d="M290 174 Q318 164 350 168 Q356 174 346 179 Q318 180 292 182 Q284 178 290 174Z" fill="#f0c36d" stroke="#c2953a" stroke-width="1.3"/>`) +
    organ('largeint', part, `<path d="M264 246 L258 198 Q258 184 272 184 L330 184 Q344 184 344 198 L344 232 Q344 248 324 248 Q306 248 302 256" stroke="#b9845a" stroke-width="15" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M264 246 L258 198 Q258 184 272 184 L330 184 Q344 184 344 198 L344 232 Q344 248 324 248 Q306 248 302 256" stroke="#d9a77a" stroke-width="9" fill="none" stroke-dasharray="7 3" stroke-linecap="round"/>`) +
    organ('smallint', part, `<path d="M304 188 Q332 190 328 200 Q324 208 280 204 Q268 212 280 216 Q328 214 330 224 Q328 236 282 232 Q270 240 290 242 Q312 244 318 240" stroke="#e98f88" stroke-width="9" fill="none" stroke-linejoin="round" stroke-linecap="round"/><path d="M304 188 Q332 190 328 200 Q324 208 280 204 Q268 212 280 216 Q328 214 330 224 Q328 236 282 232 Q270 240 290 242 Q312 244 318 240" stroke="#f7c1bb" stroke-width="3" fill="none"/>`) +
    organ('rectum', part, `<path d="M302 254 L300 266" stroke="#9c6a42" stroke-width="9" stroke-linecap="round"/>`) +
    (absorb > 0 ? `<g opacity="${absorb.toFixed(2)}" class="dg-absorb">${[[272, 198], [336, 206], [268, 226], [338, 230], [300, 248]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#d63a3a"/>`).join('')}</g>` : '') +
    (water > 0 ? `<g opacity="${water.toFixed(2)}">${[[250, 200], [352, 214], [300, 172]].map(([x, y]) => `<path d="M${x} ${y - 5} q4 6 0 9 q-4 -3 0 -9Z" fill="#4a90d9"/>`).join('')}</g>` : '') +
    `<circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="${stage < 3 ? 7 : 5.5}" fill="${stage < 2.6 ? '#8a5a2b' : stage < 4.6 ? '#c9a046' : '#6b4a2a'}" stroke="#fff" stroke-width="2" class="dg-food"/>`;
  const anchors = fit({mouth: [292, 48, 'L'], esophagus: [300, 90, 'L'], liver: [262, 120, 'L'], largeint: [258, 214, 'L'], rectum: [301, 260, 'L'], stomach: [346, 140, 'R'], pancreas: [342, 174, 'R'], smallint: [326, 222, 'R']});
  const names = Object.fromEntries(Object.entries(DIGEST_PARTS).map(([k, p]) => [k, p.name]));
  const caption = hidden ? 'توقّع: ما اسم كل عضو؟ وأين تذهب اللقمة بعد ذلك؟' : STAGE_TEXT[Math.round(stage) - 1];
  return scene('body-scene digest-scene', `الجهاز الهضمي — ${DIGEST_STAGES[Math.round(stage) - 1]}. ${caption}`,
    `${stageChips(DIGEST_STAGES, stage)}<g transform="${FIG}">${body}</g>${tags(anchors, names, part, hidden, {top: 44, bottom: 262})}`, caption);
}
export function digestiveFacts(values, hidden) {
  const part = DIGEST_PARTS[values.part] ? values.part : 'none', stage = Math.round(clamp(Number(values.stage ?? 1), 1, 6));
  if (hidden) return 'الأسماء مخفية: سمِّ كل عضو، ثم انتظر الكشف.';
  if (part !== 'none') return `${DIGEST_PARTS[part].name} · ${DIGEST_PARTS[part].about}`;
  return `${ar.format(stage)} من ٦ · ${STAGE_TEXT[stage - 1]}. الكبد والبنكرياس يساعدان الهضم ولا يمر الطعام فيهما.`;
}

// ---------------------------------------------------------------- urinary system
export const URINE_STAGES = ['الدم', 'الكليتان', 'الحالبان', 'المثانة', 'الخروج'];
export const URINE_PARTS = {
  none: {name: 'كل الأعضاء'},
  vessels: {name: 'الأوعية الدموية', about: 'الشريان يحمل الدم وفيه الفضلات إلى الكليتين، والوريد يعيد الدم نظيفًا.'},
  kidney: {name: 'الكليتان', about: 'تنقّيان الدم من الفضلات والماء الزائد فيتكوّن البول. في كل كلية نحو مليون وحدة تنقية دقيقة.'},
  ureter: {name: 'الحالبان', about: 'أنبوبان رفيعان ينقلان البول من الكليتين إلى المثانة.'},
  bladder: {name: 'المثانة', about: 'كيس عضلي مرن يخزّن البول حتى يحين وقت إخراجه.'},
  urethra: {name: 'قناة مجرى البول', about: 'تخرج البول من المثانة إلى خارج الجسم.'}
};
const URINE_TEXT = ['الدم يحمل الفضلات إلى الكليتين', 'الكليتان تنقّيان الدم ويتكوّن البول', 'الحالبان ينقلان البول إلى المثانة', 'المثانة تخزّن البول', 'يخرج البول عبر قناة مجرى البول'];
const DROP = [[296, 96], [296, 138], [284, 140], [266, 140], [270, 152], [276, 190], [290, 224], [300, 234], [300, 252], [300, 266]];
const DROP_STOPS = [0, 3, 5, 7, 9];
const kidney = flip => { const m = x => flip ? 600 - x : x; return `<path d="M${m(262)} 112 Q${m(244)} 114 ${m(242)} 138 Q${m(242)} 164 ${m(262)} 168 Q${m(276)} 166 ${m(274)} 152 Q${m(266)} 146 ${m(268)} 140 Q${m(266)} 132 ${m(274)} 126 Q${m(276)} 114 ${m(262)} 112Z" fill="#a8423f" stroke="#6f2523" stroke-width="1.5"/><path d="M${m(256)} 124 Q${m(250)} 140 ${m(256)} 156" stroke="#d9837f" stroke-width="2" fill="none"/>`; };

export function renderUrinary(values, {hidden = false} = {}) {
  const part = URINE_PARTS[values.part] ? values.part : 'none', stage = clamp(Number(values.stage ?? 1), 1, 5);
  const [dx, dy] = along(DROP, DROP_STOPS, stage), urine = stage >= 2.4;
  const body = torso() +
    organ('vessels', part, `<path d="M296 80 L296 236" stroke="#d64545" stroke-width="7" stroke-linecap="round"/><path d="M306 80 L306 236" stroke="#4a6fd6" stroke-width="7" stroke-linecap="round"/>
<path d="M296 136 L272 140 M296 136 L328 140" stroke="#d64545" stroke-width="4"/><path d="M306 146 L272 148 M306 146 L330 148" stroke="#4a6fd6" stroke-width="4"/>`) +
    organ('kidney', part, kidney(false) + kidney(true)) +
    organ('ureter', part, `<path d="M270 152 Q272 196 290 224 M330 152 Q328 196 310 224" stroke="#e2bd4f" stroke-width="4.5" fill="none" stroke-linecap="round"/>`) +
    organ('bladder', part, `<path d="M282 222 Q300 210 318 222 Q328 246 300 252 Q272 246 282 222Z" fill="#f3d77a" stroke="#c9a43a" stroke-width="1.6"/>`) +
    organ('urethra', part, `<path d="M300 251 L300 268" stroke="#e2bd4f" stroke-width="4.5" stroke-linecap="round"/>`) +
    `<path d="M${dx.toFixed(1)} ${(dy - 8).toFixed(1)} q6 8 0 12 q-6 -4 0 -12Z" fill="${urine ? '#e8b923' : '#c62828'}" stroke="#fff" stroke-width="1.6" class="ur-drop"/>`;
  const anchors = fit({kidney: [252, 140, 'L'], bladder: [284, 238, 'L'], vessels: [306, 100, 'R'], ureter: [326, 186, 'R'], urethra: [300, 262, 'R']});
  const names = Object.fromEntries(Object.entries(URINE_PARTS).map(([k, p]) => [k, p.name]));
  const caption = hidden ? 'توقّع: ما اسم كل عضو؟ وما عمله؟' : URINE_TEXT[Math.round(stage) - 1];
  return scene('body-scene urine-scene', `الجهاز البولي — ${URINE_STAGES[Math.round(stage) - 1]}. ${caption}`,
    `${stageChips(URINE_STAGES, stage)}<g transform="${FIG}">${body}</g>${tags(anchors, names, part, hidden, {top: 60, bottom: 250})}`, caption);
}
export function urinaryFacts(values, hidden) {
  const part = URINE_PARTS[values.part] ? values.part : 'none', stage = Math.round(clamp(Number(values.stage ?? 1), 1, 5));
  if (hidden) return 'الأسماء مخفية: سمِّ كل عضو، ثم انتظر الكشف.';
  if (part !== 'none') return `${URINE_PARTS[part].name} · ${URINE_PARTS[part].about}`;
  return `${ar.format(stage)} من ٥ · ${URINE_TEXT[stage - 1]}. شرب الماء الكافي يساعد الكليتين على عملهما.`;
}

// ---------------------------------------------------------------- nervous system and brain
export const NERVE_LEVELS = ['', 'الجهاز العصبي', 'الدماغ وفصوصه', 'الخلية العصبية'];
export const formatNerveLevel = z => NERVE_LEVELS[Math.min(3, Math.max(1, Math.round(z)))];
export const NERVE_PARTS = {
  none: {name: 'كل الأجزاء'},
  brain: {name: 'الدماغ', level: 1, about: 'مركز التحكم في الجسم: يستقبل الرسائل ويفسّرها ويرسل الأوامر.'},
  spinal: {name: 'الحبل الشوكي', level: 1, about: 'ينقل الرسائل بين الدماغ والجسم، ويتحكم في الأفعال المنعكسة السريعة.'},
  nerves: {name: 'الأعصاب', level: 1, about: 'ألياف تنقل الإشارات من أعضاء الحس إلى الدماغ، ومن الدماغ إلى العضلات.'},
  frontal: {name: 'الفص الجبهي', level: 2, about: 'التفكير واتخاذ القرار والكلام، والحركة الإرادية.'},
  parietal: {name: 'الفص الجداري', level: 2, about: 'الإحساس باللمس والحرارة والألم.'},
  temporal: {name: 'الفص الصدغي', level: 2, about: 'السمع والذاكرة وفهم الكلام.'},
  occipital: {name: 'الفص القذالي', level: 2, about: 'الإبصار: يفسّر ما تراه العين.'},
  cerebellum: {name: 'المخيخ', level: 2, about: 'يحفظ التوازن وينسّق حركة العضلات.'},
  brainstem: {name: 'جذع الدماغ', level: 2, about: 'يتحكم في التنفس ونبض القلب دون أن نفكر فيهما.'},
  neuron: {name: 'الخلية العصبية', level: 3, about: 'وحدة بناء الجهاز العصبي: تستقبل الإشارة بزوائدها وتنقلها عبر محورها.'}
};

function nervousBody(part, hidden) {
  const skin = '#fbe6d8', nerve = '#e9b62f';
  const body = `<g transform="translate(300 150) scale(0.95) translate(-300 -150)"><circle cx="300" cy="50" r="27" fill="${skin}" stroke="#d9a98f" stroke-width="2"/>
<path d="M264 80 L336 80 L332 172 L268 172Z" fill="${skin}" stroke="#d9a98f" stroke-width="2"/>
<path d="M266 84 L226 168 M334 84 L374 168" stroke="${skin}" stroke-width="15" stroke-linecap="round"/><path d="M286 172 L280 268 M314 172 L320 268" stroke="${skin}" stroke-width="18" stroke-linecap="round"/>
${organ('brain', part, `<path d="M280 46 Q280 26 300 26 Q322 26 322 46 Q322 58 300 58 Q280 58 280 46Z" fill="#f2a7b8" stroke="#c46a82" stroke-width="1.5"/><path d="M288 36 q6 6 0 12 M300 30 q6 8 0 16 M312 36 q-6 6 0 12" stroke="#c46a82" stroke-width="1" fill="none"/>`)}
${organ('spinal', part, `<path d="M300 58 L300 168" stroke="${nerve}" stroke-width="6" stroke-linecap="round"/>`)}
${organ('nerves', part, `<path d="M300 86 L268 92 L228 166 M300 86 L332 92 L372 166 M300 120 L272 126 M300 120 L328 126 M300 150 L276 156 M300 150 L324 156 M300 166 L284 180 L280 264 M300 166 L316 180 L320 264 M248 130 l-8 4 M352 130 l8 4 M282 220 l-8 2 M318 220 l8 2" stroke="${nerve}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`)}</g>`;
  return body + tags({brain: [282, 46, 'L'], nerves: [240, 132, 'L'], spinal: [300, 120, 'R']}, {brain: 'الدماغ', nerves: 'الأعصاب', spinal: 'الحبل الشوكي'}, part, hidden, {top: 60, bottom: 220});
}

function brainSide(part, hidden) {
  const cerebrum = 'M188 150 Q176 78 250 52 Q322 28 392 68 Q444 100 432 160 Q426 192 396 196 L360 196 Q330 214 290 206 Q240 214 206 196 Q186 180 188 150Z';
  const lobe = (id, pts, fill) => organ(id, part, `<polygon points="${pts}" fill="${fill}" clip-path="url(#nv-cerebrum)"/>`);
  return `<defs><clipPath id="nv-cerebrum"><path d="${cerebrum}"/></clipPath></defs>
${organ('brainstem', part, `<path d="M296 198 L330 198 Q338 232 328 278 L306 278 Q312 236 296 198Z" fill="#e8c39e" stroke="#b08860" stroke-width="1.5"/>`)}
${organ('cerebellum', part, `<path d="M348 200 Q360 184 400 188 Q442 192 434 226 Q422 250 386 248 Q352 242 348 222Z" fill="#c27ba0" stroke="#8a4a6e" stroke-width="1.5"/><path d="M358 206 Q396 196 428 208 M354 218 Q394 208 432 222 M360 232 Q394 224 424 236" stroke="#8a4a6e" stroke-width="1" fill="none"/>`)}
${lobe('frontal', '120,10 296,10 266,128 214,152 120,240', '#f6b26b')}${lobe('parietal', '296,10 400,10 392,40 400,158 346,140 266,128', '#8fc57a')}${lobe('occipital', '400,10 480,10 480,250 400,250 400,158 392,40', '#6fa8dc')}${lobe('temporal', '214,152 266,128 346,140 400,158 400,250 120,250', '#e7d36a')}
<path d="${cerebrum}" fill="none" stroke="#7d5a4a" stroke-width="2"/>
<g clip-path="url(#nv-cerebrum)" stroke="#fff" stroke-width="1.6" fill="none" opacity=".55"><path d="M210 110 q20 -18 40 0 t40 0 M230 80 q20 -16 40 0 t40 0 t40 0 M220 175 q24 -14 48 0 t48 0 M330 100 q16 -14 32 0 t32 0 M250 145 q14 -10 28 0"/></g>
<path d="M296 10 L266 128 M214 152 Q280 124 346 140 Q378 148 400 158 M392 40 L400 158" stroke="#5d4037" stroke-width="2.2" fill="none" stroke-dasharray="1 0"/>` +
    tags({frontal: [222, 96, 'L'], temporal: [282, 182, 'L'], brainstem: [314, 254, 'L'], parietal: [334, 70, 'R'], occipital: [420, 120, 'R'], cerebellum: [404, 222, 'R']},
      Object.fromEntries(Object.entries(NERVE_PARTS).map(([k, p]) => [k, p.name])), part, hidden, {left: 170, right: 446, top: 36, bottom: 262});
}

function neuron(part, hidden) {
  const on = part === 'neuron';
  const cell = `<path d="M150 150 L118 118 M150 150 L110 150 M150 150 L120 186 M150 150 L152 106 M150 150 L170 192 M118 118 l-14 -4 M118 118 l-4 -14 M120 186 l-14 2 M120 186 l-2 14 M152 106 l-10 -10 M152 106 l10 -10" stroke="#8e5fb3" stroke-width="4" stroke-linecap="round" fill="none"/>
<circle cx="150" cy="150" r="24" fill="#c7a4e6" stroke="#8e5fb3" stroke-width="2"/><circle cx="150" cy="150" r="9" fill="#6a3f91"/>
<path d="M174 150 L440 150" stroke="#8e5fb3" stroke-width="5"/>${[200, 252, 304, 356, 408].map(x => `<rect x="${x}" y="141" width="40" height="18" rx="9" fill="#f6e7a8" stroke="#c9a93a" stroke-width="1.5"/>`).join('')}
<path d="M440 150 L476 124 M440 150 L482 150 M440 150 L476 178 M476 124 l10 -6 M482 150 l10 0 M476 178 l10 6" stroke="#8e5fb3" stroke-width="4" stroke-linecap="round" fill="none"/>
<circle r="7" fill="#ff7a1a" class="nv-signal"><animateMotion dur="2.4s" repeatCount="indefinite" path="M110 150 L482 150"/></circle>
<path d="M200 118 L400 118" stroke="#ff7a1a" stroke-width="2" marker-end="url(#nv-arrow)"/><defs><marker id="nv-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#ff7a1a"/></marker></defs>
<text x="300" y="110" text-anchor="middle" font-size="13" font-weight="700" fill="#b45309">اتجاه الإشارة العصبية</text>`;
  const labels = hidden ? ['١ ؟', '٢ ؟', '٣ ؟', '٤ ؟'] : ['الزوائد الشجيرية', 'جسم الخلية والنواة', 'المحور', 'نهايات المحور'];
  const lab = (x, y, t, ax, ay) => `<line x1="${x}" y1="${y - 10}" x2="${ax}" y2="${ay}" stroke="#4d5b60" stroke-width="1.3"/><rect x="${x - 62}" y="${y - 10}" width="124" height="24" rx="12" fill="#fff" stroke="#9aa7ab"/><text x="${x}" y="${y + 6}" text-anchor="middle" font-size="13" font-weight="600" fill="#163d34">${esc(t)}</text>`;
  return organ('neuron', on ? 'neuron' : part === 'none' ? 'none' : '_', cell) + lab(84, 256, labels[0], 112, 196) + lab(226, 224, labels[1], 160, 168) + lab(320, 200, labels[2], 320, 160) + lab(490, 214, labels[3], 478, 180);
}

export function renderNervous(values, {hidden = false} = {}) {
  const part = NERVE_PARTS[values.part] ? values.part : 'none', z = clamp(Number(values.level ?? 1), 1, 3), level = Math.round(z);
  const crumbs = [1, 2, 3].map(k => { const x = 590 - (k - 1) * 150, on = level === k; return `<g class="c-crumb${on ? ' is-on' : ''}"><rect x="${x - 140}" y="4" width="140" height="22" rx="11" fill="${on ? '#155c4d' : '#eef3f1'}"/><text x="${x - 70}" y="19" text-anchor="middle" font-size="12" font-weight="${on ? 800 : 600}" fill="${on ? '#fff' : '#50645a'}">${esc(NERVE_LEVELS[k])}</text></g>${k < 3 ? `<text x="${x - 145}" y="19" text-anchor="middle" font-size="12" fill="#9aa7ab">←</text>` : ''}`; }).join('');
  const p = NERVE_PARTS[part], caption = hidden ? 'توقّع: ما اسم كل جزء؟ وما عمله؟' : part !== 'none' && p.level === level ? `${p.name}: ${p.about}` : level === 1 ? 'الدماغ والحبل الشوكي والأعصاب تنقل الرسائل في الجسم' : level === 2 ? 'لكل فص من الدماغ عمل خاص' : 'الإشارة تدخل من الزوائد وتخرج من نهايات المحور';
  return scene('body-scene nerve-scene', `الجهاز العصبي — ${NERVE_LEVELS[level]}. ${caption}`,
    `<g>${layer(1, z, nervousBody(part, hidden), 300, 50)}${layer(2, z, brainSide(part, hidden), 300, 150)}${layer(3, z, neuron(part, hidden), 150, 150)}</g>${crumbs}`, caption.length > 70 ? caption.slice(0, 68) + '…' : caption);
}
export function nervousFacts(values, hidden) {
  const part = NERVE_PARTS[values.part] ? values.part : 'none', level = Math.round(clamp(Number(values.level ?? 1), 1, 3));
  if (hidden) return `${NERVE_LEVELS[level]} · الأسماء مخفية: سمِّ كل جزء، ثم انتظر الكشف.`;
  if (part !== 'none') return `${NERVE_PARTS[part].name} · ${NERVE_PARTS[part].about}${NERVE_PARTS[part].level !== level ? ` (يظهر في «${NERVE_LEVELS[NERVE_PARTS[part].level]}»)` : ''}`;
  return `${NERVE_LEVELS[level]} · الجهاز العصبي: الدماغ والحبل الشوكي والأعصاب، ووحدة بنائه الخلية العصبية.`;
}
