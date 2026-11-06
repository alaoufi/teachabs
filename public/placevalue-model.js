// Original "place value up to hundred thousands" activity for grade 4 math (Chapter 1, Lesson 1 in the 1447 AH
// Ministry book order). The teacher builds a number, picks a place to spotlight, and everyone sees the digit's place,
// its value, an abacus and the standard and expanded forms. The value can be hidden so students work it out first.
// Drawings and wording are the project's own. Pure functions; SVG uses attributes and classes only.

export const PV_MAX = 999999;
const fmt = new Intl.NumberFormat('ar-SA', {maximumFractionDigits: 0});
const plain = new Intl.NumberFormat('ar-SA', {maximumFractionDigits: 0, useGrouping: false});
export const formatNumber = n => fmt.format(Math.round(n));

// Highest place first, the way a number is read.
export const PLACES = {
  hundredThousands: {name: 'مئات الألوف', unit: 100000},
  tenThousands: {name: 'عشرات الألوف', unit: 10000},
  thousands: {name: 'آحاد الألوف', unit: 1000},
  hundreds: {name: 'المئات', unit: 100},
  tens: {name: 'العشرات', unit: 10},
  ones: {name: 'الآحاد', unit: 1}
};
const ORDER = Object.keys(PLACES);

export const clampNumber = n => Math.min(PV_MAX, Math.max(0, Math.round(Number(n) || 0)));
export const digitAt = (n, place) => Math.floor(clampNumber(n) / PLACES[place].unit) % 10;
export const placeValue = (n, place) => digitAt(n, place) * PLACES[place].unit;

/** Expanded form: the value of each non-zero digit, highest place first. */
export function expandedForm(n) {
  const parts = ORDER.map(p => placeValue(n, p)).filter(v => v > 0);
  return parts.length ? parts.map(v => plain.format(v)).join(' + ') : plain.format(0);
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);

export function renderPlaceValue(values, {hidden = false} = {}) {
  const n = clampNumber(values.number ?? 0), focus = PLACES[values.place] ? values.place : 'ones';
  const used = Math.max(1, String(n).length); // how many places the number fills (leading places stay empty)
  // Columns left to right on the page: hundred thousands … ones (numbers are written left to right).
  const colW = 88, x0 = 300 - colW * 3;
  const cols = ORDER.map((p, i) => {
    const x = x0 + i * colW + (i >= 3 ? 8 : -8), on = p === focus, filled = 6 - i <= used, d = digitAt(n, p);
    const beads = filled ? Array.from({length: d}, (_, k) => `<ellipse cx="${x + colW / 2}" cy="${206 - k * 5}" rx="15" ry="2.9" fill="${on ? '#e8890c' : i < 3 ? '#2f7fd0' : '#3f9a3a'}" stroke="#ffffff" stroke-width="1"/>`).join('') : '';
    return `<g class="pv-col${on ? ' is-on' : ''}" data-place="${p}">
<rect x="${x + 4}" y="50" width="${colW - 8}" height="34" rx="8" fill="${on ? '#fff1df' : '#f4f7f6'}" stroke="${on ? '#e8890c' : '#c5d2cf'}" stroke-width="${on ? 3 : 1.5}"/>
<text x="${x + colW / 2}" y="72" text-anchor="middle" font-size="12.5" font-weight="${on ? 800 : 600}" fill="#163d34">${PLACES[p].name}</text>
<rect x="${x + 10}" y="88" width="${colW - 20}" height="52" rx="10" fill="${on ? '#e8890c' : filled ? '#ffffff' : '#f4f7f6'}" stroke="${on ? '#b8640a' : '#9fb0ad'}" stroke-width="2"/>
<text x="${x + colW / 2}" y="127" text-anchor="middle" font-size="36" font-weight="800" fill="${on ? '#ffffff' : filled ? '#163d34' : '#c5d2cf'}" class="pv-digit">${filled ? plain.format(d) : ''}</text>
<line x1="${x + colW / 2}" y1="146" x2="${x + colW / 2}" y2="212" stroke="#8a6a4a" stroke-width="3"/>${beads}</g>`;
  }).join('');
  const periods = `<rect x="${x0 - 12}" y="26" width="${colW * 3 + 8}" height="21" rx="8" fill="#dbe9f7"/><text x="${x0 - 12 + (colW * 3 + 8) / 2}" y="41" text-anchor="middle" font-size="13" font-weight="800" fill="#1f5fa8">الألوف</text>
<rect x="${x0 + colW * 3 + 4}" y="26" width="${colW * 3 + 8}" height="21" rx="8" fill="#dcefd9"/><text x="${x0 + colW * 3 + 4 + (colW * 3 + 8) / 2}" y="41" text-anchor="middle" font-size="13" font-weight="800" fill="#2f7a2f">الآحاد</text>
<rect x="${x0 - 14}" y="210" width="${colW * 6 + 28}" height="7" rx="3" fill="#8a6a4a"/>`;
  const d = digitAt(n, focus), v = placeValue(n, focus);
  const valueLine = hidden ? `قيمة الرقم ${plain.format(d)} في منزلة ${PLACES[focus].name} = ؟` : `قيمة الرقم ${plain.format(d)} في منزلة ${PLACES[focus].name} = ${formatNumber(v)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300" class="pv-scene" direction="ltr" role="img" aria-label="${esc(`العدد ${formatNumber(n)}. ${hidden ? 'قيمة الرقم المظلل مخفية حتى يكشفها المعلم.' : valueLine}`)}">
<rect width="600" height="300" fill="#fbfdfc"/>
<text x="590" y="18" text-anchor="end" font-size="14" font-weight="800" fill="#155c4d">لوحة المنازل</text>
${periods}${cols}
<g direction="rtl"><text x="590" y="236" text-anchor="start" font-size="15" font-weight="700" fill="#163d34" direction="rtl">الصيغة القياسية: ${formatNumber(n)}</text>
<text x="590" y="256" text-anchor="start" font-size="14" fill="#163d34" direction="rtl">الصيغة التحليلية: ${hidden ? '؟' : expandedForm(n)}</text>
<rect x="10" y="264" width="580" height="24" rx="12" fill="${hidden ? '#fff1df' : '#e6f4ee'}"/><text x="300" y="281" text-anchor="middle" font-size="15" font-weight="800" fill="${hidden ? '#7a3f00' : '#155c4d'}" direction="rtl">${esc(valueLine)}</text></g>
</svg>`;
}

export function placeValueFacts(values, hidden) {
  const n = clampNumber(values.number ?? 0), focus = PLACES[values.place] ? values.place : 'ones';
  if (hidden) return `العدد ${formatNumber(n)} · ما قيمة الرقم ${plain.format(digitAt(n, focus))} في منزلة ${PLACES[focus].name}؟ فكّر ثم انتظر الكشف.`;
  return `العدد ${formatNumber(n)} · ${PLACES[focus].name}: الرقم ${plain.format(digitAt(n, focus))} وقيمته ${formatNumber(placeValue(n, focus))} · كل منزلة عشرة أمثال التي على يمينها.`;
}
