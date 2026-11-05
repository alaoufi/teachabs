// Original teaching diagram; demonstrates a constructed angle, not calibrated measurement.
export function protractorElements(x,y,id){
 const c={groupIds:[id],strokeColor:'#245a85',strokeWidth:1,roughness:0},cx=x+200,cy=y+210;
 const items=[{...c,type:'rectangle',x,y,width:400,height:250,backgroundColor:'#e5f0fa',fillStyle:'solid'}];
 for(let d=0;d<=180;d+=10){const a=d*Math.PI/180,px=cx+180*Math.cos(a),py=cy-180*Math.sin(a);items.push({...c,type:'line',x:px,y:py,width:1,height:1,points:[[0,0],[-(d%30===0?16:9)*Math.cos(a),(d%30===0?16:9)*Math.sin(a)]]});if(d<180){const b=(d+10)*Math.PI/180;items.push({...c,type:'line',x:px,y:py,width:1,height:1,points:[[0,0],[cx+180*Math.cos(b)-px,cy-180*Math.sin(b)-py]]});}if(d%30===0)items.push({...c,type:'text',x:cx+145*Math.cos(a)-12,y:cy-145*Math.sin(a)-10,text:String(d),fontSize:16,fontFamily:2});}
 items.push({...c,id:'base-'+id,type:'line',x:cx,y:cy,width:170,height:0,points:[[0,0],[170,0]],strokeWidth:3});
 items.push({...c,id:'ray-'+id,type:'line',x:cx-85,y:cy-85,width:170,height:0,angle:-Math.PI/2,points:[[0,0],[170,0]],strokeWidth:3,strokeColor:'#c44920'});
 items.push({...c,id:'reading-'+id,type:'text',x:x+130,y:y+225,text:'90° — زاوية تعليمية',fontSize:18,fontFamily:2});return items;
}
export function protractorReading(elements){
 const ray=[...elements].reverse().find(e=>!e.isDeleted&&e.id.startsWith('ray-protractor-'));if(!ray)return null;const group=ray.id.slice(4),base=elements.find(e=>e.id==='base-'+group&&!e.isDeleted);if(!base)return null;
 const degrees=((base.angle-ray.angle)*180/Math.PI%360+360)%360;return {group,degrees:Math.round(Math.min(180,degrees)),base};
}
export function setProtractorAngle(elements,degrees){
 const info=protractorReading(elements);if(!info||!Number.isFinite(degrees))return elements;degrees=Math.max(0,Math.min(180,degrees));const b=info.base,angle=b.angle-degrees*Math.PI/180,cx=b.x+b.width/2-Math.cos(b.angle)*b.width/2,cy=b.y+b.height/2-Math.sin(b.angle)*b.width/2;
 return elements.map(e=>{if(e.id==='ray-'+info.group)return {...e,x:cx+Math.cos(angle)*e.width/2-e.width/2,y:cy+Math.sin(angle)*e.width/2-e.height/2,angle,version:e.version+1};if(e.id==='reading-'+info.group)return {...e,text:degrees+'° — زاوية تعليمية',originalText:degrees+'° — زاوية تعليمية',version:e.version+1};return e;});
}
