import {stepFeature} from './public/classroom-features.js';

export function stepEnabled(features, step) { return !!step && (features.board !== false || ['homework','evaluation'].includes(step.type)) && features[stepFeature(step.type)] !== false; }

// A projection only: switching a feature off never rewrites lessons, ink or answers.
export function classroomState(state, plan, features) {
  const s = structuredClone(state);
  if (!stepEnabled(features, plan.steps[s.index])) s.shown = false;
  s.voice = {...s.voice};
  if (!features.teacherMic) s.voice.teacher = false;
  if (!features.studentMic) s.voice.mics = false;
  if (!features.camera) s.voice.camera = false;
  if (!features.narration) { s.narrate = null; s.narrator = {...s.narrator, visible:false, muted:true, segment:-1}; }
  if (!features.homework) s.homework = 'none';
  if (!features.evaluation) s.evaluationPublished = false;
  if (!features.hands) s.hands = {};
  if (!features.stars) { s.stars = {}; s.lastStar = null; }
  if (!features.pick) { s.pick = null; s.picked = []; }
  if (!features.attention) s.attention = false;
  if (!features.workMode) s.workMode = null;
  if (!features.timer) s.timer = null;
  if (!features.curtain) s.curtain = {};
  if (!features.zoom) s.camera = {};
  if (!features.drawing || !features.board) s.drawGrants = {};
  s.strokes = Object.fromEntries(Object.entries(s.strokes || {}).map(([id,ink])=>[id,ink.filter(i=>i.kind==='stamp'?features.tools:features.drawing)]));
  return s;
}

export function checkClassroomCommand(features, state, plan, command, need) {
  const check = key => need(features[key] !== false, 'أوقفت الإدارة هذا المكوّن.', 403);
  const map = {'draw-permission':'drawing',stroke:'drawing',text:'drawing',move:'drawing',erase:'drawing','undo-stroke':'drawing','clear-strokes':'drawing',place:'notes',reveal:'notes',camera:'zoom',activity:'interactive',shadow:'interactive',explore:'interactive',narrator:'narration',narrate:'narration',speaker:'narration',homework:'homework','publish-evaluation':'evaluation',pick:'pick','pick-reset':'pick',attention:'attention','work-mode':'workMode',timer:'timer',curtain:'curtain',stamp:'tools','hand-down':'hands',star:'stars',open:'questions',display:'questions'};
  if (Object.hasOwn(map,command?.op)) check(map[command.op]);
  if (['stroke','text','move','erase','undo-stroke','clear-strokes','place','reveal','camera','activity','shadow','explore','stamp','open','display','narrator','narrate'].includes(command?.op)) need(stepEnabled(features,plan.steps[state.index]),'أخفت الإدارة هذه الفقرة.',403);
  if (command?.op === 'voice') {
    for (const [field,key] of [['teacher','teacherMic'],['mics','studentMic'],['camera','camera']]) if(command[field] === true) check(key);
  }
  if (command?.op === 'show' && command.shown) need(stepEnabled(features,command.step ? plan.steps.find(s=>s.id===command.step) : plan.steps[state.index]),'أخفت الإدارة هذه الفقرة.',403);
  if (command?.op === 'go') {
    if (Math.abs(command.by) === 1 && command.index === undefined) {
      let index = state.index + command.by;
      while (index >= 0 && index < plan.steps.length && !stepEnabled(features,plan.steps[index])) index += command.by;
      if(index < 0 || index >= plan.steps.length) return {...command,index:state.index,by:undefined};
      return {...command,index,by:undefined};
    }
    need(stepEnabled(features,plan.steps[command.index]),'أخفت الإدارة هذه الفقرة.',403);
  }
  return command;
}
