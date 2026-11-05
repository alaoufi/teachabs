export const FORMAT='teachabs-classroom-lab';
export const MAX_SHAPES=500;
const finite=n=>Number.isFinite(n)&&Math.abs(n)<=2000;
export function validateExperiment(data){
 if(data?.format!==FORMAT||data.version!==1||!Array.isArray(data.shapes)||data.shapes.length>MAX_SHAPES)throw Error('Invalid experiment');
 if(typeof data.title!=='string'||data.title.length>120||typeof data.notes!=='string'||data.notes.length>10000)throw Error('Invalid notes');
 let pointCount=0;
 const shapes=data.shapes.map(s=>{
  if(!s||!['pen','line','rect','ellipse','text'].includes(s.type)||!/^#[0-9a-f]{6}$/i.test(s.color)||![2,4,8].includes(s.width))throw Error('Invalid shape');
  if(!Array.isArray(s.points)||!s.points.length||s.points.length>4000||s.points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(finite)))throw Error('Invalid points');
  pointCount+=s.points.length;if(pointCount>20000)throw Error('Too many points');
  if(s.type!=='pen'&&s.type!=='text'&&s.points.length!==2)throw Error('Invalid geometry');
  if(s.type==='text'&&(typeof s.text!=='string'||s.text.length>150))throw Error('Invalid text');
  return {type:s.type,color:s.color,width:s.width,points:s.points.map(p=>[...p]),...(s.type==='text'?{text:s.text}:{})};
 });
 return {format:FORMAT,version:1,title:data.title,notes:data.notes,shapes};
}
export function experiment(shapes,title='',notes=''){return validateExperiment({format:FORMAT,version:1,shapes,title,notes});}
export function template(kind){
 const shape=(type,points,text)=>({type,points,color:'#718b91',width:2,...(text?{text}:{})});
 if(kind==='axes')return [shape('line',[[100,300],[900,300]]),shape('line',[[500,60],[500,550]]),shape('text',[[910,290]],'س'),shape('text',[[520,75]],'ص'),...[-4,-3,-2,-1,1,2,3,4].map(n=>shape('line',[[500+n*80,295],[500+n*80,305]]))];
 return [{...shape('pen',Array.from({length:81},(_,i)=>{const x=(i-40)/20;return [500+x*80,300-x*x*50];})),color:'#b24b30'},shape('text',[[720,100]],'ص = س²')];
}
