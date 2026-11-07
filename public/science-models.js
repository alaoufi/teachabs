// Original interactive science explanations for elementary and intermediate grades: day, night and the seasons,
// the phases of the Moon, the water cycle, electric circuits, the structure of the atom, the heart and blood
// circulation, and the plant and photosynthesis. Simplified school diagrams drawn by the project.
import {ar, clamp, esc, along, tags, organ, stageChips, scene} from './model-kit.js';

const chip = (text, x = 450, w = 142) => `<g class="c-crumb is-on"><rect x="${x}" y="6" width="${w}" height="24" rx="12" fill="#155c4d"/><text x="${x + w / 2}" y="22" text-anchor="middle" font-size="12.5" font-weight="800" fill="#fff">${esc(text)}</text></g>`;
const sun = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r * 1.5}" fill="#ffe08a" opacity=".45"/><circle cx="${x}" cy="${y}" r="${r}" fill="#ffc107" stroke="#f29b00" stroke-width="2"/>`;

// ---------------------------------------------------------------- Earth: day, night and seasons
export const MONTHS = ['', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const seasonOf = m => { m = ((Math.round(m) - 1) % 12) + 1; return [12, 1, 2].includes(m) ? 'الشتاء' : [3, 4, 5].includes(m) ? 'الربيع' : [6, 7, 8].includes(m) ? 'الصيف' : 'الخريف'; };
export const formatHour = h => { const x = ((Math.round(h) % 24) + 24) % 24; return `${ar.format(x % 12 || 12)} ${x < 12 ? 'ص' : 'م'}`; };
export function renderEarth(values, {hidden = false} = {}) {
  const month = clamp(Number(values.month ?? 6), 1, 12.99), hour = Number(values.hour ?? 12);
  // orbit (left): the Sun in the middle; June is on the side where the north pole leans toward the Sun
  const ang = (month - 6) / 12 * 2 * Math.PI, ox = 150, oy = 160, ex = ox + 110 * Math.cos(ang), ey = oy + 70 * Math.sin(ang);
  const orbit = `<ellipse cx="${ox}" cy="${oy}" rx="110" ry="70" fill="none" stroke="#9aa7ab" stroke-dasharray="5 4"/>${sun(ox, oy, 22)}
${[3, 6, 9, 12].map(m => { const a = (m - 6) / 12 * 2 * Math.PI; return `<text x="${(ox + 136 * Math.cos(a)).toFixed(1)}" y="${(oy + 92 * Math.sin(a) + 4).toFixed(1)}" text-anchor="middle" font-size="11" fill="#50645a">${MONTHS[m]}</text>`; }).join('')}
<circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="11" fill="#4a90d9" stroke="#fff" stroke-width="2"/><line x1="${(ex + 7).toFixed(1)}" y1="${(ey + 12).toFixed(1)}" x2="${(ex - 7).toFixed(1)}" y2="${(ey - 12).toFixed(1)}" stroke="#163d34" stroke-width="2"/>`;
  // big Earth (right), seen from the side with the Sun on the left: the lit half faces the Sun. The axis keeps its
  // direction in space, so in June the north pole leans toward the Sun and in December away from it.
  const cx = 440, cy = 156, R = 92, t = 23.5 * Math.PI / 180 * Math.cos(ang);
  const turn = (x, y) => [cx + x * Math.cos(t) + y * Math.sin(t), cy - x * Math.sin(t) + y * Math.cos(t)];
  const lon = ((hour - 12) / 24) * 2 * Math.PI, lat = 24.7 * Math.PI / 180, front = Math.sin(lon) <= 0.15;
  const [rx, ry] = turn(-R * Math.cos(lat) * Math.cos(lon), -R * Math.sin(lat)), isDay = Math.cos(lon) > 0.1, dusk = Math.abs(Math.cos(lon)) <= 0.1 ? (Math.sin(lon) > 0 ? 'غروب' : 'شروق') : '';
  const [ex2, ey2] = turn(-R * Math.cos(lat), -R * Math.sin(lat)), [ex3, ey3] = turn(R * Math.cos(lat), -R * Math.sin(lat));
  const [qx, qy] = turn(-R, 0), [qx2, qy2] = turn(R, 0), [nx, ny] = turn(0, -R * 1.22), [sx, sy] = turn(0, R * 1.22);
  const big = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#1f3b5c"/><path d="M${cx} ${cy - R} A${R} ${R} 0 0 0 ${cx} ${cy + R}Z" fill="#5aa0e6"/>
<line x1="${qx.toFixed(1)}" y1="${qy.toFixed(1)}" x2="${qx2.toFixed(1)}" y2="${qy2.toFixed(1)}" stroke="#ffffff" stroke-width="1.2" opacity=".6"/><line x1="${ex2.toFixed(1)}" y1="${ey2.toFixed(1)}" x2="${ex3.toFixed(1)}" y2="${ey3.toFixed(1)}" stroke="#ffd54f" stroke-width="1.2" stroke-dasharray="3 3" opacity=".8"/>
<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="#163d34" stroke-width="2.5" stroke-dasharray="6 4"/><text x="${nx.toFixed(1)}" y="${(ny - 6).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="800" fill="#163d34">الشمال</text>
<circle cx="${rx.toFixed(1)}" cy="${ry.toFixed(1)}" r="7" fill="${isDay ? '#ffc107' : '#cfd8dc'}" stroke="#b03a2e" stroke-width="2.5" opacity="${front ? 1 : 0.35}"/><text x="${(rx + 10).toFixed(1)}" y="${(ry + 18).toFixed(1)}" font-size="12" font-weight="800" fill="#fff" opacity="${front ? 1 : 0.5}">الرياض</text>
<text x="${cx - R / 2}" y="${cy + R + 18}" text-anchor="middle" font-size="12" fill="#1565c0">نهار</text><text x="${cx + R / 2}" y="${cy + R + 18}" text-anchor="middle" font-size="12" fill="#1f3b5c">ليل</text>
${[0, 1, 2].map(i => `<line x1="${cx - R - 64}" y1="${cy - 50 + i * 50}" x2="${cx - R - 14}" y2="${cy - 50 + i * 50}" stroke="#f29b00" stroke-width="2.5" marker-end="url(#ray-head)"/>`).join('')}
<defs><marker id="ray-head" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#f29b00"/></marker></defs>`;
  const season = seasonOf(month);
  const caption = hidden ? 'توقّع: ليل أم نهار في الرياض؟ وما الفصل؟' : `${MONTHS[Math.round(month) > 12 ? 12 : Math.round(month)]} · ${season} في نصف الأرض الشمالي · الساعة ${formatHour(hour)}: ${dusk || (isDay ? 'نهار' : 'ليل')} في الرياض`;
  return scene('sci-scene earth-scene', caption, `${chip(hidden ? '؟' : `${season} · ${dusk || (isDay ? 'نهار' : 'ليل')}`)}${orbit}${big}`, caption);
}
export const earthFacts = (v, hidden) => hidden ? 'توقّع ثم انتظر الكشف.' : `دوران الأرض حول محورها كل ٢٤ ساعة يسبب الليل والنهار، وميل محورها مع دورانها حول الشمس كل سنة يسبب الفصول. الآن ${seasonOf(v.month)}.`;

// ---------------------------------------------------------------- Moon phases
export const PHASES = ['المحاق', 'الهلال المتزايد', 'التربيع الأول', 'الأحدب المتزايد', 'البدر', 'الأحدب المتناقص', 'التربيع الأخير', 'الهلال المتناقص'];
export const phaseName = d => PHASES[Math.round(((d % 29.5) / 29.5) * 8) % 8];
export function renderMoon(values, {hidden = false} = {}) {
  const d = clamp(Number(values.day ?? 7), 0, 29.5), f = d / 29.5, a = f * 2 * Math.PI;
  // orbit view: Sun light comes from the right; the Moon goes counter-clockwise around the Earth
  const ex = 170, ey = 160, R = 95, mx = ex + R * Math.cos(a), my = ey - R * Math.sin(a);
  const orbit = `<circle cx="${ex}" cy="${ey}" r="${R}" fill="none" stroke="#9aa7ab" stroke-dasharray="5 4"/><circle cx="${ex}" cy="${ey}" r="22" fill="#4a90d9" stroke="#fff" stroke-width="2"/><text x="${ex}" y="${ey + 40}" text-anchor="middle" font-size="12" fill="#163d34">الأرض</text>
${[0, 1, 2].map(i => `<line x1="${ex + 150}" y1="${ey - 70 + i * 70}" x2="${ex + 122}" y2="${ey - 70 + i * 70}" stroke="#f29b00" stroke-width="2.5"/>`).join('')}<text x="${ex + 140}" y="${ey - 84}" text-anchor="middle" font-size="12" fill="#b45309">ضوء الشمس</text>
<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="13" fill="#3a3f45"/><path d="M${mx.toFixed(1)} ${(my - 13).toFixed(1)} A13 13 0 0 1 ${mx.toFixed(1)} ${(my + 13).toFixed(1)}Z" fill="#f5f0dc"/>`;
  // as seen from Earth: lit fraction k = (1 - cos a) / 2; waxing lit on the right
  const cx = 440, cy = 150, r = 90, k = (1 - Math.cos(a)) / 2, waxing = f <= 0.5, w = Math.abs(1 - 2 * k) * r;
  const outer = waxing ? 1 : 0, inner = k < 0.5 ? (waxing ? 0 : 1) : (waxing ? 1 : 0);
  const lit = k < 0.005 ? '' : k > 0.995 ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#f5f0dc"/>` : `<path d="M${cx} ${cy - r} A${r} ${r} 0 0 ${outer} ${cx} ${cy + r} A${w.toFixed(1)} ${r} 0 0 ${inner} ${cx} ${cy - r}Z" fill="#f5f0dc"/>`;
  const seen = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#2b3036" stroke="#566" stroke-width="1.5"/>${lit}<circle cx="${cx - 30}" cy="${cy - 20}" r="12" fill="#000" opacity=".06"/><circle cx="${cx + 24}" cy="${cy + 30}" r="16" fill="#000" opacity=".06"/>
<text x="${cx}" y="${cy + r + 22}" text-anchor="middle" font-size="12" fill="#50645a">كما نراه من الأرض</text>`;
  const caption = hidden ? 'توقّع: ما اسم هذا الطور؟' : `اليوم ${ar.format(Math.round(d))} من الشهر القمري · ${phaseName(d)}`;
  return scene('sci-scene moon-scene', caption, `<rect width="600" height="300" fill="#0f1d2b" opacity=".92"/>${chip(hidden ? '؟' : phaseName(d))}${orbit}${seen}`, caption).replace('fill="#163d34" stroke="#ffffff"', 'fill="#ffffff" stroke="#0f1d2b"');
}
export const moonFacts = (v, hidden) => hidden ? 'الاسم مخفي: سمِّ الطور ثم انتظر الكشف.' : `${phaseName(v.day)} · القمر لا يضيء بنفسه بل يعكس ضوء الشمس، ونرى منه جزءًا مختلفًا كل ليلة لأنه يدور حول الأرض في نحو ٢٩٫٥ يومًا.`;

// ---------------------------------------------------------------- the water cycle
export const WATER_STAGES = ['التبخر', 'التكاثف', 'الهطول', 'التجمع'];
const WATER_TEXT = ['حرارة الشمس تبخّر الماء من البحر فيصعد بخارًا', 'يبرد البخار في الأعلى فيتكاثف قطرات صغيرة تكوّن السحب', 'تكبر القطرات وتثقل فتهطل مطرًا أو بَرَدًا أو ثلجًا', 'يجري الماء في الأودية ويتسرب إلى باطن الأرض ويعود إلى البحر'];
export function renderWater(values, {hidden = false} = {}) {
  const stage = clamp(Number(values.stage ?? 1), 1, 4), on = k => clamp(1 - Math.abs(stage - k) * 1.2, 0.18, 1).toFixed(2);
  const body = `<rect x="0" y="0" width="600" height="300" fill="#e8f4fb"/>${sun(70, 64, 26)}
<path d="M0 230 Q80 220 160 232 Q240 244 300 236 L300 300 L0 300Z" fill="#3d85c6"/><path d="M300 236 L400 120 L470 180 L520 110 L600 170 L600 300 L300 300Z" fill="#8d6e63"/><path d="M400 120 L420 140 L380 140Z M520 110 L540 130 L500 130Z" fill="#fff"/>
<path d="M330 290 Q380 250 420 240 Q470 228 520 200" stroke="#3d85c6" stroke-width="6" fill="none"/>
<g opacity="${on(1)}" class="${Math.round(stage) === 1 ? 'c-hl' : ''}">${[110, 160, 210].map(x => `<path d="M${x} 222 Q${x - 12} 190 ${x} 160 Q${x + 12} 130 ${x} 100" stroke="#e8890c" stroke-width="3" fill="none" stroke-dasharray="6 5" marker-end="url(#w-head)"/>`).join('')}<text x="160" y="150" text-anchor="middle" font-size="15" font-weight="800" fill="#b45309">بخار ماء</text></g>
<g opacity="${on(2)}"><path d="M200 70 q20 -30 50 -10 q30 -26 60 0 q30 -6 30 20 q10 26 -24 26 L210 106 q-30 -4 -10 -36Z" fill="#fff" stroke="#9aa7ab" stroke-width="2"/><path d="M330 56 q16 -22 40 -6 q24 -18 46 4 q22 2 18 22 q-4 18 -24 18 L340 94 q-26 -6 -10 -38Z" fill="#fff" stroke="#9aa7ab" stroke-width="2"/><text x="270" y="92" text-anchor="middle" font-size="14" font-weight="800" fill="#163d34">سحب</text></g>
<g opacity="${on(3)}">${Array.from({length: 14}, (_, i) => `<line x1="${350 + (i % 7) * 13}" y1="${108 + Math.floor(i / 7) * 26}" x2="${344 + (i % 7) * 13}" y2="${122 + Math.floor(i / 7) * 26}" stroke="#3d85c6" stroke-width="2.5"/>`).join('')}</g>
<g opacity="${on(4)}"><path d="M500 210 Q450 236 400 250 Q350 262 310 262" stroke="#1565c0" stroke-width="3" fill="none" stroke-dasharray="7 5" marker-end="url(#w-head2)"/><path d="M420 280 Q380 290 330 286" stroke="#1565c0" stroke-width="2" fill="none" stroke-dasharray="3 4"/><text x="430" y="276" text-anchor="middle" font-size="12" fill="#fff">مياه جوفية</text></g>
<path d="M240 106 Q320 40 360 70" stroke="#9aa7ab" stroke-width="2" fill="none" stroke-dasharray="4 4" marker-end="url(#w-head3)" opacity="${on(2)}"/>
<defs><marker id="w-head" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#e8890c"/></marker><marker id="w-head2" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#1565c0"/></marker><marker id="w-head3" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#9aa7ab"/></marker></defs>`;
  const caption = hidden ? 'توقّع: ماذا يحدث للماء بعد ذلك؟' : WATER_TEXT[Math.round(stage) - 1];
  return scene('sci-scene water-scene', `دورة الماء — ${WATER_STAGES[Math.round(stage) - 1]}. ${caption}`, body + stageChips(WATER_STAGES, stage).replace(/x="(\d+(?:\.\d+)?)"/g, (m, v) => m), caption);
}
export const waterFacts = (v, hidden) => hidden ? 'توقّع المرحلة التالية ثم انتظر الكشف.' : `${WATER_STAGES[Math.round(v.stage) - 1]} · ${WATER_TEXT[Math.round(v.stage) - 1]}. الماء على الأرض لا يفنى بل يدور باستمرار.`;

// ---------------------------------------------------------------- electric circuits
export const CIRCUIT_MODES = {series: 'توالٍ', parallel: 'توازٍ'};
export const SWITCH = {on: 'مغلق (يمر التيار)', off: 'مفتوح (لا يمر التيار)'};
export function renderCircuit(values, {hidden = false} = {}) {
  const mode = CIRCUIT_MODES[values.mode] ? values.mode : 'series', closed = values.switch !== 'off', k = Math.round(clamp(values.bulbs ?? 2, 1, 3));
  const glow = closed ? (mode === 'series' ? 1 / k : 1) : 0, flow = closed ? `stroke-dasharray="4 10" class="ci-flow"` : '';
  const bulb = (x, y) => `<g class="ci-bulb"><circle cx="${x}" cy="${y}" r="${18 + 16 * glow}" fill="#ffe08a" opacity="${(0.75 * glow).toFixed(2)}"/><circle cx="${x}" cy="${y}" r="16" fill="${glow ? '#fff3b0' : '#eef2f3'}" stroke="#7a8a90" stroke-width="2"/><path d="M${x - 6} ${y + 4} q6 -14 12 0" stroke="${glow ? '#e8890c' : '#7a8a90'}" stroke-width="2" fill="none"/><rect x="${x - 8}" y="${y + 15}" width="16" height="10" fill="#9aa7ab"/></g>`;
  const wire = d => `<path d="${d}" stroke="#4d5b60" stroke-width="4" fill="none"/>${closed ? `<path d="${d}" stroke="#ffd54f" stroke-width="3" fill="none" ${flow}/>` : ''}`;
  let body = `<rect x="70" y="190" width="90" height="40" rx="6" fill="#455a64"/><rect x="160" y="200" width="10" height="20" fill="#455a64"/><text x="115" y="215" text-anchor="middle" font-size="13" font-weight="800" fill="#fff">بطارية</text><text x="80" y="185" font-size="16" font-weight="800" fill="#c62828">+</text><text x="150" y="185" font-size="16" font-weight="800" fill="#1565c0">−</text>`;
  const sw = closed ? `<line x1="250" y1="210" x2="300" y2="210" stroke="#4d5b60" stroke-width="5"/>` : `<line x1="250" y1="210" x2="292" y2="180" stroke="#4d5b60" stroke-width="5"/>`;
  body += `<circle cx="250" cy="210" r="5" fill="#4d5b60"/><circle cx="300" cy="210" r="5" fill="#4d5b60"/>${sw}<text x="275" y="238" text-anchor="middle" font-size="12" fill="#50645a">المفتاح</text>`;
  body += wire('M170 210 L250 210') + wire('M300 210 L520 210 L520 80') + wire('M70 210 L40 210 L40 80');
  if (mode === 'series') {
    const xs = Array.from({length: k}, (_, i) => 120 + (i + 1) * (360 / (k + 1)));
    body += wire(`M40 80 L520 80`) + xs.map(x => bulb(x, 80)).join('');
  } else {
    const ys = Array.from({length: k}, (_, i) => 60 + i * 44);
    body += ys.map(y => wire(`M40 ${y + 20} L40 ${y} L520 ${y} L520 ${y + 20}`) + bulb(280, y)).join('');
  }
  const caption = hidden ? 'توقّع: هل يضيء المصباح؟ وكم تكون شدة إضاءته؟' : !closed ? 'الدائرة مفتوحة: لا يمر التيار فلا يضيء أي مصباح' : mode === 'series' ? `توالٍ: مسار واحد للتيار، فكلما زادت المصابيح خفتت إضاءتها${k > 1 ? '، وإذا تلف واحد انطفأت كلها' : ''}` : 'توازٍ: لكل مصباح مسار، فتبقى إضاءتها قوية ولا ينطفئ الباقي إذا تلف أحدها';
  return scene('sci-scene circuit-scene', caption, `${chip(hidden ? '؟' : `${CIRCUIT_MODES[mode]} · ${closed ? 'مغلقة' : 'مفتوحة'}`)}${body}`, caption);
}
export const circuitFacts = (v, hidden) => hidden ? 'توقّع ثم أغلق المفتاح.' : 'الدائرة الكهربائية المغلقة مسار كامل من القطب الموجب للبطارية إلى قطبها السالب. المفتاح يفتح الدائرة ويغلقها.';

// ---------------------------------------------------------------- the atom (Bohr model), elements 1–20
export const ELEMENTS = [null, ['H', 'الهيدروجين', 0], ['He', 'الهيليوم', 2], ['Li', 'الليثيوم', 4], ['Be', 'البيريليوم', 5], ['B', 'البورون', 6], ['C', 'الكربون', 6], ['N', 'النيتروجين', 7], ['O', 'الأكسجين', 8], ['F', 'الفلور', 10], ['Ne', 'النيون', 10],
  ['Na', 'الصوديوم', 12], ['Mg', 'المغنيسيوم', 12], ['Al', 'الألومنيوم', 14], ['Si', 'السيليكون', 14], ['P', 'الفوسفور', 16], ['S', 'الكبريت', 16], ['Cl', 'الكلور', 18], ['Ar', 'الأرجون', 22], ['K', 'البوتاسيوم', 20], ['Ca', 'الكالسيوم', 20]];
export const shells = z => { const out = []; for (const cap of [2, 8, 8, 2]) { if (z <= 0) break; out.push(Math.min(cap, z)); z -= cap; } return out; };
export function renderAtom(values, {hidden = false} = {}) {
  const z = Math.round(clamp(values.z ?? 6, 1, 20)), [sym, name, neutrons] = ELEMENTS[z], sh = shells(z), cx = 230, cy = 156;
  const nucleus = Array.from({length: Math.min(z + neutrons, 40)}, (_, i) => { const t = i * 2.4, r = 3.2 * Math.sqrt(i); return `<circle cx="${(cx + r * Math.cos(t)).toFixed(1)}" cy="${(cy + r * Math.sin(t)).toFixed(1)}" r="5" fill="${i % 2 === 0 && i / 2 < z ? '#e06666' : '#9aa7ab'}" stroke="#fff" stroke-width="1"/>`; }).join('');
  const rings = sh.map((count, s) => { const R = 44 + s * 30; return `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#9cc3e6" stroke-width="1.5"/>${Array.from({length: count}, (_, i) => { const t = 2 * Math.PI * i / count + s * 0.4; return `<circle cx="${(cx + R * Math.cos(t)).toFixed(1)}" cy="${(cy + R * Math.sin(t)).toFixed(1)}" r="6" fill="#1565c0" stroke="#fff" stroke-width="1.5" class="at-e"/>`; }).join('')}`; }).join('');
  const card = `<g transform="translate(410 70)"><rect width="150" height="170" rx="12" fill="#fff" stroke="#155c4d" stroke-width="2"/><text x="75" y="30" text-anchor="middle" font-size="15" font-weight="800" fill="#155c4d">${esc(hidden ? '؟' : name)}</text>
<text x="75" y="84" text-anchor="middle" font-size="44" font-weight="800" fill="#163d34" direction="ltr">${sym}</text><text x="75" y="110" text-anchor="middle" font-size="12" fill="#50645a">العدد الذري ${ar.format(z)}</text>
<text x="75" y="132" text-anchor="middle" font-size="12" fill="#c62828">بروتونات ${ar.format(z)} · نيوترونات ${ar.format(neutrons)}</text><text x="75" y="154" text-anchor="middle" font-size="12" fill="#1565c0">إلكترونات ${hidden ? '؟' : sh.map(x => ar.format(x)).join(' ، ')}</text></g>`;
  const caption = hidden ? 'وزّع الإلكترونات على المستويات: ٢ ثم ٨ ثم ٨' : `ذرة ${name}: ${ar.format(z)} بروتونات في النواة و${ar.format(z)} إلكترونات في ${ar.format(sh.length)} ${sh.length > 2 ? 'مستويات' : sh.length === 2 ? 'مستويين' : 'مستوى'}`;
  return scene('sci-scene atom-scene', caption, `${hidden ? `<circle cx="${cx}" cy="${cy}" r="40" fill="none" stroke="#9cc3e6"/>` : rings}${nucleus}${card}
<g transform="translate(30 250)"><circle r="6" fill="#e06666"/><text x="12" y="4" font-size="12">بروتون (+)</text><circle cx="100" r="6" fill="#9aa7ab"/><text x="112" y="4" font-size="12">نيوترون</text><circle cx="190" r="6" fill="#1565c0"/><text x="202" y="4" font-size="12">إلكترون (−)</text></g>`, caption);
}
export const atomFacts = (v, hidden) => { const z = Math.round(v.z); return hidden ? 'التوزيع مخفي: وزّع الإلكترونات ثم انتظر الكشف.' : `${ELEMENTS[z][1]} (${ELEMENTS[z][0]}) · العدد الذري = عدد البروتونات = عدد الإلكترونات في الذرة المتعادلة = ${ar.format(z)}`; };

// ---------------------------------------------------------------- the heart and blood circulation
export const HEART_STAGES = ['من الجسم', 'الأذين الأيمن', 'البطين الأيمن', 'الرئتان', 'الأذين الأيسر', 'البطين الأيسر', 'إلى الجسم'];
export const HEART_PARTS = {
  none: {name: 'كل الأجزاء'}, ra: {name: 'الأذين الأيمن', about: 'يستقبل الدم الفقير بالأكسجين القادم من الجسم.'}, rv: {name: 'البطين الأيمن', about: 'يضخ الدم إلى الرئتين ليأخذ الأكسجين.'},
  la: {name: 'الأذين الأيسر', about: 'يستقبل الدم الغني بالأكسجين القادم من الرئتين.'}, lv: {name: 'البطين الأيسر', about: 'أقوى حجرات القلب: يضخ الدم الغني بالأكسجين إلى الجسم كله.'},
  lungs: {name: 'الرئتان', about: 'فيهما يأخذ الدم الأكسجين ويتخلص من ثاني أكسيد الكربون.'}, vessels: {name: 'الأوعية الدموية', about: 'الشرايين تحمل الدم من القلب، والأوردة تعيده إليه.'}
};
const BLOOD = [[300, 286], [236, 250], [244, 196], [250, 178], [250, 214], [262, 238], [236, 150], [150, 92], [150, 70], [240, 78], [352, 150], [340, 178], [344, 214], [334, 236], [356, 130], [340, 40], [470, 40], [470, 120]];
const BLOOD_STOPS = [0, 3, 5, 8, 11, 13, 17];
export function renderHeart(values, {hidden = false} = {}) {
  const part = HEART_PARTS[values.part] ? values.part : 'none', stage = clamp(Number(values.stage ?? 1), 1, 7), [bx, by] = along(BLOOD, BLOOD_STOPS, stage), rich = stage >= 4;
  const body = organ('lungs', part, `<path d="M140 50 Q100 70 104 140 Q110 176 150 170 Q176 160 176 100 Q174 56 140 50Z" fill="#f4b6c2" stroke="#c46a82" stroke-width="2"/><path d="M460 50 Q500 70 496 140 Q490 176 450 170 Q424 160 424 100 Q426 56 460 50Z" fill="#f4b6c2" stroke="#c46a82" stroke-width="2"/>`) +
    organ('vessels', part, `<path d="M236 150 L236 290" stroke="#4a6fd6" stroke-width="12"/><path d="M240 120 Q200 64 150 70" stroke="#4a6fd6" stroke-width="10" fill="none"/><path d="M356 130 Q400 64 450 70" stroke="#d64545" stroke-width="10" fill="none"/><path d="M340 140 Q330 30 470 40 L470 130" stroke="#d64545" stroke-width="12" fill="none"/>`) +
    `<path d="M220 160 Q210 120 250 120 Q300 116 300 140 Q300 116 350 120 Q390 120 380 160 Q376 230 300 276 Q224 230 220 160Z" fill="#c0392b" stroke="#7b1f16" stroke-width="2"/>` +
    organ('ra', part, `<path d="M228 160 Q228 140 252 140 Q290 142 292 170 L292 196 L232 196Z" fill="#6c8ee6" stroke="#2c4fa8" stroke-width="2"/>`) +
    organ('rv', part, `<path d="M232 202 L292 202 L292 262 Q250 238 236 210Z" fill="#4a6fd6" stroke="#2c4fa8" stroke-width="2"/>`) +
    organ('la', part, `<path d="M308 170 Q310 142 348 140 Q372 140 372 160 L368 196 L308 196Z" fill="#ef7b72" stroke="#a83a30" stroke-width="2"/>`) +
    organ('lv', part, `<path d="M308 202 L368 202 Q356 240 308 266Z" fill="#d64545" stroke="#a83a30" stroke-width="2"/>`) +
    `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="8" fill="${rich ? '#e53935' : '#3949ab'}" stroke="#fff" stroke-width="2.5" class="ht-blood"/>`;
  const anchors = {lungs: [120, 110, 'L'], ra: [250, 172, 'L'], rv: [256, 228, 'L'], la: [350, 172, 'R'], lv: [336, 228, 'R'], vessels: [470, 100, 'R']};
  const names = Object.fromEntries(Object.entries(HEART_PARTS).map(([k, p]) => [k, p.name]));
  const caption = hidden ? 'توقّع: إلى أين يذهب الدم بعد ذلك؟' : `${HEART_STAGES[Math.round(stage) - 1]} · الدم ${rich ? 'غني بالأكسجين (أحمر)' : 'فقير بالأكسجين (أزرق)'}`;
  return scene('sci-scene heart-scene', `القلب والدورة الدموية — ${caption}`, body + tags(anchors, names, part, hidden, {left: 90, right: 512, top: 60, bottom: 250}) + stageChips(HEART_STAGES, stage), caption);
}
export const heartFacts = (v, hidden) => { const p = HEART_PARTS[v.part]; return hidden ? 'الأسماء مخفية: سمِّ الأجزاء ثم انتظر الكشف.' : v.part !== 'none' && p ? `${p.name} · ${p.about}` : 'القلب مضخة من أربع حجرات: الجانب الأيمن يرسل الدم إلى الرئتين، والأيسر يرسله إلى الجسم.'; };

// ---------------------------------------------------------------- the plant and photosynthesis
export const PLANT_PARTS = {none: {name: 'كل الأجزاء'}, root: {name: 'الجذر', about: 'يثبّت النبات ويمتص الماء والأملاح من التربة.'}, stem: {name: 'الساق', about: 'تحمل الأوراق وتنقل الماء إلى أعلى والغذاء إلى بقية النبات.'},
  leaf: {name: 'الورقة', about: 'فيها يصنع النبات غذاءه (البناء الضوئي) مستعينًا بضوء الشمس.'}, flower: {name: 'الزهرة', about: 'عضو التكاثر: تتكوّن منها الثمار والبذور.'}};
export function renderPlant(values, {hidden = false} = {}) {
  const part = PLANT_PARTS[values.part] ? values.part : 'none', light = clamp(Number(values.light ?? 6), 0, 10), rate = light / 10;
  const body = `<rect x="0" y="230" width="600" height="70" fill="#8d6e63"/><rect x="0" y="0" width="600" height="230" fill="#eaf6ff"/>${sun(70, 60, 16 + light * 1.4)}
${Array.from({length: 4}, (_, i) => `<line x1="${100 + i * 14}" y1="${80 + i * 10}" x2="${230 - i * 4}" y2="${110 + i * 12}" stroke="#f29b00" stroke-width="2" opacity="${(0.15 + 0.85 * rate).toFixed(2)}"/>`).join('')}
${organ('root', part, `<path d="M300 232 L300 270 M300 246 L276 268 M300 246 L324 270 M300 260 L286 286 M300 260 L316 288 M276 268 l-10 10 M324 270 l12 8" stroke="#f3e1c2" stroke-width="4" fill="none" stroke-linecap="round"/>`)}
${organ('stem', part, `<path d="M300 232 Q296 170 300 96" stroke="#5b8c2a" stroke-width="8" fill="none" stroke-linecap="round"/>`)}
${organ('leaf', part, `<path d="M298 180 Q250 150 228 170 Q256 194 298 182Z M302 150 Q352 116 378 134 Q350 164 302 152Z M298 130 Q260 100 240 114 Q262 140 298 132Z" fill="${rate > 0.05 ? '#6aa84f' : '#9bbb7f'}" stroke="#3f7a2e" stroke-width="2"/>`)}
${organ('flower', part, `<g transform="translate(300 88)">${[0, 72, 144, 216, 288].map(t => `<ellipse rx="10" ry="16" transform="rotate(${t}) translate(0 -14)" fill="#f48fb1"/>`).join('')}<circle r="8" fill="#ffc107"/></g>`)}
<g opacity="${(0.25 + 0.75 * rate).toFixed(2)}"><path d="M470 130 L392 146" stroke="#607d8b" stroke-width="3" marker-end="url(#pl-in)"/><text x="490" y="122" text-anchor="middle" font-size="13" font-weight="700" fill="#455a64">ثاني أكسيد الكربون</text>
<path d="M232 120 L150 150" stroke="#2e7d32" stroke-width="3" marker-end="url(#pl-out)"/><text x="130" y="170" text-anchor="middle" font-size="13" font-weight="700" fill="#2e7d32">أكسجين</text>
${Array.from({length: Math.round(rate * 6)}, (_, i) => `<circle cx="${150 + (i % 3) * 18}" cy="${190 + Math.floor(i / 3) * 14}" r="4" fill="#81c784"/>`).join('')}</g>
<path d="M330 270 L312 236" stroke="#1e88e5" stroke-width="3" marker-end="url(#pl-w)"/><text x="360" y="284" font-size="13" font-weight="700" fill="#e3f2fd">ماء</text>
<defs><marker id="pl-in" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#607d8b"/></marker><marker id="pl-out" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#2e7d32"/></marker><marker id="pl-w" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="#1e88e5"/></marker></defs>`;
  const anchors = {flower: [300, 88, 'R'], leaf: [356, 136, 'R'], stem: [300, 200, 'L'], root: [282, 262, 'L']};
  const names = Object.fromEntries(Object.entries(PLANT_PARTS).map(([k, p]) => [k, p.name]));
  const caption = hidden ? 'توقّع: ماذا يحدث للنبات إذا قلّ الضوء؟' : light < 0.5 ? 'في الظلام يتوقف البناء الضوئي: لا يصنع النبات غذاءه' : `البناء الضوئي: ماء + ثاني أكسيد الكربون + ضوء ← غذاء (سكر) + أكسجين · الضوء ${ar.format(Math.round(light * 10))}٪`;
  return scene('sci-scene plant-scene', caption, body + tags(anchors, names, part, hidden, {left: 210, right: 420, top: 70, bottom: 230}), caption.length > 72 ? caption.slice(0, 70) + '…' : caption);
}
export const plantFacts = (v, hidden) => { const p = PLANT_PARTS[v.part]; return hidden ? 'الأسماء مخفية: سمِّ أجزاء النبات ثم انتظر الكشف.' : v.part !== 'none' && p ? `${p.name} · ${p.about}` : 'البناء الضوئي: يصنع النبات غذاءه في الورقة من الماء وثاني أكسيد الكربون بطاقة ضوء الشمس، ويُطلق الأكسجين.'; };
