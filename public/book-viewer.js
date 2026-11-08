// The ministry book on this device: PDF.js (Apache-2.0, in /vendor/pdfjs) reads only the parts of the book a page needs,
// through the platform's relay (/teach/books/<id>/file), and draws the page here. Nothing is stored. Used by the book
// viewer page and by the class («📖 كتاب الوزارة»), where the drawn page is shown on the board for this class only.
import * as pdfjs from './vendor/pdfjs/pdf.min.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';

const docs = new Map();
/** The book, opened once per page view; later pages come as small range requests. */
export function openBook(id) {
  if (!docs.has(id)) docs.set(id, pdfjs.getDocument({url: `/teach/books/${encodeURIComponent(id)}/file`, disableAutoFetch: true, disableStream: true, rangeChunkSize: 262144, isEvalSupported: false}).promise.catch(e => { docs.delete(id); throw e; }));
  return docs.get(id);
}
/** Draws printed page `page` (PDF page = printed + offset) on the canvas, `width` pixels wide. */
export async function drawPage(doc, page, offset, canvas, width) {
  const p = await doc.getPage(Math.min(doc.numPages, Math.max(1, page + offset)));
  const base = p.getViewport({scale: 1}), viewport = p.getViewport({scale: width / base.width});
  canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
  await p.render({canvasContext: canvas.getContext('2d'), viewport}).promise;
  return canvas;
}
/** The drawn page as a JPEG small enough for the class (under ~880 KB). */
export function pageImage(canvas) {
  for (const [max, q] of [[1500, 0.82], [1250, 0.76], [1000, 0.7], [800, 0.6]]) {
    const k = Math.min(1, max / Math.max(canvas.width, canvas.height)), c = document.createElement('canvas');
    c.width = Math.round(canvas.width * k); c.height = Math.round(canvas.height * k);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(canvas, 0, 0, c.width, c.height);
    const data = c.toDataURL('image/jpeg', q); if (data.length <= 880_000) return data;
  }
  throw new Error('تعذّر تصغير الصفحة.');
}

const ar = new Intl.NumberFormat('ar-SA');

/** In class: choose the page (opens at the lesson's page) and show it on the board. */
export function openBookDialog({book, page, onShow}) {
  const dlg = document.createElement('dialog'); dlg.className = 'bk-dialog'; dlg.setAttribute('aria-label', 'كتاب الوزارة'); dlg.dir = 'rtl';
  dlg.innerHTML = `<div class="bk-bar"><b class="bk-title"></b><button type="button" class="outline" data-k="prev">◀</button><label>ص <input type="number" min="1" inputmode="numeric" data-k="page"></label><button type="button" class="outline" data-k="next">▶</button>
<button type="button" class="btn" data-k="show">اعرضها على السبورة</button><button type="button" class="quiet" data-k="close" aria-label="إغلاق">✕</button></div><p class="gl-status" role="status" aria-live="polite"></p><div class="bk-stage"><canvas></canvas></div>`;
  document.body.append(dlg); dlg.showModal();
  const $ = k => dlg.querySelector(`[data-k=${k}]`), canvas = dlg.querySelector('canvas'), status = dlg.querySelector('.gl-status');
  dlg.querySelector('.bk-title').textContent = book.title;
  let at = page || 1, doc = null, busy = false;
  const max = book.pages - book.offset;
  async function show(n) {
    at = Math.min(max, Math.max(1, n)); $('page').value = at; status.textContent = `جارٍ تحميل الصفحة ${ar.format(at)}…`;
    try { doc = doc || await openBook(book.id); await drawPage(doc, at, book.offset, canvas, Math.min(1400, Math.max(700, innerWidth * 1.2))); status.textContent = `الصفحة ${ar.format(at)} من ${ar.format(max)}`; }
    catch (e) { status.textContent = e?.status === 403 ? 'عرض الكتاب داخل المنصة موقوف حتى يتأكد حق العرض. افتح الكتاب من مصدره، أو صوّر صفحة من نسختك بزر «📷 صورة».' : 'تعذّر فتح الكتاب من مصدره الآن. حاول بعد قليل.'; }
  }
  $('prev').onclick = () => show(at - 1); $('next').onclick = () => show(at + 1);
  $('page').onchange = e => show(Number(e.target.value) || 1);
  $('close').onclick = () => { dlg.close(); dlg.remove(); };
  $('show').onclick = async () => {
    if (busy || !canvas.width) return; busy = true; status.textContent = 'جارٍ عرض الصفحة على السبورة…';
    try { await onShow(pageImage(canvas), at); dlg.close(); dlg.remove(); } catch (e) { status.textContent = e.message || 'تعذّر العرض.'; } finally { busy = false; }
  };
  show(at);
  return dlg;
}

// ---- the book viewer page ----
const root = document.getElementById('book-viewer');
if (root) {
  const book = {id: root.dataset.book, offset: Number(root.dataset.offset), pages: Number(root.dataset.pages) + Number(root.dataset.offset)};
  const canvas = document.getElementById('bk-canvas'), status = document.getElementById('bk-status'), input = document.getElementById('bk-page');
  const max = Number(root.dataset.pages);
  let at = Number(root.dataset.page) || 1, zoom = 1, doc = null;
  async function show(n) {
    at = Math.min(max, Math.max(1, n)); input.value = at; status.textContent = `جارٍ تحميل الصفحة ${ar.format(at)}…`;
    history.replaceState(null, '', `?page=${at}`);
    try { doc = doc || await openBook(book.id); await drawPage(doc, at, book.offset, canvas, Math.round(Math.min(1600, root.clientWidth) * zoom * (devicePixelRatio > 1 ? 1.5 : 1))); canvas.style.width = Math.round(Math.min(1600, root.clientWidth) * zoom) + 'px'; status.textContent = `الصفحة ${ar.format(at)} من ${ar.format(max)}`; }
    catch (e) { status.textContent = e?.status === 403 ? 'عرض الكتاب داخل المنصة موقوف حتى يتأكد حق العرض. افتح الكتاب من مصدره، أو صوّر صفحة من نسختك بزر «📷 صورة».' : 'تعذّر فتح الكتاب من مصدره الآن. حاول بعد قليل.'; }
  }
  document.getElementById('bk-prev').onclick = () => show(at - 1);
  document.getElementById('bk-next').onclick = () => show(at + 1);
  document.getElementById('bk-zoom-in').onclick = () => { zoom = Math.min(3, zoom * 1.25); show(at); };
  document.getElementById('bk-zoom-out').onclick = () => { zoom = Math.max(0.5, zoom / 1.25); show(at); };
  input.onchange = () => show(Number(input.value) || 1);
  const lesson = document.getElementById('bk-lesson'); if (lesson) lesson.onchange = () => { if (lesson.value) show(Number(lesson.value)); };
  document.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; if (e.key === 'ArrowLeft') show(at + 1); if (e.key === 'ArrowRight') show(at - 1); });
  show(at);
}
