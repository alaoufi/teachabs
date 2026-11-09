// Builds public/vendor/icons/lucide.svg: only the Lucide icons the class uses (public/icons.js), as one small sprite.
import {readFileSync, writeFileSync, mkdirSync, copyFileSync} from 'node:fs';
const src = readFileSync(new URL('./public/icons.js', import.meta.url), 'utf8');
const names = [...new Set([...src.matchAll(/'([a-z0-9-]+)'(?=[,\s}])/g)].map(m => m[1]).filter(n => /-|^[a-z]+$/.test(n)))];
const dir = new URL('./node_modules/lucide-static/icons/', import.meta.url), out = [];
for (const n of names) {
  let svg; try { svg = readFileSync(new URL(n + '.svg', dir), 'utf8'); } catch { continue; }
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/\s+/g, ' ').trim();
  out.push(`<symbol id="${n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</symbol>`);
}
mkdirSync(new URL('./public/vendor/icons/', import.meta.url), {recursive: true});
writeFileSync(new URL('./public/vendor/icons/lucide.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg"><!-- Lucide icons (ISC licence, see LICENSE.txt), built by build-icons.mjs -->${out.join('')}</svg>\n`);
copyFileSync(new URL('./node_modules/lucide-static/LICENSE', import.meta.url), new URL('./public/vendor/icons/LICENSE.txt', import.meta.url));
console.log(out.length + ' icons');
