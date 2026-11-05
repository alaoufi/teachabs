export function fitDimensions(width,height){
 const scale=Math.min(1,600/Math.max(1,width),450/Math.max(1,height));
 return {width:width*scale,height:height*scale};
}
export function wrapAidText(text){
 return text.split('\n').map(line=>{
  const lines=[];let current='';
  for(const word of line.split(/\s+/)){if(current&&current.length+word.length+1>34){lines.push(current);current=word;}else current+=(current?' ':'')+word;}
  lines.push(current);return lines.join('\n');
 }).join('\n');
}
