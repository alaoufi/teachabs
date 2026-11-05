// Local selection controls. Canvas viewport and selection are never synchronized.
export function selectionState(elements){
 const active=elements.filter(e=>!e.isDeleted);
 return {selectedElementIds:Object.fromEntries(active.map(e=>[e.id,true])),selectedGroupIds:Object.fromEntries(active.flatMap(e=>e.groupIds?.length?[e.groupIds.at(-1)]:[]).map(id=>[id,true])),editingGroupId:null};
}
export function selectedElements(elements,selectedIds={}){
 const groups=new Set(elements.filter(e=>selectedIds[e.id]&&!e.isDeleted&&!e.locked).flatMap(e=>e.groupIds||[]));
 const chosen=new Set(elements.filter(e=>!e.isDeleted&&!e.locked&&(selectedIds[e.id]||e.groupIds?.some(id=>groups.has(id)))).map(e=>e.id));
 // Bound labels move/resize with their parent, but connected arrows do not.
 for(const e of elements)if(chosen.has(e.id))for(const bound of e.boundElements||[])if(bound.type==='text')chosen.add(bound.id);
 return elements.filter(e=>chosen.has(e.id)&&!e.isDeleted&&!e.locked);
}
export function transformSelection(elements,selectedIds,{scale=1,dx=0,dy=0,remove=false}={}){
 const selected=selectedElements(elements,selectedIds);if(!selected.length||!Number.isFinite(scale)||scale<=0)return elements;
 const ids=new Set(selected.map(e=>e.id));
 const cx=(Math.min(...selected.map(e=>e.x))+Math.max(...selected.map(e=>e.x+e.width)))/2;
 const cy=(Math.min(...selected.map(e=>e.y))+Math.max(...selected.map(e=>e.y+e.height)))/2;
 if(scale!==1&&selected.some(e=>e.type==='text'&&e.fontSize*scale<8))return elements;
 return elements.map(e=>{
  if(!ids.has(e.id))return e;
  const next={...e,version:(e.version||0)+1,versionNonce:Math.floor(Math.random()*2147483647),updated:Date.now()};
  if(remove)return {...next,isDeleted:true};
  Object.assign(next,{x:cx+(e.x-cx)*scale+dx,y:cy+(e.y-cy)*scale+dy,width:e.width*scale,height:e.height*scale});
  if(e.points)next.points=e.points.map(([x,y])=>[x*scale,y*scale]);
  if(e.type==='text'){next.fontSize=e.fontSize*scale;if(e.baseline!=null)next.baseline=e.baseline*scale;}
  return next;
 });
}
