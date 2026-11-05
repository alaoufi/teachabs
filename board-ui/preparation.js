// Teacher preparation remains local until the explicit publish action.
export const sceneSignature=scene=>JSON.stringify({elements:scene.elements,files:scene.files});
export function createPreparation(remote,scene){return {lessonId:remote.activeLesson,baseline:sceneSignature(remote),snapshot:scene};}
export function canPublishPreparation(preparation,remote){return !!preparation&&preparation.lessonId===remote?.activeLesson&&preparation.baseline===sceneSignature(remote);}
export function outgoingScene({preparation,elements,files,lessonId,view}){
 if(preparation){preparation.snapshot={elements,files};return null;}
 return {elements,files,lessonId,op:view==='draft'?'draft':'scene'};
}
