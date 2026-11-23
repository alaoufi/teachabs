const limit = 32 * 1024 * 1024;
const byId = id => document.getElementById(id);

function jpeg(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('تعذّر تجهيز الصفحة.')), 'image/jpeg', .8));
}
async function snapshot(canvas) {
  const output = document.createElement('canvas'), ctx = output.getContext('2d');
  for (const edge of [1600, 1250, 1000, 800]) {
    const scale = Math.min(1, edge / Math.max(canvas.width, canvas.height));
    output.width = Math.max(1, Math.round(canvas.width * scale)); output.height = Math.max(1, Math.round(canvas.height * scale));
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, output.width, output.height);
    ctx.drawImage(canvas, 0, 0, output.width, output.height);
    const blob = await jpeg(output); if (blob.size <= 1024 * 1024) return blob;
  }
  throw new Error('تعذّر تصغير الصفحة للعرض.');
}
async function openDocument(file) {
  const canvas = document.createElement('canvas');
  if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
    const pdf = await import('./vendor/pdfjs/pdf.min.mjs');
    pdf.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';
    const doc = await pdf.getDocument({data:await file.arrayBuffer(), isEvalSupported:false}).promise;
    return {count:doc.numPages, dispose:() => doc.destroy(), async page(n) {
      const page = await doc.getPage(n), size = page.getViewport({scale:1});
      const viewport = page.getViewport({scale:1600 / Math.max(size.width,size.height)});
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      try { await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise; return await snapshot(canvas); }
      finally { page.cleanup(); }
    }};
  }
  if (/\.pptx$/i.test(file.name)) {
    const {PPTXViewer} = await import('./vendor/slides/pptx.mjs');
    const viewer = new PPTXViewer({canvas, enableThumbnails:false, autoChartRerenderDelayMs:0});
    try { await viewer.loadFile(file); }
    catch (e) { viewer.destroy(); throw e; }
    return {count:viewer.getSlideCount(), dispose:() => viewer.destroy(), async page(n) {
      await viewer.render(canvas,{slideIndex:n-1}); return snapshot(canvas);
    }};
  }
  if (/^image\/(png|jpeg|webp|gif|avif)$/.test(file.type)) {
    const img = await createImageBitmap(file);
    try { const page = await snapshot(img); return {count:1, page:() => page}; }
    finally { img.close(); }
  }
  const mime = file.type || (/\.mp4$/i.test(file.name) ? 'video/mp4' : /\.webm$/i.test(file.name) ? 'video/webm' : '');
  if (['video/mp4','video/webm'].includes(mime)) {
    const probe = document.createElement('video'), src = URL.createObjectURL(file);
    try {
      await new Promise((ok, fail) => {
        probe.onloadedmetadata = ok; probe.onerror = () => fail(new Error('ترميز هذا الفيديو غير مدعوم على الجهاز.'));
        probe.preload = 'metadata'; probe.src = src;
      });
    } finally { probe.removeAttribute('src'); probe.load(); URL.revokeObjectURL(src); }
    return {count:1, page:() => file.slice(0,file.size,mime)};
  }
  throw new Error('اختر فيديو MP4 أو WebM، أو PDF، أو PowerPoint بصيغة PPTX، أو صورة.');
}

