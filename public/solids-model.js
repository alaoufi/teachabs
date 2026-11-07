// Original interactive 3D solids for mathematics: a solid stands on the board in 3D, then unfolds smoothly into its
// net (every face turns about the edge it shares with its neighbour). The teacher marks faces, edges or vertices to
// count them. Pure functions: a tiny 3D engine (hinged faces, orthographic camera, painter's order) drawing SVG.
import {ar, clamp, esc, scene} from './model-kit.js';

export const SOLIDS = {
  cube: {name: 'المكعب', faces: 6, edges: 12, vertices: 8, about: 'ستة أوجه مربعة متطابقة.'},
  cuboid: {name: 'متوازي المستطيلات', faces: 6, edges: 12, vertices: 8, about: 'ستة أوجه مستطيلة، كل وجهين متقابلين متطابقان.'},
  prism: {name: 'المنشور الثلاثي', faces: 5, edges: 9, vertices: 6, about: 'قاعدتان مثلثتان وثلاثة أوجه مستطيلة.'},
  pyramid: {name: 'الهرم الرباعي', faces: 5, edges: 8, vertices: 5, about: 'قاعدة مربعة وأربعة أوجه مثلثة تلتقي في رأس واحد.'},
  cylinder: {name: 'الأسطوانة', faces: 3, edges: 2, vertices: 0, about: 'قاعدتان دائريتان وسطح منحنٍ يُفرد مستطيلًا.', curved: true},
  cone: {name: 'المخروط', faces: 2, edges: 1, vertices: 1, about: 'قاعدة دائرية وسطح منحنٍ يُفرد قطاعًا دائريًا، وله رأس واحد.', curved: true}
};
export const MARKS = {none: 'بلا تمييز', faces: 'الأوجه', edges: 'الأحرف', vertices: 'الرؤوس'};
export const formatUnfold = u => u <= 0.001 ? 'مجسم' : u >= 0.999 ? 'شبكة' : `فتح ${ar.format(Math.round(u * 100))}٪`;

const COLORS = ['#5b9bd5', '#ed7d31', '#70ad47', '#ffc000', '#a682d6', '#e06666', '#4bb3a8'];
const N = 24; // sides used to draw a circle

// ---- vectors
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const centre = ps => ps.reduce((s, p) => add(s, p), [0, 0, 0]).map(v => v / ps.length);
/** Rodrigues rotation of p about the axis through o with unit direction u. */
const rot = (p, o, u, t) => { const v = sub(p, o), c = Math.cos(t), s = Math.sin(t), k = dot(u, v), x = cross(u, v); return add(o, [0, 1, 2].map(i => v[i] * c + x[i] * s + u[i] * k * (1 - c))); };

/** Faces of each solid (y is up, the base lies on y = 0) with the hinge tree that unfolds them: [points, parent, kind]. */
function build(id) {
  const box = (w, h, d) => {
    const P = (x, y, z) => [x * w / 2, y * h, z * d / 2];
    const b = [P(-1, 0, -1), P(1, 0, -1), P(1, 0, 1), P(-1, 0, 1)], t = b.map(p => [p[0], h, p[2]]);
    return [[b, -1, 'base'], [[b[0], b[1], t[1], t[0]], 0], [[b[1], b[2], t[2], t[1]], 0], [[b[2], b[3], t[3], t[2]], 0], [[b[3], b[0], t[0], t[3]], 0], [t, 3, 'top']];
  };
  if (id === 'cube') return box(2, 2, 2);
  if (id === 'cuboid') return box(3, 1.6, 2);
  if (id === 'prism') { // lying on a rectangle; triangles at both ends
    const L = 3.2, a = [-1, 0], b = [1, 0], c = [0, 1.7], P = (q, z) => [q[0], q[1], z];
    return [[[P(a, -L / 2), P(b, -L / 2), P(b, L / 2), P(a, L / 2)], -1, 'base'], [[P(b, -L / 2), P(c, -L / 2), P(c, L / 2), P(b, L / 2)], 0], [[P(c, -L / 2), P(a, -L / 2), P(a, L / 2), P(c, L / 2)], 0],
      [[P(a, -L / 2), P(c, -L / 2), P(b, -L / 2)], 0, 'end'], [[P(a, L / 2), P(b, L / 2), P(c, L / 2)], 0, 'end']];
  }
  if (id === 'pyramid') {
    const b = [[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1]], apex = [0, 2, 0];
    return [[b, -1, 'base'], ...b.map((p, i) => [[p, b[(i + 1) % 4], apex], 0])];
  }
  const r = 1.1, ring = y => Array.from({length: N}, (_, i) => [r * Math.cos(-2 * Math.PI * i / N), y, r * Math.sin(-2 * Math.PI * i / N)]);
  if (id === 'cylinder') {
    const b = ring(0), h = 2.2, t = ring(h), faces = [[b, -1, 'base']];
    for (let i = 0; i < N; i++) faces.push([[b[i], b[(i + 1) % N], t[(i + 1) % N], t[i]], i === 0 ? 0 : i, 'curved']);
    faces.push([[...t], 1, 'top']); // the top circle hinges on the first strip
    return faces;
  }
  // cone: a chain of thin triangles opens into a sector
  const b = ring(0), apex = [0, 2.4, 0], faces = [[b, -1, 'base']];
  for (let i = 0; i < N; i++) faces.push([[b[i], b[(i + 1) % N], apex], i === 0 ? 0 : i, 'curved']);
  return faces;
}

