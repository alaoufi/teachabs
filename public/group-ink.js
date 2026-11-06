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
  marker: {name: 'قلم تظليل', key: 'm', widths: {s: 14, m: 22, l: 32}, opacity: 0.35}
};
export const TEXT_SIZES = {s: 22, m: 32, l: 46};
export const SIZE_NAMES = {s: 'صغير', m: 'متوسط', l: 'كبير'};
export const LIMITS = {items: 300, points: 500, text: 200, zoom: 4};

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
