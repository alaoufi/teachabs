import {UserError} from './store.mjs';
import {allowedLessons} from './lesson-catalog.mjs';
export const defaultModel3d=()=>({model:'geometry-demo-v1',yaw:25,pitch:15,zoom:1.5,part:'all'});
export function changeModel3d(state,seat,command,context){
 if(seat!=='teacher')throw new UserError('Only the teacher controls the shared 3D model',403);
 if(state.pageSession||command.lessonId!==state.activeLesson||!allowedLessons(context).some(l=>l.id===state.activeLesson&&l.aidIds.includes('geometry3d')))throw new UserError('3D resource unavailable for this lesson',403);
 const v=command.view;if(!v||v.model!=='geometry-demo-v1'||!['all','cube','pyramid'].includes(v.part)||!Number.isFinite(v.yaw)||Math.abs(v.yaw)>180||!Number.isFinite(v.pitch)||Math.abs(v.pitch)>80||!Number.isFinite(v.zoom)||v.zoom<0.5||v.zoom>2.5)throw new UserError('Invalid 3D state');
 return {...state,rev:state.rev+1,model3d:{model:v.model,yaw:v.yaw,pitch:v.pitch,zoom:v.zoom,part:v.part}};
}
