import {UserError} from './store.mjs';
import {SCHOOL_STAGES,validSchoolLevel} from './school-catalog.mjs';

// Navigation only. It reads an already-authorized school snapshot and never
// creates a grade, changes enrollment, or makes a new path compatible.
export function schoolSelection(s,query={}){
 const reject=(message,status=400)=>{throw new UserError(message,status);};
 for(const key of ['trackId','stage','classId'])if(query[key]!==undefined&&typeof query[key]!=='string')reject('راجع اختيار المسار والمرحلة والفصل.');
 const trackId=query.trackId||'',stage=query.stage||'',classId=query.classId||'';
 const hasGrade=query.grade!==undefined&&query.grade!==null&&query.grade!=='';
 if(((stage||hasGrade||classId)&&!trackId)||((hasGrade||classId)&&!stage)||(classId&&!hasGrade))reject('اختر المسار ثم المرحلة ثم الصف ثم الفصل بالترتيب.');
 if(trackId&&!s.tracks.some(t=>t.id===trackId))reject('المسار غير متاح.',404);
 if(stage&&!Object.hasOwn(SCHOOL_STAGES,stage))reject('اختر مرحلة من المراحل الثلاث الثابتة.');
 let grade=null;
 if(hasGrade){
  if(typeof query.grade==='string'?!/^[1-6]$/.test(query.grade):typeof query.grade!=='number')reject('اختر صفًا ثابتًا ضمن المرحلة المختارة.');
  grade=Number(query.grade);
  if(!validSchoolLevel(stage,grade))reject('اختر صفًا ثابتًا ضمن المرحلة المختارة.');
 }
 if(classId){
  const row=s.grades.find(g=>g.track_id===trackId&&g.stage===stage&&g.grade===grade);
  if(!row||!s.classes.some(c=>c.id===classId&&c.grade_id===row.id&&c.track_id===trackId&&c.stage===stage&&c.grade===grade))reject('الفصل غير متاح.',404);
 }
 return {trackId,stage,grade,classId};
}
