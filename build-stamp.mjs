// Fast navigation on a far-away trial server: every page and module asks for its files with the same build stamp
// (?b=<hash of the public files at start-up>). A stamped file never changes, so browsers and the Android app keep it
// for a year and stop asking the server; a new deploy changes the stamp, so updates still arrive at once.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

export function buildStamp(files) {
  const h = createHash('sha256');
  for (const route of Object.keys(files).sort()) { h.update(route); h.update(readFileSync(new URL('./public' + route, import.meta.url))); }
  return h.digest('hex').slice(0, 12);
}

/** Pages: `src="/x.js?v=3"` or `href="/x.css"` of our own static files → `?b=<build>`. */
export function stampHtml(html, files, build) {
  return html.replace(/(src|href)="(\/[A-Za-z0-9_.-]+\.(?:js|css))(?:\?v=[A-Za-z0-9_.-]+)?"/g, (m, attr, path) => Object.hasOwn(files, path) ? `${attr}="${path}?b=${build}"` : m);
}

/** Modules: `from './x.js'` (with or without ?v=) → `from './x.js?b=<build>'`, so the whole import graph is stamped. */
export function stampModule(source, files, build) {
  return source.replace(/(\bfrom\s*|\bimport\s*\(\s*)(['"])\.\/([A-Za-z0-9_.-]+\.js)(?:\?v=[A-Za-z0-9_.-]+)?\2/g, (m, lead, q, name) => Object.hasOwn(files, '/' + name) ? `${lead}${q}./${name}?b=${build}${q}` : m);
}
