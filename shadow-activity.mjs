// Teacher-led, synchronized light-and-shadow activity for the live classroom.
// The teacher always leads: only the teacher hands control over, reveals results or sets a challenge.
// State lives with the room in memory (like the preview place-value activity); nothing is written to the database.
import {CHALLENGES, normalizeHour, normalizeHeight, normalizeMaterial, lessonState, judgeChallenge} from './public/science-shadow-model.js';
import {UserError} from './store.mjs';

const need = (ok, message, status = 400) => { if (!ok) throw new UserError(message, status); };

export const shadowAllowed = context => Boolean(context?.preview || context?.subject === 'science');

export function initialShadow() {
  return {hour: 8, height: 1.5, material: 'wood', control: 'teacher', reveal: true, challenge: null, step: 0};
}

export function changeShadow(current, seat, command) {
  const state = current || initialShadow();
  need(['teacher', 'student'].includes(seat), 'مقعد غير مصرح.', 403);
  need(command && typeof command.op === 'string', 'أمر غير صالح.');
  const next = {...state, step: state.step + 1};
  if (command.op === 'set') {
    need(seat === 'teacher' || state.control === 'student', 'المعلم يقود النشاط الآن. انتظر حتى يسلّمك التحكم.', 403);
    const keys = ['hour', 'height', 'material'].filter(k => Object.hasOwn(command, k));
    need(keys.length > 0, 'لا توجد قيمة للتحديث.');
    if (keys.includes('hour')) { need(Number.isFinite(Number(command.hour)), 'وقت غير صالح.'); next.hour = normalizeHour(command.hour); }
    if (keys.includes('height')) { need(Number.isFinite(Number(command.height)), 'طول غير صالح.'); next.height = normalizeHeight(command.height); }
    if (keys.includes('material')) { need(normalizeMaterial(command.material) === command.material, 'مادة غير معروفة.'); next.material = command.material; }
    return next;
  }
  need(seat === 'teacher', 'هذا الإجراء للمعلم فقط.', 403);
  if (command.op === 'control') { need(['teacher', 'student'].includes(command.to), 'جهة تحكم غير صالحة.'); next.control = command.to; return next; }
  if (command.op === 'reveal') { need(typeof command.show === 'boolean', 'قيمة غير صالحة.'); next.reveal = command.show; return next; }
  if (command.op === 'challenge') {
    need(command.id === null || CHALLENGES.some(c => c.id === command.id), 'تحدٍّ غير معروف.');
    next.challenge = command.id; return next;
  }
  if (command.op === 'reset') return {...initialShadow(), step: next.step};
  throw new UserError('أمر غير معروف.');
}

/** What each seat may see: hidden results are removed for the student, not just hidden in the page. */
export function visibleShadow(state, seat) {
  const s = state || initialShadow(), full = lessonState(s);
  const view = {hour: s.hour, height: s.height, material: s.material, control: s.control, reveal: s.reveal, challenge: s.challenge, step: s.step};
  if (seat === 'teacher' || s.reveal) Object.assign(view, {elevation: full.elevation, length: full.length, shadow: full.shadow});
  if (s.challenge && (seat === 'teacher' || s.reveal)) view.result = judgeChallenge(s.challenge, full);
  return view;
}
