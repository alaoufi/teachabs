// Only the currently presented page or clip is shared. PDF and slide originals stay on the teacher's device.
import {UserError} from './store.mjs';
import {switchBoardScene} from './group-session.mjs';

const need = (ok, msg, status = 400) => { if (!ok) throw new UserError(msg, status); };
const idPattern = /^[a-f0-9-]{36}$/;
const types = new Map([
  ['image/jpeg', b => b[0] === 255 && b[1] === 216 && b[2] === 255],
  ['video/mp4', b => b.toString('ascii', 4, 8) === 'ftyp'],
  ['video/webm', b => b.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]))]
]);
export async function readMaterial(req, url, base) {
  need(req.headers.origin === base, 'مصدر الطلب غير معتمد.', 403);
  const mime = req.headers['content-type']?.split(';')[0], q = url.searchParams;
  need(types.has(mime), 'نوع الملف غير مدعوم.', 415);
  const id = q.get('id'), page = Number(q.get('page')), count = Number(q.get('count'));
  need(idPattern.test(id) && Number.isSafeInteger(count) && count >= 1 && count <= 10000 && Number.isInteger(page) && page >= 1 && page <= count, 'صفحة غير صالحة.');
  const video = mime.startsWith('video/'), limit = video ? 32 * 1024 * 1024 : 1024 * 1024;
  need(!video || count === 1, 'فيديو غير صالح.');
  need(!(Number(req.headers['content-length']) > limit), 'يتجاوز الملف حد العرض.', 413);
  const chunks = []; let length = 0;
  for await (const chunk of req) {
    length += chunk.length; need(length <= limit, 'يتجاوز الملف حد العرض.', 413); chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  need(bytes.length > 8 && types.get(mime)(bytes), 'تعذر قراءة محتوى الملف.', 415);
  return {bytes, meta: {id, page, count, mime, length, step: q.get('step'), playing: false, position: 0, updated: Date.now()}};
}
export function closeMaterial(state) {
  const m = state.material;
  if (!m) return state;
  const next = switchBoardScene(state, m.step, m.previous, true);
  delete next.material;
  return next;
}
export function attachMaterial(state, meta) {
  const current = state.material, sameStep = current?.step === meta.step;
  const base = sameStep ? state : closeMaterial(state);
  const previous = sameStep ? current.previous : base.bookActive?.[meta.step] || 'original';
  const next = switchBoardScene(base, meta.step, 'file-' + meta.id + ':' + meta.page);
  next.material = {...meta, previous};
  next.cameraFocus = false;
  return next;
}
export function sendMaterial(req, res, url, store, code, state, stepId) {
  const m = state.material;
  need(m && m.step === stepId && url.searchParams.get('id') === m.id && Number(url.searchParams.get('page')) === m.page, 'هذا الملف غير معروض.', 404);
  const size = m.length, headers = {'Content-Type': m.mime, 'Cache-Control': 'private, no-store', 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff'};
  let start = 0, end = size - 1;
  if (req.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (match) {
      start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
      if (match[1] && match[2]) end = Math.min(end, Number(match[2]));
    }
    if (!match || !(match[1] || match[2]) || start > end || start >= size) {
      res.writeHead(416, {...headers, 'Content-Range': 'bytes */' + size}); return res.end();
    }
    headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + size;
  }
  const data = store.materialBytes(code, start, end - start + 1);
  need(data, 'تعذّر تحميل الملف.', 404);
  res.writeHead(req.headers.range ? 206 : 200, {...headers, 'Content-Length': data.length});
  res.end(data);
}
