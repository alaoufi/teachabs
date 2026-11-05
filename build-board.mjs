import{build}from'esbuild';import{cp,mkdir,readFile,writeFile}from'node:fs/promises';
await mkdir('public/board-assets',{recursive:true});
const pinnedFontSource=await readFile('node_modules/@excalidraw/excalidraw/dist/prod/chunk-K2UTITRG.js','utf8');
if(!/P\(jn,"ASSETS_FALLBACK_URL",[\s\S]*?\);var Xo/.test(pinnedFontSource))throw Error('Review local font fallback patch before upgrading Excalidraw');
const localFonts={name:'local-font-fallback',setup(b){b.onLoad({filter:/chunk-K2UTITRG\.js$/},async a=>({contents:(await readFile(a.path,'utf8')).replace(/P\(jn,"ASSETS_FALLBACK_URL",[\s\S]*?\);var Xo/,"P(jn,\"ASSETS_FALLBACK_URL\",new URL('/board-assets/',window.location.origin).toString());var Xo"),loader:'js'}));}};
await build({plugins:[localFonts],entryPoints:['board-ui/index.jsx'],conditions:['production'],bundle:true,format:'esm',splitting:true,outdir:'public/board-assets',entryNames:'board',chunkNames:'chunks/[name]-[hash]',assetNames:'assets/[name]-[hash]',minify:true,define:{'process.env.NODE_ENV':'"production"'},loader:{'.woff2':'file','.woff':'file','.ttf':'file','.png':'file','.svg':'file'},banner:{js:'window.EXCALIDRAW_ASSET_PATH="/board-assets/";'}});
await cp('node_modules/@excalidraw/excalidraw/dist/prod/fonts','public/board-assets/fonts',{recursive:true});
await cp('node_modules/mathlive/fonts','public/board-assets/mathlive-fonts',{recursive:true});
await mkdir('THIRD_PARTY_LICENSES',{recursive:true});
await cp('node_modules/mathlive/LICENSE.txt','THIRD_PARTY_LICENSES/MathLive.txt');
await cp('node_modules/katex/LICENSE','THIRD_PARTY_LICENSES/KaTeX.txt');
await cp('node_modules/html2canvas/LICENSE','THIRD_PARTY_LICENSES/html2canvas.txt');
for(const [name,path]of Object.entries({Excalidraw:'@excalidraw/excalidraw',React:'react',ReactDOM:'react-dom'})){
 try{await cp('node_modules/'+path+'/LICENSE','THIRD_PARTY_LICENSES/'+name+'.txt');}catch{}
}
