// Original "cells" activity for grade 4 science (Unit 1, Chapter 1, Lesson 1 in the 1447 AH Ministry book order).
// The teacher zooms from the whole living thing to its organ, its tissue under the microscope and one cell,
// switches between a plant and an animal cell, and spotlights one part at a time. Names can be hidden so
// students predict first. Drawings and wording are the project's own; no textbook content is copied.
// Pure functions shared by the server, the board and the tests. SVG uses attributes and classes only.

const ar = new Intl.NumberFormat('ar-SA', {maximumFractionDigits: 0});

export const LEVELS = ['', 'المخلوق الحي', 'العضو', 'النسيج تحت المجهر', 'الخلية'];
export const formatLevel = z => LEVELS[Math.min(4, Math.max(1, Math.round(z)))];

export const KINDS = {plant: 'خلية نباتية', animal: 'خلية حيوانية'};

export const PARTS = {
  none: {name: 'كل الأجزاء'},
  wall: {name: 'جدار الخلية', plantOnly: true, about: 'غلاف صلب خارج الغشاء يدعم الخلية النباتية ويحميها.'},
  membrane: {name: 'الغشاء الخلوي', about: 'يحيط بالخلية ويتحكم فيما يدخلها ويخرج منها.'},
  nucleus: {name: 'النواة', about: 'تتحكم في أنشطة الخلية، وفيها المادة الوراثية.'},
  cytoplasm: {name: 'السيتوبلازم', about: 'مادة هلامية تملأ الخلية وتسبح فيها أجزاؤها.'},
  chloroplast: {name: 'البلاستيدات الخضراء', plantOnly: true, about: 'فيها الكلوروفيل الأخضر، يصنع بها النبات غذاءه مستعينًا بضوء الشمس.'},
  mitochondria: {name: 'الميتوكندريا', about: 'تُطلق الطاقة من الغذاء لتقوم الخلية بعملها.'},
  vacuole: {name: 'الفجوة', about: 'تخزّن الماء والمواد؛ كبيرة في الخلية النباتية وصغيرة في الحيوانية.'}
};

const ORGAN = {plant: 'الورقة', animal: 'القلب'}, ORGANISM = {plant: 'نبات', animal: 'إنسان'}, TISSUE = {plant: 'نسيج الورقة', animal: 'نسيج عضلة القلب'};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);

/** One zoom layer: grows as the camera passes it and fades in and out around its own level. */
function layer(k, z, body) {
  const o = clamp(1 - Math.abs(z - k), 0, 1);
  if (o <= 0.001) return '';
  const s = Math.pow(2.2, z - k);
  return `<g opacity="${o.toFixed(3)}" transform="translate(300 160) scale(${s.toFixed(4)}) translate(-300 -160)">${body}</g>`;
}

const focusBox = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="none" stroke="#e8890c" stroke-width="3" stroke-dasharray="8 6" class="c-focus"/>`;

function organism(kind) {
  if (kind === 'plant') return `<rect x="262" y="236" width="76" height="46" rx="6" fill="#b5653a"/><rect x="256" y="228" width="88" height="14" rx="5" fill="#c97a4a"/>
<path d="M300 230 C300 190 298 150 300 92" stroke="#3f8a3a" stroke-width="7" fill="none" stroke-linecap="round"/>
<path d="M300 170 C262 150 238 160 222 178 C250 190 280 186 300 170 Z" fill="#5cb85c" stroke="#2f7a2f" stroke-width="2"/>
<path d="M300 140 C336 116 364 124 380 142 C352 158 322 156 300 140 Z" fill="#5cb85c" stroke="#2f7a2f" stroke-width="2"/>
<path d="M300 100 C280 74 286 56 300 46 C314 56 320 74 300 100 Z" fill="#6cc46c" stroke="#2f7a2f" stroke-width="2"/>${focusBox(326, 120, 50, 36)}`;
  return `<circle cx="300" cy="74" r="30" fill="#f2c8a0" stroke="#8a5a3c" stroke-width="2"/><circle cx="290" cy="70" r="3" fill="#4a2a14"/><circle cx="310" cy="70" r="3" fill="#4a2a14"/>
