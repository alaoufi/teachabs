// «مكتبة الأدوات»: tools for the board, filtered by subject, grade and curriculum lesson. The teacher pins the ones a
// lesson needs while preparing it; in class the pinned tools are one tap away («🧰 أدوات الدرس»), and the whole library
// can still be opened. Board tools ("stamps") are original drawings made here in board units (1000 × 600), laid on the
// board like ink: moved with «تحريك», erased with the eraser, seen by every student.
// Ideas: Microsoft Whiteboard (ruler, protractor), Classroomscreen (timer, random name, work symbols), virtual
// manipulatives of maths classrooms (number line, fraction bars, hundred chart, clock), and graphic organisers.

const ALL = [1, 2, 3, 4, 5, 6];
const ar = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);

/** Each stamp: its size (for placing it in view) and how it is drawn. `add(tag, attrs, text)` appends to the stamp. */
export const STAMPS = {
  ruler: {w: 420, h: 56, draw(add) {
    add('rect', {x: 0, y: 0, width: 420, height: 56, rx: 6, class: 'gl-stamp-body'});
    for (let mm = 0; mm <= 100; mm++) { const x = 10 + mm * 4, h = mm % 10 ? (mm % 5 ? 10 : 16) : 24; add('line', {x1: x, y1: 0, x2: x, y2: h, class: 'gl-stamp-tick'}); if (!(mm % 10)) add('text', {x, y: 42, class: 'gl-stamp-num'}, String(mm / 10)); }
    add('text', {x: 404, y: 52, class: 'gl-stamp-unit'}, 'سم');
  }},
  protractor: {w: 320, h: 160, draw(add) {
    const r = 160;
    add('path', {d: `M0 ${r} L${2 * r} ${r} A${r} ${r} 0 0 0 0 ${r} Z`, class: 'gl-stamp-body'});
    for (let d = 0; d <= 180; d += 5) {
      const a = Math.PI * d / 180, c = Math.cos(a), sn = Math.sin(a), len = d % 10 ? 8 : (d % 30 ? 14 : 22);
      add('line', {x1: r - r * c, y1: r - r * sn, x2: r - (r - len) * c, y2: r - (r - len) * sn, class: 'gl-stamp-tick'});
      if (!(d % 30)) add('text', {x: r - (r - 38) * c, y: r - (r - 38) * sn + 5, class: 'gl-stamp-num'}, String(d));
    }
    add('circle', {cx: r, cy: r, r: 4, class: 'gl-stamp-tick'});
  }},
  numberline10: {w: 540, h: 70, draw(add) {
    add('line', {x1: 10, y1: 30, x2: 530, y2: 30, class: 'gl-stamp-line'});
    for (let i = 0; i <= 10; i++) { const x = 20 + i * 50; add('line', {x1: x, y1: 20, x2: x, y2: 40, class: 'gl-stamp-tick'}); add('text', {x, y: 64, class: 'gl-stamp-num big'}, ar(i)); }
  }},
  numberline100: {w: 540, h: 70, draw(add) {
    add('line', {x1: 10, y1: 30, x2: 530, y2: 30, class: 'gl-stamp-line'});
    for (let i = 0; i <= 100; i += 5) { const x = 20 + i * 5, big = !(i % 10); add('line', {x1: x, y1: big ? 18 : 24, x2: x, y2: big ? 42 : 36, class: 'gl-stamp-tick'}); if (big) add('text', {x, y: 64, class: 'gl-stamp-num'}, ar(i)); }
  }},
  fractionbars: {w: 420, h: 230, draw(add) {
    [1, 2, 3, 4, 6].forEach((n, row) => {
      for (let i = 0; i < n; i++) { const w = 400 / n, x = 10 + i * w, y = 10 + row * 44; add('rect', {x, y, width: w, height: 38, class: 'gl-stamp-cell f' + (row % 5)}); add('text', {x: x + w / 2, y: y + 26, class: 'gl-stamp-num'}, n === 1 ? '١' : `١/${ar(n)}`); }
    });
  }},
  fractioncircle: {w: 200, h: 200, draw(add) {
    const c = 100, r = 90;
    add('circle', {cx: c, cy: c, r, class: 'gl-stamp-body'});
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; add('line', {x1: c, y1: c, x2: c + r * Math.cos(a), y2: c + r * Math.sin(a), class: 'gl-stamp-tick'}); }
    add('path', {d: `M${c} ${c} L${c + r} ${c} A${r} ${r} 0 0 1 ${c} ${c + r} Z`, class: 'gl-stamp-cell f1'});
    add('text', {x: c + 38, y: c + 42, class: 'gl-stamp-num big'}, '١/٤');
  }},
  clock: {w: 200, h: 200, draw(add) {
    const c = 100, r = 92;
    add('circle', {cx: c, cy: c, r, class: 'gl-stamp-body'});
    for (let i = 0; i < 60; i++) { const a = i * Math.PI / 30, l = i % 5 ? 5 : 12; add('line', {x1: c + r * Math.sin(a), y1: c - r * Math.cos(a), x2: c + (r - l) * Math.sin(a), y2: c - (r - l) * Math.cos(a), class: 'gl-stamp-tick'}); }
    for (let h = 1; h <= 12; h++) { const a = h * Math.PI / 6; add('text', {x: c + 70 * Math.sin(a), y: c - 70 * Math.cos(a) + 7, class: 'gl-stamp-num big'}, ar(h)); }
    add('line', {x1: c, y1: c, x2: c, y2: c - 72, class: 'gl-stamp-hand'}); add('line', {x1: c, y1: c, x2: c + 46, y2: c, class: 'gl-stamp-hand thick'});
    add('circle', {cx: c, cy: c, r: 5, class: 'gl-stamp-dot'});
  }},
  grid: {w: 300, h: 300, draw(add) {
    for (let i = 0; i <= 10; i++) { const p = 20 + i * 26; add('line', {x1: 20, y1: p, x2: 280, y2: p, class: 'gl-stamp-gridline'}); add('line', {x1: p, y1: 20, x2: p, y2: 280, class: 'gl-stamp-gridline'}); }
    add('line', {x1: 20, y1: 280, x2: 290, y2: 280, class: 'gl-stamp-line'}); add('line', {x1: 20, y1: 290, x2: 20, y2: 10, class: 'gl-stamp-line'});
    for (let i = 0; i <= 10; i += 2) { add('text', {x: 20 + i * 26, y: 298, class: 'gl-stamp-num'}, ar(i)); if (i) add('text', {x: 8, y: 285 - i * 26, class: 'gl-stamp-num'}, ar(i)); }
  }},
  hundred: {w: 370, h: 370, draw(add) {
    for (let i = 0; i < 100; i++) { const x = 5 + (9 - i % 10) * 36, y = 5 + Math.floor(i / 10) * 36; add('rect', {x, y, width: 36, height: 36, class: 'gl-stamp-cell' + (i % 10 === 9 ? ' f1' : '')}); add('text', {x: x + 18, y: y + 24, class: 'gl-stamp-num'}, ar(i + 1)); }
  }},
  multtable: {w: 400, h: 400, draw(add) {
    for (let r = 0; r <= 10; r++) for (let c = 0; c <= 10; c++) {
      const x = 5 + (10 - c) * 35, y = 5 + r * 35, head = !r || !c;
      add('rect', {x, y, width: 35, height: 35, class: 'gl-stamp-cell' + (head ? ' f1' : '')});
      if (r || c) add('text', {x: x + 17.5, y: y + 23, class: 'gl-stamp-num small'}, ar(!r ? c : !c ? r : r * c));
    }
    add('text', {x: 372, y: 28, class: 'gl-stamp-num'}, '×');
  }},
  placechart: {w: 600, h: 110, draw(add) {
    const names = ['الآحاد', 'العشرات', 'المئات', 'آحاد الألوف', 'عشرات الألوف', 'مئات الألوف', 'الملايين'];
    names.forEach((n, i) => { const x = 590 - (i + 1) * 84; add('rect', {x, y: 5, width: 84, height: 40, class: 'gl-stamp-cell f' + (i < 3 ? 1 : i < 6 ? 2 : 3)}); add('text', {x: x + 42, y: 31, class: 'gl-stamp-num small'}, n); add('rect', {x, y: 45, width: 84, height: 60, class: 'gl-stamp-cell'}); });
  }},
  bargraph: {w: 400, h: 280, draw(add) {
    for (let i = 0; i <= 5; i++) { const y = 240 - i * 44; add('line', {x1: 340, y1: y, x2: 30, y2: y, class: 'gl-stamp-gridline'}); add('text', {x: 360, y: y + 5, class: 'gl-stamp-num small'}, ar(i * 2)); }
    add('line', {x1: 340, y1: 240, x2: 20, y2: 240, class: 'gl-stamp-line'}); add('line', {x1: 340, y1: 245, x2: 340, y2: 10, class: 'gl-stamp-line'});
    add('text', {x: 190, y: 272, class: 'gl-stamp-num small'}, 'الفئات'); add('text', {x: 385, y: 20, class: 'gl-stamp-num small'}, 'العدد');
  }},
  piechart: {w: 220, h: 220, draw(add) {
    const c = 110, r = 100, parts = [0.4, 0.25, 0.2, 0.15]; let a0 = -Math.PI / 2;
    parts.forEach((p, i) => { const a1 = a0 + p * 2 * Math.PI, big = p > 0.5 ? 1 : 0; add('path', {d: `M${c} ${c} L${c + r * Math.cos(a0)} ${c + r * Math.sin(a0)} A${r} ${r} 0 ${big} 1 ${c + r * Math.cos(a1)} ${c + r * Math.sin(a1)} Z`, class: 'gl-stamp-cell f' + (i + 1)}); a0 = a1; });
  }},
  shapes: {w: 520, h: 150, draw(add) {
    add('polygon', {points: '60,20 110,110 10,110', class: 'gl-stamp-shape'}); add('text', {x: 60, y: 140, class: 'gl-stamp-num small'}, 'مثلث');
    add('rect', {x: 140, y: 20, width: 90, height: 90, class: 'gl-stamp-shape'}); add('text', {x: 185, y: 140, class: 'gl-stamp-num small'}, 'مربع');
    add('rect', {x: 260, y: 35, width: 120, height: 70, class: 'gl-stamp-shape'}); add('text', {x: 320, y: 140, class: 'gl-stamp-num small'}, 'مستطيل');
    add('circle', {cx: 460, cy: 65, r: 48, class: 'gl-stamp-shape'}); add('text', {x: 460, y: 140, class: 'gl-stamp-num small'}, 'دائرة');
  }},
  dice: {w: 120, h: 120, draw(add) {
    add('rect', {x: 5, y: 5, width: 110, height: 110, rx: 18, class: 'gl-stamp-body'});
    for (const [x, y] of [[32, 32], [88, 32], [60, 60], [32, 88], [88, 88]]) add('circle', {cx: x, cy: y, r: 9, class: 'gl-stamp-dot'});
  }},
  spinner: {w: 220, h: 220, draw(add) {
    const c = 110, r = 100;
    for (let i = 0; i < 4; i++) { const a0 = i * Math.PI / 2 - Math.PI / 2, a1 = a0 + Math.PI / 2; add('path', {d: `M${c} ${c} L${c + r * Math.cos(a0)} ${c + r * Math.sin(a0)} A${r} ${r} 0 0 1 ${c + r * Math.cos(a1)} ${c + r * Math.sin(a1)} Z`, class: 'gl-stamp-cell f' + (i + 1)}); }
    add('line', {x1: c, y1: c, x2: c + 60, y2: c - 50, class: 'gl-stamp-hand thick'}); add('circle', {cx: c, cy: c, r: 7, class: 'gl-stamp-dot'});
  }},
  functable: {w: 240, h: 250, draw(add) {
    ['المدخلة', 'المخرجة'].forEach((t, c) => { const x = 125 - c * 120; add('rect', {x, y: 5, width: 110, height: 36, class: 'gl-stamp-cell f1'}); add('text', {x: x + 55, y: 29, class: 'gl-stamp-num small'}, t); for (let r = 1; r <= 5; r++) add('rect', {x, y: 5 + r * 40, width: 110, height: 40, class: 'gl-stamp-cell'}); });
  }},
  thermometer: {w: 90, h: 300, draw(add) {
    add('rect', {x: 30, y: 10, width: 30, height: 240, rx: 15, class: 'gl-stamp-body'}); add('circle', {cx: 45, cy: 265, r: 26, class: 'gl-stamp-mercury'});
    add('rect', {x: 39, y: 120, width: 12, height: 140, class: 'gl-stamp-mercury'});
    for (let t = 0; t <= 100; t += 10) { const y = 240 - t * 2.1; add('line', {x1: 60, y1: y, x2: 70, y2: y, class: 'gl-stamp-tick'}); if (!(t % 20)) add('text', {x: 84, y: y + 5, class: 'gl-stamp-num small'}, ar(t)); }
    add('text', {x: 14, y: 20, class: 'gl-stamp-num small'}, '°س');
  }},
  foodchain: {w: 600, h: 100, draw(add) {
    ['المنتج', 'مستهلك أول', 'مستهلك ثانٍ', 'مستهلك ثالث'].forEach((t, i) => { const x = 470 - i * 150; add('rect', {x, y: 25, width: 120, height: 50, rx: 10, class: 'gl-stamp-cell f' + (i + 1)}); add('text', {x: x + 60, y: 56, class: 'gl-stamp-num small'}, t); if (i) add('path', {d: `M${x + 148} 50 L${x + 124} 50 M${x + 132} 42 L${x + 124} 50 L${x + 132} 58`, class: 'gl-stamp-line'}); });
  }},
  vertebrates: {w: 420, h: 260, draw(add) { tchart(add, 'فقاريات', 'لافقاريات'); }},
  plate: {w: 260, h: 260, draw(add) {
    const c = 130, r = 120, names = ['خضروات', 'حبوب', 'بروتين', 'فواكه']; add('circle', {cx: c, cy: c, r: r + 6, class: 'gl-stamp-body'});
    names.forEach((n, i) => { const a0 = i * Math.PI / 2 - Math.PI / 2, a1 = a0 + Math.PI / 2, m = (a0 + a1) / 2; add('path', {d: `M${c} ${c} L${c + r * Math.cos(a0)} ${c + r * Math.sin(a0)} A${r} ${r} 0 0 1 ${c + r * Math.cos(a1)} ${c + r * Math.sin(a1)} Z`, class: 'gl-stamp-cell f' + (i + 1)}); add('text', {x: c + 62 * Math.cos(m), y: c + 62 * Math.sin(m) + 6, class: 'gl-stamp-num small'}, n); });
  }},
  compass: {w: 200, h: 200, draw(add) {
    const c = 100; add('circle', {cx: c, cy: c, r: 70, class: 'gl-stamp-body'});
    add('polygon', {points: `${c},20 ${c + 12},${c} ${c},180 ${c - 12},${c}`, class: 'gl-stamp-shape'}); add('polygon', {points: `20,${c} ${c},${c - 12} 180,${c} ${c},${c + 12}`, class: 'gl-stamp-shape'});
    [['شمال', c, 16], ['جنوب', c, 196], ['شرق', 186, c + 5], ['غرب', 14, c + 5]].forEach(([t, x, y]) => add('text', {x, y, class: 'gl-stamp-num small'}, t));
  }},
  arabicletters: {w: 600, h: 150, draw(add) {
    const L = 'ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي'.split(' ');
    L.forEach((l, i) => { const x = 555 - (i % 14) * 42, y = 8 + Math.floor(i / 14) * 70; add('rect', {x, y, width: 40, height: 64, rx: 6, class: 'gl-stamp-cell'}); add('text', {x: x + 20, y: y + 44, class: 'gl-stamp-num letter'}, l); });
  }},
  writinglines: {w: 600, h: 180, draw(add) {
    for (let i = 0; i < 4; i++) { const y = 30 + i * 44; add('line', {x1: 10, y1: y, x2: 590, y2: y, class: 'gl-stamp-gridline'}); add('line', {x1: 10, y1: y + 28, x2: 590, y2: y + 28, class: 'gl-stamp-line'}); }
  }},
  englishabc: {w: 600, h: 150, draw(add) {
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((l, i) => { const x = 8 + (i % 13) * 45, y = 8 + Math.floor(i / 13) * 70; add('rect', {x, y, width: 42, height: 64, rx: 6, class: 'gl-stamp-cell'}); add('text', {x: x + 21, y: y + 44, class: 'gl-stamp-num letter'}, l + l.toLowerCase()); });
  }},
  venn: {w: 420, h: 260, draw(add) {
    add('circle', {cx: 150, cy: 130, r: 115, class: 'gl-stamp-cell f1 see'}); add('circle', {cx: 270, cy: 130, r: 115, class: 'gl-stamp-cell f2 see'});
    add('text', {x: 330, y: 30, class: 'gl-stamp-num small'}, 'أ'); add('text', {x: 90, y: 30, class: 'gl-stamp-num small'}, 'ب'); add('text', {x: 210, y: 135, class: 'gl-stamp-num small'}, 'مشترك');
  }},
  tchart: {w: 420, h: 260, draw(add) { tchart(add, 'أوجه الشبه', 'أوجه الاختلاف'); }},
  kwl: {w: 600, h: 260, draw(add) {
    ['ماذا أعرف؟', 'ماذا أريد أن أعرف؟', 'ماذا تعلمت؟'].forEach((t, i) => { const x = 405 - i * 200; add('rect', {x, y: 5, width: 190, height: 40, class: 'gl-stamp-cell f' + (i + 1)}); add('text', {x: x + 95, y: 31, class: 'gl-stamp-num small'}, t); add('rect', {x, y: 45, width: 190, height: 210, class: 'gl-stamp-cell'}); });
  }}
};
function tchart(add, a, b) {
  add('rect', {x: 5, y: 5, width: 410, height: 250, class: 'gl-stamp-cell'}); add('line', {x1: 210, y1: 5, x2: 210, y2: 255, class: 'gl-stamp-line'}); add('line', {x1: 5, y1: 50, x2: 415, y2: 50, class: 'gl-stamp-line'});
  add('text', {x: 312, y: 35, class: 'gl-stamp-num'}, a); add('text', {x: 108, y: 35, class: 'gl-stamp-num'}, b);
}

