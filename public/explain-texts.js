// Ready explanatory texts for the light-and-shadow lesson (original wording, not copied from any textbook).
// The teacher picks one, edits it and saves the edited copy as a new text in their own library.
// Kept in the repository so it never depends on the trial server.

export const TEXT_TOPICS = {
  idea: 'الفكرة الأساسية',
  example: 'أمثلة من الحياة',
  mistake: 'أخطاء شائعة',
  discuss: 'أسئلة للنقاش',
  activity: 'نشاط قصير',
  summary: 'خلاصة'
};

export const EXPLAIN_TEXTS = [
  {id: 'ls-idea-1', lesson: 'science-4-light', topic: 'idea', title: 'الضوء يسير مستقيمًا', body: 'ينطلق الضوء من مصدره في خطوط مستقيمة، ولا ينعطف من تلقاء نفسه حول الأجسام.'},
  {id: 'ls-idea-2', lesson: 'science-4-light', topic: 'idea', title: 'ما الظل؟', body: 'الظل منطقة مظلمة تتكون خلف جسم معتم، لأن الجسم يمنع الضوء من الوصول إليها.'},
  {id: 'ls-idea-3', lesson: 'science-4-light', topic: 'idea', title: 'اتجاه الظل', body: 'يتكون الظل دائمًا في الجهة المقابلة لمصدر الضوء.'},
  {id: 'ls-idea-4', lesson: 'science-4-light', topic: 'idea', title: 'طول الظل', body: 'كلما انخفض مصدر الضوء طال الظل، وكلما ارتفع قصر الظل.'},
  {id: 'ls-idea-5', lesson: 'science-4-light', topic: 'idea', title: 'المواد والضوء', body: 'الجسم المعتم يحجب الضوء كله، وشبه الشفاف يمرر جزءًا منه، والشفاف يمرر معظمه.'},
  {id: 'ls-ex-1', lesson: 'science-4-light', topic: 'example', title: 'ظلك في الطريق إلى المدرسة', body: 'في الصباح الباكر تكون الشمس منخفضة، فترى ظلك طويلًا أمامك أو خلفك.'},
  {id: 'ls-ex-2', lesson: 'science-4-light', topic: 'example', title: 'المظلة', body: 'نجلس تحت المظلة في يوم مشمس لأنها جسم معتم يصنع ظلًا يحمينا من أشعة الشمس.'},
  {id: 'ls-ex-3', lesson: 'science-4-light', topic: 'example', title: 'النافذة والستارة', body: 'زجاج النافذة يمرر الضوء، أما الستارة السميكة فتحجبه وتجعل الغرفة مظلمة.'},
  {id: 'ls-mis-1', lesson: 'science-4-light', topic: 'mistake', title: 'الظل ليس انعكاسًا', body: 'الظل ليس صورة للجسم مثل المرآة؛ إنه مكان لم يصله الضوء، لذلك لا يظهر فيه لون الجسم أو تفاصيله.'},
  {id: 'ls-mis-2', lesson: 'science-4-light', topic: 'mistake', title: 'الظل لا يتحرك وحده', body: 'يتغير الظل خلال اليوم لأن موقع الشمس في السماء يتغير، وليس لأن الظل يتحرك من نفسه.'},
  {id: 'ls-dis-1', lesson: 'science-4-light', topic: 'discuss', title: 'توقّع', body: 'إذا ارتفعت الشمس في السماء، ماذا تتوقع أن يحدث لطول ظلك؟ ولماذا؟'},
  {id: 'ls-dis-2', lesson: 'science-4-light', topic: 'discuss', title: 'قارن', body: 'لماذا يصنع اللوح الخشبي ظلًا داكنًا، بينما يصنع الورق المشمّع ظلًا باهتًا؟'},
  {id: 'ls-act-1', lesson: 'science-4-light', topic: 'activity', title: 'تجربة المصباح', body: 'ضع قلمًا واقفًا على الطاولة، وحرّك مصباحًا من فوقه إلى جانبه، وراقب كيف يطول الظل ويقصر.'},
  {id: 'ls-sum-1', lesson: 'science-4-light', topic: 'summary', title: 'خلاصة الدرس', body: 'الضوء يسير مستقيمًا، والجسم المعتم يحجبه فيتكون ظل في الجهة المقابلة للضوء، ويطول الظل كلما انخفض مصدر الضوء.'},
  {id: 'mt-idea-1', lesson: 'science-4-matter', topic: 'idea', title: 'حالات المادة الثلاث', body: 'توجد المادة في ثلاث حالات: صلبة وسائلة وغازية. الماء مثال يمكن أن نراه في الحالات الثلاث.'},
  {id: 'mt-idea-2', lesson: 'science-4-matter', topic: 'idea', title: 'الصلب', body: 'جزيئات المادة الصلبة متقاربة ومرتبة وتهتز في مكانها، لذلك يكون للصلب شكل ثابت وحجم ثابت.'},
  {id: 'mt-idea-3', lesson: 'science-4-matter', topic: 'idea', title: 'السائل', body: 'جزيئات السائل قريبة لكنها تنزلق فوق بعضها، لذلك يكون حجمه ثابتًا ويأخذ شكل الإناء.'},
  {id: 'mt-idea-4', lesson: 'science-4-matter', topic: 'idea', title: 'الغاز', body: 'جزيئات الغاز متباعدة وتتحرك بسرعة في كل اتجاه، لذلك ينتشر الغاز ويملأ المكان كله.'},
  {id: 'mt-idea-5', lesson: 'science-4-matter', topic: 'idea', title: 'تغيرات الحالة', body: 'الانصهار: صلب إلى سائل. التبخر والغليان: سائل إلى غاز. التكاثف: غاز إلى سائل. التجمد: سائل إلى صلب.'},
  {id: 'mt-ex-1', lesson: 'science-4-matter', topic: 'example', title: 'الآيس كريم', body: 'يذوب الآيس كريم في يوم حار لأن الحرارة تجعله ينصهر من الحالة الصلبة إلى السائلة.'},
  {id: 'mt-ex-2', lesson: 'science-4-matter', topic: 'example', title: 'كأس الماء البارد', body: 'تظهر قطرات على السطح الخارجي لكأس بارد لأن بخار الماء في الهواء يبرد عند الكأس فيتكاثف.'},
  {id: 'mt-ex-3', lesson: 'science-4-matter', topic: 'example', title: 'قِدر الماء', body: 'عندما يغلي الماء في القِدر يتحول جزء منه إلى بخار، فتقل كمية الماء مع الوقت.'},
  {id: 'mt-mis-1', lesson: 'science-4-matter', topic: 'mistake', title: 'فقاعات الغليان', body: 'الفقاعات الكبيرة في الماء المغلي ليست هواء؛ إنها بخار ماء تكوّن داخل السائل.'},
  {id: 'mt-mis-2', lesson: 'science-4-matter', topic: 'mistake', title: 'السحابة البيضاء فوق الإبريق', body: 'بخار الماء نفسه لا يُرى؛ السحابة البيضاء قطرات ماء صغيرة تكاثفت عندما برد البخار.'},
  {id: 'mt-dis-1', lesson: 'science-4-matter', topic: 'discuss', title: 'توقّع', body: 'إذا وضعنا كأس ماء في الثلاجة طوال الليل، ماذا تتوقع أن يحدث؟ ولماذا؟'},
  {id: 'mt-act-1', lesson: 'science-4-matter', topic: 'activity', title: 'سباق الجليد', body: 'ضع مكعبي جليد، أحدهما في الشمس والآخر في الظل. أيهما ينصهر أولًا؟ سجّل الوقت.'},
  {id: 'mt-sum-1', lesson: 'science-4-matter', topic: 'summary', title: 'خلاصة الدرس', body: 'للمادة ثلاث حالات. التسخين يحوّل الصلب إلى سائل والسائل إلى غاز، والتبريد يعيد الغاز سائلًا والسائل صلبًا.'}
];

export const TEXT_LESSONS = {'science-4-light': 'الضوء والظل', 'science-4-matter': 'حالات المادة'};
