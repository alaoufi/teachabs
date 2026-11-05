// Scale a reviewed local library item without introducing remote URLs or shared IDs.
export function libraryElements(source,x,y,maxWidth=520,maxHeight=280){
 const corners=source.flatMap(e=>{const cx=e.x+e.width/2,cy=e.y+e.height/2,c=Math.cos(e.angle||0),s=Math.sin(e.angle||0);return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>({x:cx+a*e.width/2*c-b*e.height/2*s,y:cy+a*e.width/2*s+b*e.height/2*c}));});
 const minX=Math.min(...corners.map(p=>p.x)),minY=Math.min(...corners.map(p=>p.y)),w=Math.max(...corners.map(p=>p.x))-minX,h=Math.max(...corners.map(p=>p.y))-minY;
 const scale=Math.min(1,maxWidth/Math.max(1,w),maxHeight/Math.max(1,h)),group='library-'+crypto.randomUUID(),ids=new Map(source.map(e=>[e.id,crypto.randomUUID()]));
 return source.map(raw=>{const e=structuredClone(raw);e.id=ids.get(raw.id);e.x=x+(e.x-minX)*scale;e.y=y+(e.y-minY)*scale;e.width*=scale;e.height*=scale;e.strokeWidth=Math.max(0.5,(e.strokeWidth||1)*scale);if(e.points)e.points=e.points.map(p=>[p[0]*scale,p[1]*scale]);if(e.fontSize)e.fontSize*=scale;e.groupIds=[group];e.link=null;delete e.customData;e.boundElements=null;e.startBinding=null;e.endBinding=null;e.containerId=null;e.frameId=null;e.version=1;e.versionNonce=0;e.updated=Date.now();e.isDeleted=false;return e;});
}
