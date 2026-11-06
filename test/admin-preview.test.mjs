import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {generateAssets,staticPage} from '../admin-preview-android/generate-assets.mjs';
const read=path=>readFileSync(new URL('../admin-preview-android/'+path,import.meta.url),'utf8');

test('offline APK generation uses only synthetic static pages and removes active actions',t=>{
 const dir=mkdtempSync(join(tmpdir(),'teachabs-preview-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const manifest=generateAssets(dir);
 assert.equal(manifest.mode,'offline-static-preview');assert.equal(manifest.network,false);assert.equal(manifest.persistence,false);assert.equal(manifest.syntheticDataOnly,true);
 assert.match(manifest.sourceRevision,/^[a-f0-9]{40}$/);assert.equal(typeof manifest.sourceDirty,'boolean');assert.equal(Object.keys(manifest.routes).filter(r=>r.startsWith('/admin')).length,19);
 for(const [file,sha] of Object.entries(manifest.files)){
  const value=readFileSync(join(dir,file),'utf8');assert.equal(createHash('sha256').update(value).digest('hex'),sha);
  if(file.endsWith('.html')){
   assert.match(value,/معاينة تصميم فقط/);assert.match(value,/لا حفظ ولا اتصال بخادم/);assert.match(value,/form-action 'none'/);
   assert.doesNotMatch(value,/<script\b|<form\b|\saction=|\son\w+=|type="hidden"|<iframe\b/i);
   assert.doesNotMatch(value,/<button\b(?![^>]*\bdisabled)[^>]*>/i);
   assert.doesNotMatch(value,/<(?:input|textarea|select)\b(?![^>]*\bdisabled)[^>]*>/i);
   for(const [,href] of value.matchAll(/href="([^"]+)"/g))assert.ok(href.startsWith('#')||manifest.routes[href],href);
   assert.doesNotMatch(value,/\/activate\?code=|onrender\.com|127\.0\.0\.1|<input[^>]*type="password"/);
  }else assert.doesNotMatch(value,/@import|url\(/i);
 }
 assert.deepEqual(readdirSync(dir).sort(),['pages','preview-manifest.json','styles']);
 const home=readFileSync(join(dir,manifest.routes['/admin']),'utf8');assert.equal((home.match(/class="adm-section-card"/g)||[]).length,10);
 assert.match(home,/«التعليم» لإدارة المعلمين ومواعيدهم/);
});

test('static preview fails closed for unsafe templates and disables external destinations',()=>{
 const safe=staticPage('<form method="post" action="/save" class="adm-form"><input type="hidden" name="secret" value="not-in-output"><input name="name"><button class="btn" type="submit">حفظ</button></form><a class="x" href="https://example.com/">خارجي</a><a href="/unknown">مفقود</a>',new Set());
 assert.doesNotMatch(safe,/not-in-output|href="https:|href="\/unknown"|<form/);
 assert.equal((safe.match(/aria-disabled="true"/g)||[]).length,2);
 assert.throws(()=>staticPage('<script>alert(1)</script>',new Set()));
 assert.throws(()=>staticPage('<div onclick="bad()">x</div>',new Set()));
});

test('Android preview is isolated, offline, without shared production build changes',()=>{
 const manifest=read('app/src/main/AndroidManifest.xml'),java=read('app/src/main/java/app/teachabs/adminpreview/PreviewActivity.java'),build=read('app/build.gradle');
 assert.doesNotMatch(manifest,/<uses-permission\b/);assert.match(manifest,/android:allowBackup="false"/);assert.match(manifest,/android:usesCleartextTraffic="false"/);
 assert.match(build,/applicationId 'app.teachabs.adminpreview.sidecar018'/);assert.match(build,/variant.enable = false/);
 for(const setting of ['setJavaScriptEnabled(false)','setAllowFileAccess(false)','setAllowContentAccess(false)','setBlockNetworkLoads(true)','setDomStorageEnabled(false)'])assert.ok(java.includes(setting));
 assert.match(java,/shouldInterceptRequest/);assert.match(java,/getAssets\(\).open\(path\)/);assert.match(java,/routes.has\(uri.getPath\(\)\)/);
 assert.doesNotMatch(java,/addJavascriptInterface|https:\/\/[^"+]*onrender|SslErrorHandler|requestPermissions/);
 const generator=read('generate-assets.mjs');assert.match(generator,/openStore\(':memory:'\)/);assert.doesNotMatch(generator,/process.env|DATABASE_URL|APP_ORIGIN/);
});
