// Every ready lesson prep, gathered: grade 4 (lesson-preps-g4.js, ids from curriculum-g4.js) and the other elementary
// grades (one file per grade, ids from curriculum-primary.js, e.g. p1m26). Same format in every file; original wording.
import {LESSON_PREPS, LESSON_AIDS, arDigits} from './lesson-preps-g4.js';
import {LESSON_PREPS_G1} from './lesson-preps-g1.js';
import {LESSON_PREPS_G2} from './lesson-preps-g2.js';
import {LESSON_PREPS_G3} from './lesson-preps-g3.js';
import {LESSON_PREPS_G5} from './lesson-preps-g5.js';

export {arDigits};
/** Ready preps of the lessons outside grade 4, by lesson id. */
export const READY_PREPS = {...LESSON_PREPS_G1, ...LESSON_PREPS_G2, ...LESSON_PREPS_G3, ...LESSON_PREPS_G5};
/** Every prep, grade 4 included. */
export const ALL_PREPS = {...LESSON_PREPS, ...READY_PREPS};
/** The aids of every lesson that has a prep, in the prep's order. */
export const ALL_AIDS = {...LESSON_AIDS, ...Object.fromEntries(Object.entries(READY_PREPS).map(([id, p]) => [id, p.aids]))};
