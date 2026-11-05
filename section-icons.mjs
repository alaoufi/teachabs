// Original vector illustrations. Decorative; adjacent headings provide accessible names.
export function sectionIcon(kind){
 const colors={parent:['#f2bd75','#bc7139'],teacher:['#7fc9b3','#267d70'],student:['#9eade8','#586da9'],board:['#76cbd2','#287d8e'],admin:['#b9adc9','#766986']};
 const [light,dark]=colors[kind]||colors.teacher;
 const shapes={
  parent:'<circle cx="43" cy="39" r="12"/><circle cx="72" cy="47" r="9"/><path d="M23 80v-9c0-21 40-21 40 0v9zM63 80V68c0-13 24-13 24 0v12z"/>',
  teacher:'<path d="M23 39h63v39H23z"/><path d="M32 51h29M32 61h19M70 52l7 7 14-19" fill="none" stroke="#fff" stroke-width="5"/><path d="M40 87h30M55 78v9" fill="none" stroke="#fff" stroke-width="5"/>',
  student:'<path d="M17 42l39-20 39 20-39 20z"/><path d="M33 58v15q23 17 46 0V58L56 70z"/><path d="M92 44v27" fill="none" stroke="#fff" stroke-width="4"/>',
  board:'<rect x="22" y="28" width="66" height="49" rx="7"/><path d="M32 64l12-15 11 9 20-19M42 87h27M55 78v9" fill="none" stroke="#fff" stroke-width="5"/><path d="M70 43l5-4-1 7" fill="none" stroke="#fff" stroke-width="4"/>',
  admin:'<path d="M56 22l30 12v22q-2 24-30 35-28-11-30-35V34z"/><rect x="45" y="49" width="22" height="20" rx="4" fill="#fff"/><path d="M49 49v-7a7 7 0 0114 0v7" fill="none" stroke="#fff" stroke-width="4"/>'
 };
 return `<span class="section-icon" aria-hidden="true"><svg viewBox="0 0 112 120" focusable="false"><defs><linearGradient id="tile-${kind}" x2=".8" y2="1"><stop stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs><ellipse cx="56" cy="108" rx="37" ry="7" fill="${dark}" opacity=".15"/><rect x="9" y="15" width="94" height="88" rx="25" fill="${dark}"/><rect x="9" y="7" width="94" height="88" rx="25" fill="url(#tile-${kind})"/><path d="M23 23q8-8 23-8" stroke="white" opacity=".5" stroke-width="4" fill="none" stroke-linecap="round"/><g fill="#fff4d9" stroke="${dark}" stroke-width="2" stroke-linejoin="round">${(shapes[kind]||shapes.teacher).replaceAll('stroke="#fff"','stroke="'+dark+'"')}</g></svg></span>`;
}
