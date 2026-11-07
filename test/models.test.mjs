// Stage 059: professional interactive models in the library — body systems and 3D solids with their nets.
import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTIVITIES, cleanValues, tweenValues} from '../public/activities.js';
import {unfold, SOLIDS} from '../public/solids-model.js';
import {LIBRARY, toolsFor} from '../public/tool-library.js';
import {validatePlan, defaultPlan} from '../public/group-plan.js';

const ids = ['digestive', 'urinary', 'nervous', 'solids'];

test('each model renders every state, hides names on request and has a valid narrated tour', () => {
  for (const id of ids) {
    const a = ACTIVITIES[id], v = a.initial();
    for (const p of a.params) {
      const values = p.kind === 'range' ? [p.min, (p.min + p.max) / 2, p.max] : Object.keys(p.options);
      for (const x of values) {
        const svg = a.render({...v, [p.key]: x}, {hidden: false});
        assert.match(svg, /^<svg[^>]+viewBox="0 0 600 300"/); assert.doesNotMatch(svg, /NaN|undefined/, `${id} ${p.key}=${x}`);
        assert.ok(a.facts({...v, [p.key]: x}, false).length > 5);
      }
    }
    for (const seg of a.narrator()) assert.deepEqual(cleanValues(id, seg.values), {...v, ...seg.values});
    const hidden = a.render({...v, part: Object.keys(a.params.find(p => p.key === 'part')?.options || {none: 1}).at(-1)}, {hidden: true});
    if (id !== 'solids') assert.match(hidden, /١ ؟/);
  }
  // the chosen organ pulses and the others fade
  const svg = ACTIVITIES.digestive.render({stage: 3, part: 'stomach'}, {hidden: false});
  assert.match(svg, /c-part c-hl" data-part="stomach"/); assert.match(svg, /c-part c-dim" data-part="liver"/);
  // the food moves smoothly between stages
  const mid = tweenValues('digestive', {stage: 1, part: 'none'}, {stage: 2, part: 'none'}, 0.5);
  assert.equal(mid.stage, 1.5); assert.doesNotMatch(ACTIVITIES.digestive.render(mid, {}), /NaN/);
});

test('solids unfold into flat nets that keep every face the same size', () => {
  const area = ps => { let s = [0, 0, 0]; for (let i = 0; i < ps.length; i++) { const a = ps[i], b = ps[(i + 1) % ps.length]; s = [s[0] + a[1] * b[2] - a[2] * b[1], s[1] + a[2] * b[0] - a[0] * b[2], s[2] + a[0] * b[1] - a[1] * b[0]]; } return Math.hypot(...s) / 2; };
  for (const id of Object.keys(SOLIDS)) {
    const solid = unfold(id, 0), net = unfold(id, 1);
    assert.equal(solid.length, net.length);
    for (const f of net) for (const p of f.points) assert.ok(Math.abs(p[1]) < 1e-6, `${id}: the net lies flat on the table`);
    solid.forEach((f, i) => assert.ok(Math.abs(area(f.points) - area(net[i].points)) < 1e-6, `${id}: faces keep their size`));
  }
  assert.deepEqual([SOLIDS.cube.faces, SOLIDS.cube.edges, SOLIDS.cube.vertices], [6, 12, 8]);
  assert.equal(SOLIDS.pyramid.faces - SOLIDS.pyramid.edges + SOLIDS.pyramid.vertices, 2); // Euler
});

test('the models are in the library, filtered by subject, grade and lesson, and can be pinned into a lesson', () => {
  for (const id of ids) assert.equal(LIBRARY.find(t => t.id === id)?.kind, 'activity');
  assert.ok(toolsFor({subject: 'science', grade: 4, lesson: 's3-5-2'}).forLesson.some(t => t.id === 'digestive'));
  assert.ok(!toolsFor({subject: 'math', grade: 4}).forLesson.concat(toolsFor({subject: 'math', grade: 4}).others).some(t => t.id === 'digestive'));
  assert.ok(toolsFor({subject: 'math', grade: 5}).others.some(t => t.id === 'solids'));
  const plan = defaultPlan(); plan.steps[1].activity = 'nervous'; delete plan.steps[1].narrator; plan.tools = ['nervous', 'urinary'];
  const clean = validatePlan(plan);
  assert.equal(clean.steps[1].activity, 'nervous'); assert.equal(clean.steps[1].narrator.segments.length, 7); assert.deepEqual(clean.tools, ['nervous', 'urinary']);
});
