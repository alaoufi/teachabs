// Narrated tour of the light-and-shadow animation (original script).
// Each segment moves the scene and has a short explanation that is spoken and shown as a caption.
// The teacher can edit every line and record their own voice for it in the lesson planner.

export const NARRATOR_SCRIPTS = {
  shadows: {
    title: 'جولة الشمس والظل',
    segments: [
      {id: 'n1', hour: 7, height: 1.5, material: 'wood', text: 'مرحبًا! انظروا إلى الشمس. إنها في الشرق ومنخفضة قرب الأفق في الصباح الباكر.'},
      {id: 'n2', hour: 7, height: 1.5, material: 'wood', text: 'لاحظوا ظل اللوح: إنه طويل جدًا، ويمتد نحو الغرب، أي في الجهة المقابلة للشمس.'},
      {id: 'n3', hour: 9, height: 1.5, material: 'wood', text: 'ترتفع الشمس قليلًا، فيقصر الظل. هنا صار طول الظل مساويًا تقريبًا لطول اللوح.'},
      {id: 'n4', hour: 12, height: 1.5, material: 'wood', text: 'عند الظهر تكون الشمس فوق اللوح تقريبًا، فيكاد الظل يختفي.'},
      {id: 'n5', hour: 15, height: 1.5, material: 'wood', text: 'بعد الظهر تنتقل الشمس نحو الغرب، فينقلب الظل ويتجه نحو الشرق.'},
      {id: 'n6', hour: 15, height: 1.5, material: 'paper', text: 'لو استبدلنا الخشب بورق مشمّع، يمر جزء من الضوء، فيصبح الظل باهتًا.'},
      {id: 'n7', hour: 17, height: 1.5, material: 'wood', text: 'وقبيل الغروب تنخفض الشمس من جديد، فيطول الظل مرة أخرى. تذكروا: الظل دائمًا عكس جهة الضوء.'}
    ]
  }
};

/** Rough speaking time used for automatic advance when no recording exists (about 13 Arabic characters per second). */
export const speakingMs = text => Math.max(3500, Math.min(15000, Math.round(String(text).length / 13 * 1000) + 1200));
