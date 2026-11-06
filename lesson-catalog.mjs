// Synthetic lesson assignments, not an official curriculum mapping.
export const lessons=[
{id:'original-book-p1',subject:'math',grade:1,title:'وثيقة اختبار أصلية — صفحة ١، ليست منهجًا رسميًا',aidIds:[],previewOnly:true,bookPage:1},
{id:'original-book-p2',subject:'math',grade:1,title:'وثيقة اختبار أصلية — صفحة ٢، ليست منهجًا رسميًا',aidIds:[],previewOnly:true,bookPage:2},
{id:'science-g6-digestion-demo',subject:'science',grade:6,title:'رحلة الطعام — نشاط مستقل للمراجعة',aidIds:['digestion-journey']},
{id:'math-g4-angles',subject:'math',grade:4,title:'الزوايا — نموذج تجريبي غير منسوب للمنهج',aidIds:['protractor']},
{id:'math-g4-length',subject:'math',grade:4,title:'قياس الأطوال — نموذج تجريبي غير منسوب للمنهج',aidIds:['ruler']},
{id:'math-g4-fractions',subject:'math',grade:4,title:'الكسور — نموذج تجريبي',aidIds:['fraction']},
{id:'math-g1-line',subject:'math',grade:1,title:'خط الأعداد — نموذج تجريبي',aidIds:['number-line','library-number-line']},
{id:'science-g4-water',subject:'science',grade:4,title:'دورة الماء — نموذج تجريبي',aidIds:['water']},
{id:'science-g4-shadows',subject:'science',grade:4,title:'الضوء والظل — درس تفاعلي أصلي',aidIds:[],interactive:'/interactive-lessons/science-4-shadows'},
{id:'science-g4-observation',subject:'science',grade:4,title:'الملاحظة العلمية — نموذج تجريبي',aidIds:[]}
];
export const allowedLessons=context=>lessons.filter(l=>context?.preview||(!l.previewOnly&&l.subject===context?.subject&&l.grade===context?.grade));

