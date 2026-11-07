// A stand-in for the book source in tests: a small generated PDF ("PDF page N" on each page) served with byte ranges.
import http from 'node:http';

export function fakePdf(pages = 20) {
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${Array.from({length: pages}, (_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${pages} >>`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  for (let i = 1; i <= pages; i++) {
    const text = `BT /F1 64 Tf 120 500 Td (PDF page ${i}) Tj ET 0.1 0.5 0.4 rg 60 60 480 40 re f`;
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + (i - 1) * 2} 0 R >>`, `<< /Length ${text.length} >>\nstream\n${text}\nendstream`);
  }
  let out = '%PDF-1.4\n'; const at = [];
  objs.forEach((o, i) => { at.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${at.map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/** Serves the fake PDF at any path, honouring Range like the real source. Returns {origin, close, hits}. */
export async function fakeBookSource(pages = 20) {
  const pdf = fakePdf(pages), hits = [];
  const server = http.createServer((req, res) => {
    hits.push({url: req.url, range: req.headers.range || null});
    const m = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
    if (m) { const a = Number(m[1]), b = m[2] ? Math.min(Number(m[2]), pdf.length - 1) : pdf.length - 1;
      res.writeHead(206, {'content-type': 'application/pdf', 'accept-ranges': 'bytes', 'content-length': b - a + 1, 'content-range': `bytes ${a}-${b}/${pdf.length}`}); return res.end(pdf.subarray(a, b + 1)); }
    res.writeHead(200, {'content-type': 'application/pdf', 'accept-ranges': 'bytes', 'content-length': pdf.length}); res.end(pdf);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return {origin: 'http://127.0.0.1:' + server.address().port, hits, close: () => new Promise(r => { server.closeAllConnections(); server.close(r); })};
}
