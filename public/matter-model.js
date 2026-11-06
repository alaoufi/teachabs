// Original "states of water" activity for grade 4 science: the teacher heats or cools water and everyone sees
// ice, melting, liquid, boiling and steam, with a magnifier showing how the particles move.
// Pure functions shared by the server, the board and the tests. SVG uses attributes and classes only (no inline styles).

export const TEMP_MIN = -20, TEMP_MAX = 120;
const ar = new Intl.NumberFormat('ar-SA', {maximumFractionDigits: 0});
export const formatTemp = t => `${ar.format(Math.round(t))}°س`;

export const PHASES = {
  solid: {name: 'صلب (جليد)', tone: '#9fd3f2'},
  melting: {name: 'ينصهر: صلب وسائل معًا', tone: '#7cc2ee'},
  liquid: {name: 'سائل (ماء)', tone: '#3d9be0'},
  boiling: {name: 'يغلي: السائل يتحول إلى غاز', tone: '#3d9be0'},
  gas: {name: 'غاز (بخار الماء)', tone: '#d7e6f2'}
};

/** Water at sea level: frozen below 0°, melting at 0°, boiling at 100°. A teaching simplification. */
export function phaseOf(temp) {
  const t = Math.round(temp);
  if (t < 0) return 'solid';
  if (t === 0) return 'melting';
  if (t < 100) return 'liquid';
  if (t === 100) return 'boiling';
  return 'gas';
}
export const motionOf = phase => ({solid: 'يهتز في مكانه', melting: 'يبدأ بالتحرر من مكانه', liquid: 'ينزلق ويتحرك', boiling: 'يتحرك بسرعة ويهرب', gas: 'يتحرك بسرعة كبيرة ويتباعد'})[phase];

function rand(seed) { let x = seed % 2147483647; if (x <= 0) x += 2147483646; return () => (x = x * 16807 % 2147483647) / 2147483647; }

function particles(phase, cx, cy, r) {
  const out = [], next = rand(7);
  const speed = phase === 'solid' ? 'p-vib' : phase === 'melting' ? 'p-vib p-loose' : phase === 'liquid' ? 'p-flow' : phase === 'boiling' ? 'p-flow p-fast' : 'p-fly';
  if (phase === 'solid' || phase === 'melting') {
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
      const loose = phase === 'melting' && (i + j) % 3 === 0;
      out.push([cx - 44 + i * 22 + (loose ? next() * 10 - 5 : 0), cy - 44 + j * 22 + (loose ? next() * 10 - 5 : 0)]);
    }
  } else if (phase === 'liquid' || phase === 'boiling') {
    for (let k = 0; k < 20; k++) out.push([cx - 58 + next() * 116, cy - 18 + next() * 66]);
  } else {
    for (let k = 0; k < 8; k++) { const a = next() * Math.PI * 2, d = 20 + next() * 50; out.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]); }
  }
  return out.map(([x, y], i) => `<circle class="particle ${speed} pd${i % 4}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" fill="#2f7fd0" stroke="#174f86" stroke-width="1.5"/>`).join('');
}

