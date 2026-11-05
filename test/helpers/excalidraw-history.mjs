import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

// Test the pinned editor's actual Store/History implementation, not a substitute.
// The published package exposes these internally in its readable development
// bundle. Re-review this extraction when upgrading Excalidraw 0.18.1.
export async function loadHistoryEngine(){
 const dir=new URL('../../node_modules/@excalidraw/excalidraw/dist/dev/',import.meta.url).pathname;
 const source=await readFile(dir+'index.js','utf8');
 const history=source.split('// history.ts\n')[1]?.split('// hooks/useEmitter.ts')[0];
 if(!history?.includes('var HistoryEntry ='))throw Error('Review real Excalidraw History extraction after package upgrade.');
 const temporary=await mkdtemp(join(tmpdir(),'excalidraw-history-'));
 const output=join(temporary,'engine.mjs');
 await build({stdin:{contents:`import {Store,Emitter,getDefaultAppState,newElement,arrayToMap} from '${dir}chunk-4FTI6OG3.js';import {__publicField} from '${dir}chunk-XDFCUUT6.js';${history};export {Store,History,getDefaultAppState,newElement,arrayToMap};`,resolveDir:dir},bundle:true,platform:'node',format:'esm',outfile:output,loader:{'.woff2':'empty','.woff':'empty','.ttf':'empty','.png':'empty'},logLevel:'silent'});
 const previous={window:globalThis.window,document:globalThis.document,devicePixelRatio:globalThis.devicePixelRatio};
 globalThis.devicePixelRatio=1;
 globalThis.window={location:{origin:'http://localhost'},navigator:globalThis.navigator};
 globalThis.document={documentElement:{style:{}},createElement:()=>({getContext:()=>({measureText:()=>({width:20})})})};
 try{return await import(pathToFileURL(output).href);}finally{Object.assign(globalThis,previous);await rm(temporary,{recursive:true,force:true});}
}
