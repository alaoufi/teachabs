import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createApp } from '../server.mjs';
import { openStore } from '../store.mjs';

test('الدخول والجولة وحدود صلاحية النموذج عبر HTTP',async t=>{
  const store=openStore(':memory:');
  const app=createApp(store);
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>app.close(resolve));store.close()});
  const origin='http://127.0.0.1:'+app.address().port;
  const get=(path,cookie='')=>fetch(origin+path,{headers:{cookie},redirect:'manual'});
  const post=(path,data,source=origin,cookie='')=>fetch(origin+path,{method:'POST',headers:{origin:source,cookie},body:new URLSearchParams(data),redirect:'manual'});
  const landing=await get('/');
  assert.match(await landing.text(),/خطوة/);
  assert.equal(landing.headers.get('referrer-policy'),'strict-origin');
  assert.equal((await get('/app')).status,303);
  assert.equal((await post('/tour',{},'https://other.example')).status,403);
  const tour=await post('/tour',{});
  assert.equal(tour.status,303);
  const session=tour.headers.get('set-cookie').split(';')[0];
  assert.match(await (await get('/app',session)).text(),/نورة/);
  assert.equal((await post('/teacher/slots',{minutes:30},origin,session)).status,403);
  assert.equal((await post('/tour/switch',{},origin,session)).status,303);
});

test('الخادم خلف وكيل HTTPS يقبل نطاق المشروع فقط ويصدر جلسة آمنة', async t => {
  const store = openStore(':memory:');
  const origin = 'https://khatwa.example';
  const app = createApp(store, {origin});
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => app.close(resolve)); store.close(); });
  function post(host, source) {
    return new Promise((resolve, reject) => {
      const req = request({
        hostname: '127.0.0.1', port: app.address().port, path: '/tour', method: 'POST',
        headers: {host, origin: source, 'content-type': 'application/x-www-form-urlencoded'}
      }, res => { res.resume(); res.on('end', () => resolve(res)); });
      req.on('error', reject);
      req.end();
    });
  }
  assert.equal((await post('other.example', origin)).statusCode, 403);
  assert.equal((await post('khatwa.example', 'https://other.example')).statusCode, 403);
  const accepted = await post('khatwa.example', origin);
  assert.equal(accepted.statusCode, 303);
  assert.match(accepted.headers['set-cookie'][0], /; Secure(?:;|$)/);
});
