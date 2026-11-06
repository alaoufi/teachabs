// Stage 042: term-1 curriculum order, the cells and place-value activities and their lesson templates.
import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTIVITIES, cleanValues, tweenValues, bigOf, textOf, quickParams} from '../public/activities.js';
import {renderCells, cellsFacts, PARTS} from '../public/cells-model.js';
import {renderPlaceValue, placeValueFacts, digitAt, placeValue, expandedForm, clampNumber} from '../public/placevalue-model.js';
import {LESSON_TEMPLATES, validatePlan, ORIGINAL_PAGES} from '../public/group-plan.js';
import {CURRICULUM_G4_T1, curriculumLessons} from '../public/curriculum-g4.js';
import {TEXT_LESSONS} from '../public/explain-texts.js';
import * as texts from '../public/explain-texts.js';

test('curriculum: term-1 order for science and math, unique ids, templates exist', () => {
  const all = curriculumLessons();
  assert.equal(new Set(all.map(l => l.id)).size, all.length);
  assert.equal(all.filter(l => l.subject === 'science').length, 12);
  assert.equal(all.filter(l => l.subject === 'math').length, 39);
  assert.equal(all[0].title, 'الخلايا'); assert.equal(all[0].template, 'cells');
  assert.equal(CURRICULUM_G4_T1.math.units[0].chapters[0].lessons[0].template, 'placevalue');
  for (const l of all.filter(x => x.template)) assert.ok(LESSON_TEMPLATES[l.template], l.template);
});

test('cells: zoom levels, plant vs animal parts, hidden names and no inline styles', () => {
  const a = ACTIVITIES.cells;
  assert.deepEqual(cleanValues('cells', {zoom: 9, kind: 'animal', part: 'nucleus'}), {zoom: 4, kind: 'animal', part: 'nucleus'});
  assert.throws(() => cleanValues('cells', {kind: 'fungus'}));
  const plant = renderCells({zoom: 4, kind: 'plant', part: 'none'});
  for (const id of ['wall', 'membrane', 'nucleus', 'cytoplasm', 'chloroplast', 'mitochondria', 'vacuole']) assert.match(plant, new RegExp(`data-part="${id}"`));
  const animal = renderCells({zoom: 4, kind: 'animal', part: 'none'});
  assert.doesNotMatch(animal, /data-part="wall"/); assert.doesNotMatch(animal, /data-part="chloroplast"/);
  assert.match(renderCells({zoom: 4, kind: 'animal', part: 'wall'}), /لا يوجد في الخلية الحيوانية/);
  const hidden = renderCells({zoom: 4, kind: 'plant', part: 'none'}, {hidden: true});
  assert.doesNotMatch(hidden, /البلاستيدات الخضراء</); assert.match(hidden, /توقّع/);
  for (const svg of [plant, animal, hidden, renderCells({zoom: 2.5, kind: 'plant', part: 'none'})]) assert.doesNotMatch(svg, /style=/);
  assert.match(cellsFacts({zoom: 4, kind: 'animal', part: 'chloroplast'}), /لا يوجد في الخلية الحيوانية/);
  assert.match(cellsFacts({zoom: 2, kind: 'plant', part: 'none'}), /نسيج ← عضو/);
  assert.equal(Object.keys(PARTS).length, 8);
  assert.equal(tweenValues('cells', {zoom: 1, kind: 'plant', part: 'none'}, {zoom: 3, kind: 'animal', part: 'none'}, 0.5).zoom, 2);
  assert.equal(a.narrator().length, 9);
});

test('place value: digits, values, expanded form, hidden value, place-dependent step', () => {
  assert.equal(digitAt(345678, 'tenThousands'), 4); assert.equal(placeValue(345678, 'tenThousands'), 40000);
  assert.equal(placeValue(305070, 'tens'), 70); assert.equal(digitAt(7, 'hundredThousands'), 0);
  assert.equal(expandedForm(305070), '٣٠٠٠٠٠ + ٥٠٠٠ + ٧٠'); assert.equal(expandedForm(0), '٠');
  assert.equal(clampNumber(-3), 0); assert.equal(clampNumber(1e7), 999999);
  const svg = renderPlaceValue({number: 345678, place: 'tenThousands'});
  assert.match(svg, /٤٠٬٠٠٠/); assert.match(svg, /٣٤٥٬٦٧٨/); assert.doesNotMatch(svg, /style=/);
  const hidden = renderPlaceValue({number: 345678, place: 'tenThousands'}, {hidden: true});
  assert.doesNotMatch(hidden, /٤٠٬٠٠٠/); assert.match(hidden, /= ؟/);
  assert.match(placeValueFacts({number: 345678, place: 'hundreds'}), /٦٠٠/);
  const p = ACTIVITIES.placevalue.params[0], v = {number: 345678, place: 'thousands'};
  assert.equal(bigOf(p, v), 1000); assert.equal(textOf(p.later, v), '+ ١٬٠٠٠');
  assert.deepEqual(quickParams(ACTIVITIES.placevalue).map(x => x.key), ['number', 'place']);
  assert.deepEqual(quickParams(ACTIVITIES.matter).map(x => x.key), ['temp']);
  assert.equal(tweenValues('placevalue', {number: 1, place: 'ones'}, {number: 1001, place: 'thousands'}, 0.5).number, 1, 'numbers switch at the end, not count through every value');
  assert.equal(tweenValues('placevalue', {number: 1, place: 'ones'}, {number: 1001, place: 'thousands'}, 1).number, 1001);
  assert.deepEqual(cleanValues('placevalue', {number: 1234567.4}), {number: 999999, place: 'tenThousands'});
});

test('cells and place-value templates: six ordered steps, original pages, valid narrator and texts', () => {
  for (const [id, page, subject] of [['cells', 'science-4-cells', 'science'], ['placevalue', 'math-4-placevalue', 'math']]) {
    const plan = validatePlan(LESSON_TEMPLATES[id].plan());
    assert.deepEqual(plan.steps.map(s => s.type), ['page', 'interactive', 'board', 'questions', 'homework', 'evaluation']);
    assert.equal(plan.subject, subject); assert.equal(plan.steps[0].page, page); assert.ok(ORIGINAL_PAGES[page]);
    assert.ok(plan.steps[1].narrator.segments.length >= 7);
    for (const q of plan.steps[3].questions.filter(q => q.kind === 'choice')) assert.ok(q.answer >= 0 && q.answer < q.options.length);
    const list = Object.values(texts).find(Array.isArray);
    assert.ok(list.filter(t => t.lesson === page).length >= 10, page); assert.ok(TEXT_LESSONS[page]);
  }
});
