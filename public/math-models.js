// Original interactive mathematics explanations for elementary and intermediate grades: fractions, the number line
// (with integers), angles, area and perimeter, solving equations with a balance, and the linear function.
// Pure functions drawing SVG strings; the board animates between states by tweening the numeric values.
import {ar, clamp, esc, scene} from './model-kit.js';

const n = v => (v < 0 ? '−' : '') + ar.format(Math.abs(Math.round(v * 100) / 100));
const dec = new Intl.NumberFormat('ar-SA', {maximumFractionDigits: 2});
const chip = (text, x = 470, w = 122) => `<g class="c-crumb is-on"><rect x="${x}" y="6" width="${w}" height="24" rx="12" fill="#155c4d"/><text x="${x + w / 2}" y="22" text-anchor="middle" font-size="12.5" font-weight="800" fill="#fff">${esc(text)}</text></g>`;
/** A stacked fraction: numerator over a bar over denominator. */
const frac = (x, y, a, b, size = 30, fill = '#163d34') => `<g class="m-frac"><text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" font-weight="800" fill="${fill}">${esc(n(a))}</text><line x1="${x - size * 0.6}" y1="${y + size * 0.22}" x2="${x + size * 0.6}" y2="${y + size * 0.22}" stroke="${fill}" stroke-width="3"/><text x="${x}" y="${y + size * 1.15}" text-anchor="middle" font-size="${size}" font-weight="800" fill="${fill}">${esc(n(b))}</text></g>`;

// ---------------------------------------------------------------- fractions
export const FRACTION_VIEWS = {bar: 'شريط', circle: 'دائرة', both: 'شريط ودائرة'};
const UNIT = ['', 'الواحد', 'النصف', 'الثلث', 'الربع', 'الخمس', 'السدس', 'السبع', 'الثمن', 'التسع', 'العشر'];
export function renderFraction(values, {hidden = false} = {}) {
  const den = Math.max(1, Math.round(values.den ?? 4)), num = clamp(Math.round(values.num ?? 3), 0, 2 * den), view = FRACTION_VIEWS[values.view] ? values.view : 'both';
  const wholes = num > den ? 2 : 1, shade = '#f6b26b', empty = '#ffffff', line = '#22313a';
  const bars = [], circles = [];
  for (let w = 0; w < wholes; w++) {
    const y = wholes > 1 ? 70 + w * 86 : 110, x0 = view === 'bar' ? 150 : 130, W = view === 'bar' ? 400 : 300;
    for (let i = 0; i < den; i++) { const on = w * den + i < num; bars.push(`<rect x="${(x0 + i * W / den).toFixed(1)}" y="${y}" width="${(W / den).toFixed(1)}" height="64" fill="${on ? shade : empty}" stroke="${line}" stroke-width="2" class="${on ? 'm-on' : ''}"/>`); }
    const cx = view === 'circle' ? (wholes > 1 ? 230 + w * 180 : 320) : 518, cy = view === 'circle' ? 145 : (wholes > 1 ? 100 + w * 92 : 142), r = view === 'circle' ? 86 : (wholes > 1 ? 42 : 62);
    for (let i = 0; i < den; i++) {
      const on = w * den + i < num, a0 = -Math.PI / 2 + 2 * Math.PI * i / den, a1 = a0 + 2 * Math.PI / den;
      circles.push(den === 1 ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${on ? shade : empty}" stroke="${line}" stroke-width="2"/>` :
        `<path d="M${cx} ${cy} L${(cx + r * Math.cos(a0)).toFixed(1)} ${(cy + r * Math.sin(a0)).toFixed(1)} A${r} ${r} 0 0 1 ${(cx + r * Math.cos(a1)).toFixed(1)} ${(cy + r * Math.sin(a1)).toFixed(1)}Z" fill="${on ? shade : empty}" stroke="${line}" stroke-width="2"/>`);
    }
  }
  const showBar = view !== 'circle', showCircle = view !== 'bar';
  const big = hidden ? `<text x="70" y="160" text-anchor="middle" font-size="40" font-weight="800" fill="#b45309">؟</text>` : frac(64, 130, num, den, 40);
  const name = num === den ? 'واحد صحيح' : num === 0 ? 'صفر' : den <= 10 && num === 1 ? UNIT[den] : `${n(num)} من ${n(den)} أجزاء متساوية`;
  const caption = hidden ? 'ما الكسر الذي يمثله الجزء الملوّن؟' : num > den ? `كسر أكبر من الواحد: ${n(Math.floor(num / den))} و${n(num % den)} من ${n(den)}` : `${name} · البسط ${n(num)} أجزاء ملوّنة، والمقام ${n(den)} أجزاء متساوية`;
  return scene('math-scene fraction-scene', `الكسر ${num}/${den}. ${caption}`, `${chip(FRACTION_VIEWS[view])}${big}${showBar ? bars.join('') : ''}${showCircle ? circles.join('') : ''}`, caption);
}
export function fractionFacts(values, hidden) {
  const den = Math.max(1, Math.round(values.den ?? 4)), num = clamp(Math.round(values.num ?? 3), 0, 2 * den);
  if (hidden) return 'الكسر مخفي: اكتب الكسر ثم انتظر الكشف.';
  const g = (a, b) => b ? g(b, a % b) : a, d = g(num, den) || 1;
  return `${n(num)}/${n(den)} = ${dec.format(num / den)} = ${dec.format(num / den * 100)}٪${d > 1 ? ` · في أبسط صورة: ${n(num / d)}/${n(den / d)}` : ''}`;
}

