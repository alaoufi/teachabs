// QA-only sandboxed adaptation of test/admin-home-guide-021-browser.cjs.
// Browser text stress is not Android font-scale verification.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {createHash}=require('node:crypto');
const SOURCE='30c0c89e3a8d909852674a7890a504780917ce15';
const ORIGINAL_SHA256='bbc11dc83bd1d80bcc7764bd549ba9c67456499ad7989bb0b700f93de2d1d9a9';
const ROOT=process.env.QA_SOURCE_ROOT||path.resolve(__dirname,'../..');
const WIDTHS=[320,360,393,768,1280],PERCENTS=[100,130,160,200];
const REPORT={source:SOURCE,synthetic:true,database:':memory:',browserSandbox:true,
 authentication:'Synthetic supervisor session, not production login',
 textEnlargementMethod:'Snapshot body and descendant HTML computed font sizes and numeric line heights before changes; multiply by 1, 1.3, 1.6 or 2. Root font size remains unchanged. No zoom or Android accessibility claim.',
 plannedMatrix:{widths:WIDTHS,textPercent:PERCENTS},checks:[],matrix:[],screenshots:[],pageErrors:[],blockedRequests:[]};
let store,app,browser,page,output=process.env.QA_OUTPUT_DIR?path.resolve(process.env.QA_OUTPUT_DIR):null,phase='preflight';
if(output)fs.mkdirSync(output,{recursive:true});
function check(name,condition,detail){REPORT.checks.push({name,pass:!!condition,...(detail===undefined?{}:{detail})});}
async function capture(name,locator){
 const target=path.join(output,name+'.png');
 if(locator)await locator.screenshot({path:target});else await page.screenshot({path:target,fullPage:true});
 REPORT.screenshots.push(name+'.png');
}
async function scaleText(factor){
 return page.evaluate(factor=>{
  const rootBefore=getComputedStyle(document.documentElement).fontSize;
  const entries=[...document.querySelectorAll('body, body *')].filter(e=>e instanceof HTMLElement).map(e=>{
   const s=getComputedStyle(e);return {e,size:parseFloat(s.fontSize),line:s.lineHeight};
  });
  const selectors=['h1','.adm-hub-head>div>p','.adm-hub-head>.adm-help>summary','.adm-hub-head>.adm-help>p'];
  const probes=selectors.map(selector=>{const e=document.querySelector(selector),s=getComputedStyle(e);return {selector,e,before:parseFloat(s.fontSize),lineBefore:s.lineHeight};});
  if(factor!==1)for(const {e,size,line}of entries){
   e.style.setProperty('font-size',`${size*factor}px`,'important');
   if(line!=='normal')e.style.setProperty('line-height',`${parseFloat(line)*factor}px`,'important');
  }
  return {factor,rootBefore,rootAfter:getComputedStyle(document.documentElement).fontSize,elementCount:entries.length,
   maximumFontDeviation:Math.max(...entries.map(({e,size})=>Math.abs(parseFloat(getComputedStyle(e).fontSize)-size*factor))),
   maximumLineDeviation:Math.max(0,...entries.filter(x=>x.line!=='normal').map(({e,line})=>Math.abs(parseFloat(getComputedStyle(e).lineHeight)-parseFloat(line)*factor))),
   probes:probes.map(({selector,e,before,lineBefore})=>({selector,before,after:parseFloat(getComputedStyle(e).fontSize),lineBefore,lineAfter:getComputedStyle(e).lineHeight}))};
 },factor);
}
(async()=>{
 assert.equal(createHash('sha256').update(fs.readFileSync(path.join(ROOT,'test/admin-home-guide-021-browser.cjs'))).digest('hex'),ORIGINAL_SHA256,'Supplied regression file must match the reviewed source');
 const {openStore}=await import(pathToFileURL(path.join(ROOT,'store.mjs')));
 const {createApp}=await import(pathToFileURL(path.join(ROOT,'server.mjs')));
 store=openStore(':memory:');const ids=store.admin.demo(),actor=ids.supervisor;
 assert.equal(store.admin.profile(actor).adminRole,'supervisor');
 const session=store.session(actor);assert.equal(store.resolve(session),actor);
 if(process.argv.includes('--check')){
  console.log(JSON.stringify({source:SOURCE,originalTestSHA256:ORIGINAL_SHA256,synthetic:true,persistence:false,supervisorSession:true,plannedCases:WIDTHS.length*PERCENTS.length}));
  store.close();store=null;REPORT.status='preflight-passed';REPORT.mode='model-only';return;
 }
 assert.ok(process.env.QA_OUTPUT_DIR,'QA_OUTPUT_DIR is required');
 assert.ok(process.env.QA_BROWSER_PATH,'Preinstalled browser path is required');
 assert.ok(process.env.PLAYWRIGHT_MODULE,'Isolated pinned Playwright module is required');
 assert.ok(process.env.QA_RUNTIME_HOME&&process.env.HOME===process.env.QA_RUNTIME_HOME&&fs.statSync(process.env.HOME).isDirectory(),'Isolated temporary HOME required');
 output=path.resolve(process.env.QA_OUTPUT_DIR);fs.mkdirSync(output,{recursive:true});
 const fingerprint=()=>createHash('sha256').update(JSON.stringify({overview:store.admin.overview(actor),audit:store.admin.auditLog(actor)})).digest('hex');
 const initialState=fingerprint();
 app=createApp(store);await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.address().port;
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
 const browserEnv=Object.fromEntries(['PATH','LANG','LC_ALL','TMPDIR','HOME','XDG_CONFIG_HOME','XDG_CACHE_HOME','XDG_DATA_HOME'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
 phase='browser-launch';
 browser=await chromium.launch({headless:true,executablePath:process.env.QA_BROWSER_PATH,chromiumSandbox:true,env:browserEnv});
 REPORT.browserVersion=browser.version();REPORT.browserExecutable=process.env.QA_BROWSER_PATH;
 const context=await browser.newContext({serviceWorkers:'block',deviceScaleFactor:1});
 await context.route('**/*',route=>{
  const request=route.request();
  if(new URL(request.url()).origin===base&&['GET','HEAD'].includes(request.method()))return route.continue();
  REPORT.blockedRequests.push({url:request.url(),method:request.method()});return route.abort();
 });
 await context.addCookies([{name:'ks',value:session,url:base}]);
 page=await context.newPage();page.setDefaultTimeout(10000);
 page.on('pageerror',error=>REPORT.pageErrors.push(error.message));
 phase='matrix';
 for(const width of WIDTHS)for(const percent of PERCENTS){
  const scale=percent/100,name=`home-w${width}-text${percent}`,record={width,scale,percent,name};
  const beforeChecks=REPORT.checks.length;
  try{
   await page.setViewportSize({width,height:900});const response=await page.goto(base+'/admin',{waitUntil:'networkidle'});
   assert.equal(response.status(),200);record.fonts=await scaleText(scale);
   check(name+': root font stays unchanged',record.fonts.rootBefore===record.fonts.rootAfter);
   check(name+': all HTML computed fonts reach the requested multiplier',record.fonts.maximumFontDeviation<.05,record.fonts);
   check(name+': numeric line heights reach the requested multiplier',record.fonts.maximumLineDeviation<.05);
   const details=page.locator('.adm-hub-head>.adm-help'),summary=details.locator('summary');
   check(name+': guide starts closed',await details.getAttribute('open')===null);
   record.closed=await details.evaluate(e=>({guideWidth:e.getBoundingClientRect().width,summaryWidth:e.querySelector('summary').getBoundingClientRect().width,summaryHeight:e.querySelector('summary').getBoundingClientRect().height,root:document.documentElement.scrollWidth,body:document.body.scrollWidth,direction:getComputedStyle(document.body).direction}));
   check(name+': closed page has no horizontal overflow',Math.max(record.closed.root,record.closed.body)<=width+1,record.closed);
   check(name+': RTL remains active',record.closed.direction==='rtl');
   check(name+': summary target is at least 44 by 44',record.closed.summaryWidth>=44&&record.closed.summaryHeight>=44,record.closed);
   if(percent===100&&(width===320||width===1280))await capture(name+'-closed');
   await summary.focus();await summary.press('Enter');
   check(name+': keyboard Enter opens guide',await details.getAttribute('open')!==null);
   record.measured=await details.evaluate(details=>{
    const head=details.parentElement.getBoundingClientRect(),title=details.previousElementSibling.getBoundingClientRect(),box=details.getBoundingClientRect(),paragraph=details.querySelector('p').getBoundingClientRect(),icon=details.querySelector('svg').getBoundingClientRect(),summary=details.querySelector('summary'),focus=getComputedStyle(summary);
    return {headerWidth:head.width,guideWidth:box.width,guideHeight:box.height,paragraphWidth:paragraph.width,paragraphHeight:paragraph.height,belowTitle:box.top>=title.bottom-1,overflow:document.documentElement.scrollWidth>innerWidth+1,bodyOverflow:document.body.scrollWidth>innerWidth+1,paragraphOverflow:details.querySelector('p').scrollWidth>details.querySelector('p').clientWidth+1,iconWidth:icon.width,iconHeight:icon.height,focusOnSummary:document.activeElement===summary,focusOutlineStyle:focus.outlineStyle,focusOutlineWidth:focus.outlineWidth};
   });
   // Preserve every supplied geometry regression assertion, recording failures without skipping later cases.
   const measured=record.measured;
   check(name+': guide occupies at least 95% of header width',measured.guideWidth>=measured.headerWidth*.95,measured);
   check(name+': paragraph occupies at least 95% of header width',measured.paragraphWidth>=measured.headerWidth*.95,measured);
   check(name+': guide is below title',measured.belowTitle===true,measured);
   check(name+': no horizontal page overflow',measured.overflow===false&&measured.bodyOverflow===false,measured);
   check(name+': paragraph has no horizontal overflow',!measured.paragraphOverflow);
   check(name+': SVG icon stays 20 by 20',measured.iconWidth===20&&measured.iconHeight===20);
   check(name+': keyboard focus stays on summary',measured.focusOnSummary);
   await page.evaluate(()=>scrollTo(0,0));await capture(name+'-guide');await capture(name+'-guide-crop',details);
   await summary.press('Space');check(name+': Space closes guide',await details.getAttribute('open')===null);
   await summary.press('Enter');check(name+': repeated Enter opens guide',await details.getAttribute('open')!==null);
   await summary.press('Enter');check(name+': repeated Enter closes guide',await details.getAttribute('open')===null);
   check(name+': repeated close retains focus',await summary.evaluate(e=>document.activeElement===e));
   record.status=REPORT.checks.slice(beforeChecks).every(x=>x.pass)?'passed':'failed-checks';
  }catch(error){
   record.status='failed';record.error=error.stack||String(error);
   check(name+': completed all actions',false,record.error);
   try{await capture(name+'-failure');}catch(screenshotError){record.failureScreenshotError=String(screenshotError);}
  }
  REPORT.matrix.push(record);
 }
 check('All twenty planned cases completed',REPORT.matrix.length===20&&REPORT.matrix.every(x=>x.status!=='failed'));
 check('No page JavaScript errors',REPORT.pageErrors.length===0);
 check('No external or mutating page requests',REPORT.blockedRequests.length===0);
 check('Guide inspection leaves model and audit unchanged',initialState===fingerprint());
 REPORT.status=REPORT.checks.every(x=>x.pass)?'completed':'completed-with-failed-checks';
})().catch(error=>{
 REPORT.status='failed';REPORT.phase=phase;REPORT.error=error.stack||String(error);console.error(REPORT.error);
}).finally(async()=>{
 if(page&&REPORT.status==='failed')try{await capture('failure');}catch(error){REPORT.failureScreenshotError=String(error);}
 if(browser)await browser.close();
 if(app){app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}
 if(store)store.close();
 if(output){
  REPORT.unexecuted='Cases or checks absent from this report were not executed. Browser-only stress does not validate Android font scale.';
  fs.writeFileSync(path.join(output,REPORT.mode==='model-only'?'model-preflight.json':'browser-report.json'),JSON.stringify(REPORT,null,2));
  console.log(JSON.stringify({status:REPORT.status,checks:REPORT.checks.length,failed:REPORT.checks.filter(x=>!x.pass),screenshots:REPORT.screenshots.length,matrixCases:REPORT.matrix.length}));
 }
 if(REPORT.status&&!['completed','preflight-passed'].includes(REPORT.status))process.exitCode=1;
});
