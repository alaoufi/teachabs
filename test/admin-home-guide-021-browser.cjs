// Run only in an environment permitted to launch a browser. Uses synthetic data.
// Browser text stress does not replace Android font-scale verification.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const {openStore}=await import('../store.mjs'),{createApp}=await import('../server.mjs');
 const store=openStore(':memory:'),ids=store.admin.demo(),app=createApp(store);
 await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.address().port,output=process.env.ADMIN_QA_OUTPUT||path.resolve('../admin-home-guide-021-evidence');
 fs.mkdirSync(output,{recursive:true});let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox']});
  const context=await browser.newContext();await context.addCookies([{name:'ks',value:store.session(ids.supervisor),url:base}]);
  const page=await context.newPage(),errors=[],checks=[];page.on('pageerror',error=>errors.push(error.message));
  for(const width of [320,360,393,768,1280])for(const scale of [1,1.6,2]){
   await page.setViewportSize({width,height:900});assert.equal((await page.goto(base+'/admin')).status(),200);
   if(scale!==1)await page.evaluate(scale=>{const sizes=[...document.querySelectorAll('body *')].map(node=>[node,parseFloat(getComputedStyle(node).fontSize)]);for(const [node,size]of sizes)node.style.fontSize=size*scale+'px';},scale);
   const details=page.locator('.adm-hub-head>.adm-help'),summary=details.locator('summary');
   assert.equal(await details.getAttribute('open'),null);await summary.focus();await summary.press('Enter');assert.notEqual(await details.getAttribute('open'),null);
   const measured=await details.evaluate(details=>{
    const head=details.parentElement.getBoundingClientRect(),title=details.previousElementSibling.getBoundingClientRect(),box=details.getBoundingClientRect(),paragraph=details.querySelector('p').getBoundingClientRect();
    return {headerWidth:head.width,guideWidth:box.width,paragraphWidth:paragraph.width,belowTitle:box.top>=title.bottom-1,overflow:document.documentElement.scrollWidth>innerWidth+1};
   });
   assert.ok(measured.guideWidth>=measured.headerWidth*.95,JSON.stringify({width,scale,measured}));assert.ok(measured.paragraphWidth>=measured.headerWidth*.95,JSON.stringify({width,scale,measured}));assert.equal(measured.belowTitle,true);assert.equal(measured.overflow,false,JSON.stringify({width,scale,measured}));
   await page.screenshot({path:path.join(output,`home-w${width}-text${Math.round(scale*100)}-guide.png`),fullPage:true});
   await summary.press('Space');assert.equal(await details.getAttribute('open'),null);await summary.press('Enter');assert.notEqual(await details.getAttribute('open'),null);await summary.press('Enter');assert.equal(await details.getAttribute('open'),null);
   checks.push({width,scale,...measured});
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({mode:'browser-stress-not-android-approval',checks,errors},null,2));console.log(JSON.stringify({checks:checks.length,errors,mode:'browser-stress-not-android-approval'}));
 }finally{if(browser)await browser.close();app.closeAllConnections();await new Promise(resolve=>app.close(resolve));store.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
