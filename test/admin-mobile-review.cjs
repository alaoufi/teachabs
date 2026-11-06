const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http');
(async()=>{
 const {generateAssets}=await import('../admin-preview-android/generate-assets.mjs');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'admin-mobile-')),manifest=generateAssets(temp);
 const output=process.env.ADMIN_QA_OUTPUT||path.resolve('../admin-mobile-review-014');fs.mkdirSync(output,{recursive:true});
 const app=http.createServer((req,res)=>{const asset=manifest.routes[new URL(req.url,'http://localhost').pathname];if(!asset){res.writeHead(404);return res.end();}res.setHeader('Content-Type',asset.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(fs.readFileSync(path.join(temp,asset)));});
 await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox']});
  const context=await browser.newContext({deviceScaleFactor:2});const page=await context.newPage(),errors=[],checks=[];page.on('pageerror',e=>errors.push(e.message));
  const base='http://127.0.0.1:'+app.address().port,routes=Object.keys(manifest.routes).filter(r=>r.startsWith('/admin'));
  for(const width of [320,360,393])for(const scale of [1,1.3,1.6])for(const route of routes){
   await page.setViewportSize({width,height:850});await page.goto(base+route);
   // Browser-only stress approximation. This does not replace actual Android font-scale QA.
   if(scale!==1)await page.evaluate(scale=>{const sizes=[...document.querySelectorAll('body *')].map(n=>[n,parseFloat(getComputedStyle(n).fontSize)]);for(const [node,size]of sizes)node.style.fontSize=size*scale+'px';},scale);
   const measured=await page.evaluate(()=>{
    const broken=[];for(const title of document.querySelectorAll('.school-class-title h3')){const text=title.firstChild;if(!text||text.nodeType!==Node.TEXT_NODE)continue;for(const word of text.textContent.matchAll(/\S+/g)){if(word[0].length>20)continue;const r=document.createRange();r.setStart(text,word.index);r.setEnd(text,word.index+word[0].length);const lines=new Set([...r.getClientRects()].map(x=>Math.round(x.top)));if(lines.size>1)broken.push(word[0]);}}
    const clashes=[];for(const head of document.querySelectorAll('.school-class-top,.adm-agent-head')){const title=head.querySelector('h3,h2'),badge=head.querySelector('.adm-badge');if(title&&badge){const t=title.getBoundingClientRect(),b=badge.getBoundingClientRect();if(b.top<t.bottom-1)clashes.push(title.textContent);}}
    return {overflow:document.documentElement.scrollWidth>innerWidth+1,broken,clashes};
   });
   assert.equal(measured.overflow,false,JSON.stringify({width,scale,route,measured}));assert.deepEqual(measured.broken,[],JSON.stringify({width,scale,route}));assert.deepEqual(measured.clashes,[],JSON.stringify({width,scale,route}));
   checks.push({width,scale,route,...measured});
   if(width===360&&[1,1.6].includes(scale)&&['/admin','/admin/school','/admin/finance','/admin/agents','/admin/accounts'].includes(route))await page.screenshot({path:path.join(output,route.replaceAll('/','-')+'-'+scale+'.png'),fullPage:true});
  }
  assert.deepEqual(errors,[]);const result={mode:'browser-stress-not-android-approval',sourceRevision:manifest.sourceRevision,checks,errors};fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({checks:checks.length,errors,mode:result.mode}));
 }finally{if(browser)await browser.close();app.closeAllConnections();await new Promise(resolve=>app.close(resolve));fs.rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
