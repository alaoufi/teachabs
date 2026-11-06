import {UserError} from './store.mjs';
import {SCHOOL_STAGES,validSchoolLevel} from './school-catalog.mjs';

// Navigation only. It reads an already-authorized school snapshot and never
// creates a grade, changes enrollment, or makes a new path compatible.
export function schoolSelection(s,query={}){
 const reject=(message,status=400)=>{throw new UserError(message,status);};
 for(const key of ['trackId','stage'])if(query[key]!==undefined&&typeof query[key]!=='string')reject('راجع اختيار المسار والمرحلة.');
 const trackId=query.trackId||s.tracks[0]?.id||'';
 if(trackId&&!s.tracks.some(t=>t.id===trackId))reject('المسار غير متاح.',404);
 const stage=query.stage||s.grades.find(g=>g.track_id===trackId)?.stage||'primary';
 if(!Object.hasOwn(SCHOOL_STAGES,stage))reject('اختر مرحلة من المراحل الثلاث الثابتة.');
 const grade=query.grade===undefined||query.grade===''?s.grades.find(g=>g.track_id===trackId&&g.stage===stage)?.grade||1:Number(query.grade);
 if((query.grade!==undefined&&!['string','number'].includes(typeof query.grade))||!validSchoolLevel(stage,grade))reject('اختر صفًا ثابتًا ضمن المرحلة المختارة.');
 return {trackId,stage,grade};
}
