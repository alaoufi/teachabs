// A vertical video should use the width of a portrait phone without stretching.
// Generate a small real WebM in Chrome so the test also exercises loadedmetadata.
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function portraitClip(page) {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 90;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(15);
    const recorder = new MediaRecorder(stream, {mimeType:'video/webm'});
    const chunks = [];
    recorder.ondataavailable = event => chunks.push(event.data);
    const stopped = new Promise(resolve => { recorder.onstop = resolve; });
    recorder.start();
    for (const color of ['green','white','green']) {
      ctx.fillStyle = color;
      ctx.fillRect(0,0,90,160);
      await new Promise(resolve => setTimeout(resolve,90));
    }
    recorder.stop();
    await stopped;
    stream.getTracks().forEach(track => track.stop());
    return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
  });
  return {name:'portrait.webm',mimeType:'video/webm',buffer:Buffer.from(bytes)};
}

(async () => {
  const {openStore} = await import('../store.mjs');
  const {createApp} = await import('../server.mjs');
  const store = openStore(':memory:'), app = createApp(store,{simpleBoard:true});
  await new Promise(r => app.listen(0,'127.0.0.1',r));
  const base = 'http://127.0.0.1:' + app.address().port;
  const browser = await chromium.launch(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {});
  try {
    const phone = {viewport:{width:390,height:844},isMobile:true,hasTouch:true};
    const teacher = await browser.newPage(phone), student = await browser.newPage(phone);
    await teacher.goto(base+'/start/teacher');
    await teacher.getByRole('button',{name:'فتح السبورة'}).click();
    await teacher.waitForSelector('#gl-simple-dock #gl-file-pick');
    await student.goto(base+'/start/student');
    await student.locator('#gl-enter').click();
    await teacher.locator('#gl-file-input').setInputFiles(await portraitClip(teacher));
    for (const page of [teacher,student]) {
      await page.waitForFunction(() => {
        const video = document.querySelector('.gl-video-expanded #gl-material-layer video');
        if (!video?.videoHeight) return false;
        const rect = video.getBoundingClientRect();
        return rect.width>=innerWidth-2 && Math.abs(rect.width/rect.height-9/16)<0.01;
      });
    }
    const size = student.locator('#gl-video-size');
    await size.click();
    assert.equal(await size.getAttribute('aria-expanded'),'false');
    assert.equal(await teacher.locator('#gl-video-size').getAttribute('aria-expanded'),'true');
    await size.click();
    assert.equal(await size.getAttribute('aria-expanded'),'true');
    await teacher.locator('#gl-video-size').click();
    await teacher.locator('#gl-file-close').click();
    await student.locator('#gl-material-layer').waitFor({state:'hidden'});
    assert.equal(await student.locator('.gl-video-expanded').count(),0);
    console.log('Portrait video fits both phones, toggles independently, and restores the board on close.');
  } finally {
    await browser.close();
    app.closeAllConnections();
    await new Promise(resolve => app.close(resolve));
    store.close();
  }
})().catch(error => {console.error(error); process.exitCode=1;});
