// Live classroom client for the teacher-led light-and-shadow activity.
// The server decides who may change what; this file renders the shared state and sends intent.
import {CHALLENGES, MATERIALS, SCENE, lessonState, renderScene, formatHour, formatNumber, DIRECTION_TEXT, hourFromSceneX} from './science-shadow-model.js';

export function attachShadowActivity(seat, signals, send) {
  const panel = document.getElementById('shadow-activity');
  if (!panel) return () => {};
  const $ = id => document.getElementById(id), teacher = seat === 'teacher';
  const scene = $('sa-scene'), hour = $('sa-hour'), height = $('sa-height'), error = $('sa-error');
  let state = null, connected = false, local = null, pending = null, timer = 0, lastLocal = 0, dragging = false, sliding = false, settle = 0;

  const canDrive = () => connected && state && (teacher || state.control === 'student');
  const showError = message => { error.textContent = message || ''; error.hidden = !message; };

  // Latest-value-wins sending while dragging: at most one request in flight, then the newest pending value.
  let inFlight = false;
  async function flush() {
    if (inFlight || !pending) return;
    const payload = pending; pending = null; inFlight = true;
    try { accept(await send('shadow', payload)); showError(''); } catch (e) { showError(e.message); local = null; render(); }
    finally { inFlight = false; if (pending) flush(); }
  }
  function drive(values) {
    if (!canDrive()) return;
    local = {...(local || {}), ...values}; lastLocal = Date.now();
    pending = {op: 'set', ...(pending || {}), ...values};
    render();
    clearTimeout(timer); timer = setTimeout(flush, 90);
    clearTimeout(settle); settle = setTimeout(() => { if (!pending && !inFlight && !dragging && !sliding) { local = null; render(); } }, 700);
  }
  async function command(payload) {
    if (!teacher || !connected) return;
    try { accept(await send('shadow', payload)); showError(''); } catch (e) { showError(e.message); }
  }

  function accept(next) {
    if (!next || (state && next.step < state.step)) return;
    state = next;
    // Keep the driver's own hand steady: ignore echoes of older values for a moment after local input.
    if (local && Date.now() - lastLocal > 600 && !pending && !inFlight) local = null;
    render();
  }

  function render() {
    for (const el of panel.querySelectorAll('button, input, select')) el.disabled = !connected || !state;
    if (!state) return;
    const view = {...state, ...(local || {})};
    const full = lessonState(view), hide = !teacher && !state.reveal;
    scene.innerHTML = renderScene(full, {hideShadow: hide});
    const drivable = canDrive();
    for (const el of [hour, height, $('sa-earlier'), $('sa-later'), ...panel.querySelectorAll('[name=sa-material]')]) el.disabled = !drivable;
    panel.classList.toggle('is-driving', drivable);
    if (!sliding || !drivable) { hour.value = full.hour; height.value = full.height; }
    $('sa-hour-out').textContent = formatHour(full.hour); hour.setAttribute('aria-valuetext', formatHour(full.hour));
    $('sa-height-out').textContent = formatNumber(full.height) + ' م'; height.setAttribute('aria-valuetext', formatNumber(full.height) + ' متر');
    for (const input of panel.querySelectorAll('[name=sa-material]')) input.checked = input.value === full.material;
    $('sa-elevation').textContent = hide ? 'مخفي' : formatNumber(full.elevation) + '°';
    $('sa-length').textContent = hide ? 'توقّع أولًا' : formatNumber(full.length) + ' م';
    $('sa-direction').textContent = hide ? '؟' : DIRECTION_TEXT[full.shadow];
    $('sa-role').textContent = state.control === 'teacher'
      ? (teacher ? 'أنت تقود النشاط. اشرح بصوتك وحرّك الشمس.' : 'المعلم يقود النشاط الآن. استمع وتابع.')
      : (teacher ? 'الطالب يتحكم الآن. تابعه وناقشه بصوتك، ويمكنك التدخل في أي وقت.' : 'دورك الآن: حرّك الشمس واشرح لمعلمك ما تلاحظه.');
    $('sa-scene-note').textContent = teacher
      ? (state.reveal ? 'يرى الطالب ما تراه هنا مباشرة.' : 'الظل مخفي عن الطالب الآن حتى يتوقع. أنت ما زلت تراه.')
      : (state.reveal ? 'يتحرك المشهد مع الشرح.' : 'المعلم أخفى الظل: توقّع أين سيكون، ثم انتظر الكشف.');
    const box = $('sa-challenge-box'), challenge = CHALLENGES.find(c => c.id === state.challenge);
    box.hidden = !challenge;
    if (challenge) {
      const result = state.result;
      box.textContent = `التحدي: ${challenge.title} ` + (result ? result.message : 'سيظهر الحكم بعد أن يكشف المعلم الظل.');
      box.classList.toggle('is-success', Boolean(result?.done));
    }
    if (teacher) {
      const handover = $('sa-handover'), reveal = $('sa-reveal');
      handover.textContent = state.control === 'teacher' ? 'سلّم التحكم للطالب' : 'استعد التحكم';
      reveal.textContent = state.reveal ? 'إخفاء الظل للتوقع' : 'اكشف الظل';
      reveal.setAttribute('aria-pressed', String(!state.reveal));
      $('sa-challenge').value = state.challenge || '';
    }
  }

  hour.addEventListener('input', () => { sliding = true; drive({hour: Number(hour.value)}); });
  hour.addEventListener('change', () => { sliding = false; });
  height.addEventListener('input', () => drive({height: Number(height.value)}));
  $('sa-earlier').addEventListener('click', () => drive({hour: Math.max(7, Number(hour.value) - 1)}));
  $('sa-later').addEventListener('click', () => drive({hour: Math.min(17, Number(hour.value) + 1)}));
  for (const input of panel.querySelectorAll('[name=sa-material]')) input.addEventListener('change', () => { if (Object.hasOwn(MATERIALS, input.value)) drive({material: input.value}); });
  if (teacher) {
    $('sa-handover').addEventListener('click', () => command({op: 'control', to: state?.control === 'teacher' ? 'student' : 'teacher'}));
    $('sa-reveal').addEventListener('click', () => command({op: 'reveal', show: !state?.reveal}));
    $('sa-challenge').addEventListener('change', e => command({op: 'challenge', id: e.target.value || null}));
    $('sa-reset').addEventListener('click', () => command({op: 'reset'}));
  }

  // Drag the sun in the sky (mouse, touch or pen) when this seat is driving.
  function fromPointer(event) {
    const box = scene.getBoundingClientRect();
    drive({hour: hourFromSceneX((event.clientX - box.left) / box.width * SCENE.width)});
  }
  scene.addEventListener('pointerdown', event => {
    if (!canDrive()) return;
    const box = scene.getBoundingClientRect();
    if ((event.clientY - box.top) / box.height * SCENE.height > SCENE.ground) return;
    dragging = true; scene.setPointerCapture(event.pointerId); fromPointer(event); event.preventDefault();
  });
  scene.addEventListener('pointermove', event => { if (dragging && canDrive()) fromPointer(event); });
  for (const type of ['pointerup', 'pointercancel']) scene.addEventListener(type, () => { dragging = false; });

  signals.addEventListener('open', () => { state = null; render(); });
  signals.addEventListener('shadow', ev => accept(JSON.parse(ev.data)));
  render();
  return value => { connected = value; if (!value) { pending = null; local = null; } render(); };
}
