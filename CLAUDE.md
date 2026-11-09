# احتراف التدريس — تعليمات Claude

## النطاق والقواعد
- Claude: الفصل والسبورة والدروس والتحضير والحضور. الإدارة لفزاع (Codex) في `alaoufi/khatwa-learning`: لا تعدّلها، أرسل طلبًا مكتوبًا.
- اكتب للمستخدم بالعربية، باختصار. لا أسرار ولا بيانات شخصية. مناهج سعودية حكومية فقط، ولا تنسب كتابًا لمصدر غير مؤكد.
- قبل كل مرحلة: فرع احتياطي `backup/rollback-0NN-...`.
- موافقة دائمة: تحسينات التصميم (خط، ألوان، أزرار، إطارات، حركة، ترتيب) تُنفَّذ دون سؤال، بلا حذف وظيفة أو تغيير سلوك.

## الكفاءة (حد الاستخدام الأسبوعي عائق عند المالك) — دون نقص في الجودة
- اقرأ الجزء المطلوب من الملف فقط (`grep` / `sed -n`)، ولا تفتح ملفات كاملة كبيرة.
- لا صور شاشة إلا للتحقق من تغيير مقصود في الشكل (صورة واحدة).
- الفحص مرة واحدة في نهاية المرحلة: `npm run -s check`. لا APK ولا صور Figma إلا عند الطلب.
- ردود قصيرة: النتيجة وما يحتاج قرارًا فقط.

## الأدوات
- الحركة: GSAP عبر `public/motion.js` فقط (transform/opacity، `clearProps`، احترام تقليل الحركة، لا تحريك للحبر أو الكاميرا). المهارات في `.claude/skills/gsap-*`.
- الألوان: متغيرات `--gl-*` في `:root` بأعلى `public/group-lesson.css`، مطابقة لملف Figma https://www.figma.com/design/5UwR7htPZ2GGD3zv7bI5h9 (مجموعة `Classroom colors`). لا ألوان مباشرة.
- الخط: Noto Sans Arabic في `public/vendor/fonts/`. الأيقونات: Lucide عبر `public/icons.js` (أضف للجدول ثم `node build-icons.mjs`).
- Figma: `create_session` ثم مهارة `figma-design-to-code` قبل `get_design_context`؛ الناتج مرجع يُكيَّف (JS بلا إطار، RTL، CSP `script-src 'self'`).

## الفحص والنشر
- `export PATH=/opt/node24/bin:$PATH && npm run -s check` (وحدة + 33 فحص متصفح بالتوازي، يشمل axe والصور). فحوص محددة: `npm run -s check -- a11y visual`. بعد تغيير مقصود في الشكل: `npm run test:visual:update`.
- الملفات الثابتة الجديدة تُسجَّل في `server.mjs`.
- `git push -q origin codex/board-first` ثم `git push -q origin codex/board-first:main` ثم نشر Render (`srv-dbm5a215efls73chq600`، مساحة `tea-dbm46bp42hec73dk4e6g`) والتحقق من https://abdulrahman-edu-trial.onrender.com.
- APK: `cd android && ANDROID_HOME=/opt/android-sdk ./build.sh`؛ رفع الإصدار في `AndroidManifest.xml` و`res/values/strings.xml` و`MainActivity.java`.
