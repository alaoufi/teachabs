import {UserError} from './store.mjs';
const need=(ok,message,status=400)=>{if(!ok)throw new UserError(message,status);};
const snapshot=s=>({elements:s.elements,files:s.files,studentDraft:s.studentDraft||null,publishedStudent:s.publishedStudent||null,model3d:s.model3d||null});
export function changeLivePages(state,seat,command,instance){
 need(seat==='teacher','Only the teacher may change pages',403);
 need(command.rev===state.rev,'Board changed',409);
 let session=structuredClone(state.pageSession),target;
 const archives=structuredClone(state.savedPageArchives||{});
 if(command.op==='pages-start'){
  need(!session,'Close the current saved lesson first',409);
  need(instance?.id===command.instanceId&&instance.pages?.length,'Saved lesson unavailable',403);
  session={id:instance.id,index:0,pages:archives[instance.id]||instance.pages.map(p=>({...p,studentDraft:null,publishedStudent:null})),returnScene:snapshot(state)};
  target=session.pages[0];
 }else{
  need(session,'No saved lesson is open',409);
  need(command.instanceId===session.id,'Saved lesson changed',409);
  session.pages[session.index]=snapshot(state);
  if(command.op==='pages-close'){archives[session.id]=session.pages;target=session.returnScene;session=null;}
  else {need(command.op==='pages-go'&&Number.isInteger(command.page)&&command.page>=0&&command.page<session.pages.length,'Invalid page');session.index=command.page;target=session.pages[session.index];}
 }
 const next={...state,...target,model3d:target.model3d||null,pageSession:session,savedPageArchives:archives,studentDraw:false,rev:state.rev+1};
 need(JSON.stringify(next).length<=2000000,'Saved lesson exceeds board capacity');return next;
}
