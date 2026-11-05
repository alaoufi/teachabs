import {sectionIcon} from './section-icons.mjs';
export function demoHub(user,selected='') {
  const card=(id,title,description,action)=>`<article class="panel role-card" id="${id}">${sectionIcon(id)}<h2>${title}</h2><p>${description}</p>${action}</article>`;
  const start=role=>`<form method="post" action="/demo/start"><input type="hidden" name="role" value="${role}"><button class="btn">فتح تجربة ${role==='teacher'?'المعلم':'ولي الأمر'}</button></form>`;
  const real=user && !user.scope;
  const available=role=>real?'<p>أنت داخل حساب فعلي. سجّل الخروج بنفسك قبل بدء الجولة.</p><a class="outline" href="/app">العودة إلى حسابي</a>':start(role);
  const cards={
    parent:card('parent','ولي الأمر','جولة ببيانات افتراضية: الأطفال والمواد والمواعيد والحجوزات. لا تدخل بيانات شخصية في التجربة.',available('parent')),
    teacher:card('teacher','المعلم','لوحة المعلم التجريبية ومواعيده. الدخول الفعلي يبقى بحساب معلم مفعّل.',available('teacher')+'<p><a class="textlink" href="/lesson/teacher">مقعد المعلم والسبورة في حصة تجريبية</a></p>'),
    student:card('student','الطالب والحصة','لا يوجد حساب طالب مستقل بعد. الحصة الفعلية من حجز ولي الأمر، ويمكن تجربة مقعد الطالب ببيانات افتراضية.','<a class="btn" href="/lesson">فتح مدخل الحصة</a>'),
    board:card('board','السبورة الذكية','سبورة مشتركة ونشاط الآحاد والعشرات داخل الحصة. يحتاج اختبار الطرفين نافذتين في المتصفح؛ الهاتف يعرض مقعدًا واحدًا في كل مرة.','<a class="btn" href="/lesson/teacher">فتح تجربة السبورة</a>'),
    admin:card('admin','الإدارة','غير متاحة في هذا الإصدار. إصدار دعوة المعلم متاح للمشغّل من أداة الكمبيوتر فقط.','<span class="eyebrow">ليست شاشة إدارة مكتملة</span>')
  };
  return `<section class="demo-hub"><div class="section-head welcome-panel"><div class="eyebrow">أهلًا بك في مساحتك التعليمية</div><h1>احتراف التدريس</h1><p>اختر قسمًا للتجربة من المتصفح. استخدم بيانات وهمية فقط؛ الحفظ على الاستضافة المجانية مؤقت. الإدارة وحساب الطالب المستقل غير متاحين بعد.</p></div><div class="cards role-grid">${Object.hasOwn(cards,selected)?cards[selected]:Object.values(cards).join('')}</div><p><a class="outline" href="/demo">جميع التجارب</a> <a class="textlink" href="/login">الدخول بحساب فعلي</a></p></section>`;
}
