const fs=require('fs');const file=process.argv[2];const events=JSON.parse(fs.readFileSync(file)).traceEvents;
const names=['book-open','book-ready','writing-start','writing-end','zoom-start','zoom-end','page-turn-start','page-turn-end'];
const marks=Object.fromEntries(events.filter(e=>names.includes(e.name)).map(e=>[e.name,e]));
const phases={book:['book-open','book-ready'],writing:['writing-start','writing-end'],zoomPan:['zoom-start','zoom-end'],pageTurn:['page-turn-start','page-turn-end']};const result={};
for(const [name,[start,end]]of Object.entries(phases)){const a=marks[start],b=marks[end];if(!a||!b)continue;const list=events.filter(e=>e.pid===a.pid&&e.tid===a.tid&&e.ph==='X'&&e.ts>=a.ts&&e.ts<=b.ts&&e.dur);result[name]={elapsedMs:(b.ts-a.ts)/1000};for(const key of ['Layout','UpdateLayoutTree','Paint','FireAnimationFrame','EventDispatch','FunctionCall']){const sub=list.filter(e=>e.name===key);result[name][key]={count:sub.length,totalMs:+sub.reduce((n,e)=>n+e.dur/1000,0).toFixed(2),maxMs:+Math.max(0,...sub.map(e=>e.dur/1000)).toFixed(2),over50Ms:sub.filter(e=>e.dur>50000).length};}}
console.log(JSON.stringify(result,null,2));