/**
 * The library. kind: 'stamp' (laid on the board), 'activity' (an interactive explanation step), 'class' (a class tool:
 * timer, random student, curtain, laser). lessons: curriculum lesson ids (curriculum-g4.js) the tool suits best.
 */
export const LIBRARY = [
  // ---- mathematics ----
  {id: 'placevalue', kind: 'activity', icon: '🔢', title: 'لوحة المنازل التفاعلية', desc: 'يكتب المعلم عددًا فتظهر منازله وقيمها.', subjects: ['math'], grades: [3, 4, 5], lessons: ['m1-1', 'm1-2', 'm1-4', 'm1-5', 'm1-6']},
  {id: 'placechart', kind: 'stamp', icon: '🏷', title: 'جدول المنازل', desc: 'من الآحاد إلى الملايين لكتابة الأعداد.', subjects: ['math'], grades: [2, 3, 4, 5], lessons: ['m1-1', 'm1-2', 'm1-4', 'm1-5', 'm1-6']},
  {id: 'numberline10', kind: 'stamp', icon: '📏', title: 'خط الأعداد ٠–١٠', desc: 'للعد والجمع والطرح والمقارنة.', subjects: ['math'], grades: [1, 2, 3], lessons: ['m2-4', 'm2-5']},
  {id: 'numberline100', kind: 'stamp', icon: '📏', title: 'خط الأعداد ٠–١٠٠', desc: 'للتقريب والترتيب والتقدير.', subjects: ['math'], grades: [2, 3, 4, 5], lessons: ['m1-4', 'm1-5', 'm1-6', 'm2-2']},
  {id: 'hundred', kind: 'stamp', icon: '💯', title: 'لوحة المئة', desc: 'الأعداد من ١ إلى ١٠٠ لاكتشاف الأنماط.', subjects: ['math'], grades: [1, 2, 3, 4], lessons: ['m5-1']},
  {id: 'multtable', kind: 'stamp', icon: '✖️', title: 'جدول الضرب', desc: 'من ١ إلى ١٠، للمضاعفات والقواسم.', subjects: ['math'], grades: [3, 4, 5], lessons: ['m4-7', 'm5-1', 'm5-2', 'm5-5', 'm5-6', 'm5-8', 'm6-1', 'm6-4']},
  {id: 'functable', kind: 'stamp', icon: '🧮', title: 'جدول الدالة', desc: 'مدخلة ومخرجة لاكتشاف القاعدة.', subjects: ['math'], grades: [4, 5, 6], lessons: ['m4-4', 'm4-5', 'm4-7']},
  {id: 'fractionbars', kind: 'stamp', icon: '🍫', title: 'أشرطة الكسور', desc: 'الواحد والنصف والثلث والربع والسدس.', subjects: ['math'], grades: [3, 4, 5, 6], lessons: []},
  {id: 'fractioncircle', kind: 'stamp', icon: '🍕', title: 'دائرة الكسور', desc: 'دائرة مقسمة لأثمان وربع مظلل.', subjects: ['math'], grades: [2, 3, 4, 5], lessons: []},
  {id: 'clock', kind: 'stamp', icon: '🕒', title: 'الساعة', desc: 'وجه ساعة لقراءة الوقت.', subjects: ['math'], grades: [1, 2, 3], lessons: []},
  {id: 'grid', kind: 'stamp', icon: '#️⃣', title: 'المستوى الإحداثي', desc: 'شبكة بمحورين للنقاط والتمثيل بالخطوط.', subjects: ['math'], grades: [4, 5, 6], lessons: ['m3-4']},
  {id: 'bargraph', kind: 'stamp', icon: '📊', title: 'محاور التمثيل بالأعمدة', desc: 'محوران وخطوط شبكة لرسم الأعمدة.', subjects: ['math'], grades: [3, 4, 5], lessons: ['m3-1', 'm3-2', 'm3-3']},
  {id: 'piechart', kind: 'stamp', icon: '🥧', title: 'قطاعات دائرية', desc: 'دائرة بأربعة قطاعات ملونة.', subjects: ['math'], grades: [4, 5, 6], lessons: ['m3-5']},
  {id: 'spinner', kind: 'stamp', icon: '🎯', title: 'القرص الدوار', desc: 'أربعة ألوان متساوية لدرس الاحتمال.', subjects: ['math'], grades: [3, 4, 5, 6], lessons: ['m3-6']},
  {id: 'dice', kind: 'stamp', icon: '🎲', title: 'حجر النرد', desc: 'للاحتمال والعد.', subjects: ['math'], grades: ALL, lessons: ['m3-6']},
  {id: 'shapes', kind: 'stamp', icon: '🔺', title: 'الأشكال الهندسية', desc: 'مثلث ومربع ومستطيل ودائرة بأسمائها.', subjects: ['math'], grades: [1, 2, 3, 4], lessons: []},
  {id: 'ruler', kind: 'stamp', icon: '📏', title: 'المسطرة', desc: 'عشرة سنتيمترات للقياس.', subjects: ['math', 'science'], grades: ALL, lessons: []},
  {id: 'protractor', kind: 'stamp', icon: '📐', title: 'المنقلة', desc: 'من ٠ إلى ١٨٠ درجة لقياس الزوايا.', subjects: ['math'], grades: [4, 5, 6], lessons: []},
  // ---- science ----
  {id: 'cells', kind: 'activity', icon: '🔬', title: 'رحلة التكبير إلى الخلية', desc: 'من المخلوق إلى العضو والنسيج والخلية، نباتية وحيوانية.', subjects: ['science'], grades: [4, 5], lessons: ['s1-1-1', 's1-1-2']},
  {id: 'matter', kind: 'activity', icon: '🧊', title: 'حالات المادة', desc: 'نسخّن الماء ونبرّده فيتغيّر من صلب إلى سائل إلى غاز.', subjects: ['science'], grades: [3, 4, 5], lessons: []},
  {id: 'shadows', kind: 'activity', icon: '☀️', title: 'الضوء والظل', desc: 'نحرّك الشمس فيتغيّر طول الظل واتجاهه.', subjects: ['science'], grades: [3, 4, 5], lessons: []},
  {id: 'thermometer', kind: 'stamp', icon: '🌡', title: 'ميزان الحرارة', desc: 'بالدرجات السيليزية من ٠ إلى ١٠٠.', subjects: ['science', 'math'], grades: [2, 3, 4, 5, 6], lessons: []},
  {id: 'foodchain', kind: 'stamp', icon: '🔗', title: 'السلسلة الغذائية', desc: 'منتج ومستهلكون بأسهم انتقال الطاقة.', subjects: ['science'], grades: [3, 4, 5], lessons: ['s2-3-1', 's2-3-2', 's2-3-3']},
  {id: 'vertebrates', kind: 'stamp', icon: '🦴', title: 'فقاريات ولافقاريات', desc: 'جدول بعمودين لتصنيف الحيوانات.', subjects: ['science'], grades: [3, 4, 5], lessons: ['s1-1-2', 's1-2-1', 's1-2-2', 's1-2-3']},
  {id: 'plate', kind: 'stamp', icon: '🍽', title: 'طبق الغذاء الصحي', desc: 'الخضروات والفواكه والحبوب والبروتين.', subjects: ['science'], grades: ALL, lessons: ['s3-5-1', 's3-5-2']},
  // ---- languages, social studies and Islamic studies ----
  {id: 'arabicletters', kind: 'stamp', icon: '🔤', title: 'الحروف العربية', desc: 'الحروف الثمانية والعشرون.', subjects: ['arabic', 'islamic'], grades: [1, 2, 3], lessons: []},
  {id: 'writinglines', kind: 'stamp', icon: '✍️', title: 'سطور الكتابة', desc: 'أربعة أسطر للخط والإملاء.', subjects: ['arabic', 'english', 'islamic'], grades: ALL, lessons: []},
  {id: 'englishabc', kind: 'stamp', icon: '🔠', title: 'الحروف الإنجليزية', desc: 'من A إلى Z بالحرفين الكبير والصغير.', subjects: ['english'], grades: ALL, lessons: []},
  {id: 'compass', kind: 'stamp', icon: '🧭', title: 'الاتجاهات الأربعة', desc: 'شمال وجنوب وشرق وغرب.', subjects: ['science', 'islamic'], grades: [2, 3, 4, 5, 6], lessons: []},
  // ---- organisers for every subject ----
  {id: 'venn', kind: 'stamp', icon: '⭕', title: 'شكل فِن للمقارنة', desc: 'دائرتان متداخلتان: المختلف والمشترك.', subjects: ['*'], grades: ALL, lessons: []},
  {id: 'tchart', kind: 'stamp', icon: '📋', title: 'جدول المقارنة', desc: 'أوجه الشبه وأوجه الاختلاف.', subjects: ['*'], grades: ALL, lessons: []},
  {id: 'kwl', kind: 'stamp', icon: '🧠', title: 'أعرف، أريد أن أعرف، تعلمت', desc: 'منظّم لبداية الدرس ونهايته.', subjects: ['*'], grades: ALL, lessons: []},
  // ---- class tools (every subject) ----
  {id: 'timer', kind: 'class', icon: '⏱', title: 'المؤقت', desc: 'عد تنازلي يراه الطلاب.', subjects: ['*'], grades: ALL, lessons: []},
  {id: 'picker', kind: 'class', icon: '🎲', title: 'اختيار طالب', desc: 'عشوائي دون تكرار حتى يأخذ الجميع دورهم.', subjects: ['*'], grades: ALL, lessons: []},
  {id: 'curtain', kind: 'class', icon: '🎭', title: 'الستارة', desc: 'تغطي السبورة وتكشفها تدريجيًا.', subjects: ['*'], grades: ALL, lessons: []},
  {id: 'laser', kind: 'class', icon: '🔴', title: 'مؤشر الليزر', desc: 'أثر أحمر يتبع حركتك ويختفي.', subjects: ['*'], grades: ALL, lessons: []}
];
export const toolOf = id => LIBRARY.find(t => t.id === id);

/** Tools for a subject, grade and lesson: the ones made for the lesson first, then the rest of the subject's. */
export function toolsFor({subject = '', grade = 0, lesson = '', query = ''} = {}) {
  const q = query.trim();
  const fits = t => (!subject || t.subjects.includes('*') || t.subjects.includes(subject)) && (!grade || t.grades.includes(Number(grade))) && (!q || (t.title + ' ' + t.desc).includes(q));
  const list = LIBRARY.filter(fits), forLesson = lesson ? list.filter(t => t.lessons.includes(lesson)) : [];
  return {forLesson, others: list.filter(t => !forLesson.includes(t))};
}
