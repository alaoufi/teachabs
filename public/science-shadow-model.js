// Simplified, original model for a grade 4 light-and-shadow activity.
// Pure functions only: shared by the browser page and the Node tests.
// Model: the sun climbs 15° per hour from 6:00 to an overhead position at 12:00
// (close to a Saudi summer day near the Tropic of Cancer), then descends.
// It is a teaching simplification, not an astronomical calculator.

export const HOUR_MIN = 7, HOUR_MAX = 17, HOUR_STEP = 0.25;
export const HEIGHT_MIN = 1, HEIGHT_MAX = 2, HEIGHT_STEP = 0.1;

export const MATERIALS = {
  wood: {name: 'خشب', kind: 'معتم', shadow: 0.85, light: 0, explain: 'لا يمر الضوء خلال الخشب، فيتكون خلفه ظل داكن واضح.'},
  paper: {name: 'ورق مشمّع', kind: 'شبه شفاف', shadow: 0.35, light: 0.5, explain: 'يمر جزء من الضوء خلال الورق المشمّع، فيتكون ظل باهت.'},
  glass: {name: 'زجاج صافٍ', kind: 'شفاف', shadow: 0.06, light: 0.95, explain: 'يمر معظم الضوء خلال الزجاج الصافي، فلا يكاد يظهر له ظل.'}
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const snap = (value, step) => Math.round(value / step) * step;

export function normalizeHour(hour) {
  const value = Number(hour);
  if (!Number.isFinite(value)) return 9;
  return clamp(Number(snap(value, HOUR_STEP).toFixed(2)), HOUR_MIN, HOUR_MAX);
}

/** Clamps without snapping, for smooth animation between slider steps. */
export function clampHour(hour) {
  const value = Number(hour);
  return Number.isFinite(value) ? clamp(value, HOUR_MIN, HOUR_MAX) : 9;
}

export function normalizeHeight(height) {
  const value = Number(height);
  if (!Number.isFinite(value)) return 1.5;
  return clamp(Number(snap(value, HEIGHT_STEP).toFixed(1)), HEIGHT_MIN, HEIGHT_MAX);
}

export function normalizeMaterial(material) {
  return Object.hasOwn(MATERIALS, material) ? material : 'wood';
}

/** Sun height above the horizon in degrees (15° per hour, 90° at noon). */
export function sunElevation(hour) {
  return 90 - 15 * Math.abs(clampHour(hour) - 12);
}

/** Shadow length in metres for an upright object of the given height. */
export function shadowLength(height, elevationDeg) {
  if (elevationDeg >= 90) return 0;
  const length = height / Math.tan(elevationDeg * Math.PI / 180);
  return Math.abs(length) < 1e-9 ? 0 : length;
}

/** Sun is in the east before noon, so the shadow points west, and the reverse after noon. */
export function sunSide(hour) {
  const h = clampHour(hour);
  return h < 12 ? 'east' : h > 12 ? 'west' : 'overhead';
}

export function shadowSide(hour) {
  return {east: 'west', west: 'east', overhead: 'none'}[sunSide(hour)];
}

export function lessonState(input = {}) {
  const hour = input.exact ? clampHour(input.hour ?? 9) : normalizeHour(input.hour ?? 9), height = normalizeHeight(input.height ?? 1.5), material = normalizeMaterial(input.material);
  const elevation = sunElevation(hour), length = shadowLength(height, elevation);
  return {hour, height, material, elevation, length, ratio: length / height, sun: sunSide(hour), shadow: shadowSide(hour), darkness: MATERIALS[material].shadow};
}

const number = new Intl.NumberFormat('ar-SA', {maximumFractionDigits: 1, minimumFractionDigits: 0});
export const formatNumber = value => number.format(Math.round(value * 10) / 10);

export function formatHour(hour) {
  const h = normalizeHour(hour), whole = Math.floor(h), minutes = Math.round((h - whole) * 60);
  const shown = whole > 12 ? whole - 12 : whole, period = h < 12 ? 'صباحًا' : h === 12 ? 'ظهرًا' : 'مساءً';
  const two = new Intl.NumberFormat('ar-SA', {minimumIntegerDigits: 2, useGrouping: false});
  return `${number.format(shown)}:${two.format(minutes)} ${period}`;
}

export function compareText(state) {
  if (state.length < 0.05) return 'لا يكاد يظهر ظل؛ الشمس فوق اللوح تقريبًا.';
  const r = state.ratio;
  if (Math.abs(r - 1) <= 0.06) return 'الظل يساوي طول اللوح تقريبًا.';
  if (r < 1) return `الظل أقصر من اللوح (نحو ${formatNumber(r)} من طوله).`;
  return `الظل أطول من اللوح بنحو ${formatNumber(r)} مرة.`;
}

export const DIRECTION_TEXT = {west: 'نحو الغرب', east: 'نحو الشرق', none: 'تحت اللوح تقريبًا'};

// Challenges are judged from the visible state only; feedback is immediate and local.
export const CHALLENGES = [
  {id: 'longest', title: 'اجعل الظل أطول ما يمكن.', hint: 'متى تكون الشمس أقرب إلى الأفق؟',
    check: s => s.elevation <= 15 + 1e-9 && s.height >= HEIGHT_MAX - 1e-9,
    partial: s => s.elevation <= 15 + 1e-9 ? 'الوقت مناسب! جرّب أيضًا زيادة طول اللوح.' : 'حرّك الوقت نحو الصباح الباكر أو قبيل الغروب.'},
  {id: 'equal', title: 'اجعل طول الظل مساويًا لطول اللوح.', hint: 'ابحث عن ارتفاع للشمس بين الأفق ومنتصف السماء.',
    check: s => Math.abs(s.ratio - 1) <= 0.06,
    partial: s => s.ratio > 1 ? 'الظل ما زال أطول؛ ارفع الشمس قليلًا.' : 'الظل أقصر؛ أنزل الشمس قليلًا.'},
  {id: 'vanish', title: 'اجعل الظل يختفي تقريبًا.', hint: 'أين تكون الشمس عند منتصف النهار في نموذجنا؟',
    check: s => s.length < 0.05,
    partial: () => 'اقترب من وقت الظهر حين تكون الشمس فوق اللوح.'},
  {id: 'east', title: 'اجعل الظل يتجه نحو الشرق.', hint: 'الظل يكون في الجهة المقابلة للشمس.',
    check: s => s.shadow === 'east',
    partial: s => s.shadow === 'west' ? 'الظل الآن نحو الغرب لأن الشمس في الشرق. انتقل إلى ما بعد الظهر.' : 'حرّك الوقت قليلًا بعد الظهر.'},
  {id: 'faint', title: 'اختر مادة تجعل الظل باهتًا لكنه ما زال ظاهرًا.', hint: 'مادة يمر خلالها بعض الضوء فقط.',
    check: s => s.material === 'paper' && s.length >= 0.05,
    partial: s => s.length < 0.05 ? 'لا يظهر ظل وقت الظهر؛ غيّر الوقت أولًا.' : s.material === 'wood' ? 'الخشب يحجب الضوء كله فيصنع ظلًا داكنًا.' : 'الزجاج الصافي يمرر معظم الضوء فلا يكاد يظهر ظل.'}
];

export function judgeChallenge(id, state) {
  const challenge = CHALLENGES.find(c => c.id === id);
  if (!challenge) throw new Error('unknown challenge');
  return challenge.check(state) ? {done: true, message: 'أحسنت! حققت المطلوب.'} : {done: false, message: challenge.partial(state)};
}

export const QUIZ = [
  {id: 'q1', question: 'لماذا يتكون الظل خلف اللوح الخشبي؟', answer: 'b', options: {
    a: 'لأن اللوح يصنع ضوءًا أسود.', b: 'لأن اللوح يحجب الضوء الذي يسير في خطوط مستقيمة.', c: 'لأن الضوء ينعطف حول اللوح.'},
    why: 'الضوء يسير في خطوط مستقيمة، والجسم المعتم يمنعه من الوصول إلى المنطقة التي خلفه.'},
  {id: 'q2', question: 'متى يكون ظلك أقصر في يوم مشمس؟', answer: 'c', options: {
    a: 'في الصباح الباكر.', b: 'قبيل الغروب.', c: 'قرب منتصف النهار.'},
    why: 'كلما ارتفعت الشمس في السماء قصر الظل، وتكون أعلى ما يمكن قرب منتصف النهار.'},
  {id: 'q3', question: 'الشمس في الشرق صباحًا. في أي جهة يكون الظل؟', answer: 'a', options: {
    a: 'في الغرب.', b: 'في الشرق.', c: 'لا يتكون ظل صباحًا.'},
    why: 'يتكون الظل دائمًا في الجهة المقابلة لمصدر الضوء.'}
];

export function judgeQuiz(id, choice) {
  const item = QUIZ.find(q => q.id === id);
  if (!item || !Object.hasOwn(item.options, choice)) throw new Error('invalid answer');
  return {correct: choice === item.answer, why: item.why};
}

/** Scene geometry for a 600×300 SVG: ground at y=250, panel at x=300, sun on a semicircle. */
export const SCENE = {width: 600, height: 300, ground: 250, cx: 300, radius: 230, scale: 38};

export function sceneGeometry(state) {
  const {ground, cx, radius, scale} = SCENE, rad = state.elevation * Math.PI / 180;
  const east = state.sun === 'east' ? 1 : state.sun === 'west' ? -1 : 0; // east is drawn on the right
  const sunX = cx + east * radius * Math.cos(rad), sunY = ground - radius * Math.sin(rad);
  const top = ground - state.height * scale, tipX = cx - east * state.length * scale;
  return {sunX, sunY, top, tipX, ground, cx};
}

/** Inverse of the sun position: maps a horizontal scene coordinate to a time of day. */
export function hourFromSceneX(x) {
  const {cx, radius} = SCENE, dx = clamp((Number(x) - cx) / radius, -1, 1);
  const elevation = Math.acos(Math.abs(dx)) * 180 / Math.PI, offset = (90 - elevation) / 15;
  return normalizeHour(dx > 0 ? 12 - offset : 12 + offset);
}

const mix = (a, b, t) => Math.round(a + (b - a) * t);
function skyColors(elevation) {
  const t = clamp((elevation - 15) / 60, 0, 1);
  const rgb = (a, b) => `rgb(${mix(a[0], b[0], t)},${mix(a[1], b[1], t)},${mix(a[2], b[2], t)})`;
  return {top: rgb([120, 150, 205], [58, 146, 214]), bottom: rgb([252, 196, 140], [198, 230, 248])};
}

const PANEL = {wood: 'fill="#9c6b3f" stroke="#6d4523"', paper: 'fill="#fff6d8" fill-opacity="0.8" stroke="#c9b37a"', glass: 'fill="#bfe6f7" fill-opacity="0.45" stroke="#6fb2d1"'};

/** Static SVG markup (numbers and fixed strings only) used by the server render and the client. */
export function renderScene(input) {
  const s = lessonState(input), g = sceneGeometry(s), {width, height, ground, cx, radius} = SCENE, sky = skyColors(s.elevation);
  const r = v => Math.round(v * 10) / 10, half = 7, shadowVisible = s.length >= 0.05;
  // A ground strip from the panel's base to the tip, thinning slightly with distance like a real shadow.
  const shadow = shadowVisible ? `<polygon class="shadow" points="${cx},${ground + 1} ${r(g.tipX)},${ground + 3} ${r(g.tipX)},${ground + 11} ${cx},${ground + 15}" fill="#1d2b36" fill-opacity="${s.darkness}"/>` : '';
  const ray = shadowVisible ? `<line class="ray" x1="${r(g.sunX)}" y1="${r(g.sunY)}" x2="${r(g.tipX)}" y2="${ground + 6}" stroke="#e8890c" stroke-width="2" stroke-dasharray="7 6"/>` : `<line class="ray" x1="${cx}" y1="${r(g.sunY)}" x2="${cx}" y2="${r(g.top)}" stroke="#e8890c" stroke-width="2" stroke-dasharray="7 6"/>`;
  const lengthLabel = shadowVisible ? `<text x="${r((cx + g.tipX) / 2)}" y="${ground + 34}" class="scene-label" text-anchor="middle">الظل ${formatNumber(s.length)} م</text>` : `<text x="${cx}" y="${ground + 34}" class="scene-label" text-anchor="middle">لا يكاد يظهر ظل</text>`;
  const side = s.sun === 'west' ? 1 : -1, markX = cx + side * 22;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="shadow-scene" direction="ltr" role="img" aria-label="الشمس عند ارتفاع ${formatNumber(s.elevation)} درجة، وطول الظل ${formatNumber(s.length)} متر ${DIRECTION_TEXT[s.shadow]}">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky.top}"/><stop offset="1" stop-color="${sky.bottom}"/></linearGradient><radialGradient id="glow"><stop offset="0" stop-color="#fff3b0" stop-opacity="0.9"/><stop offset="1" stop-color="#ffd23f" stop-opacity="0"/></radialGradient></defs>
<rect width="${width}" height="${ground}" fill="url(#sky)"/>
<path d="M ${cx - radius} ${ground} A ${radius} ${radius} 0 0 1 ${cx + radius} ${ground}" fill="none" stroke="#ffffff" stroke-opacity="0.7" stroke-width="1.5" stroke-dasharray="3 7"/>
<rect y="${ground}" width="${width}" height="${height - ground}" fill="#ead6a6"/>
<line x1="0" y1="${ground}" x2="${width}" y2="${ground}" stroke="#b9975a" stroke-width="2"/>
${shadow}${ray}
<rect class="panel material-${s.material}" x="${cx - half}" y="${r(g.top)}" width="${half * 2}" height="${r(ground - g.top)}" rx="2" ${PANEL[s.material]} stroke-width="2"/>
<line x1="${markX}" y1="${r(g.top)}" x2="${markX}" y2="${ground}" stroke="#123b41" stroke-width="1.5"/><line x1="${markX - 5}" y1="${r(g.top)}" x2="${markX + 5}" y2="${r(g.top)}" stroke="#123b41" stroke-width="1.5"/>
<text x="${markX + side * 8}" y="${r((g.top + ground) / 2 + 5)}" class="scene-small" text-anchor="${side > 0 ? 'start' : 'end'}">${formatNumber(s.height)} م</text>
<circle cx="${r(g.sunX)}" cy="${r(g.sunY)}" r="44" fill="url(#glow)"/><circle class="sun" cx="${r(g.sunX)}" cy="${r(g.sunY)}" r="20" fill="#ffd23f" stroke="#f0a400" stroke-width="2"/>
${lengthLabel}
<text x="${width - 12}" y="24" class="scene-side" text-anchor="end">الشرق</text><text x="12" y="24" class="scene-side" text-anchor="start">الغرب</text>
</svg>`;
}
