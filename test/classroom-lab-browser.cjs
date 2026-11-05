// Optional browser verification: PLAYWRIGHT_MODULE may point to an installed Playwright.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const {openStore}=await import('../store.mjs'),{createApp}=await import('../server.mjs');
 const db=openStore(':memory:'),app=createApp(db);await new Promise(r=>app.listen(0,'127.0.0.1',r));
 const base=process.env.TEST_BASE||'http://127.0.0.1:'+app.address().port;
 const output=process.env.LAB_ARTIFACTS||'../verification';fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  const context=await browser.newContext(),page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!==base)external.push(r.url());});
  page.on('dialog',d=>d.accept());await page.goto(base+'/classroom-lab');
  const board=page.locator('#lab-board');await page.locator('#lab-axes').click();assert.equal(await board.locator('line').count(),10);
  await page.locator('#lab-curve').click();assert.equal(await board.locator('polyline').count(),1);
  await page.locator('#lab-undo').click();assert.equal(await board.locator('polyline').count(),0);
  await page.locator('#lab-redo').click();assert.equal(await board.locator('polyline').count(),1);
  const box=await board.boundingBox();await page.mouse.move(box.x+80,box.y+90);await page.mouse.down();await page.mouse.move(box.x+150,box.y+140,{steps:8});await page.mouse.up();assert.equal(await board.locator('polyline').count(),2);
  for(const [tool,tag]of [['rect','rect'],['ellipse','ellipse']]){await page.locator('#lab-tool').selectOption(tool);await page.mouse.move(box.x+200,box.y+150);await page.mouse.down();await page.mouse.move(box.x+270,box.y+210);await page.mouse.up();assert.equal(await board.locator(tag).count(),1);}
  await page.locator('#lab-tool').selectOption('text');await page.locator('#lab-text').fill('شرح عربي <script>');await board.click({position:{x:100,y:100}});assert.ok((await board.textContent()).includes('شرح عربي <script>'));assert.equal(await board.locator('script').count(),0);
  const count=await board.locator(':scope > *').count();await page.locator('#lab-role').selectOption('student');await board.click();assert.equal(await board.locator(':scope > *').count(),count);assert.equal(await page.locator('#lab-axes').isDisabled(),true);
  await page.locator('#lab-role').selectOption('teacher');await page.locator('#lab-title').fill('اختبار الدالة');await page.locator('#lab-notes').fill('رسم ثم حفظ واستعادة');await page.locator('#lab-save').click();await page.reload();assert.equal(await board.locator(':scope > *').count(),count);assert.equal(await page.locator('#lab-notes').inputValue(),'رسم ثم حفظ واستعادة');
  const downloadPromise=page.waitForEvent('download');await page.locator('#lab-export').click();const download=await downloadPromise;const exported=path.join(output,'experiment.json');await download.saveAs(exported);
  await page.locator('#lab-clear').click();assert.equal(await board.locator(':scope > *').count(),0);await page.locator('#lab-import').setInputFiles(exported);await page.waitForFunction(n=>document.querySelector('#lab-board').children.length===n,count);assert.equal(await board.locator(':scope > *').count(),count);
  await page.locator('#lab-import').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"format":"bad"}')});await page.waitForFunction(()=>document.querySelector('#lab-status').textContent.includes('غير صالح'));assert.equal(await board.locator(':scope > *').count(),count);assert.match(await page.locator('#lab-status').textContent(),/غير صالح/);
  for(const width of [320,500,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:path.join(output,'classroom-lab-'+width+'.png'),fullPage:true});}
  const touchContext=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),touch=await touchContext.newPage();await touch.goto(base+'/classroom-lab');await touch.locator('#lab-board').scrollIntoViewIfNeeded();const tb=await touch.locator('#lab-board').boundingBox(),cdp=await touchContext.newCDPSession(touch);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tb.x+100,y:tb.y+100}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tb.x+180,y:tb.y+150}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await touch.locator('#lab-board polyline').count(),1);
  await page.locator('#lab-save').click();await page.goto(base+'/demo');assert.equal(await page.locator('a[href="/classroom-lab"]').count(),1);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify({base,draw:true,shapes:true,arabicText:true,undoRedo:true,studentPreviewReadonly:true,saveReload:true,exportImport:true,invalidImportPreserved:true,mobileTouch:true,widths:[320,500,1280],externalRequests:external,browserErrors:errors,physicalStylus:'not tested'},null,2));
 }finally{await browser.close();app.closeAllConnections();await new Promise(r=>app.close(r));db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
