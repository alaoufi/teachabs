// «مكتبة الوسائل الدراسية»: the subject and grade filters apply at once.
for (const s of document.querySelectorAll('.aid-filters select')) s.addEventListener('change', () => s.form.submit());
