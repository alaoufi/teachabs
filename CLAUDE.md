# احتراف التدريس — تعليمات دائمة لـ Claude

## النطاق
- Claude مسؤول عن الفصل والسبورة والدروس والتحضير والحضور.
- قسم الإدارة يملكه Codex («فزاع») في `alaoufi/khatwa-learning`. لا تعدّل كوده ولا قاعدة بياناته؛ أرسل طلبًا مكتوبًا.
- اكتب للمستخدم بالعربية. لا أسرار ولا بيانات شخصية في المستودع.
- المناهج السعودية الحكومية فقط. لا تنسب كتابًا إلى مصدر أو طبعة أو إذن غير مؤكد.
- قبل أي مرحلة: فرع احتياطي مرقّم `backup/rollback-0NN-...`. لا تغيّر التصميم المعتمد أو الوظائف القائمة دون ضرورة.

## أدوات التصميم والحركة (استعملها دائمًا في عمل الواجهة)
- **GSAP:** المهارات في `.claude/skills/gsap-*`. اقرأ `gsap-core` و`gsap-performance` قبل أي حركة.
  - كل حركة تمر عبر `public/motion.js` فقط (enter / grow / fadeIn / open / slideIn / settle).
  - transform وopacity فقط، مدد قصيرة، `clearProps` في النهاية، واحترام `prefers-reduced-motion`.
  - لا تحريك لطبقة الحبر أو كاميرا السبورة أو ما تحت مؤشر المعلم.
- **Figma:** الموصل مربوط بحساب المالك (خطة Starter).
  - عند أي رابط figma.com أو عمل تصميم: `create_session` ثم مهارة `figma-design-to-code` قبل `get_design_context`.
  - ناتج Figma مرجع يُكيَّف مع المشروع: JavaScript بلا إطار، RTL، CSP `script-src 'self'`، بلا خطوط أو صور من مصادر خارجية.
- **ملف Figma للمشروع:** https://www.figma.com/design/5UwR7htPZ2GGD3zv7bI5h9 («احتراف التدريس — نظام تصميم الفصل والسبورة»).
  - مجموعة المتغيرات `Classroom colors` تطابق `:root` في `public/group-lesson.css` و`style.css` (صيغة الويب `var(--...)`).
  - أي تغيير لون: حدّثه في Figma وفي `:root` معًا، ولا تكتب ألوانًا مباشرة في CSS الفصل؛ استعمل `var(--gl-*)`.
- **التحقق البصري:** Playwright (`test/*-browser.cjs`) على مقاسات الجوال والتابلت والكمبيوتر قبل النشر.

## الاختبار والنشر
- `export PATH=/opt/node24/bin:$PATH && npm test`، ثم اختبارات المتصفح بـ `PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright`.
- الملفات الثابتة الجديدة تُسجَّل في `server.mjs`.
- الفرع `codex/board-first`، ثم الدمج إلى `main`، ثم النشر على Render.
