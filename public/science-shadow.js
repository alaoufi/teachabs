import {CHALLENGES, MATERIALS, HOUR_MIN, HOUR_MAX, SCENE, lessonState, renderScene, formatHour, formatNumber, compareText, DIRECTION_TEXT, judgeChallenge, judgeQuiz, hourFromSceneX} from './science-shadow-model.js';

const $ = id => document.getElementById(id);
const hour = $('sl-hour'), height = $('sl-height'), play = $('sl-play'), scene = $('sl-scene');
const done = new Set();
let state = lessonState({hour: hour.value, height: height.value, material: document.querySelector('[name=sl-material]:checked')?.value});
let frame = 0, last = 0, animated = null; // animated: unsnapped hour while playing

function material() { return document.querySelector('[name=sl-material]:checked')?.value; }
function challenge() { return document.querySelector('[name=sl-challenge]:checked')?.value; }

function update(fromUser = true) {
  state = lessonState({hour: animated ?? hour.value, exact: animated !== null, height: height.value, material: material()});
  hour.value = state.hour; height.value = state.height;
  scene.innerHTML = renderScene(state);
  $('sl-hour-out').textContent = formatHour(state.hour);
  hour.setAttribute('aria-valuetext', formatHour(state.hour));
  $('sl-height-out').textContent = formatNumber(state.height) + ' م';
  height.setAttribute('aria-valuetext', formatNumber(state.height) + ' متر');
  $('sl-elevation').textContent = formatNumber(state.elevation) + '°';
  $('sl-length').textContent = formatNumber(state.length) + ' م';
  $('sl-direction').textContent = DIRECTION_TEXT[state.shadow];
  $('sl-compare').textContent = compareText(state);
  $('sl-material-text').textContent = MATERIALS[state.material].explain;
  if (fromUser && animated === null) for (const c of CHALLENGES) if (c.check(state)) done.add(c.id); // autoplay alone does not complete challenges
  for (const input of document.querySelectorAll('[name=sl-challenge]')) input.closest('li').classList.toggle('is-done', done.has(input.value));
  $('sl-progress').textContent = `${formatNumber(done.size)} من ${formatNumber(CHALLENGES.length)}`;
  const current = challenge(), result = judgeChallenge(current, state);
  const feedback = $('sl-challenge-feedback');
  feedback.textContent = result.message;
  feedback.classList.toggle('is-success', result.done);
}

function stop() {
  cancelAnimationFrame(frame); frame = 0; animated = null;
  play.setAttribute('aria-pressed', 'false'); play.textContent = '▶ شغّل يومًا كاملًا';
}

function tick(time) {
  if (!last) last = time;
  animated = Math.min(HOUR_MAX, animated + (time - last) / 1000); // one model hour per second
  last = time; update();
  if (animated >= HOUR_MAX) { stop(); hour.value = HOUR_MAX; return update(false); }
  frame = requestAnimationFrame(tick);
}

play.addEventListener('click', () => {
  if (frame) return stop();
  if (Number(hour.value) >= HOUR_MAX) hour.value = HOUR_MIN;
  play.setAttribute('aria-pressed', 'true'); play.textContent = '⏸ إيقاف مؤقت';
  animated = Number(hour.value); last = 0; frame = requestAnimationFrame(tick);
});
$('sl-reset').addEventListener('click', () => { stop(); hour.value = 8; height.value = 1.5; document.querySelector('[name=sl-material][value=wood]').checked = true; update(); });
hour.addEventListener('input', () => { stop(); update(); });
height.addEventListener('input', update);
for (const input of document.querySelectorAll('[name=sl-material], [name=sl-challenge]')) input.addEventListener('change', update);

// Drag the sun (or tap the sky) to set the time of day; mouse, touch and pen use Pointer Events.
let dragging = false;
function fromPointer(event) {
  const svg = scene.querySelector('svg'), box = svg.getBoundingClientRect();
  const x = (event.clientX - box.left) / box.width * SCENE.width;
  hour.value = hourFromSceneX(x); update();
}
scene.addEventListener('pointerdown', event => {
  const box = scene.getBoundingClientRect();
  if ((event.clientY - box.top) / box.height * SCENE.height > SCENE.ground) return; // ground taps do nothing
  dragging = true; stop(); scene.setPointerCapture(event.pointerId); fromPointer(event); event.preventDefault();
});
scene.addEventListener('pointermove', event => { if (dragging) fromPointer(event); });
for (const type of ['pointerup', 'pointercancel']) scene.addEventListener(type, () => { dragging = false; });

for (const fieldset of document.querySelectorAll('.sl-question')) {
  fieldset.addEventListener('change', event => {
    const result = judgeQuiz(fieldset.dataset.question, event.target.value), feedback = fieldset.querySelector('.sl-feedback');
    feedback.textContent = (result.correct ? 'إجابة صحيحة. ' : 'ليست الإجابة الأدق. ') + result.why;
    feedback.classList.toggle('is-success', result.correct);
    feedback.classList.toggle('is-retry', !result.correct);
  });
}

document.documentElement.classList.add('sl-ready');
update(false);