// ---------------------------------------------------------------- the number line
export function renderNumberLine(values, {hidden = false} = {}) {
  const start = Number(values.start ?? 3), jump = Number(values.jump ?? 4), end = start + jump, L = -15, R = 15;
  const X = v => 300 + v * 18, y = 190;
  const ticks = Array.from({length: R - L + 1}, (_, i) => L + i).map(v => `<line x1="${X(v)}" y1="${y - (v % 5 ? 6 : 10)}" x2="${X(v)}" y2="${y + (v % 5 ? 6 : 10)}" stroke="#22313a" stroke-width="${v === 0 ? 3 : 1.5}"/>${v % 5 === 0 || Math.abs(v) <= 2 ? `<text x="${X(v)}" y="${y + 30}" text-anchor="middle" font-size="13" font-weight="${v === 0 ? 800 : 500}" fill="${v < 0 ? '#b03a2e' : '#163d34'}">${n(v)}</text>` : ''}`).join('');
  const a = X(clamp(start, L, R)), b = X(clamp(end, L, R)), h = Math.min(90, Math.abs(b - a) * 0.6 + 20);
  const arc = jump ? `<path d="M${a} ${y - 8} Q${(a + b) / 2} ${y - 8 - h * 1.6} ${b} ${y - 8}" fill="none" stroke="${jump > 0 ? '#2e7d32' : '#c62828'}" stroke-width="3.5" marker-end="url(#nl-head-${jump > 0 ? 'p' : 'n'})"/><text x="${(a + b) / 2}" y="${y - 14 - h * 0.85}" text-anchor="middle" font-size="16" font-weight="800" fill="${jump > 0 ? '#2e7d32' : '#c62828'}">${jump > 0 ? '+' : '−'}${esc(ar.format(Math.abs(Math.round(jump))))}</text>` : '';
  const sign = jump >= 0 ? '+' : '−', eq = `${n(start)} ${sign} ${ar.format(Math.abs(Math.round(jump)))} = ${hidden ? '؟' : n(end)}`;
  const caption = hidden ? `${eq} — أين نقف بعد القفزة؟` : jump > 0 ? `${eq} · الجمع قفزة إلى اليمين` : jump < 0 ? `${eq} · الطرح (أو جمع عدد سالب) قفزة إلى اليسار` : `${n(start)} + ٠ = ${n(start)}`;
  return scene('math-scene numberline-scene', caption, `<defs><marker id="nl-head-${jump > 0 ? 'p' : 'n'}" markerWidth="10" markerHeight="10" refX="7" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10Z" fill="${jump > 0 ? '#2e7d32' : '#c62828'}"/></marker></defs>
<text x="300" y="56" text-anchor="middle" font-size="30" font-weight="800" fill="#163d34" direction="ltr">${esc(eq)}</text>
<line x1="${X(L) - 14}" y1="${y}" x2="${X(R) + 14}" y2="${y}" stroke="#22313a" stroke-width="3"/>${ticks}${arc}
<circle cx="${a}" cy="${y}" r="9" fill="#155c4d" stroke="#fff" stroke-width="2"/>${hidden ? '' : `<circle cx="${b}" cy="${y}" r="9" fill="#e8890c" stroke="#fff" stroke-width="2" class="m-on"/>`}
<text x="${X(-8)}" y="${y + 56}" text-anchor="middle" font-size="12" fill="#b03a2e">الأعداد السالبة</text><text x="${X(8)}" y="${y + 56}" text-anchor="middle" font-size="12" fill="#155c4d">الأعداد الموجبة</text>`, caption);
}
export const numberLineFacts = (v, hidden) => hidden ? 'توقّع الناتج، ثم انتظر الكشف.' : `البداية ${n(v.start)} · القفزة ${n(v.jump)} · النهاية ${n(v.start + v.jump)}. العدد السالب يقع يسار الصفر.`;

