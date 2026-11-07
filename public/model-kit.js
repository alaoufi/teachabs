// Small shared helpers for the interactive models (body systems, solids). Pure functions, SVG strings only.

export const ar = new Intl.NumberFormat('ar-SA', {maximumFractionDigits: 0});
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);

/** A zoom layer that grows as the camera passes it and fades in and out around its own level (k). */
export function layer(k, z, body, cx = 300, cy = 150) {
  const o = clamp(1 - Math.abs(z - k), 0, 1);
  if (o <= 0.001) return '';
  const s = Math.pow(2.2, z - k);
  return `<g opacity="${o.toFixed(3)}" transform="translate(${cx} ${cy}) scale(${s.toFixed(4)}) translate(${-cx} ${-cy})">${body}</g>`;
}

/** A point on a route: `stops[i]` is the index in `points` where stage i+1 sits; a stage between two stops slides along the path. */
export function along(points, stops, stage) {
  const s = clamp(stage, 1, stops.length), k = Math.min(stops.length - 2, Math.floor(s - 1)), f = s - 1 - k;
  const seg = points.slice(stops[k], stops[k + 1] + 1), lens = seg.slice(1).map((p, i) => Math.hypot(p[0] - seg[i][0], p[1] - seg[i][1]));
  let d = f * lens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) { const t = lens[i] ? clamp(d / lens[i], 0, 1) : 0; return [seg[i][0] + (seg[i + 1][0] - seg[i][0]) * t, seg[i][1] + (seg[i + 1][1] - seg[i][1]) * t]; }
    d -= lens[i];
  }
  return seg[seg.length - 1];
}

/** Name tags on both sides with leader lines; sorted by height so lines never cross. Hidden names become numbers. */
export function tags(anchors, names, part, hidden, {left = 196, right = 404, top = 30, bottom = 250} = {}) {
  const order = Object.keys(anchors).sort((a, b) => anchors[a][1] - anchors[b][1]);
  const tag = (id, x, y, side) => {
    const [ax, ay] = anchors[id], on = part === id, n = order.indexOf(id) + 1, text = hidden ? `${ar.format(n)} ؟` : names[id];
    const w = hidden ? 44 : 18 + names[id].length * 8.2, bx = side === 'L' ? Math.max(4, x - w) : Math.min(x, 596 - w); x = side === 'L' ? bx + w : bx;
    return `<g class="c-tag${on ? ' is-on' : ''}${part !== 'none' && !on ? ' c-dim' : ''}" data-tag="${id}"><line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${ax}" y2="${ay}" stroke="${on ? '#e8890c' : '#4d5b60'}" stroke-width="${on ? 2.5 : 1.4}"/>
<circle cx="${ax}" cy="${ay}" r="3.5" fill="${on ? '#e8890c' : '#4d5b60'}"/><rect x="${bx.toFixed(1)}" y="${(y - 13).toFixed(1)}" width="${w.toFixed(1)}" height="26" rx="13" fill="${on ? '#fff1df' : '#ffffff'}" stroke="${on ? '#e8890c' : '#9aa7ab'}" stroke-width="${on ? 2.5 : 1.4}"/>
<text x="${(bx + w / 2).toFixed(1)}" y="${(y + 5).toFixed(1)}" text-anchor="middle" font-size="14" font-weight="${on ? 800 : 600}" fill="#163d34">${esc(text)}</text></g>`;
  };
  const side = (s, x) => { const ids = order.filter(id => anchors[id][2] === s); return ids.map((id, i) => tag(id, x, ids.length === 1 ? anchors[id][1] : top + i * ((bottom - top) / (ids.length - 1)), s)).join(''); };
  return side('L', left) + side('R', right);
}

/** An organ group: pulses when chosen, fades when another part is chosen. */
export const organ = (id, part, body) => `<g class="c-part${part === id ? ' c-hl' : ''}${part !== 'none' && part !== id ? ' c-dim' : ''}" data-part="${id}">${body}</g>`;

/** Stage chips on top: «١ الفم ← ٢ المريء …»; the current one is filled. */
export function stageChips(names, stage) {
  const n = names.length, w = Math.min(96, 580 / n), cur = Math.round(stage);
  return names.map((name, i) => {
    const x = 590 - (i + 1) * w, on = cur === i + 1;
    return `<g class="c-crumb${on ? ' is-on' : ''}"><rect x="${(x + 2).toFixed(1)}" y="4" width="${(w - 4).toFixed(1)}" height="22" rx="11" fill="${on ? '#155c4d' : '#eef3f1'}"/><text x="${(x + w / 2).toFixed(1)}" y="19" text-anchor="middle" font-size="11.5" font-weight="${on ? 800 : 600}" fill="${on ? '#ffffff' : '#50645a'}">${esc(`${ar.format(i + 1)} ${name}`)}</text></g>`;
  }).join('');
}

export const scene = (cls, label, body, caption, id = cls.split(' ').pop()) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300" class="${cls}" direction="ltr" role="img" aria-label="${esc(label)}">
<defs><radialGradient id="${id}-bg" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eef5f2"/></radialGradient></defs>
<rect width="600" height="300" fill="url(#${id}-bg)"/>${body}
<text x="300" y="292" class="c-caption" text-anchor="middle" font-size="14.5" font-weight="700" fill="#163d34">${esc(caption)}</text></svg>`;