<path d="M290 86 q10 8 20 0" stroke="#8a5a3c" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<rect x="264" y="108" width="72" height="104" rx="22" fill="#5a8fd0" stroke="#2f5f9a" stroke-width="2"/>
<path d="M266 124 L232 186 M334 124 L368 186" stroke="#f2c8a0" stroke-width="14" stroke-linecap="round"/>
<path d="M284 210 L278 278 M316 210 L322 278" stroke="#34507a" stroke-width="16" stroke-linecap="round"/>
<path d="M302 138 c-6 -8 -18 -4 -16 6 c2 8 16 16 16 16 c0 0 14 -8 16 -16 c2 -10 -10 -14 -16 -6 z" fill="#d63a2f"/>${focusBox(278, 126, 48, 42)}`;
}

function organ(kind) {
  if (kind === 'plant') return `<path d="M150 170 C210 70 380 60 460 150 C380 240 210 250 150 170 Z" fill="#5cb85c" stroke="#2f7a2f" stroke-width="3"/>
<path d="M150 170 L460 150" stroke="#2f7a2f" stroke-width="3" fill="none"/>${[220, 280, 340, 400].map(x => `<path d="M${x} ${168 - (x - 150) * 0.065} l30 -42 M${x} ${168 - (x - 150) * 0.065} l30 40" stroke="#2f7a2f" stroke-width="2" fill="none"/>`).join('')}
<path d="M96 178 L150 170" stroke="#3f8a3a" stroke-width="6" stroke-linecap="round"/>${focusBox(270, 132, 54, 40)}`;
  return `<path d="M300 268 C220 214 168 170 172 118 C176 72 232 58 270 92 C282 102 292 114 300 128 C308 114 318 102 330 92 C368 58 424 72 428 118 C432 170 380 214 300 268 Z" fill="#d63a2f" stroke="#8e2219" stroke-width="3"/>
<path d="M262 96 C256 70 262 52 276 44 M330 92 C336 66 350 54 366 52" stroke="#b23128" stroke-width="12" fill="none" stroke-linecap="round"/>
<path d="M220 140 C250 160 270 190 296 220" stroke="#f27f74" stroke-width="4" fill="none" opacity=".7"/>${focusBox(274, 140, 52, 40)}`;
}

function tissue(kind) {
  let cells = '';
  if (kind === 'plant') {
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
      const x = 186 + c * 38 + (r % 2) * 19, y = 70 + r * 46;
      cells += `<rect x="${x}" y="${y}" width="36" height="44" rx="4" fill="#dff2d0" stroke="#3f8a3a" stroke-width="2.5"/><circle cx="${x + 12}" cy="${y + 16}" r="5" fill="#7a4fa0"/>${[[24, 10], [26, 30], [8, 34]].map(([dx, dy]) => `<ellipse cx="${x + dx}" cy="${y + dy}" rx="5" ry="3" fill="#3f9a3a"/>`).join('')}`;
    }
  } else {
    for (let r = 0; r < 5; r++) {
      const y = 66 + r * 38;
      cells += `<rect x="180" y="${y}" width="240" height="34" rx="16" fill="#f6c7c0" stroke="#b5453a" stroke-width="2"/>${[0, 1, 2].map(k => `<ellipse cx="${230 + k * 76 + (r % 2) * 20}" cy="${y + 17}" rx="9" ry="6" fill="#7a3f8a"/>`).join('')}${[0, 1, 2, 3, 4, 5, 6, 7].map(k => `<line x1="${196 + k * 28}" y1="${y + 4}" x2="${196 + k * 28}" y2="${y + 30}" stroke="#d98a80" stroke-width="2"/>`).join('')}`;
    }
  }
  return `<defs><clipPath id="clens"><circle cx="300" cy="156" r="104"/></clipPath></defs><circle cx="300" cy="156" r="110" fill="#fffef6" stroke="#2b3a40" stroke-width="10"/>
