export function digestionElements(x,y,width=300){
 const stages=[['الفم','مضغ وخلط باللعاب'],['المريء','دفع الطعام للمعدة'],['المعدة','خلط وهضم البروتينات'],['الأمعاء الدقيقة','هضم وامتصاص معظم المغذيات'],['الأمعاء الغليظة','امتصاص مزيد من الماء'],['المستقيم','تخزين البراز مؤقتًا'],['فتحة الشرج','خروج البراز']];
 const w=Math.min(300,Math.max(180,width)),group='digestion-'+crypto.randomUUID(),elements=[];
 stages.forEach(([name,job],i)=>{const yy=y+i*90;elements.push({type:'rectangle',x,y:yy,width:w,height:68,backgroundColor:i%2?'#e3f2ed':'#fff4d6',strokeColor:'#215b50',roundness:{type:3},groupIds:[group],label:{text:(i+1)+' · '+name+'\n'+job,fontSize:18,fontFamily:2,textAlign:'center',verticalAlign:'middle'}});if(i<6)elements.push({type:'arrow',x:x+w/2,y:yy+70,width:0,height:18,points:[[0,0],[0,18]],endArrowhead:'arrow',groupIds:[group]});});return elements;
}

