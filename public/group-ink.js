// Board ink shared by server validation and every viewer: pen, brush, highlighter marker and typed text.
// Coordinates are board units: 1000 × 600, independent of screen size.

export const BOARD = {width: 1000, height: 600};
export const COLORS = [
  {value: '#173e34', name: 'أخضر داكن'}, {value: '#111111', name: 'أسود'}, {value: '#c0392b', name: 'أحمر'}, {value: '#1f5fa8', name: 'أزرق'},
  {value: '#7b3fa0', name: 'بنفسجي'}, {value: '#e8890c', name: 'برتقالي'}, {value: '#f4d03f', name: 'أصفر'}, {value: '#2fa86a', name: 'أخضر فاتح'}
];
export const TOOLS = {
  pen: {name: 'قلم', key: 'p', widths: {s: 2.5, m: 4, l: 6}, opacity: 1},
  brush: {name: 'فرشاة', key: 'b', widths: {s: 7, m: 11, l: 16}, opacity: 0.92},
  marker: {name: 'قلم تظليل', key: 'm', widths: {s: 14, m: 22, l: 32}, opacity: 0.35},
  rect: {name: 'مستطيل', key: 'r', widths: {s: 3, m: 5, l: 8}, opacity: 1, shape: true},
  ellipse: {name: 'دائرة', key: 'o', widths: {s: 3, m: 5, l: 8}, opacity: 1, shape: true},
  line: {name: 'خط مستقيم', key: 'l', widths: {s: 3, m: 5, l: 8}, opacity: 1, shape: true},
  arrow: {name: 'سهم', key: 'a', widths: {s: 3, m: 5, l: 8}, opacity: 1, shape: true}
};
/** A rectangle or an ellipse dragged from one corner to the other, as the points of its outline. */
export function shapePoints(tool, [x0, y0], [x1, y1]) {
  const r = v => Math.round(v * 10) / 10;
  if (tool === 'rect') return [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]].map(([x, y]) => [r(x), r(y)]);
  if (tool === 'line') return [[r(x0), r(y0)], [r(x1), r(y1)]];
  if (tool === 'arrow') { // the shaft, then the two sides of the head drawn from the tip
    const a = Math.atan2(y1 - y0, x1 - x0), h = Math.min(28, Math.max(12, Math.hypot(x1 - x0, y1 - y0) / 4)), side = s => [x1 - h * Math.cos(a + s * 0.45), y1 - h * Math.sin(a + s * 0.45)];
    const clamp = ([x, y]) => [r(Math.min(1000, Math.max(0, x))), r(Math.min(600, Math.max(0, y)))];
    return [[x0, y0], [x1, y1], side(1), [x1, y1], side(-1)].map(clamp);
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2, n = 48;
  return Array.from({length: n + 1}, (_, i) => [r(cx + rx * Math.cos(2 * Math.PI * i / n)), r(cy + ry * Math.sin(2 * Math.PI * i / n))]);
}
/** Straight segments (for rectangles). */
export function straightPath(points) { return points.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' '); }
export const TEXT_SIZES = {s: 22, m: 32, l: 46};
export const SIZE_NAMES = {s: 'صغير', m: 'متوسط', l: 'كبير'};
export const LIMITS = {items: 300, points: 500, text: 600, zoom: 4};
/** Characters per line for each text size, so long explanations wrap on the board. */
export const LINE_CHARS = {s: 46, m: 34, l: 24};
export function wrapText(text, size = 'm') {
  const max = LINE_CHARS[size] || LINE_CHARS.m, lines = [];
  for (const paragraph of String(text).split(/\n/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && (line + ' ' + word).length > max) { lines.push(line); line = word; } else line = line ? line + ' ' + word : word;
    }
    lines.push(line);
  }
  return lines;
}

export const colorAllowed = c => COLORS.some(x => x.value === c);

/** Smooth path through points using midpoint quadratic curves. */
export function smoothPath(points) {
  if (!points.length) return '';
  if (points.length < 3) return `M${points[0][0]} ${points[0][1]} ` + points.slice(1).map(p => `L${p[0]} ${p[1]}`).join(' ');
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i], [nx, ny] = points[i + 1];
    d += ` Q${x} ${y} ${((x + nx) / 2).toFixed(1)} ${((y + ny) / 2).toFixed(1)}`;
  }
  const last = points[points.length - 1];
  return d + ` L${last[0]} ${last[1]}`;
}

/** Camera: zoom ≥ 1 and an offset that keeps the board on screen. */
export function clampCamera(c) {
  const z = Math.min(LIMITS.zoom, Math.max(1, Number(c?.z) || 1));
  const maxX = BOARD.width - BOARD.width / z, maxY = BOARD.height - BOARD.height / z;
  const x = Math.min(maxX, Math.max(0, Number(c?.x) || 0)), y = Math.min(maxY, Math.max(0, Number(c?.y) || 0));
  return {z: Math.round(z * 100) / 100, x: Math.round(x), y: Math.round(y)};
}
export const cameraTransform = c => `scale(${c.z}) translate(${-c.x / 10}%, ${-c.y / 6}%)`;

/** Zoom around a board point so it stays under the finger or cursor. */
export function zoomAround(c, factor, px, py) {
  const z = Math.min(LIMITS.zoom, Math.max(1, c.z * factor));
  return clampCamera({z, x: px - (px - c.x) * c.z / z, y: py - (py - c.y) * c.z / z});
}
