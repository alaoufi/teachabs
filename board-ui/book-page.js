export const bookViewport=(width,height)=>{const zoom=Math.max(.1,Math.min(1,(width-32)/1000,(height-120)/600));return {zoom:{value:zoom},scrollX:(width/zoom-1000)/2,scrollY:70/zoom};};
export const bookTransform=s=>`translate(${s.scrollX*s.zoom}px, ${s.scrollY*s.zoom}px) scale(${s.zoom})`;
