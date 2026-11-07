# توصيف ربط الفصل والسبورة بقاعدة البيانات الحقيقية وقسم الإدارة

المرحلة 059 · مسودة للاتفاق قبل التنفيذ · لا تحتوي أسرارًا ولا بيانات طلاب.

## ١. الوضع الحالي (كما وجدته)

| الجزء | أين | ما الموجود |
|---|---|---|
| الخادم التجريبي (Render) | SQLite على قرص مؤقت | **تضيع البيانات عند كل نشر أو إعادة تشغيل** — لذلك نحتاج قاعدة حقيقية. |
| قاعدة Neon «teachabs-education» | Postgres 18، فرانكفورت | موجودة وفارغة (لا جداول). |
| قسم الإدارة (فروع Codex، غير مدموجة في main بعد) | `school-schema.mjs` | الصفوف `school_grades`، الفصول `school_classes`، إسناد معلم لمادة في فصل `school_teacher_assignments(class_id, subject, teacher)`، إسناد طالب لفصل `school_student_assignments(child, class_id)`، الإشراف، المسارات، السعة. **لا يوجد جدول حصص أسبوعي بعد.** |
| الحصة والسبورة (هذا الفرع) | `group-store.mjs` | تحضير الدروس `group_plans`، الحصص الجارية `group_sessions` (برمز من ٦ أحرف)، الطلاب يدخلون بالاسم فقط `group_students`، الإجابات `group_responses`. |

النتيجة: الإدارة تعرف «مَن يدرّس مَن»، والفصل يعرف «ماذا حدث في الحصة»، لكن **لا شيء يربط بينهما**. هذا التوصيف يحدد الربط.

## ٢. ما أحتاجه من الإدارة (القراءة فقط)

يكفي جانبَ الفصل أن يقرأ هذه المعلومات؛ لا يكتب في جداول الإدارة أبدًا.

1. **الفصل:** `class_id`، اسمه (مثل «٤/أ»)، الصف (١–٦)، المدرسة (`scope`)، حالته (نشط/مؤرشف).
2. **إسناد المادة:** لكل فصل: المادة ← المعلم (موجود: `school_teacher_assignments`).
3. **طلاب الفصل:** `child` ← `class_id` (موجود: `school_student_assignments`)، والاسم الأول فقط للعرض.
4. **جدول الحصص الأسبوعي (جديد، تبنيه الإدارة):** الفصل، المادة، المعلم، اليوم، رقم الحصة، الوقت.
5. **الصلاحيات:** من الشؤون التعليمية يطّلع على التحضير ويحوّله (موجود: `education.read` / `education.write`).

## ٣. الجداول الجديدة المقترحة

### أ) يملكها قسم الإدارة

```sql
-- أوقات الحصص في اليوم الدراسي لكل مدرسة (جرس المدرسة)
CREATE TABLE school_periods(
  id TEXT PRIMARY KEY, scope TEXT NOT NULL,
  number INTEGER NOT NULL CHECK(number BETWEEN 1 AND 12),
  starts TEXT NOT NULL,           -- 'HH:MM' بتوقيت الرياض
  ends   TEXT NOT NULL,
  UNIQUE(scope, number));

-- جدول الحصص الأسبوعي: فصل + مادة + معلم + يوم + حصة
CREATE TABLE school_timetable(
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL REFERENCES school_classes(id),
  subject  TEXT NOT NULL,          -- science | math | arabic | english | islamic …
  teacher  TEXT NOT NULL REFERENCES users(id),
  weekday  INTEGER NOT NULL CHECK(weekday BETWEEN 0 AND 6),   -- 0 = الأحد
  period_id TEXT NOT NULL REFERENCES school_periods(id),
  term TEXT NOT NULL,              -- مثل '1447-1'
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(class_id, weekday, period_id, term));   -- لا حصتان للفصل في الوقت نفسه
```

**منع التعارض** (من متطلبات المدرسة): لا يُسند معلم لفصلين في اليوم والحصة نفسيهما، إلا إذا تطابق **الصف والمادة وموضوع الدرس** (حصة مدمجة). يُفحص عند الحفظ داخل معاملة (transaction)، ويُرفض بخلاف ذلك.

### ب) يملكها جانب الفصل والسبورة (أضيفها أنا)

```sql
-- ربط الحصة الجارية بالجدول والفصل (أعمدة جديدة، القديمة تبقى تعمل)
ALTER TABLE group_sessions ADD COLUMN timetable_id TEXT REFERENCES school_timetable(id);
ALTER TABLE group_sessions ADD COLUMN class_id     TEXT REFERENCES school_classes(id);
ALTER TABLE group_sessions ADD COLUMN lesson       TEXT;   -- رمز الدرس من المنهج مثل 's1-1-1'

-- الطالب المسجّل يدخل بحسابه بدل كتابة اسمه
ALTER TABLE group_students ADD COLUMN child TEXT REFERENCES children(id);

-- الحضور لكل حصة
CREATE TABLE class_attendance(
  code  TEXT NOT NULL REFERENCES group_sessions(code),
  child TEXT NOT NULL REFERENCES children(id),
  status TEXT NOT NULL CHECK(status IN ('present','late','absent','excused')),
  joined INTEGER, PRIMARY KEY(code, child));

-- تحضير مخصّص لفصل (اختياري): المعلم يربط تحضيره بفصل وحصة
ALTER TABLE group_plans ADD COLUMN class_id TEXT REFERENCES school_classes(id);
-- (عمود origin موجود من المرحلة 058: مصدر التحضير المرسل/المحوّل)
```

