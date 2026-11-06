// Run only in a permitted browser environment. Synthetic, loopback-only, read-only UI QA.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const {openStore}=await import('../store.mjs'),{createApp}=await import('../server.mjs');
 const store=openStore(':memory:'),ids=store.admin.demo(),app=createApp(store);await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.address().port,output=process.env.ADMIN_QA_OUTPUT||path.resolve('../admin-demo-wrap-023-evidence');fs.mkdirSync(output,{recursive:true});let browser;
 try{
  browser=await chromium.launch({headless:true,chromiumSandbox:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  const context=await browser.newContext({serviceWorkers:'block'}),blocked=[];await context.addCookies([{name:'ks',value:store.session(ids.supervisor),url:base}]);
  await context.route('**/*',route=>{const request=route.request();if(!request.url().startsWith(base+'/')||!['GET','HEAD'].includes(request.method())){blocked.push({method:request.method(),url:request.url()});return route.abort();}return route.continue();});
  const page=await context.newPage(),errors=[],checks=[];page.on('pageerror',error=>errors.push(error.message));
  for(const width of [320,360,393,768,1280])for(const scale of [1,1.3,1.6,2]){
   await page.setViewportSize({width,height:900});assert.equal((await page.goto(base+'/admin')).status(),200);
   await page.evaluate(scale=>{const sizes=[...document.querySelectorAll('body *')].filter(node=>node instanceof HTMLElement).map(node=>{const style=getComputedStyle(node);return [node,parseFloat(style.fontSize),parseFloat(style.lineHeight)];});for(const [node,size,line]of sizes){node.style.fontSize=size*scale+'px';if(Number.isFinite(line))node.style.lineHeight=line*scale+'px';}},scale);
   const details=page.locator('.adm-simulation'),summary=details.locator('summary'),guide=page.locator('.adm-hub-head>details.adm-help>summary');
   for(const state of ['closed','role-open','role-and-guide-open']){
    if(state==='role-open'){await summary.focus();await summary.press('Enter');assert.notEqual(await details.getAttribute('open'),null);}
    if(state==='role-and-guide-open'){await guide.focus();await guide.press('Enter');}
    const measured=await details.evaluate(details=>{
     const visible=[details.querySelector('summary'),...details.querySelector('summary').children,...(details.open?[details.querySelector('select'),details.querySelector('button')]:[])].filter(node=>node&&getComputedStyle(node).display!=='none');
     return {rootWidth:document.documentElement.scrollWidth,viewport:innerWidth,roleSelectWidth:details.open?details.querySelector('select').getBoundingClientRect().width:null,escaped:visible.filter(node=>{const r=node.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1||node.scrollWidth>node.clientWidth+1;}).map(node=>node.tagName),targetHeight:details.querySelector('summary').getBoundingClientRect().height};
    });
    assert.ok(measured.rootWidth<=width+1,JSON.stringify({width,scale,state,measured}));assert.deepEqual(measured.escaped,[],JSON.stringify({width,scale,state}));assert.ok(measured.targetHeight>=44);checks.push({width,scale,state,...measured});
    if((width===393&&scale===2)||(width===320&&scale===1)||(width===1280&&scale===1))await page.screenshot({path:path.join(output,`demo-w${width}-text${Math.round(scale*100)}-${state}.png`),fullPage:true});
   }
   await summary.focus();await summary.press('Space');assert.equal(await details.getAttribute('open'),null);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({mode:'browser-text-stress-not-android',checks,errors,blocked},null,2));console.log(JSON.stringify({checks:checks.length,errors,mode:'browser-text-stress-not-android'}));
 }finally{if(browser)await browser.close();app.closeAllConnections();await new Promise(resolve=>app.close(resolve));store.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