// ---------------------------------------------------------------- angles
export function angleType(a) { a = Math.round(a); return a === 0 ? 'صفرية' : a < 90 ? 'حادة' : a === 90 ? 'قائمة' : a < 180 ? 'منفرجة' : a === 180 ? 'مستقيمة' : a < 360 ? 'منعكسة' : 'كاملة (دورة)'; }
export function renderAngle(values, {hidden = false} = {}) {
  const deg = clamp(Number(values.angle ?? 60), 0, 360), rad = deg * Math.PI / 180, cx = 300, cy = 210, R = 150;
  const px = (r, t) => (cx + r * Math.cos(-t)).toFixed(1), py = (r, t) => (cy + r * Math.sin(-t)).toFixed(1);
  const marks = Array.from({length: 19}, (_, i) => i * 10).map(t => `<line x1="${px(R, t * Math.PI / 180)}" y1="${py(R, t * Math.PI / 180)}" x2="${px(R - (t % 30 ? 8 : 16), t * Math.PI / 180)}" y2="${py(R - (t % 30 ? 8 : 16), t * Math.PI / 180)}" stroke="#7a8a90" stroke-width="1.5"/>${t % 30 === 0 ? `<text x="${px(R + 14, t * Math.PI / 180)}" y="${(+py(R + 14, t * Math.PI / 180) + 4).toFixed(1)}" text-anchor="middle" font-size="11" fill="#50645a">${ar.format(t)}</text>` : ''}`).join('');
  const r = 48, large = deg > 180 ? 1 : 0;
  const arc = deg >= 359.5 ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fde2c4" stroke="#e8890c" stroke-width="3"/>` : deg === 90 ? `<path d="M${cx + 24} ${cy} L${cx + 24} ${cy - 24} L${cx} ${cy - 24}" fill="none" stroke="#e8890c" stroke-width="3"/>` :
    deg > 0 ? `<path d="M${cx} ${cy} L${px(r, 0)} ${py(r, 0)} A${r} ${r} 0 ${large} 0 ${px(r, rad)} ${py(r, rad)}Z" fill="#fde2c4" stroke="#e8890c" stroke-width="3"/>` : '';
  const caption = hidden ? 'قدّر قياس الزاوية ونوعها' : `زاوية ${angleType(deg)} قياسها ${ar.format(Math.round(deg))}°`;
  return scene('math-scene angle-scene', caption, `${chip(hidden ? '؟' : angleType(deg))}<path d="M${cx - R} ${cy} A${R} ${R} 0 0 1 ${cx + R} ${cy}" fill="#f4f8f7" stroke="#b8c4c8" stroke-width="2"/>${marks}${arc}
<line x1="${cx}" y1="${cy}" x2="${px(R + 30, 0)}" y2="${py(R + 30, 0)}" stroke="#155c4d" stroke-width="5" stroke-linecap="round"/>
<line x1="${cx}" y1="${cy}" x2="${px(R + 30, rad)}" y2="${py(R + 30, rad)}" stroke="#155c4d" stroke-width="5" stroke-linecap="round" class="m-ray"/><circle cx="${cx}" cy="${cy}" r="6" fill="#155c4d"/>
${hidden ? '' : `<text x="${px(r + 30, rad / 2)}" y="${(+py(r + 30, rad / 2) + 6).toFixed(1)}" text-anchor="middle" font-size="18" font-weight="800" fill="#b45309">${ar.format(Math.round(deg))}°</text>`}`, caption);
}
export const angleFacts = (v, hidden) => hidden ? 'الزاوية مخفية القياس: قدّرها ثم انتظر الكشف.' : `${ar.format(Math.round(v.angle))}° · ${angleType(v.angle)}. الحادة أقل من ٩٠°، والقائمة ٩٠°، والمنفرجة بين ٩٠° و١٨٠°، والمستقيمة ١٨٠°.`;

