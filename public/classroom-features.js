// Shared, fixed allowlist. These switches never grant room admission or change schedules.
export const CLASSROOM_FEATURES = Object.freeze([
  ['board', 'مساحة السبورة', 'السبورة', '#gl-board,.gl-zoom'],
  ['drawing', 'الأقلام والأشكال والممحاة', 'السبورة', '[data-fly="pens"],[data-fly="shapes"],[data-tool="select"],[data-tool="eraser"],.gl-look,#gl-undo,#gl-clear,#gl-textbox'],
  ['texts', 'مكتبة النصوص', 'السبورة', '#gl-library,#gl-snippets,.gl-dialog.tl-dialog'],
  ['tools', 'مكتبة الوسائل وأدوات القياس', 'السبورة', '.gl-lesson-tools,.gl-stamp-btn,.tl-dialog:not(.gl-dialog)'],
  ['laser', 'مؤشر الليزر', 'السبورة', '[data-tool="laser"]'],
  ['zoom', 'التكبير والتحريك', 'السبورة', '.gl-zoom,[data-tool="hand"]'],
  ['timer', 'المؤقت', 'السبورة', '.gl-timer-btn,.gl-timer'],
  ['curtain', 'ستارة السبورة', 'السبورة', '.gl-curtain-btn,.gl-curtain'],
  ['display', 'شاشة العرض', 'الفصل', 'a[href$="/display"]'],
  ['roster', 'قائمة الطلاب', 'الفصل', '#gl-students-section'],
  ['hands', 'رفع اليد', 'الفصل', '#gl-hand,#gl-hands,[data-down]'],
  ['pick', 'اختيار طالب', 'الفصل', '#gl-pick,#gl-pick-reset,#gl-pick-pop'],
  ['attention', 'تنبيه انتباه الطلاب', 'الفصل', '#gl-attention,#gl-attention-cover'],
  ['workMode', 'وضع العمل', 'الفصل', '.gl-work-btn,#gl-work'],
  ['stars', 'نجوم التشجيع', 'الفصل', '#gl-stars,#gl-star-pop,.gl-star-btn'],
  ['teacherMic', 'صوت المعلم', 'الصوت والصورة', '#gl-voice'],
  ['studentMic', 'ميكروفون الطالب', 'الصوت والصورة', '#gl-mics,#gl-mic'],
  ['camera', 'كاميرا المعلم', 'الصوت والصورة', '#gl-cam,#gl-selfcam,#gl-teachercam'],
  ['narration', 'المتحدث والشرح الصوتي', 'الصوت والصورة', '#gl-test-voice,#gl-narration,[data-narr],.gl-narrator,.gl-narr-panel,.gl-narr-quick,[data-q=narration]'],
  ['title', 'عنوان الدرس', 'فقرات الدرس', '[data-type="title"]'],
  ['page', 'صفحة الكتاب والصورة', 'فقرات الدرس', '[data-type="page"]'],
  ['interactive', 'الشرح التفاعلي', 'فقرات الدرس', '[data-type="interactive"]'],
  ['notes', 'فقرة نصوص السبورة', 'فقرات الدرس', '[data-type="board"]'],
  ['questions', 'الأسئلة والإجابات', 'فقرات الدرس', '[data-type="questions"],#gl-answer'],
  ['homework', 'الواجب', 'فقرات الدرس', '[data-type="homework"],#gl-homework-section,#gl-hw'],
  ['evaluation', 'التقييم', 'فقرات الدرس', '[data-type="evaluation"],#gl-evaluation-section,#gl-eval']
].map(([key,label,group,selectors]) => Object.freeze({key,label,group,selectors})));
export const featureDefaults = () => Object.fromEntries(CLASSROOM_FEATURES.map(f => [f.key, true]));
export const stepFeature = type => type === 'board' ? 'notes' : type;
export function applyClassroomFeatures(features = {}) {
  for (const {key} of CLASSROOM_FEATURES) document.documentElement.classList.toggle('gl-off-' + key, features[key] === false);
  // Closing an already-open modal avoids trapping keyboard focus behind hidden tools.
  if (features.tools === false) document.querySelectorAll('dialog.tl-dialog:not(.gl-dialog)[open]').forEach(d => d.close());
  if (features.texts === false) document.querySelectorAll('dialog.gl-dialog.tl-dialog[open]').forEach(d => d.close());
}
