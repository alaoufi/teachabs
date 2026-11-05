import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';import {build} from 'esbuild';
import {changeBoard,emptyBoard} from '../board.mjs';import {aids} from '../board-ui/aids.js';
// Run the actual board event handlers with a deterministic scene API and minimal
// React/DOM adapters. This is client logic coverage, not visual browser testing.
const directory=await mkdtemp(join(tmpdir(),'board-client-test-'));
const shim=`const h=globalThis.__boardHarness;export const useState=(v)=>h.useState(v);export const useRef=(v)=>h.useState({current:v})[0];export const useEffect=(fn,deps)=>h.useEffect(fn,deps);export default {createElement:(type,props,...children)=>({type,props:{...props,children}})};`;
const plugin={name:'deterministic-board-client',setup(b){
 b.onResolve({filter:/^(react|react-dom\/client|@excalidraw\/excalidraw)$/},args=>({path:args.path,namespace:'test'}));
 b.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path==='react'?shim:args.path==='react-dom/client'?'export const createRoot=()=>({render:element=>globalThis.__boardHarness.mount(element)});':`export const Excalidraw='Excalidraw';export const MainMenu=Object.assign('MainMenu',{Item:'MainMenuItem'});export const CaptureUpdateAction={IMMEDIATELY:'immediately'};export const convertToExcalidrawElements=(items)=>items.map(e=>({id:crypto.randomUUID(),width:40,height:20,angle:0,version:1,isDeleted:false,...e}));export const exportToBlob=async()=>new Blob();`,loader:'js'}));
 b.onResolve({filter:/\.css$/},args=>({path:args.path,namespace:'empty'}));b.onLoad({filter:/.*/,namespace:'empty'},()=>({contents:'',loader:'js'}));
 b.onResolve({filter:/ClassTimer\.jsx$/},()=>({path:'timer',namespace:'timer'}));b.onLoad({filter:/.*/,namespace:'timer'},()=>({contents:"export const ClassTimer=()=>null;",loader:'js'}));
 b.onResolve({filter:/MathPanel\.jsx$/},()=>({path:'math',namespace:'math'}));b.onLoad({filter:/.*/,namespace:'math'},()=>({contents:"export const MathPanel=()=>null;",loader:'js'}));
}};
await build({entryPoints:[new URL('../board-ui/index.jsx',import.meta.url).pathname],bundle:true,format:'esm',platform:'node',outfile:join(directory,'client.mjs'),plugins:[plugin]});
let moduleNumber=0;
function nodes(node){if(node==null||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(nodes);return [node,...nodes(node.props?.children)];}
function text(node){if(node==null||typeof node==='boolean')return '';if(typeof node!=='object')return String(node);if(Array.isArray(node))return node.map(text).join('');return text(node.props?.children);}
async function harness(seat='teacher'){
 const h={states:[],effects:[],cursor:0,queued:false,tree:null,scene:[],files:{},appState:{selectedElementIds:{},selectedGroupIds:{}},requests:[],connected:false};
 h.useState=initial=>{const i=h.cursor++;if(!(i in h.states))h.states[i]=typeof initial==='function'?initial():initial;return [h.states[i],value=>{const next=typeof value==='function'?value(h.states[i]):value;if(Object.is(h.states[i],next))return;h.states[i]=next;if(!h.queued){h.queued=true;queueMicrotask(()=>{h.queued=false;h.render();});}}];};
 h.useEffect=(fn,deps)=>{const i=h.cursor++,previous=h.effects[i];if(previous&&deps?.every((x,j)=>Object.is(x,previous.deps[j])))return;previous?.cleanup?.();h.effects[i]={deps,cleanup:fn()};};
 h.api={history:{clear:()=>{h.historyCleared=(h.historyCleared||0)+1;}},getSceneElements:()=>h.scene.filter(e=>!e.isDeleted),getSceneElementsIncludingDeleted:()=>h.scene,getFiles:()=>h.files,getAppState:()=>h.appState,addFiles:files=>{for(const file of files)h.files[file.id]=file;},updateScene:({elements,appState})=>{if(elements)h.scene=elements;if(appState)h.appState={...h.appState,...appState};h.change?.(h.scene,h.appState,h.files);},scrollToContent:()=>{h.viewportChanges=(h.viewportChanges||0)+1;},setActiveTool:()=>{},};
 h.render=()=>{h.cursor=0;h.tree=h.root();const engine=nodes(h.tree).find(x=>x.type==='Excalidraw');h.change=engine.props.onChange;if(!h.connected){h.connected=true;engine.props.excalidrawAPI(h.api);}};
 h.mount=element=>{h.root=element.type;h.render();};
 globalThis.__boardHarness=h;const leave=new EventTarget();leave.href='/lesson';globalThis.document={getElementById:id=>id==='leave'?leave:{},body:{style:{}}};globalThis.window=new EventTarget();globalThis.requestAnimationFrame=fn=>fn();
 const {attachProfessionalBoard}=await import(pathToFileURL(join(directory,'client.mjs')).href+'?'+moduleNumber++);
 h.signals=new EventTarget();h.state={...changeBoard(emptyBoard(),'teacher',{op:'lesson',lessonId:'math-g4-angles',rev:0},{preview:true}),resources:aids};
 h.receive=(state,sender=null)=>{h.state=state;h.signals.dispatchEvent(new MessageEvent('boardstate',{data:JSON.stringify({state,sender})}));};
 attachProfessionalBoard(seat,h.signals,async(kind,payload)=>{h.requests.push(structuredClone({kind,payload}));h.state=changeBoard(h.state,seat,payload,{preview:true});queueMicrotask(()=>h.receive(h.state,'this-client'));return h.state;},'this-client','preview',0);
 h.receive(h.state);await flush();
 h.find=(type,label)=>nodes(h.tree).find(x=>x.type===type&&text(x)===label);
 h.click=async label=>{const button=h.find('button',label);assert.ok(button,'Missing button '+label);assert.ok(!button.props.disabled,'Disabled button '+label);button.props.onClick();await flush();};
 h.dispose=()=>{for(const effect of h.effects)effect?.cleanup?.();};return h;
}
async function flush(){for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('teacher aid is private through move/resize; sends only on confirmation; later deliberate movement is live',async()=>{
 const h=await harness();const aid=aids.find(a=>a.kind==='protractor');await h.click(aid.title+' +');assert.ok(h.scene.length>40);assert.equal(h.state.elements.length,0);assert.ok(h.find('button','تأكيد المكان وإرسال للطالب'));
 await h.click('تصغير التحديد −');await h.click('تكبير التحديد +');await h.click('منقلة يمين');await h.click('زيادة الزاوية 5°');await delay(450);assert.equal(h.requests.length,0);assert.equal(h.state.elements.length,0);assert.equal(text(nodes(h.tree).find(n=>n.type==='output'&&n.props['aria-label']==='قراءة زاوية المنقلة')),'95°');
 const prepared=structuredClone(h.scene);await h.click('تأكيد المكان وإرسال للطالب');await flush();assert.equal(h.requests.length,1);assert.deepEqual(h.state.elements,prepared.map(e=>({...e,link:null})));
 await h.click('منقلة يمين');await delay(450);await flush();assert.equal(h.requests.length,2);assert.equal(h.state.elements[0].x,prepared[0].x+20);
 const before=JSON.stringify(h.state);await h.click('توسيع مساحة السبورة');await h.click('ملاءمة المحتوى');await h.click('خصائص الرسم');await delay(450);assert.equal(JSON.stringify(h.state),before);assert.equal(h.requests.length,2);window.dispatchEvent(Object.assign(new Event('keydown'),{key:'Escape'}));await flush();assert.ok(h.find('button','توسيع مساحة السبورة'));h.dispose();
});
test('private cancellation never publishes; a concurrent shared update blocks publication and is retained on cancel',async()=>{
 const h=await harness();const aid=aids.find(a=>a.kind==='protractor');await h.click(aid.title+' +');await h.click('إلغاء التجهيز');await delay(450);assert.equal(h.requests.length,0);assert.equal(h.scene.length,0);assert.equal(h.historyCleared,1);
 await h.click(aid.title+' +');const other={id:'another-teacher',type:'rectangle',x:20,y:20,width:80,height:60,angle:0,version:1};h.receive({...h.state,rev:h.state.rev+1,elements:[other]});await flush();assert.ok(h.find('button','تأكيد المكان وإرسال للطالب').props.disabled);assert.ok(h.scene.length>40);await h.click('إلغاء التجهيز');assert.deepEqual(h.scene,[other]);assert.equal(h.requests.length,0);h.dispose();
});
test('students remain read-only without permission and cannot access teacher preparation',async()=>{
 const h=await harness('student');assert.ok(!h.find('button','تجهيز خاص'));assert.ok(!h.find('button','تأكيد المكان وإرسال للطالب'));assert.ok(h.find('button','تحديد وتحريك').props.disabled);const aid=aids.find(a=>a.kind==='protractor');assert.ok(h.find('button',aid.title+' +').props.disabled);assert.equal(h.requests.length,0);h.dispose();
});
test('authorized student edits only the draft and teacher preparation remains unavailable',async()=>{
 const h=await harness('student');h.receive({...h.state,rev:h.state.rev+1,studentDraw:true});await flush();const selector=nodes(h.tree).find(n=>n.type==='select'&&n.props['aria-label']==='مساحة العمل');selector.props.onChange({target:{value:'draft'}});await flush();
 const aid=aids.find(a=>a.kind==='protractor');await h.click(aid.title+' +');await delay(450);await flush();assert.equal(h.requests.length,1);assert.equal(h.requests[0].payload.op,'draft');assert.equal(h.state.elements.length,0);assert.ok(h.state.studentDraft.elements.length>40);assert.ok(!h.find('button','تجهيز خاص'));h.dispose();
});
test('disconnect disables private publication without losing the local preparation',async()=>{
 const h=await harness();const aid=aids.find(a=>a.kind==='protractor');await h.click(aid.title+' +');const prepared=structuredClone(h.scene);h.signals.dispatchEvent(new Event('error'));await flush();assert.ok(h.find('button','تأكيد المكان وإرسال للطالب').props.disabled);assert.deepEqual(h.scene,prepared);assert.equal(h.requests.length,0);
 h.receive(h.state);await flush();assert.ok(!h.find('button','تأكيد المكان وإرسال للطالب').props.disabled);await h.click('تأكيد المكان وإرسال للطالب');assert.equal(h.requests.length,1);h.dispose();
});
test.after(async()=>{await rm(directory,{recursive:true,force:true});});
