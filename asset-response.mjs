import {createHash} from 'node:crypto';
import {brotliCompress,gzip,constants} from 'node:zlib';
import {promisify} from 'node:util';
const br=promisify(brotliCompress),gz=promisify(gzip),compressed=new Map();
function encoding(header){
 const entries=String(header||'').split(',').map(v=>{const [name,...params]=v.trim().toLowerCase().split(';');const q=params.find(x=>x.trim().startsWith('q='));return [name,q?Number(q.trim().slice(2)):1];});
 const quality=name=>entries.find(x=>x[0]===name)?.[1]??entries.find(x=>x[0]==='*')?.[1]??0;
 return ['br','gzip'].filter(x=>quality(x)>0).sort((a,b)=>quality(b)-quality(a))[0];
}
export async function serveAsset(req,res,buffer,type,immutable=false){
 const hash=createHash('sha256').update(buffer).digest('hex'),codec=buffer.length>1024&&/javascript|text\/css/.test(type)?encoding(req.headers['accept-encoding']):null;
 const etag='"'+hash+'-'+(codec||'identity')+'"';
 res.setHeader('Content-Type',type);res.setHeader('Cache-Control',immutable?'public, max-age=31536000, immutable':'public, no-cache');res.setHeader('ETag',etag);res.setHeader('Vary','Accept-Encoding');
 if(codec)res.setHeader('Content-Encoding',codec);
 const matches=String(req.headers['if-none-match']||'').split(',').map(v=>v.trim().replace(/^W\//,''));
 if(matches.includes(etag)||matches.includes('*')){res.writeHead(304);return res.end();}
 let body=buffer;
 if(codec){const key=hash+'-'+codec;if(!compressed.has(key)){if(compressed.size>=64)compressed.delete(compressed.keys().next().value);compressed.set(key,codec==='br'?br(buffer,{params:{[constants.BROTLI_PARAM_QUALITY]:4}}):gz(buffer,{level:6}));}body=await compressed.get(key);}
 res.setHeader('Content-Length',body.length);res.writeHead(200);res.end(body);
}
