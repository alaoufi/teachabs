import {digestionAid} from './digestion-aid.js';
import samples from '../vendor/excalidraw-libraries/samples.json' with {type:'json'};
const catalog=[{...digestionAid,kind:'digestion'},
{id:'library-number-line',subject:'الرياضيات',kind:'library',title:'خط أعداد فارغ — مكتبة Excalidraw',explanation:'رسم توضيحي قابل للتحرير من Yatrik Patel، بترخيص MIT. أضف الأعداد المناسبة للدرس؛ ليس أداة قياس.',...samples['library-number-line']},
{id:'library-cell',subject:'العلوم',kind:'library',title:'رسم خلية — عينة للمراجعة',explanation:'رسم تخطيطي من Sanketh، بترخيص MIT؛ يحتاج مراجعة المعلم العلمية، وليس نموذجًا تشريحيًا معتمدًا أو متحركًا.',...samples['library-cell']},
{id:'protractor',subject:'رياضيات',kind:'protractor',title:'منقلة تعليمية',explanation:'نموذج لعرض زاوية منشأة؛ ليس أداة قياس معايرة للأشكال الخارجية. استخدم أزرار آخر منقلة.',text:''},
{id:'ruler',subject:'رياضيات',kind:'ruler',title:'مسطرة قابلة للتحريك والدوران',explanation:'حدد المجموعة لتحريكها أو تدويرها من مقبض الدوران. التدريج وحدات نسبية وليس سنتيمترات فعلية. مثال أصلي تجريبي.',text:''},
 {id:'number-line',subject:'رياضيات',title:'خط الأعداد ٠–١٠',explanation:'ضع الأعداد على الخط. اشرح الجمع بالحركة يمينًا والطرح بالحركة يسارًا.',text:'٠    ١    ٢    ٣    ٤    ٥    ٦    ٧    ٨    ٩    ١٠\n←────────────────────────────→'},
 {id:'fraction',subject:'رياضيات',title:'الجزء والكل',explanation:'قسّم مستطيلًا إلى أربعة أجزاء متساوية ولون جزءًا. ناقش: ١/٤ + ١/٤ = ١/٢.',text:'الكسور: أجزاء متساوية من كل واحد\n١/٤ + ١/٤ = ٢/٤ = ١/٢'},
 {id:'water',subject:'علوم',title:'دورة الماء',explanation:'يتبخر الماء ثم يتكاثف بخاره في السحب ويهطل مطرًا. أضف الأسهم والعناصر بالرسم.',text:'الشمس → تبخر الماء → تكاثف في السحب → هطول → تجمع الماء'},
 {id:'sentence',subject:'العربية',title:'الجملة الاسمية والفعلية',explanation:'اقرأ المثالين وحدد الكلمة الأولى. أضف أمثلة جديدة مع الطالب.',text:'جملة اسمية: الطَّالِبُ مُجْتَهِدٌ.\nجملة فعلية: يَقْرَأُ الطَّالِبُ كِتَابًا.'},
 {id:'english',subject:'الإنجليزية',title:'وصف الأشياء',explanation:'سمِّ شيئًا ثم صف لونه وحجمه. اكتب جملة قصيرة جديدة.',text:'This is a red ball.\nThe book is small.\nI can see a green tree.'},
 {id:'islamic',subject:'الدراسات الإسلامية',title:'آداب الحوار',explanation:'ناقش الإنصات للمتحدث، والكلمة الطيبة، واحترام الآخرين. يذكر الطالب مثالًا من حياته دون بيانات شخصية.',text:'آداب الحوار\nالإنصات • الكلام الطيب • احترام الآخرين'}
];
// Original starter teaching material created for this project. No third-party media.

const subjectKeys={'digestion-journey':'science','library-number-line':'math','library-cell':'science',protractor:'math',ruler:'math','number-line':'math',fraction:'math',water:'science',sentence:'arabic',english:'english',islamic:'islamic'};
export const aids=catalog.map(a=>({...a,subjectKey:subjectKeys[a.id]}));
export function aidsForSubject(key){return aids.filter(a=>a.subjectKey===key);}

