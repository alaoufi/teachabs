const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

(async()=>{
 const {openStore}=await import('../store.mjs'),{createApp}=await import('../server.mjs');
 const store=openStore(':memory:'),ids=store.admin.demo(),app=createApp(store);
 await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.address().port,output=process.env.ADMIN_QA_OUTPUT||path.resolve('../admin-compact-verification-012');
 fs.mkdirSync(output,{recursive:true});let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox']});
  const context=await browser.newContext();await context.addCookies([{name:'ks',value:store.session(ids.supervisor),url:base}]);
  const page=await context.newPage(),errors=[],metrics=[];page.on('pageerror',e=>errors.push(e.message));
  for(const width of [320,390,768,1280]){
   await page.setViewportSize({width,height:900});await page.goto(base+'/admin');
   assert.equal(await page.locator('.adm-section-card').count(),10);
   assert.equal(await page.locator('.adm-sidebar,.adm-mobile-nav').count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   const measured=await page.evaluate(()=>{
    const card=document.querySelector('.adm-section-card').getBoundingClientRect(),icon=document.querySelector('.adm-card-icon').getBoundingClientRect(),hub=document.querySelector('.adm-hub').getBoundingClientRect();
    return {width:innerWidth,firstCardTop:card.top,cardHeight:card.height,iconTop:icon.top,hubHeight:hub.height};
   });
   assert.ok(measured.firstCardTop<340,JSON.stringify(measured));assert.ok(measured.cardHeight>=44);assert.ok(measured.iconTop<measured.firstCardTop);metrics.push(measured);
   await page.screenshot({path:path.join(output,`hub-${width}.png`),fullPage:true});
   await page.locator('.adm-help summary').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('.adm-help').getAttribute('open'),'');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.keyboard.press('Enter');
   await page.locator('.adm-simulation summary').click();assert.equal(await page.locator('.adm-simulation select').isVisible(),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   for(const route of ['school','finance','accounts/new','agents']){
    await page.goto(base+'/admin/'+route);
    if(route==='agents')await page.locator('.adm-disclosure summary').click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,route+' '+width);
    const undersized=await page.locator('.adm-field input,.adm-field select,.adm-field textarea,.adm-form .btn').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length&&n.getBoundingClientRect().height<43).map(n=>n.outerHTML.slice(0,100)));
    assert.deepEqual(undersized,[],route+' '+width+' controls');
    if([390,1280].includes(width))await page.screenshot({path:path.join(output,`${route.replaceAll('/','-')}-${width}.png`),fullPage:true});
   }
  }
  await page.goto(base+'/admin/school');assert.equal(await page.locator('form[action="/admin/school/teachers"]').count(),0);
  store.admin.addSchoolGrade(ids.supervisor,{grade:4});await page.reload();await page.locator('select[name="grade"]').selectOption('4');await page.locator('form[method="get"]:has(select[name="grade"]) button').click();await page.locator('form[action="/admin/school/classes"] input[name="capacity"]').fill('10');
  await page.locator('form[action="/admin/school/classes"] input[name="name"]').fill('فصل الاختبار');await page.locator('form[action="/admin/school/classes"] button').click();
  assert.equal(store.admin.school(ids.supervisor).classes.length,1);
  for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:900});await page.goto(base+'/admin/school');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.locator('.school-class-edit summary').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:path.join(output,`school-ready-${width}.png`),fullPage:true});}
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({metrics,errors,controls:'>=44px',emptyAssignmentsHidden:true,createClass:true},null,2));console.log(JSON.stringify({metrics,errors}));
 }finally{if(browser)await browser.close();app.closeAllConnections();await new Promise(resolve=>app.close(resolve));store.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
