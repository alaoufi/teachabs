// Original project-authored artwork. Relative units, never physical screen centimeters.
export function rulerElements(x,y,groupId){
 const common={groupIds:[groupId],strokeColor:'#155c4d',strokeWidth:1,roughness:0};
 const result=[{...common,type:'rectangle',x,y,width:400,height:100,backgroundColor:'#d8eee7',fillStyle:'solid'}];
 for(let i=0;i<=10;i++){
  const left=x+20+i*36;
  result.push({...common,type:'line',x:left,y:y+5,width:0,height:i%5===0?30:22,points:[[0,0],[0,i%5===0?30:22]]});
  result.push({...common,type:'text',x:left-7,y:y+38,text:String(i),fontSize:16,fontFamily:2,textAlign:'center'});
 }
 result.push({...common,type:'text',x:x+35,y:y+72,text:'مسطرة تعليمية — وحدات نسبية',fontSize:18,fontFamily:2});
 return result;
}
export function transformRuler(elements,{rotate=0,dx=0,dy=0}){
 const group=[...elements].reverse().find(e=>!e.isDeleted&&e.groupIds?.some(id=>id.startsWith('ruler-')))?.groupIds.find(id=>id.startsWith('ruler-'));
 if(!group)return elements;
 const members=elements.filter(e=>!e.isDeleted&&e.groupIds?.includes(group));
 const anchor=members.find(e=>e.type==='rectangle')||members[0];
 const cx=anchor.x+anchor.width/2,cy=anchor.y+anchor.height/2;
 return elements.map(e=>{if(!members.includes(e))return e;const x=e.x+e.width/2-cx,y=e.y+e.height/2-cy;return {...e,x:cx+x*Math.cos(rotate)-y*Math.sin(rotate)-e.width/2+dx,y:cy+x*Math.sin(rotate)+y*Math.cos(rotate)-e.height/2+dy,angle:(e.angle||0)+rotate,version:(e.version||0)+1,versionNonce:Math.floor(Math.random()*2147483647)};});
}