// ---------------------------------------------------------------- area and perimeter
export const AREA_MODES = {area: 'المساحة', perimeter: 'المحيط'};
export function renderArea(values, {hidden = false} = {}) {
  const w = Math.round(clamp(values.width ?? 5, 1, 12)), h = Math.round(clamp(values.height ?? 3, 1, 8)), mode = AREA_MODES[values.mode] ? values.mode : 'area', s = Math.min(34, 420 / 12, 200 / 8);
  const x0 = 300 - w * s / 2, y0 = 150 - h * s / 2;
  const grid = Array.from({length: 13 * 9}, (_, i) => [i % 13, Math.floor(i / 13)]).filter(([i, j]) => i < 12 && j < 8).map(([i, j]) => `<rect x="${(300 - 6 * s + i * s).toFixed(1)}" y="${(150 - 4 * s + j * s).toFixed(1)}" width="${s}" height="${s}" fill="none" stroke="#dfe7e4"/>`).join('');
  const cells = mode === 'area' ? Array.from({length: w * h}, (_, k) => [k % w, Math.floor(k / w)]).map(([i, j]) => `<rect x="${(x0 + i * s).toFixed(1)}" y="${(y0 + j * s).toFixed(1)}" width="${s}" height="${s}" fill="#9cc3e6" stroke="#4a78a8" class="m-on"/>${!hidden && w * h <= 40 ? `<text x="${(x0 + i * s + s / 2).toFixed(1)}" y="${(y0 + j * s + s / 2 + 5).toFixed(1)}" text-anchor="middle" font-size="12" fill="#1d3f66">${ar.format(j * w + i + 1)}</text>` : ''}`).join('') : '';
  const edge = mode === 'perimeter' ? `<rect x="${x0}" y="${y0}" width="${w * s}" height="${h * s}" fill="#fff8ec" stroke="#e8890c" stroke-width="5" class="m-on"/>` : `<rect x="${x0}" y="${y0}" width="${w * s}" height="${h * s}" fill="none" stroke="#163d34" stroke-width="2.5"/>`;
  const dims = `<text x="300" y="${y0 - 10}" text-anchor="middle" font-size="16" font-weight="800" fill="#155c4d">${ar.format(w)} وحدات</text><text x="${x0 + w * s + 12}" y="${150 + 5}" font-size="16" font-weight="800" fill="#155c4d">${ar.format(h)}</text>`;
  const value = mode === 'area' ? `${ar.format(w)} × ${ar.format(h)} = ${hidden ? '؟' : ar.format(w * h)} وحدة مربعة` : `${ar.format(w)} + ${ar.format(h)} + ${ar.format(w)} + ${ar.format(h)} = ${hidden ? '؟' : ar.format(2 * (w + h))} وحدات`;
  const caption = `${AREA_MODES[mode]}: ${value}`;
  return scene('math-scene area-scene', caption, `${chip(AREA_MODES[mode])}${grid}${edge}${cells}${dims}`, caption);
}
export const areaFacts = (v, hidden) => hidden ? 'احسب ثم انتظر الكشف.' : `المساحة = الطول × العرض = ${ar.format(v.width * v.height)} · المحيط = مجموع الأضلاع = ${ar.format(2 * (v.width + v.height))}`;