export function renderMatter(values, {hidden = false} = {}) {
  const temp = Math.max(TEMP_MIN, Math.min(TEMP_MAX, Number(values.temp ?? 25))), phase = phaseOf(temp), p = PHASES[phase];
  const level = (temp - TEMP_MIN) / (TEMP_MAX - TEMP_MIN), tubeTop = 40, tubeBottom = 240, fillY = tubeBottom - level * (tubeBottom - tubeTop);
  const ticks = [-20, 0, 25, 50, 75, 100, 120].map(v => { const y = tubeBottom - (v - TEMP_MIN) / (TEMP_MAX - TEMP_MIN) * (tubeBottom - tubeTop); return `<line x1="70" y1="${y.toFixed(1)}" x2="80" y2="${y.toFixed(1)}" stroke="#123b41" stroke-width="1.5"/><text x="86" y="${(y + 4).toFixed(1)}" class="m-tick">${ar.format(v)}</text>`; }).join('');
  const heat = temp > 30 ? `<g class="m-flame ${temp >= 100 ? 'is-strong' : ''}"><path d="M290 286 q-12 -18 0 -34 q4 12 12 4 q10 16 -2 30 z" fill="#f28c28"/><path d="M296 286 q-6 -10 0 -18 q6 8 4 18 z" fill="#ffd34d"/></g>` : '';
  const cold = temp < 0 ? `<g class="m-cold" fill="#5aa9e6"><text x="280" y="290" class="m-icon">❄</text></g>` : '';
  let beaker = '';
  if (hidden) beaker = '<rect x="212" y="92" width="156" height="148" rx="8" fill="#e9eef2"/><text x="290" y="182" class="m-q">؟</text>';
  else if (phase === 'solid') beaker = '<rect x="236" y="168" width="108" height="70" rx="10" fill="#c9ecff" stroke="#7cc2ee" stroke-width="3"/><path d="M248 180 l22 0 M300 196 l30 0" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/>';
  else if (phase === 'melting') beaker = '<rect x="214" y="206" width="152" height="34" fill="#7cc2ee" opacity=".75"/><rect x="252" y="178" width="76" height="46" rx="8" fill="#c9ecff" stroke="#7cc2ee" stroke-width="3"/>';
  else if (phase === 'liquid') beaker = '<rect x="214" y="170" width="152" height="70" fill="#3d9be0" opacity=".8"/><path d="M214 170 q38 -8 76 0 t76 0" fill="none" stroke="#bfe3ff" stroke-width="3"/>';
  else if (phase === 'boiling') beaker = '<rect x="214" y="178" width="152" height="62" fill="#3d9be0" opacity=".8"/>' + [236, 268, 300, 334].map((x, i) => `<circle class="m-bubble mb${i}" cx="${x}" cy="230" r="${5 + i % 2 * 3}" fill="#e8f6ff" stroke="#fff"/>`).join('') + '<path class="m-steam" d="M250 120 q-10 -20 6 -36 M290 116 q-10 -22 6 -40 M330 120 q-10 -20 6 -36" fill="none" stroke="#c8d6e2" stroke-width="5" stroke-linecap="round"/>';
  else beaker = '<rect x="214" y="232" width="152" height="8" fill="#3d9be0" opacity=".35"/><path class="m-steam" d="M236 96 q-14 -24 8 -44 M272 90 q-14 -24 8 -46 M308 90 q-14 -24 8 -46 M344 96 q-14 -24 8 -44" fill="none" stroke="#c8d6e2" stroke-width="7" stroke-linecap="round"/>';
  const lens = hidden ? '<text x="490" y="168" class="m-q">؟</text>' : particles(phase, 490, 150, 85);
  const label = hidden ? 'توقّع: ما حالة الماء الآن؟' : p.name;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300" class="matter-scene" direction="ltr" role="img" aria-label="${hidden ? `درجة الحرارة ${formatTemp(temp)}. حالة الماء مخفية حتى يكشفها المعلم.` : `درجة الحرارة ${formatTemp(temp)}. الماء ${p.name}، والجزيء ${motionOf(phase)}.`}">
<defs><linearGradient id="mbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${temp < 0 ? '#e7f3fb' : temp >= 100 ? '#fff1e3' : '#f3f8fb'}"/><stop offset="1" stop-color="#ffffff"/></linearGradient><clipPath id="mlens"><circle cx="490" cy="150" r="85"/></clipPath></defs>
<rect width="600" height="300" fill="url(#mbg)"/>
<rect x="60" y="${tubeTop - 10}" width="12" height="${tubeBottom - tubeTop + 10}" rx="6" fill="#fff" stroke="#123b41" stroke-width="2"/>
<rect x="63" y="${fillY.toFixed(1)}" width="6" height="${(tubeBottom - fillY).toFixed(1)}" fill="#d63a2f"/><circle cx="66" cy="${tubeBottom + 10}" r="12" fill="#d63a2f" stroke="#123b41" stroke-width="2"/>
${ticks}<text x="66" y="22" class="m-temp" text-anchor="middle">${formatTemp(temp)}</text>
${beaker}
<path d="M206 70 L206 244 Q206 252 214 252 L366 252 Q374 252 374 244 L374 70" fill="none" stroke="#5f7d8c" stroke-width="5" stroke-linejoin="round"/>
<line x1="196" y1="70" x2="384" y2="70" stroke="#5f7d8c" stroke-width="5" stroke-linecap="round"/>
<rect x="250" y="258" width="80" height="8" rx="3" fill="#8a949e"/>${heat}${cold}
<circle cx="490" cy="150" r="88" fill="#ffffff" stroke="#123b41" stroke-width="4"/>
<g clip-path="url(#mlens)">${lens}</g>
<line x1="552" y1="212" x2="586" y2="250" stroke="#123b41" stroke-width="10" stroke-linecap="round"/>
<text x="490" y="262" class="m-small" text-anchor="middle">العدسة: الجزيئات</text>
<text x="290" y="40" class="m-phase" text-anchor="middle">${label}</text>
</svg>`;
}

export function matterFacts(values, hidden) {
  const phase = phaseOf(values.temp);
  return hidden ? `درجة الحرارة ${formatTemp(values.temp)} · الحالة مخفية: توقّع ثم انتظر الكشف.` : `درجة الحرارة ${formatTemp(values.temp)} · ${PHASES[phase].name} · الجزيء ${motionOf(phase)}`;
}
