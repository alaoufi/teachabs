import test from 'node:test';import assert from 'node:assert/strict';import {brotliDecompressSync,gunzipSync} from 'node:zlib';import {serveAsset} from '../asset-response.mjs';
async function request(bytes,headers={},immutable=false){const result={headers:{}};const res={setHeader:(k,v)=>result.headers[k]=v,writeHead:status=>result.status=status,end:body=>result.body=body};await serveAsset({headers},res,bytes,'text/javascript',immutable);return result;}
test('compressed assets negotiate encoding, revalidate and invalidate safely on content change',async()=>{
 const original=Buffer.from('const example = 123;\n'.repeat(300));const br=await request(original,{'accept-encoding':'br, gzip'});assert.deepEqual(brotliDecompressSync(br.body),original);assert.ok(br.body.length<original.length);assert.equal(br.headers.Vary,'Accept-Encoding');
 const gz=await request(original,{'accept-encoding':'br;q=0, gzip;q=1'});assert.deepEqual(gunzipSync(gz.body),original);assert.notEqual(gz.headers.ETag,br.headers.ETag);
 const identity=await request(original,{'accept-encoding':'br;q=0,gzip;q=0'});assert.equal(identity.headers['Content-Encoding'],undefined);assert.deepEqual(identity.body,original);
 const cached=await request(original,{'accept-encoding':'br','if-none-match':br.headers.ETag});assert.equal(cached.status,304);assert.equal(cached.body,undefined);
 const changed=await request(Buffer.concat([original,Buffer.from('/*v2*/')]),{'accept-encoding':'br','if-none-match':br.headers.ETag});assert.equal(changed.status,200);assert.notEqual(changed.headers.ETag,br.headers.ETag);assert.equal(changed.headers['Cache-Control'],'public, no-cache');
 assert.equal((await request(original,{},true)).headers['Cache-Control'],'public, max-age=31536000, immutable');
});