// ---------------------------------------------------------------- equations on a balance: a·س + b = c
export const BALANCE_STEPS = ['المعادلة', 'نطرح من الطرفين', 'نقسم على المعامل', 'الحل'];
export function renderBalance(values, {hidden = false} = {}) {
  const a = Math.round(clamp(values.a ?? 2, 1, 4)), b = Math.round(clamp(values.b ?? 3, 0, 8)), x = Math.round(clamp(values.x ?? 4, 1, 9)), step = Math.round(clamp(values.step ?? 1, 1, 4)), c = a * x + b;
  const leftBoxes = step >= 3 ? 1 : a, leftUnits = step >= 2 ? 0 : b, rightUnits = step === 1 ? c : step === 2 ? c - b : x;
  const box = (i, y) => `<g class="m-box"><rect x="${120 + i * 40}" y="${y}" width="34" height="34" rx="5" fill="#6fa8dc" stroke="#2f5d8a" stroke-width="2"/><text x="${137 + i * 40}" y="${y + 24}" text-anchor="middle" font-size="18" font-weight="800" fill="#fff">س</text></g>`;
  const unit = (x0, i, y, faded) => `<rect x="${x0 + (i % 6) * 22}" y="${y - Math.floor(i / 6) * 22}" width="18" height="18" rx="3" fill="${faded ? '#f8d7d4' : '#f6b26b'}" stroke="${faded ? '#d98a83' : '#b5651d'}" stroke-dasharray="${faded ? '3 2' : ''}"/>`;
  const units = (x0, k, y, gone = 0) => Array.from({length: k + gone}, (_, i) => unit(x0, i, y, i >= k)).join('');
  const left = Array.from({length: leftBoxes}, (_, i) => box(i, 168)).join('') + units(120 + leftBoxes * 40, leftUnits, 184, step === 2 ? b : 0);
  const right = units(360, Math.min(rightUnits, 36), 184, step === 2 ? b : 0);
  const eq = step === 1 ? `${a > 1 ? ar.format(a) : ''}س + ${ar.format(b)} = ${ar.format(c)}` : step === 2 ? `${a > 1 ? ar.format(a) : ''}س = ${ar.format(c)} − ${ar.format(b)} = ${ar.format(c - b)}` : step === 3 ? `س = ${ar.format(c - b)} ÷ ${ar.format(a)}` : `س = ${hidden ? '؟' : ar.format(x)}`;
  const stepsChips = BALANCE_STEPS.map((t, i) => `<g class="c-crumb${step === i + 1 ? ' is-on' : ''}"><rect x="${470 - i * 118}" y="6" width="112" height="22" rx="11" fill="${step === i + 1 ? '#155c4d' : '#eef3f1'}"/><text x="${526 - i * 118}" y="21" text-anchor="middle" font-size="12" font-weight="700" fill="${step === i + 1 ? '#fff' : '#50645a'}">${esc(`${ar.format(i + 1)} ${t}`)}</text></g>`).join('');
  const caption = step === 1 ? 'الكفتان متوازنتان: ما في اليسار يساوي ما في اليمين' : step === 2 ? `نزيل ${ar.format(b)} من الكفتين فتبقى متوازنة` : step === 3 ? `نقسم الكفتين على ${ar.format(a)} مجموعات متساوية` : hidden ? 'ما قيمة س؟' : `قيمة س = ${ar.format(x)} · نتحقق: ${ar.format(a)} × ${ar.format(x)} + ${ar.format(b)} = ${ar.format(c)}`;
  return scene('math-scene balance-scene', `${eq}. ${caption}`, `${stepsChips}<text x="300" y="66" text-anchor="middle" font-size="28" font-weight="800" fill="#163d34">${esc(eq)}</text>
<path d="M300 210 L280 262 L320 262Z" fill="#7a8a90"/><rect x="100" y="204" width="400" height="8" rx="4" fill="#4d5b60"/><path d="M110 212 L110 222 L290 222 L290 212 M310 212 L310 222 L490 222 L490 212" stroke="#4d5b60" stroke-width="3" fill="none"/>
${left}${right}<text x="200" y="250" text-anchor="middle" font-size="13" fill="#50645a">الطرف الأيسر</text><text x="420" y="250" text-anchor="middle" font-size="13" fill="#50645a">الطرف الأيمن</text>`, caption);
}
export const balanceFacts = (v, hidden) => { const c = v.a * v.x + v.b; return hidden ? 'حل المعادلة ثم انتظر الكشف.' : `المعادلة ${ar.format(v.a)}س + ${ar.format(v.b)} = ${ar.format(c)} · ما نفعله بطرف نفعله بالطرف الآخر حتى تبقى المعادلة متوازنة.`; };