/** The shared edge of two faces (two common points). */
function hinge(a, b) {
  const same = (p, q) => Math.hypot(...sub(p, q)) < 1e-6, common = a.filter(p => b.some(q => same(p, q)));
  return common.length >= 2 ? [common[0], common[1]] : null;
}

/** Face points after unfolding by u (0 solid … 1 flat net). Each face turns about its hinge; children follow parents. */
export function unfold(id, u) {
  const faces = build(id), out = [];
  const normal = ps => norm(cross(sub(ps[1], ps[0]), sub(ps[2], ps[0])));
  const out0 = faces.map(([ps]) => { const n = normal(ps), c = centre(ps); return dot(n, sub(c, [0, 1, 0])) < 0 ? n.map(v => -v) : n; }); // outward normals
  const xf = []; // per face: a function mapping a folded point to its unfolded place
  faces.forEach(([ps, parent], i) => {
    if (parent < 0) { xf[i] = p => p; out.push(ps); return; }
    const [A, B] = hinge(ps, faces[parent][0]), axis = norm(sub(B, A));
    const want = out0[parent], have = out0[i], angle = Math.acos(clamp(dot(want, have), -1, 1));
    const sign = dot(rot(have, [0, 0, 0], axis, angle), want) > dot(rot(have, [0, 0, 0], axis, -angle), want) ? 1 : -1;
    const up = xf[parent], t = sign * angle * u;
    xf[i] = p => up(rot(p, A, axis, t)); out.push(ps.map(xf[i]));
  });
  return faces.map(([, , kind], i) => ({points: out[i], kind: kind || 'side', parent: faces[i][1]}));
}

