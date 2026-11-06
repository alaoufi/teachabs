const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

(async()=>{
 const {openStore}=await import('../store.mjs');
 const {createApp}=await import('../server.mjs');
 const store=openStore(':memory:'),ids=store.admin.demo(),app=createApp(store);
 await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.address().port;
 const output=process.env.ADMIN_QA_OUTPUT||path.resolve('../admin-lifecycle-verification-011');
 fs.mkdirSync(output,{recursive:true});
 let browser;
 try{
  browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox']});
  const context=await browser.newContext();
  await context.addCookies([{name:'ks',value:store.session(ids.supervisor),url:base}]);
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/admin/school');
  assert.equal(await page.locator('form[action="/admin/school/classes"]').count(),0);
  store.admin.addSchoolGrade(ids.supervisor,{grade:4});
  await page.reload();
  await page.locator('select[name="grade"]').selectOption('4');await page.locator('form[method="get"]:has(select[name="grade"]) button').click();
  await page.locator('form[action="/admin/school/classes"] input[name="capacity"]').fill('10');
  await page.locator('form[action="/admin/school/classes"] input[name="name"]').fill('أ');
  await page.locator('form[action="/admin/school/classes"] button').click();
  const classId=store.admin.school(ids.supervisor).classes[0].id;
  const card=()=>page.locator('[data-class-id="'+classId+'"]');
  const record=()=>store.admin.school(ids.supervisor).classes.find(c=>c.id===classId);
  await card().locator('summary').press('Enter');
  assert.equal(await card().locator('details').getAttribute('open'),'');
  await card().locator('form[action="/admin/school/classes/update"] input[name="name"]:not([type=hidden])').fill('ب');
  await card().locator('.school-class-edit > form[action="/admin/school/classes/update"] button').click();
  assert.equal(record().name,'ب');
  await card().locator('summary').click();
  await card().locator('.school-class-state button').click();
  assert.equal(record().state,'archived');
  assert.equal(await page.locator('form[action="/admin/school/teachers"]').count(),0);
  await page.reload();
  assert.equal(record().state,'archived');
  await card().locator('summary').click();
  await card().locator('.school-class-state button').click();
  assert.equal(record().state,'active');
  await page.locator('form[action="/admin/school/teachers"] button').click();
  const assignments=store.admin.school(ids.supervisor).teacherAssignments.length;
  assert.equal(assignments,1);
  await card().locator('summary').click();
  const rejected=page.waitForResponse(response=>response.url()===base+'/admin/school/classes/update'&&response.request().method()==='POST');
  await card().locator('.school-class-state button').click();
  assert.equal((await rejected).status(),409);
  assert.equal(record().state,'active');
  assert.equal(store.admin.school(ids.supervisor).teacherAssignments.length,assignments);
  await page.goto(base+'/admin/school');
  const widths=[320,390,768,1280];
  for(const width of widths){
   await page.setViewportSize({width,height:900});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'School width '+width);
   await card().locator('summary').press('Enter');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Expanded card width '+width);
   await page.screenshot({path:path.join(output,'school-lifecycle-'+width+'.png'),fullPage:true});
   await card().locator('summary').press('Enter');
  }
  assert.deepEqual(errors,[]);
  const result={create:true,rename:true,archive:true,restore:true,reload:true,archiveAssignedRejected:true,assignmentsPreserved:true,widths,keyboardDetails:true,errors};
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
 }finally{
  if(browser)await browser.close();
  app.closeAllConnections();await new Promise(resolve=>app.close(resolve));store.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