// ---------------------------------------------------------------- the linear function ص = م س + ب
export function renderLinear(values, {hidden = false} = {}) {
  const m = Number(values.m ?? 1), b = Number(values.b ?? 0), U = 22, ox = 300, oy = 150;
  const X = v => ox + v * U, Y = v => oy - v * U;
  const grid = Array.from({length: 21}, (_, i) => i - 10).map(v => `<line x1="${X(v)}" y1="${Y(6)}" x2="${X(v)}" y2="${Y(-6)}" stroke="${v ? '#e3eae8' : '#22313a'}" stroke-width="${v ? 1 : 2}"/>`).join('') +
    Array.from({length: 13}, (_, i) => i - 6).map(v => `<line x1="${X(-10)}" y1="${Y(v)}" x2="${X(10)}" y2="${Y(v)}" stroke="${v ? '#e3eae8' : '#22313a'}" stroke-width="${v ? 1 : 2}"/>`).join('') +
    [-10, -5, 5, 10].map(v => `<text x="${X(v)}" y="${oy + 16}" text-anchor="middle" font-size="11" fill="#50645a">${n(v)}</text>`).join('') + [-5, 5].map(v => `<text x="${ox - 12}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="#50645a">${n(v)}</text>`).join('');
  const x1 = -10, x2 = 10, line = `<line x1="${X(x1)}" y1="${Y(m * x1 + b)}" x2="${X(x2)}" y2="${Y(m * x2 + b)}" stroke="#e8890c" stroke-width="4" class="m-on" clip-path="url(#lin-clip)"/>`;
  const pts = [-2, -1, 0, 1, 2].map(x => [x, m * x + b]);
  const dots = pts.filter(([, y]) => Math.abs(y) <= 6).map(([x, y]) => `<circle cx="${X(x)}" cy="${Y(y)}" r="5" fill="#155c4d" stroke="#fff" stroke-width="1.5"/>`).join('');
  const table = `<g transform="translate(18 40)"><rect width="96" height="${24 * 6}" rx="8" fill="#fff" stroke="#9aa7ab"/><text x="72" y="17" text-anchor="middle" font-size="13" font-weight="800">س</text><text x="26" y="17" text-anchor="middle" font-size="13" font-weight="800">ص</text>
${pts.map(([x, y], i) => `<text x="72" y="${41 + i * 24}" text-anchor="middle" font-size="13">${n(x)}</text><text x="26" y="${41 + i * 24}" text-anchor="middle" font-size="13" fill="#b45309">${hidden ? '؟' : n(y)}</text>`).join('')}</g>`;
  const eq = `ص = ${m === 0 ? '' : m === 1 ? 'س' : m === -1 ? '−س' : n(m) + 'س'}${b ? (m === 0 ? n(b) : ` ${b > 0 ? '+' : '−'} ${n(Math.abs(b))}`) : m === 0 ? '٠' : ''}`;
  const caption = hidden ? `${eq} — أكمل الجدول قبل أن نرسم` : `${eq} · الميل ${n(m)}: ${m > 0 ? 'يصعد المستقيم' : m < 0 ? 'ينزل المستقيم' : 'مستقيم أفقي'} · يقطع محور الصادات عند ${n(b)}`;
  return scene('math-scene linear-scene', caption, `<defs><clipPath id="lin-clip"><rect x="${X(-10)}" y="${Y(6)}" width="${20 * U}" height="${12 * U}"/></clipPath></defs>${grid}${hidden ? '' : line + dots}${table}${chip(eq, 452, 140)}`, caption);
}
export const linearFacts = (v, hidden) => hidden ? 'أكمل جدول القيم ثم انتظر الرسم.' : `الميل ${n(v.m)} = مقدار تغيّر ص عندما تزيد س واحدًا · المقطع الصادي ${n(v.b)}`;
