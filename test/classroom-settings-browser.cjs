// Real browser + isolated SQLite, synthetic identities only; no hosted writes.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path');
(async()=>{
 const {openStore}=await import('../store.mjs'),{createApp}=await import('../server.mjs');
 const {defaultPlan,validatePlan}=await import('../public/group-plan.js'),{initialState}=await import('../group-session.mjs');
 const {CLASSROOM_FEATURES}=await import('../public/classroom-features.js');
 const store=openStore(':memory:'),ids=store.admin.demo(),teacher=store.group.colleagues(store.user(ids.supervisor).scope)[0].id;
 const plan=validatePlan(defaultPlan()),code=store.group.startSession(teacher,plan,initialState(plan));
 const joined=store.group.join(code,'طالب تجريبي',30),app=createApp(store);
 await new Promise(r=>app.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 const errors=[];
 try{
  const context=async(id)=>{const c=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});await c.addCookies([{name:'ks',value:store.session(id),url:base}]);await c.addInitScript(()=>localStorage.setItem('gl-autostart','0'));return c;};
  const ac=await context(ids.supervisor),tc=await context(teacher),sc=await browser.newContext();
  await sc.addCookies([{name:'gl_'+code,value:joined.token,url:base+'/class/'+code}]);
  const admin=await ac.newPage(),t=await tc.newPage(),student=await sc.newPage();
  for(const p of [admin,t,student])p.on('pageerror',e=>errors.push(e.message));
  await admin.goto(base+'/admin/classroom');await t.goto(base+'/teach/live/'+code);await student.goto(base+'/class/'+code);
  await t.waitForFunction(()=>document.querySelector('#gl-status').textContent.includes('متصل'));
  await student.waitForFunction(()=>document.querySelector('#gl-status').textContent.includes('متصل'));
  assert.equal(await admin.locator('input[type=checkbox]').count(),CLASSROOM_FEATURES.length);
  const saved=JSON.stringify(store.group.session(code));
  for(const box of await admin.locator('input[type=checkbox]').all())await box.uncheck();
  await admin.getByRole('button',{name:'حفظ إعدادات الفصل والسبورة'}).click();await admin.waitForURL(/saved=1/);
  await t.waitForFunction(()=>document.documentElement.classList.contains('gl-off-board'));
  await student.waitForFunction(()=>document.documentElement.classList.contains('gl-off-hands'));
  for(const selector of ['#gl-board','#gl-voice','#gl-cam','#gl-library','#gl-pick','#gl-hand']){
   const page=selector==='#gl-hand'?student:t;assert.equal(await page.locator(selector).isVisible(),false,selector);
  }
  assert.equal(JSON.stringify(store.group.session(code)),saved,'settings must not erase the running lesson');
  // A manufactured click/direct command cannot restore a disabled function.
  assert.equal(await t.evaluate(async()=>{const r=await fetch(location.pathname+'/command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'timer',seconds:60})});return r.status;}),403);
  await t.reload();await t.waitForFunction(()=>document.documentElement.classList.contains('gl-off-board'));
  await admin.reload();assert.equal(await admin.locator('input:checked').count(),0);
  for(const box of await admin.locator('input[type=checkbox]').all())await box.check();
  await admin.getByRole('button',{name:'حفظ إعدادات الفصل والسبورة'}).click();await admin.waitForURL(/saved=1/);
  await t.waitForFunction(()=>!document.documentElement.classList.contains('gl-off-board'));
  assert.equal(await t.locator('#gl-board').isVisible(),true);
  assert.equal(await t.locator('#gl-voice').isVisible(),true);
  // Disable the current paragraph without disabling the board itself.
  await admin.locator('[name=feature_page]').uncheck();await admin.getByRole('button',{name:'حفظ إعدادات الفصل والسبورة'}).click();
  await t.waitForFunction(()=>document.querySelector('#gl-app').classList.contains('gl-section-disabled'));
  assert.equal(await t.locator('#gl-content').isVisible(),false);
  await t.locator('#gl-next').click();await t.waitForFunction(()=>document.querySelector('#gl-app').dataset.stepType==='interactive');
  assert.equal(await t.locator('#gl-content').isVisible(),true);
  await admin.setViewportSize({width:390,height:844});
  assert.equal(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile horizontal overflow');
  const out=process.env.SCIENCE_ARTIFACTS||'/workspace/classroom-preview';fs.mkdirSync(out,{recursive:true});
  await admin.screenshot({path:path.join(out,'classroom-administration.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: administrative permissions UI, all component switches, live teacher/student updates, direct-call denial, restored state, reload persistence and mobile layout');
 }finally{await browser.close();app.closeAllConnections();await new Promise(r=>app.close(r));store.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
