// Interactive explanations for elementary and intermediate science and mathematics (stage 060). Each entry follows
// the activity engine in activities.js: controls, drawing, the facts line and a ready narrated tour.
import * as M from './math-models.js';
import * as S from './science-models.js';

const names = parts => Object.fromEntries(Object.entries(parts).map(([k, p]) => [k, p.name]));
const ar = new Intl.NumberFormat('ar-SA');
const stagesParam = (list, extra = {}) => ({key: 'stage', label: 'المرحلة', kind: 'range', min: 1, max: list.length, step: 1, big: 1, format: v => list[Math.round(v) - 1], earlier: '◀ السابقة', later: 'التالية ▶', quick: true, ...extra});
const tour = (prefix, rows) => rows.map(([values, text], i) => ({id: prefix + (i + 1), values, text}));

export const EXPLAINERS = {
  // ------------------------------------------------ mathematics
  fractions: {
    id: 'fractions', title: 'الكسور: البسط والمقام والكسور المتكافئة', lesson: 'math-fractions',
    params: [
      {key: 'num', label: 'البسط', kind: 'range', min: 0, max: 24, step: 1, big: 1, tween: false, format: v => ar.format(v), earlier: 'البسط −١', later: 'البسط +١', quick: true},
      {key: 'den', label: 'المقام', kind: 'range', min: 1, max: 12, step: 1, big: 1, tween: false, format: v => ar.format(v), earlier: 'المقام −١', later: 'المقام +١', quick: true},
      {key: 'view', label: 'الشكل', kind: 'choice', options: M.FRACTION_VIEWS, quick: true}
    ],
    initial: () => ({num: 1, den: 2, view: 'both'}), render: (v, o) => M.renderFraction(v, o), facts: M.fractionFacts,
    hideLabel: 'إخفاء الكسر ليكتبه الطلاب', revealLabel: 'اكشف الكسر', exploreKey: 'num',
    narrator: () => tour('f', [
      [{num: 1, den: 2, view: 'both'}, 'قسمنا الشكل جزأين متساويين ولوّنا واحدًا: هذا نصف. المقام اثنان عدد الأجزاء كلها، والبسط واحد عدد الأجزاء الملوّنة.'],
      [{num: 2, den: 4, view: 'both'}, 'الآن أربعة أجزاء ولوّنا اثنين: اثنان من أربعة. لاحظوا أن الجزء الملوّن بالحجم نفسه، إذن اثنان من أربعة يساوي نصفًا. هذان كسران متكافئان.'],
      [{num: 3, den: 4, view: 'both'}, 'ثلاثة أرباع: قسمنا الواحد أربعة أجزاء متساوية ولوّنا ثلاثة.'],
      [{num: 4, den: 4, view: 'both'}, 'أربعة أرباع تساوي واحدًا صحيحًا: لوّنا الأجزاء كلها.'],
      [{num: 5, den: 4, view: 'bar'}, 'خمسة أرباع أكبر من الواحد: واحد صحيح وربع. نسميه كسرًا غير فعلي.'],
      [{num: 3, den: 8, view: 'bar'}, 'قارنوا: ثلاثة أثمان أصغر من ثلاثة أرباع، لأن الثمن أصغر من الربع. كلما كبر المقام صغر الجزء.']])
  },
  numberline: {
    id: 'numberline', title: 'خط الأعداد: الجمع والطرح والأعداد الصحيحة', lesson: 'math-numberline',
    params: [
      {key: 'start', label: 'البداية', kind: 'range', min: -15, max: 15, step: 1, big: 1, format: v => ar.format(v), earlier: 'البداية −١', later: 'البداية +١', quick: true},
      {key: 'jump', label: 'القفزة', kind: 'range', min: -15, max: 15, step: 1, big: 1, format: v => ar.format(v), earlier: 'القفزة −١', later: 'القفزة +١', quick: true}
    ],
    initial: () => ({start: 3, jump: 4}), render: (v, o) => M.renderNumberLine(v, o), facts: M.numberLineFacts,
    hideLabel: 'إخفاء الناتج ليتوقعه الطلاب', revealLabel: 'اكشف الناتج', exploreKey: 'jump',
    narrator: () => tour('l', [
      [{start: 3, jump: 0}, 'نقف على العدد ثلاثة على خط الأعداد.'],
      [{start: 3, jump: 4}, 'نجمع أربعة: نقفز أربع خطوات إلى اليمين فنصل إلى سبعة. ثلاثة زائد أربعة يساوي سبعة.'],
      [{start: 7, jump: -5}, 'من سبعة نطرح خمسة: نقفز إلى اليسار خمس خطوات فنصل إلى اثنين.'],
      [{start: 2, jump: -6}, 'وإذا طرحنا ستة من اثنين نتجاوز الصفر إلى اليسار ونصل إلى سالب أربعة. الأعداد يسار الصفر أعداد سالبة.'],
      [{start: -4, jump: 9}, 'ومن سالب أربعة نجمع تسعة فنصل إلى خمسة موجب.']])
  },
  angles: {
    id: 'angles', title: 'الزوايا: قياسها وأنواعها', lesson: 'math-angles',
    params: [{key: 'angle', label: 'قياس الزاوية', kind: 'range', min: 0, max: 360, step: 5, big: 15, format: v => ar.format(v) + '°', earlier: '−١٥°', later: '+١٥°', quick: true}],
    initial: () => ({angle: 45}), render: (v, o) => M.renderAngle(v, o), facts: M.angleFacts,
    hideLabel: 'إخفاء القياس ليقدّره الطلاب', revealLabel: 'اكشف القياس', exploreKey: 'angle',
    narrator: () => tour('a', [
      [{angle: 45}, 'الزاوية ضلعان يلتقيان في رأس. هذه زاوية حادة قياسها خمس وأربعون درجة، أقل من تسعين.'],
      [{angle: 90}, 'هذه زاوية قائمة قياسها تسعون درجة تمامًا، مثل ركن الكتاب، ونرسم عندها مربعًا صغيرًا.'],
      [{angle: 135}, 'وهذه منفرجة: أكبر من تسعين وأصغر من مئة وثمانين.'],
      [{angle: 180}, 'وعندما يصبح الضلعان على استقامة واحدة تكون الزاوية مستقيمة، قياسها مئة وثمانون درجة.'],
      [{angle: 270}, 'وما زاد على مئة وثمانين نسميه زاوية منعكسة.'],
      [{angle: 360}, 'وإذا أكمل الضلع دورة كاملة فالقياس ثلاثمئة وستون درجة.']])
  },
  area: {
    id: 'area', title: 'المساحة والمحيط', lesson: 'math-area',
    params: [
      {key: 'width', label: 'الطول', kind: 'range', min: 1, max: 12, step: 1, big: 1, tween: false, format: v => ar.format(v), earlier: 'الطول −١', later: 'الطول +١', quick: true},
      {key: 'height', label: 'العرض', kind: 'range', min: 1, max: 8, step: 1, big: 1, tween: false, format: v => ar.format(v), earlier: 'العرض −١', later: 'العرض +١', quick: true},
      {key: 'mode', label: 'نحسب', kind: 'choice', options: M.AREA_MODES, quick: true}
    ],
    initial: () => ({width: 5, height: 3, mode: 'area'}), render: (v, o) => M.renderArea(v, o), facts: M.areaFacts,
    hideLabel: 'إخفاء الناتج ليحسبه الطلاب', revealLabel: 'اكشف الناتج', exploreKey: 'width',
    narrator: () => tour('r', [
      [{width: 5, height: 3, mode: 'area'}, 'المساحة عدد الوحدات المربعة التي تغطي الشكل. نعدّها: خمسة في كل صف، وثلاثة صفوف. خمسة في ثلاثة يساوي خمس عشرة وحدة مربعة.'],
      [{width: 5, height: 3, mode: 'perimeter'}, 'أما المحيط فطول الحدود حول الشكل: خمسة وثلاثة وخمسة وثلاثة، المجموع ست عشرة وحدة.'],
      [{width: 4, height: 4, mode: 'area'}, 'وفي المربع الأضلاع متساوية: أربعة في أربعة يساوي ست عشرة وحدة مربعة.'],
      [{width: 8, height: 2, mode: 'area'}, 'انتبهوا: هذا المستطيل مساحته ست عشرة أيضًا، لكن محيطه أكبر. أشكال مختلفة قد تتساوى في المساحة.']])
  },
  balance: {
    id: 'balance', title: 'حل المعادلات بالميزان', lesson: 'math-equations',
    params: [
      stagesParam(M.BALANCE_STEPS, {tween: false}),
      {key: 'a', label: 'المعامل', kind: 'range', min: 1, max: 4, step: 1, tween: false, format: v => ar.format(v)},
      {key: 'b', label: 'العدد المضاف', kind: 'range', min: 0, max: 8, step: 1, tween: false, format: v => ar.format(v)},
      {key: 'x', label: 'قيمة س', kind: 'range', min: 1, max: 9, step: 1, tween: false, format: v => ar.format(v)}
    ],
    initial: () => ({stage: 1, a: 2, b: 3, x: 4}), render: (v, o) => M.renderBalance({...v, step: v.stage}, o), facts: M.balanceFacts,
    hideLabel: 'إخفاء الحل ليجده الطلاب', revealLabel: 'اكشف الحل', exploreKey: 'stage',
    narrator: () => tour('b', [
      [{stage: 1, a: 2, b: 3, x: 4}, 'المعادلة مثل ميزان متوازن: في اليسار صندوقان في كل منهما العدد المجهول س، وثلاث قطع. وفي اليمين إحدى عشرة قطعة.'],
      [{stage: 2, a: 2, b: 3, x: 4}, 'لنبقي الميزان متوازنًا نزيل ثلاث قطع من الطرفين معًا: يبقى صندوقان في اليسار وثماني قطع في اليمين.'],
      [{stage: 3, a: 2, b: 3, x: 4}, 'الصندوقان يساويان ثماني قطع، فنقسم الطرفين على اثنين: صندوق واحد يساوي أربع قطع.'],
      [{stage: 4, a: 2, b: 3, x: 4}, 'إذن س تساوي أربعة. نتحقق: اثنان في أربعة زائد ثلاثة يساوي أحد عشر. صحيح.']])
  },
  linear: {
    id: 'linear', title: 'الدالة الخطية والتمثيل البياني', lesson: 'math-linear',
    params: [
      {key: 'm', label: 'الميل م', kind: 'range', min: -3, max: 3, step: 0.5, big: 0.5, format: v => ar.format(v), earlier: 'الميل −½', later: 'الميل +½', quick: true},
      {key: 'b', label: 'المقطع ب', kind: 'range', min: -5, max: 5, step: 1, big: 1, format: v => ar.format(v), earlier: 'المقطع −١', later: 'المقطع +١', quick: true}
    ],
    initial: () => ({m: 1, b: 0}), render: (v, o) => M.renderLinear(v, o), facts: M.linearFacts,
    hideLabel: 'إخفاء الرسم ليكمل الطلاب الجدول', revealLabel: 'ارسم المستقيم', exploreKey: 'm',
    narrator: () => tour('y', [
      [{m: 1, b: 0}, 'الدالة ص تساوي س: كل قيمة لس تعطي القيمة نفسها لص. نعيّن النقاط من الجدول فتقع على مستقيم يمر بنقطة الأصل.'],
      [{m: 2, b: 0}, 'إذا صار الميل اثنين يصعد المستقيم أسرع: كلما زادت س واحدًا زادت ص اثنين.'],
      [{m: 2, b: 3}, 'والعدد ب يرفع المستقيم كله: هنا يقطع محور الصادات عند ثلاثة.'],
      [{m: -1, b: 3}, 'وإذا كان الميل سالبًا ينزل المستقيم من اليسار إلى اليمين.'],
      [{m: 0, b: -2}, 'وعندما يكون الميل صفرًا يصبح المستقيم أفقيًا: ص ثابتة مهما تغيرت س.']])
  },
  // ------------------------------------------------ science
  earth: {
    id: 'earth', title: 'الأرض: الليل والنهار والفصول الأربعة', lesson: 'science-earth',
    params: [
      {key: 'hour', label: 'الساعة', kind: 'range', min: 0, max: 24, step: 1, big: 3, format: S.formatHour, earlier: '−٣ ساعات', later: '+٣ ساعات', quick: true},
      {key: 'month', label: 'الشهر', kind: 'range', min: 1, max: 12, step: 1, big: 3, format: v => S.MONTHS[Math.round(v)], earlier: '−٣ أشهر', later: '+٣ أشهر', quick: true}
    ],
    initial: () => ({hour: 12, month: 6}), render: (v, o) => S.renderEarth(v, o), facts: S.earthFacts,
    hideLabel: 'إخفاء الإجابة ليتوقع الطلاب', revealLabel: 'اكشف', exploreKey: 'hour',
    narrator: () => tour('e', [
      [{hour: 12, month: 6}, 'الأرض تدور حول نفسها. نصفها المواجه للشمس نهار، والنصف الآخر ليل. الرياض الآن تواجه الشمس: إنه الظهر.'],
      [{hour: 18, month: 6}, 'مع الدوران تبتعد الرياض عن الشمس فيأتي المساء.'],
      [{hour: 0, month: 6}, 'وفي منتصف الليل تكون الرياض في الجهة المظلمة. دورة كاملة كل أربع وعشرين ساعة: يوم وليلة.'],
      [{hour: 12, month: 6}, 'والأرض تدور أيضًا حول الشمس مرة كل سنة، ومحورها مائل. في يونيو يميل نصفها الشمالي نحو الشمس فيكون الصيف عندنا.'],
      [{hour: 12, month: 12}, 'وفي ديسمبر يميل النصف الشمالي بعيدًا عن الشمس فتصلنا أشعتها مائلة ويكون الشتاء.'],
      [{hour: 12, month: 3}, 'وبينهما الربيع في مارس، والخريف في سبتمبر.']])
  },
  moon: {
    id: 'moon', title: 'أطوار القمر', lesson: 'science-moon',
    params: [{key: 'day', label: 'يوم الشهر القمري', kind: 'range', min: 0, max: 29, step: 1, big: 4, format: v => `اليوم ${ar.format(v)}`, earlier: '−٤ أيام', later: '+٤ أيام', quick: true}],
    initial: () => ({day: 0}), render: (v, o) => S.renderMoon(v, o), facts: S.moonFacts,
    hideLabel: 'إخفاء الاسم ليتوقع الطلاب', revealLabel: 'اكشف الاسم', exploreKey: 'day',
    narrator: () => tour('o', [
      [{day: 0}, 'القمر لا يضيء بنفسه، بل يعكس ضوء الشمس. في المحاق يكون بين الأرض والشمس، فوجهه المضيء لا نراه.'],
      [{day: 3}, 'بعد أيام يظهر هلال رقيق: هذا الهلال، ومنه نبدأ الشهر الهجري.'],
      [{day: 7}, 'في نحو اليوم السابع نرى نصف القرص مضيئًا: التربيع الأول.'],
      [{day: 15}, 'وفي منتصف الشهر يكتمل القرص: البدر، والأرض بين الشمس والقمر.'],
      [{day: 22}, 'ثم يتناقص: التربيع الأخير.'],
      [{day: 27}, 'ثم الهلال المتناقص، حتى يعود محاقًا بعد نحو تسعة وعشرين يومًا ونصف.']])
  },
  watercycle: {
    id: 'watercycle', title: 'دورة الماء في الطبيعة', lesson: 'science-water',
    params: [stagesParam(S.WATER_STAGES)],
    initial: () => ({stage: 1}), render: (v, o) => S.renderWater(v, o), facts: S.waterFacts,
    hideLabel: 'إخفاء الشرح ليتوقع الطلاب', revealLabel: 'اكشف', exploreKey: 'stage',
    narrator: () => tour('w', [
      [{stage: 1}, 'حرارة الشمس تسخّن ماء البحار والأنهار فيتبخر ويصعد إلى الجو بخارًا لا نراه.'],
      [{stage: 2}, 'كلما ارتفع البخار برد، فيتكاثف قطرات صغيرة جدًا تتجمع وتكوّن السحب.'],
      [{stage: 3}, 'تتجمع القطرات وتكبر حتى تثقل فتسقط: هذا الهطول، مطرًا أو بَرَدًا أو ثلجًا.'],
      [{stage: 4}, 'يجري ماء المطر في الأودية والأنهار، ويتسرب بعضه إلى باطن الأرض مياهًا جوفية، ويعود إلى البحر لتبدأ الدورة من جديد.']])
  },
  circuit: {
    id: 'circuit', title: 'الدائرة الكهربائية: التوالي والتوازي', lesson: 'science-circuits',
    params: [
      {key: 'bulbs', label: 'عدد المصابيح', kind: 'range', min: 1, max: 3, step: 1, big: 1, tween: false, format: v => ar.format(v), earlier: 'مصباح −١', later: 'مصباح +١', quick: true},
      {key: 'switch', label: 'المفتاح', kind: 'choice', options: S.SWITCH, quick: true},
      {key: 'mode', label: 'التوصيل', kind: 'choice', options: S.CIRCUIT_MODES, quick: true}
    ],
    initial: () => ({bulbs: 1, switch: 'off', mode: 'series'}), render: (v, o) => S.renderCircuit(v, o), facts: S.circuitFacts,
    hideLabel: 'إخفاء النتيجة ليتوقع الطلاب', revealLabel: 'اكشف', exploreKey: 'bulbs',
    narrator: () => tour('c', [
      [{bulbs: 1, switch: 'off', mode: 'series'}, 'هذه دائرة كهربائية: بطارية وأسلاك ومصباح ومفتاح. المفتاح مفتوح، فالدائرة غير مكتملة ولا يضيء المصباح.'],
      [{bulbs: 1, switch: 'on', mode: 'series'}, 'نغلق المفتاح فتكتمل الدائرة، ويسري التيار من البطارية عبر الأسلاك فيضيء المصباح.'],
      [{bulbs: 3, switch: 'on', mode: 'series'}, 'وصلنا ثلاثة مصابيح على التوالي في مسار واحد: تقل إضاءتها، وإذا تلف أحدها انقطع التيار عنها كلها.'],
      [{bulbs: 3, switch: 'on', mode: 'parallel'}, 'وهنا على التوازي: لكل مصباح مساره، فتضيء كلها بقوة. هكذا توصل الأجهزة في بيوتنا.']])
  },
  atom: {
    id: 'atom', title: 'تركيب الذرة', lesson: 'science-atom',
    params: [{key: 'z', label: 'العنصر (العدد الذري)', kind: 'range', min: 1, max: 20, step: 1, big: 1, tween: false, format: v => `${S.ELEMENTS[Math.round(v)][1]} (${ar.format(v)})`, earlier: '◀ العنصر السابق', later: 'العنصر التالي ▶', quick: true}],
    initial: () => ({z: 1}), render: (v, o) => S.renderAtom(v, o), facts: S.atomFacts,
    hideLabel: 'إخفاء التوزيع ليحله الطلاب', revealLabel: 'اكشف التوزيع', exploreKey: 'z',
    narrator: () => tour('t', [
      [{z: 1}, 'الذرة أصغر جزء من العنصر. ذرة الهيدروجين أبسط ذرة: بروتون واحد في النواة، وإلكترون واحد يدور حولها.'],
      [{z: 2}, 'الهيليوم: بروتونان ونيوترونان في النواة، وإلكترونان. المستوى الأول يمتلئ بإلكترونين.'],
      [{z: 6}, 'الكربون عدده الذري ستة: ستة بروتونات، وستة إلكترونات: اثنان في المستوى الأول وأربعة في الثاني.'],
      [{z: 8}, 'الأكسجين: ثمانية إلكترونات، اثنان ثم ستة.'],
      [{z: 11}, 'الصوديوم: أحد عشر إلكترونًا. يمتلئ الأول باثنين والثاني بثمانية، ويبقى إلكترون واحد في المستوى الثالث.'],
      [{z: 18}, 'الأرجون: اثنان وثمانية وثمانية. مستواه الخارجي ممتلئ، لذلك لا يتفاعل بسهولة.']])
  },
  heart: {
    id: 'heart', title: 'القلب والدورة الدموية', lesson: 'science-heart',
    params: [stagesParam(S.HEART_STAGES), {key: 'part', label: 'الجزء المظلل', kind: 'choice', options: names(S.HEART_PARTS), quick: true}],
    initial: () => ({stage: 1, part: 'none'}), render: (v, o) => S.renderHeart(v, o), facts: S.heartFacts,
    hideLabel: 'إخفاء الأسماء ليتوقع الطلاب', revealLabel: 'اكشف الأسماء', exploreKey: 'stage',
    narrator: () => tour('h', [
      [{stage: 1, part: 'vessels'}, 'يعود الدم من أنحاء الجسم في الأوردة، وقد استهلكت الخلايا أكسجينه، فنلوّنه بالأزرق.'],
      [{stage: 2, part: 'ra'}, 'يدخل الأذين الأيمن، ثم ينزل إلى البطين الأيمن.'],
      [{stage: 3, part: 'rv'}, 'البطين الأيمن يضخه إلى الرئتين.'],
      [{stage: 4, part: 'lungs'}, 'في الرئتين يأخذ الدم الأكسجين ويتخلص من ثاني أكسيد الكربون، فيصبح غنيًا بالأكسجين.'],
      [{stage: 5, part: 'la'}, 'يعود إلى القلب في الأذين الأيسر، ثم ينزل إلى البطين الأيسر.'],
      [{stage: 6, part: 'lv'}, 'البطين الأيسر أقوى حجرات القلب، يضخ الدم بقوة.'],
      [{stage: 7, part: 'vessels'}, 'فيخرج في الشريان الأورطي إلى الجسم كله، يحمل الأكسجين والغذاء إلى كل خلية.']])
  },
  plant: {
    id: 'plant', title: 'النبات: أجزاؤه والبناء الضوئي', lesson: 'science-plant',
    params: [
      {key: 'light', label: 'شدة الضوء', kind: 'range', min: 0, max: 10, step: 1, big: 2, format: v => `${ar.format(v * 10)}٪`, earlier: '🌑 أقل ضوءًا', later: '☀️ أكثر ضوءًا', quick: true},
      {key: 'part', label: 'الجزء المظلل', kind: 'choice', options: names(S.PLANT_PARTS), quick: true}
    ],
    initial: () => ({light: 8, part: 'none'}), render: (v, o) => S.renderPlant(v, o), facts: S.plantFacts,
    hideLabel: 'إخفاء الأسماء ليتوقع الطلاب', revealLabel: 'اكشف الأسماء', exploreKey: 'light',
    narrator: () => tour('p', [
      [{light: 8, part: 'root'}, 'الجذر يثبّت النبات في التربة ويمتص منها الماء والأملاح.'],
      [{light: 8, part: 'stem'}, 'الساق تحمل الأوراق وتنقل الماء من الجذر إلى أعلى.'],
      [{light: 8, part: 'leaf'}, 'وفي الورقة مصنع الغذاء: تأخذ ثاني أكسيد الكربون من الهواء، والماء من الجذر، وتستعين بضوء الشمس فتصنع السكر، وتطلق الأكسجين.'],
      [{light: 2, part: 'leaf'}, 'إذا قلّ الضوء قلّ صنع الغذاء وقلّ الأكسجين الخارج.'],
      [{light: 0, part: 'none'}, 'وفي الظلام يتوقف البناء الضوئي.'],
      [{light: 8, part: 'flower'}, 'والزهرة عضو التكاثر: منها تتكوّن الثمار وفيها البذور.']])
  }
};