export function renderSolid(values, {hidden = false} = {}) {
  const id = SOLIDS[values.shape] ? values.shape : 'cube', mark = MARKS[values.mark] ? values.mark : 'none', u = clamp(Number(values.unfold ?? 0), 0, 1), s = SOLIDS[id];
  const faces = unfold(id, u);
  // camera: from a 3D view to looking straight down at the flat net
  const ease = u * u * (3 - 2 * u), yaw = (35 - 35 * ease) * Math.PI / 180, pitch = (24 + 66 * ease) * Math.PI / 180;
  const cam = p => { const x = p[0] * Math.cos(yaw) - p[2] * Math.sin(yaw), z = p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw), y = p[1] - 0.9 * (1 - ease);
    return [x, -(y * Math.cos(pitch) - z * Math.sin(pitch)), y * Math.sin(pitch) + z * Math.cos(pitch)]; };
  const proj = faces.map(f => ({...f, p: f.points.map(cam)}));
  const all = proj.flatMap(f => f.p), minX = Math.min(...all.map(p => p[0])), maxX = Math.max(...all.map(p => p[0])), minY = Math.min(...all.map(p => p[1])), maxY = Math.max(...all.map(p => p[1]));
  const k = Math.min(56, 430 / (maxX - minX || 1), 210 / (maxY - minY || 1)), ox = 300 - (minX + maxX) / 2 * k, oy = 152 - (minY + maxY) / 2 * k;
  const xy = p => `${(ox + p[0] * k).toFixed(1)},${(oy + p[1] * k).toFixed(1)}`;
  const light = norm([0.4, 0.9, 0.5]);
  let face = 0; const colourOf = f => f.kind === 'curved' ? COLORS[2] : COLORS[(face++) % COLORS.length];
  const drawn = proj.map(f => ({...f, colour: colourOf(f), depth: centre(f.p)[2]})).sort((a, b) => a.depth - b.depth); // far faces first
  const shade = (hex, f) => { const n = norm(cross(sub(f.points[1], f.points[0]), sub(f.points[2], f.points[0]))), l = 0.62 + 0.38 * Math.abs(dot(n, light));
    return '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * l).toString(16).padStart(2, '0')).join(''); };
  const coloured = mark === 'faces' || u > 0.02; // the solid is one colour; its faces get their own colours when counted or opened
  const polys = drawn.map(f => {
    const fill = shade(coloured ? f.colour : '#9cc3e6', f), seam = f.kind === 'curved';
    return `<polygon points="${f.p.map(xy).join(' ')}" fill="${fill}" stroke="${seam ? fill : '#22313a'}" stroke-width="${seam ? 0.8 : 1.8}" stroke-linejoin="round" class="sl-face"/>`;
  }).join('');
  // real edges (not the seams of a curved surface) and vertices, for counting
  const solidEdges = edgesOf(id, faces), vertices = id === 'cylinder' ? [] : id === 'cone' ? [faces[1].points[2]] : uniq(faces.filter(f => f.kind !== 'curved').flatMap(f => f.points));
  const marks = mark === 'edges' && u < 0.05 ? solidEdges.map(([a, b]) => `<line x1="${xy(cam(a)).split(',')[0]}" y1="${xy(cam(a)).split(',')[1]}" x2="${xy(cam(b)).split(',')[0]}" y2="${xy(cam(b)).split(',')[1]}" stroke="#e8890c" stroke-width="5" stroke-linecap="round" class="sl-edge"/>`).join('')
    : mark === 'vertices' && u < 0.05 ? vertices.map(v => { const [x, y] = xy(cam(v)).split(','); return `<circle cx="${x}" cy="${y}" r="7" fill="#e8890c" stroke="#fff" stroke-width="2" class="sl-vertex"/>`; }).join('') : '';
  const count = mark === 'faces' ? `${s.faces} أوجه` : mark === 'edges' ? `${s.edges} أحرف` : mark === 'vertices' ? `${s.vertices} رؤوس` : '';
  const caption = hidden ? `توقّع: كم ${mark === 'none' ? 'وجهًا وحرفًا ورأسًا' : MARKS[mark]} لـ${s.name}؟` : u >= 0.999 ? `شبكة ${s.name}: ${s.about}` : mark !== 'none' ? `${s.name}: ${count.replace(/\d+/, d => ar.format(+d))}` : s.name;
  const chip = `<g class="c-crumb is-on"><rect x="${470}" y="6" width="122" height="24" rx="12" fill="#155c4d"/><text x="531" y="22" text-anchor="middle" font-size="12.5" font-weight="800" fill="#fff">${esc(formatUnfold(u))}</text></g>`;
  const note = mark !== 'none' && u >= 0.05 && mark !== 'faces' ? `<text x="300" y="24" text-anchor="middle" font-size="12.5" fill="#7a3f00">أغلق الشبكة لعدّ ${MARKS[mark]}</text>` : '';
  return scene('solid-scene', `${s.name} — ${formatUnfold(u)}. ${caption}`, `${polys}${marks}${chip}${note}`, caption);
}

const uniq = ps => ps.filter((p, i) => ps.findIndex(q => Math.hypot(...sub(p, q)) < 1e-6) === i);
/** The solid's real edges in its folded state: edges of flat faces, without the seams of a curved surface. */
function edgesOf(id, folded) {
  const faces = build(id);
  if (id === 'cylinder') return [...ringEdges(faces[0][0]), ...ringEdges(faces[faces.length - 1][0])];
  if (id === 'cone') return ringEdges(faces[0][0]);
  const list = [];
  for (const [ps] of faces) ps.forEach((p, i) => { const q = ps[(i + 1) % ps.length]; if (!list.some(([a, b]) => (same(a, p) && same(b, q)) || (same(a, q) && same(b, p)))) list.push([p, q]); });
  return list;
}
const same = (p, q) => Math.hypot(...sub(p, q)) < 1e-6, ringEdges = ps => ps.map((p, i) => [p, ps[(i + 1) % ps.length]]);

export function solidFacts(values, hidden) {
  const s = SOLIDS[values.shape] || SOLIDS.cube, u = clamp(Number(values.unfold ?? 0), 0, 1);
  if (hidden) return `${s.name} · العدد مخفي: عُدّ ثم انتظر الكشف.`;
  const n = x => ar.format(x);
  return `${s.name} · الأوجه ${n(s.faces)} · الأحرف ${n(s.edges)} · الرؤوس ${n(s.vertices)}${u >= 0.999 ? ' · هذه شبكته: لو طويناها عاد المجسم.' : ''}`;
}