## ٤. كيف يعمل الربط بعد التنفيذ

1. **الإدارة** تنشئ الفصل وتسند المعلم والمادة والطلاب، وتبني جدول الحصص.
2. **المعلم** يفتح «دروسي»، فيرى حصص اليوم من الجدول: «٤/أ · علوم · الحصة الثالثة ٩:١٥». بجانب كل حصة زر «ابدأ» يختار التحضير المناسب، ويقترح تلقائيًا التحضير المرتبط بالدرس نفسه.
3. **بدء الحصة** ينشئ `group_sessions` مربوطة بـ `timetable_id` و`class_id`.
4. **الطالب** المسجّل يرى في حسابه «حصتك الآن: علوم مع أ. …» ويدخل بضغطة، **بلا رمز ولا كتابة اسم**. لا يدخل إلا طلاب ذلك الفصل.
5. **الحضور** يُسجّل تلقائيًا عند الدخول. المعلم يعدّله (متأخر/معذور)، والإدارة تقرؤه.
6. **النتائج** (الإجابات والتقييم والنجوم) تُحفظ باسم الطالب الحقيقي، فتظهر لولي الأمر والشؤون التعليمية.
7. **الشؤون التعليمية** ترى تحضيرات كل معلم مرتبة حسب الفصل والمادة، وتحوّلها لمعلم آخر (منفّذ في المرحلة 058).

يبقى الدخول برمز الحصة متاحًا للحصص التجريبية وللضيوف، كما هو الآن.

## ٥. الواجهة بين الجانبين (دوال القراءة)

تنفّذها الإدارة في `school-*.mjs`، وأستدعيها أنا من `group-lesson.mjs`. كلها مقيدة بالمدرسة (`scope`):

| الدالة | تُرجع |
|---|---|
| `teacherToday(teacherId, date)` | حصص المعلم اليوم: `[{timetableId, classId, className, grade, subject, period, starts, ends}]` |
| `classRoster(classId)` | طلاب الفصل: `[{child, firstName}]` |
| `canTeach(teacherId, classId, subject)` | صحيح/خطأ (من الإسناد أو الجدول) |
| `studentNow(childId, date)` | الحصة الجارية لفصل الطالب الآن، إن وجدت |
| `classOf(childId)` | فصل الطالب |

## ٦. قاعدة البيانات الحقيقية (Neon Postgres)

- المشروع موجود: **teachabs-education** (Postgres 18، فرانكفورت eu-central-1).
- **الاتصال:** يضاف رابط الاتصال في إعدادات Render متغيرًا باسم `DATABASE_URL`. **لا يُكتب في المحادثة ولا في GitHub.**
- **الترحيل:** الكود الحالي يستعمل SQLite بأوامر متزامنة. الخطة:
  1. طبقة تخزين واحدة لها تنفيذان (SQLite للاختبارات، وPostgres للخادم).
  2. ترحيلات مرقّمة (`schema_migrations`) تعمل على الاثنين.
  3. نقل الجداول بالترتيب: الحسابات ← الإدارة ← الفصول ← التحضير ← الحصص.
  4. نسخة احتياطية قبل كل ترحيل (فرع Neon لكل مرحلة، ويُرجع إليه عند الحاجة).
- **مَن يبدأ:** الجداول المشتركة (`users`, `children`, `school_*`) يرحّلها قسم الإدارة أولًا، ثم أرحّل جداول الحصة. هكذا لا يكتب طرفان على الجدول نفسه.

## ٧. الخصوصية والأمان

- الطلاب قُصّر: يُعرض **الاسم الأول فقط** في الحصة. لا أرقام هوية ولا جوالات في جداول الحصة.
- كل استعلام مقيد بالمدرسة (`scope`). يُختبر الرفض عند محاولة الوصول لفصل أو مدرسة أخرى.
- الطالب لا يرى إلا حصة فصله، والمعلم لا يبدأ حصة إلا لفصل مسند إليه.
- لا تُنقل بيانات حقيقية إلى الخادم التجريبي. التجربة ببيانات وهمية (`@example.invalid`).

## ٨. ما أحتاجه منكم للبدء

1. **موافقة** على الجداول في القسم ٣ (أو تعديلها).
2. أن **يدمج قسم الإدارة** فروع `school-*` في main، أو يحدد الفرع المعتمد.
3. أن **يضيف المالك** `DATABASE_URL` لمشروع Neon «teachabs-education» في إعدادات Render.
4. **قرار:** هل يدخل الطالب بحساب ولي الأمر (الحالي)، أم يُنشأ للطالب حساب مستقل برمز دخول؟
