// Synthetic lesson assignments, not an official curriculum mapping.
export const lessons=[
{id:'science-g4-cell-demo',subject:'science',grade:4,title:'الخلية — عينة توضيحية غير منسوبة لمنهج رسمي',aidIds:['library-cell']},
{id:'math-g4-angles',subject:'math',grade:4,title:'الزوايا — نموذج تجريبي غير منسوب للمنهج',aidIds:['protractor']},
{id:'math-g4-length',subject:'math',grade:4,title:'قياس الأطوال — نموذج تجريبي غير منسوب للمنهج',aidIds:['ruler']},
{id:'math-g4-fractions',subject:'math',grade:4,title:'الكسور — نموذج تجريبي',aidIds:['fraction']},
{id:'math-g1-line',subject:'math',grade:1,title:'خط الأعداد — نموذج تجريبي',aidIds:['number-line','library-number-line']},
{id:'science-g4-water',subject:'science',grade:4,title:'دورة الماء — نموذج تجريبي',aidIds:['water']},
{id:'science-g4-observation',subject:'science',grade:4,title:'الملاحظة العلمية — نموذج تجريبي',aidIds:[]}
];
export const allowedLessons=context=>lessons.filter(l=>context?.preview||(l.subject===context?.subject&&l.grade===context?.grade));
