// Lesson list: import a lesson saved as a file (for example after the trial server was reset).
const $ = id => document.getElementById(id);
const status = (text, bad = false) => { const s = $('plans-status'); s.hidden = false; s.textContent = text; s.classList.toggle('is-error', bad); };
$('plans-import-btn').addEventListener('click', () => $('plans-import').click());
$('plans-import').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text()), plan = data?.format === 'teachabs-lesson' ? data.plan : data;
    const r = await fetch('/teach/plans/import', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(plan)});
    const out = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(out.error || 'تعذّر الاستيراد.');
    location.href = '/teach/plans/' + out.id;
  } catch (err) { status(err instanceof SyntaxError ? 'الملف ليس درسًا صالحًا.' : err.message, true); }
  e.target.value = '';
});
