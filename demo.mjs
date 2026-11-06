import {sectionIcon} from './section-icons.mjs';
export function demoHub(user,selected='') {
  const card=(id,title,description,action,icon=id)=>`<article class="panel role-card" id="${id}">${sectionIcon(icon)}<h2>${title}</h2><p>${description}</p>${action}</article>`;
  const start=role=>`<form method="post" action="/demo/start"><input type="hidden" name="role" value="${role}"><button class="btn">فتح تجربة ${role==='admin'?'الإدارة':role==='teacher'?'المعلم':'ولي الأمر'}</button></form>`;
  const real=user && !user.scope;
  const available=role=>real?'<p>أنت داخل حساب فعلي. سجّل الخروج بنفسك قبل بدء الجولة.</p><a class="outline" href="/app">العودة إلى حسابي</a>':start(role);
  const cards={
    lab:card('lab','مختبر الفصل التعليمي','جرّب سبورة مستقلة وسجّل الطريقة والدروس المستفادة، واطّلع على مراجع LearnCube وBigBlueButton.','<a class="btn" href="/classroom-lab">فتح مختبر الفصل</a>','board'),
    science:card('lessons','الدروس التفاعلية','أول درس: الضوء والظل لعلوم الصف الرابع. حرّك الشمس وغيّر القيم وشاهد الظل يتغير فورًا، مع تحديات وأسئلة تصحَّح مباشرة. محتوى أصلي، لا يحفظ بيانات.','<a class="btn" href="/lessons">صفحة الدروس</a> <a class="textlink" href="/interactive-lessons/science-4-shadows">فتح الدرس مباشرة</a>','student'),
    group:card('group','الحصة الجماعية','يرتب المعلم درسه قبل الحصة: المنهج، ثم الشرح التفاعلي، ثم السبورة المجهزة، ثم الأسئلة، ثم الواجب والتقييم. يدخل الطلاب برمز الحصة من أجهزتهم.',available('teacher')+'<p><a class="textlink" href="/teach/plans">دروسي للحصة الجماعية</a> · <a class="textlink" href="/join">دخول طالب برمز الحصة</a> · <a class="textlink" href="/guide">دليل الاستخدام</a></p>','board'),
    parent:card('parent','ولي الأمر','جولة ببيانات افتراضية: الأطفال والمواد والمواعيد والحجوزات. لا تدخل بيانات شخصية في التجربة.',available('parent')),
    teacher:card('teacher','المعلم','لوحة المعلم التجريبية ومواعيده. الدخول الفعلي يبقى بحساب معلم مفعّل.',available('teacher')+'<p><a class="textlink" href="/lesson/teacher">مقعد المعلم والسبورة في حصة تجريبية</a></p>'),
    student:card('student','الطالب والحصة','لا يوجد حساب طالب مستقل بعد. الحصة الفعلية من حجز ولي الأمر، ويمكن تجربة مقعد الطالب ببيانات افتراضية.','<a class="btn" href="/lesson">فتح مدخل الحصة</a>'),
    board:card('board','السبورة الذكية','سبورة مشتركة ونشاط الآحاد والعشرات داخل الحصة. يحتاج اختبار الطرفين نافذتين في المتصفح؛ الهاتف يعرض مقعدًا واحدًا في كل مرة.','<a class="btn" href="/lesson/teacher">فتح تجربة السبورة</a>'),
    admin:card('admin','الإدارة','مركز واحد للإشراف العام والمحاسبة والتسجيل والشؤون التعليمية والوكيل الإداري والقسم الفني. يحدد المشرف العام صلاحيات الأعضاء داخل الجولة.',available('admin'))
  };
  return `<section class="demo-hub"><div class="section-head welcome-panel"><div class="eyebrow">أهلًا بك في مساحتك التعليمية</div><h1>احتراف التدريس</h1><p>اختر قسمًا للتجربة من المتصفح. استخدم بيانات وهمية فقط؛ الحفظ على الاستضافة المجانية مؤقت. تتفرع الأقسام الإدارية داخل تجربة الإدارة، ويظل حساب الطالب المستقل غير متاح بعد.</p></div><div class="cards role-grid">${Object.hasOwn(cards,selected)?cards[selected]:Object.values(cards).join('')}</div><p><a class="outline" href="/demo">جميع التجارب</a> <a class="textlink" href="/login">الدخول بحساب فعلي</a></p></section>`;
}