export function filePicker({base, getContext, media, post, videoOnly = false}) {
  const input = byId('gl-file-input'), tools = byId('gl-material-tools'), note = byId('gl-file-note');
  const prev = byId('gl-file-prev'), next = byId('gl-file-next'), play = byId('gl-file-play');
  const close = byId('gl-file-close'), back = byId('gl-file-restart'), page = byId('gl-file-number');
  const pick = byId('gl-file-pick');
  if (videoOnly) {
    input.accept = 'video/mp4,video/webm,.mp4,.webm';
    pick.textContent = 'تشغيل مقطع';
    pick.title = 'اختر مقطع فيديو من جهازك';
    close.textContent = 'إغلاق المقطع';
  }
  let doc = null, localId = '', busy = false, lastControls = '';
  const say = text => { note.textContent = text; note.hidden = !text; };
  function update() {
    const {material:m, enabled} = getContext(), video = m?.mime.startsWith('video/');
    const controls = [enabled,busy,localId,m?.id,m?.page,m?.count,m?.playing].join('|');
    if (controls === lastControls) return;
    lastControls = controls;
    tools.hidden = !enabled;
    pick.disabled = busy;
    pick.hidden = videoOnly && video;
    close.hidden = !m; close.disabled = busy;
    page.hidden = !m || m.count < 2;
    page.textContent = m ? new Intl.NumberFormat('ar-SA').format(m.page) + ' / ' + new Intl.NumberFormat('ar-SA').format(m.count) : '';
    prev.hidden = next.hidden = page.hidden || videoOnly;
    if (videoOnly) page.hidden = true;
    prev.disabled = busy || localId !== m?.id || m.page <= 1;
    next.disabled = busy || localId !== m?.id || m.page >= m.count;
    play.hidden = !video; back.hidden = videoOnly || !video;
    play.disabled = back.disabled = busy;
    play.textContent = m?.playing ? 'إيقاف مؤقت' : videoOnly ? 'تشغيل المقطع' : 'تشغيل الفيديو';
    if (m?.count > 1 && localId !== m.id && !busy) say('أعد اختيار الملف من جهازك لتقليب صفحاته.');
  }
  async function act(fn) {
    if (busy) return;
    busy = true; say(''); update();
    try { await fn(); }
    catch (e) { say(e.message && /[\u0600-\u06ff]/.test(e.message) ? e.message : 'تعذّر فتح الملف. تحقق من صيغته ثم أعد اختياره.'); }
    finally { busy = false; update(); }
  }
  async function publish(source,id,n,context) {
    const blob = await source.page(n);
    const q = new URLSearchParams({step:context.step,version:context.version,id,page:n,count:source.count});
    const r = await fetch(base + '/material?' + q,{method:'POST',headers:{'Content-Type':blob.type},body:blob});
    if (!r.ok) throw new Error((await r.json()).error);
  }
  byId('gl-file-pick').onclick = () => input.click();
  input.onchange = () => {
    const file = input.files[0]; input.value = ''; if (!file) return;
    act(async () => {
      if (videoOnly && !['video/mp4','video/webm'].includes(file.type) && !/\.(mp4|webm)$/i.test(file.name)) throw new Error('اختر مقطع MP4 أو WebM.');
      if (file.size > limit) throw new Error('الحد الأقصى للملف ٣٢ ميغابايت.');
      const context = getContext();
      say('جارٍ تجهيز الملف…');
      // The same original can be reopened after a reload with its ink on each page.
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      const hex = [...new Uint8Array(digest,0,16)].map(b => b.toString(16).padStart(2,'0')).join('');
      const id = [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
      const source = await openDocument(file);
      try { await publish(source,id,1,context); }
      catch (e) { await source.dispose?.(); throw e; }
      await doc?.dispose?.(); doc = source; localId = id; say('');
      if (videoOnly) await control({id,page:1},{op:'playback',playing:true,position:0});
    });
  };
  for (const [button,by] of [[prev,-1],[next,1]]) button.onclick = () => act(async () => {
    const context = getContext(), m = context.material;
    if (doc && localId === m?.id) await publish(doc,m.id,m.page+by,context);
  });
  const control = (m,cmd) => post('/material-control',{id:m.id,page:m.page,...cmd});
  close.onclick = () => act(async () => { await control(getContext().material,{op:'close'}); await doc?.dispose?.(); doc = null; localId = ''; });
  play.onclick = () => act(() => {
    const m = getContext().material, ended = media.duration() > 0 && media.position() >= media.duration() - .1;
    return control(m,{op:'playback',playing:ended || !m.playing,position:ended ? 0 : media.position()});
  });
  back.onclick = () => act(() => control(getContext().material,{op:'playback',playing:false,position:0}));
  return {update};
}