<g clip-path="url(#clens)">${cells}</g>${focusBox(kind === 'plant' ? 282 : 280, kind === 'plant' ? 114 : 100, kind === 'plant' ? 40 : 60, kind === 'plant' ? 48 : 40)}`;
}

/** One cell with its parts; `part` is highlighted, the rest dimmed. Returns the drawing and the label list. */
function oneCell(kind, part, hidden) {
  const has = id => kind === 'plant' || !PARTS[id].plantOnly;
  const cls = id => part === 'none' ? 'c-part' : part === id ? 'c-part c-hl' : 'c-part c-dim';
  const g = (id, body) => has(id) ? `<g class="${cls(id)}" data-part="${id}">${body}</g>` : '';
  let shape;
  if (kind === 'plant') {
    shape = g('wall', '<rect x="186" y="58" width="228" height="204" rx="18" fill="#9fd08a" stroke="#2f7a2f" stroke-width="10"/>') +
      g('cytoplasm', '<rect x="198" y="70" width="204" height="180" rx="12" fill="#e8f6dc"/>') +
      g('membrane', '<rect x="198" y="70" width="204" height="180" rx="12" fill="none" stroke="#5b8f3c" stroke-width="3"/>') +
      g('vacuole', '<path d="M262 96 C330 86 384 104 386 160 C388 214 330 236 276 226 C238 218 236 184 248 160 C258 138 236 104 262 96 Z" fill="#bfe3f7" stroke="#5aa9d6" stroke-width="2.5"/>') +
      g('nucleus', '<circle cx="226" cy="108" r="22" fill="#b993d6" stroke="#6b3f8f" stroke-width="3"/><circle cx="230" cy="104" r="7" fill="#6b3f8f"/>') +
      g('chloroplast', [[220, 170], [222, 218], [300, 240], [372, 230], [392, 92], [326, 80]].map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="15" ry="8" transform="rotate(${(i * 37) % 80 - 40} ${x} ${y})" fill="#3f9a3a" stroke="#1f6a1f" stroke-width="1.5"/><path d="M${x - 9} ${y} h18" stroke="#9fe08f" stroke-width="1.5" transform="rotate(${(i * 37) % 80 - 40} ${x} ${y})"/>`).join('')) +
      g('mitochondria', [[262, 200], [356, 246]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="13" ry="7" fill="#f2a65a" stroke="#b5652a" stroke-width="1.5"/><path d="M${x - 9} ${y} q3 -5 6 0 t6 0 t6 0" stroke="#b5652a" stroke-width="1.3" fill="none"/>`).join(''));
  } else {
    const blob = 'M300 62 C362 58 412 96 414 154 C416 214 372 260 304 262 C236 264 186 228 186 166 C186 104 236 66 300 62 Z';
    shape = g('cytoplasm', `<path d="${blob}" fill="#fde3dc"/>`) +
      g('membrane', `<path d="${blob}" fill="none" stroke="#c0574a" stroke-width="4"/>`) +
      g('vacuole', [[356, 112], [236, 210], [372, 214]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#bfe3f7" stroke="#5aa9d6" stroke-width="2"/>`).join('')) +
      g('nucleus', '<circle cx="300" cy="160" r="30" fill="#b993d6" stroke="#6b3f8f" stroke-width="3"/><circle cx="306" cy="154" r="10" fill="#6b3f8f"/>') +
      g('mitochondria', [[238, 128], [356, 176], [292, 226], [326, 98]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="14" ry="7" fill="#f2a65a" stroke="#b5652a" stroke-width="1.5"/><path d="M${x - 10} ${y} q3 -5 6 0 t6 0 t6 0" stroke="#b5652a" stroke-width="1.3" fill="none"/>`).join(''));
  }
  // Labels: name tags on both sides, sorted by height so leader lines never cross.
  const anchors = kind === 'plant'
    ? {wall: [188, 78, 'L'], nucleus: [206, 108, 'L'], membrane: [199, 196, 'L'], cytoplasm: [236, 236, 'L'], chloroplast: [392, 92, 'R'], vacuole: [384, 160, 'R'], mitochondria: [356, 246, 'R']}
    : {mitochondria: [238, 128, 'L'], membrane: [187, 172, 'L'], cytoplasm: [250, 238, 'L'], vacuole: [356, 112, 'R'], nucleus: [330, 164, 'R']};
  const order = Object.keys(anchors).sort((a, b) => anchors[a][1] - anchors[b][1]);
  const tag = (id, x, y, side) => {
    const [ax, ay] = anchors[id], on = part === id, n = order.indexOf(id) + 1;
    const text = hidden ? `${ar.format(n)} ؟` : PARTS[id].name;
    const w = hidden ? 44 : 18 + PARTS[id].name.length * 8.6, bx = side === 'L' ? Math.max(4, x - w) : Math.min(x, 596 - w); x = side === 'L' ? bx + w : bx;
    return `<g class="c-tag${on ? ' is-on' : ''}${part !== 'none' && !on ? ' c-dim' : ''}"><line x1="${x}" y1="${y}" x2="${ax}" y2="${ay}" stroke="${on ? '#e8890c' : '#4d5b60'}" stroke-width="${on ? 2.5 : 1.5}"/>
<circle cx="${ax}" cy="${ay}" r="3.5" fill="${on ? '#e8890c' : '#4d5b60'}"/><rect x="${bx.toFixed(1)}" y="${y - 13}" width="${w.toFixed(1)}" height="26" rx="13" fill="${on ? '#fff1df' : '#ffffff'}" stroke="${on ? '#e8890c' : '#9aa7ab'}" stroke-width="${on ? 2.5 : 1.5}"/>
<text x="${(bx + w / 2).toFixed(1)}" y="${y + 5}" text-anchor="middle" font-size="14" font-weight="${on ? 800 : 600}" fill="#163d34">${esc(text)}</text></g>`;
  };
  const sideTags = (side, x) => { const ids = order.filter(id => anchors[id][2] === side); return ids.map((id, i) => tag(id, x, ids.length === 1 ? anchors[id][1] : 72 + i * (180 / (ids.length - 1)), side)).join(''); };
  const tags = sideTags('L', 170) + sideTags('R', 430);
  const missing = part !== 'none' && !has(part) ? `<g><rect x="200" y="132" width="200" height="56" rx="12" fill="#fff1df" stroke="#e8890c" stroke-width="2.5"/><text x="300" y="156" text-anchor="middle" font-size="15" font-weight="800" fill="#7a3f00">${esc(PARTS[part].name)}</text><text x="300" y="177" text-anchor="middle" font-size="13" fill="#7a3f00">لا يوجد في الخلية الحيوانية</text></g>` : '';
  return shape + tags + missing;
}

export function renderCells(values, {hidden = false} = {}) {
  const kind = KINDS[values.kind] ? values.kind : 'plant', part = PARTS[values.part] ? values.part : 'none';
  const z = clamp(Number(values.zoom ?? 1), 1, 4), level = Math.round(z);
  const crumbs = [1, 2, 3, 4].map(k => {
    const x = 560 - (k - 1) * 130, on = level === k, name = k === 1 ? `${LEVELS[1]}: ${ORGANISM[kind]}` : k === 2 ? `${LEVELS[2]}: ${ORGAN[kind]}` : k === 3 ? 'النسيج' : 'الخلية';
    return `<g class="c-crumb${on ? ' is-on' : ''}"><rect x="${x - 118}" y="6" width="118" height="26" rx="13" fill="${on ? '#155c4d' : '#eef3f1'}"/><text x="${x - 59}" y="24" text-anchor="middle" font-size="12.5" font-weight="${on ? 800 : 600}" fill="${on ? '#ffffff' : '#50645a'}">${esc(name)}</text></g>${k < 4 ? `<text x="${x - 124}" y="24" text-anchor="middle" font-size="13" fill="#9aa7ab">←</text>` : ''}`;
  }).join('');
  const caption = level === 4 ? KINDS[kind] : level === 3 ? TISSUE[kind] + ': خلايا متشابهة تعمل معًا' : level === 2 ? `${ORGAN[kind]}: عضو يتكون من أنسجة` : `${ORGANISM[kind]}: مخلوق حي يتكون من أجهزة وأعضاء`;
  const label = hidden && level === 4 ? 'توقّع: ما اسم كل جزء؟' : caption;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300" class="cells-scene" direction="ltr" role="img" aria-label="${esc(`${KINDS[kind]} — ${LEVELS[level]}. ${hidden ? 'أسماء الأجزاء مخفية حتى يكشفها المعلم.' : caption}`)}">
<defs><radialGradient id="cbg" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eef5f2"/></radialGradient></defs>
<rect width="600" height="300" fill="url(#cbg)"/>
<g>${layer(1, z, organism(kind))}${layer(2, z, organ(kind))}${layer(3, z, tissue(kind))}${layer(4, z, oneCell(kind, part, hidden))}</g>
${crumbs}
<text x="300" y="284" class="c-caption" text-anchor="middle" font-size="15" font-weight="700" fill="#163d34">${esc(label)}</text>
</svg>`;
}

export function cellsFacts(values, hidden) {
  const kind = KINDS[values.kind] ? values.kind : 'plant', part = PARTS[values.part] ? values.part : 'none', level = Math.round(clamp(Number(values.zoom ?? 1), 1, 4));
  if (level < 4) return `${LEVELS[level]} · الخلية أصغر وحدة في بناء المخلوق الحي: خلايا ← نسيج ← عضو ← جهاز ← مخلوق.`;
  if (hidden) return `${KINDS[kind]} · الأسماء مخفية: توقّع اسم كل جزء ثم انتظر الكشف.`;
  if (part === 'none') return kind === 'plant' ? 'خلية نباتية · لها جدار خلية وبلاستيدات خضراء وفجوة كبيرة.' : 'خلية حيوانية · ليس لها جدار خلية ولا بلاستيدات خضراء.';
  if (PARTS[part].plantOnly && kind === 'animal') return `${PARTS[part].name} · لا يوجد في الخلية الحيوانية. ${PARTS[part].about}`;
  return `${PARTS[part].name} · ${PARTS[part].about}`;
}
