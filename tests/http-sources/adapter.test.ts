import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Readable} from 'node:stream';
import type {ClientRequest,IncomingMessage} from 'node:http';
import {Agent} from 'node:https';
import {createHttpSourcePass,type HttpLastGood,type HttpResult} from '../../src/monitoring/http.ts';
import {httpSources,httpLimits,officialUrl,publicAddress,type PublicAddress} from '../../src/monitoring/http-policy.ts';
import {createNodeFetch} from '../../src/monitoring/http-node.ts';
import {sourceId} from '../../src/monitoring/catalog.ts';
import {fixtureTransport} from '../../src/monitoring/fixtures.ts';
import {readFileSync} from 'node:fs';

const source=httpSources[0];const address:PublicAddress={address:'1.1.1.1',family:4};const now=1_792_168_000_000;
const date='Thu, 01 Oct 2026 00:00:00 GMT';
const last:HttpLastGood={mode:'http',sourceId:source.id,hash:'a'.repeat(64),etag:'"v1"',lastModified:date,checkedAt:now-1000};
const resolve=async()=>[address];
const response=(body='Synthetic public documentation.',headers:Record<string,string>={})=>new Response(body,{headers:{'Content-Type':'text/html; charset=utf-8',...headers}});
function error(result:HttpResult,code:string,previous:HttpLastGood|null=last){assert.equal(result.ok,false);if(result.ok)throw new Error('Expected a rejected observation');assert.equal(result.error.code,code);assert.deepEqual(result.state,previous);}

test('six exact official document IDs agree with the built catalog; URL/credential/private variants never resolve or fetch',async()=>{
  const catalog=JSON.parse(readFileSync('dist/source-catalog.json','utf8'));assert.equal(httpSources.length,6);
  for(const item of httpSources){assert.equal(await sourceId(item.url),item.id);assert.ok(catalog.sources.some((entry:{id:string;url:string})=>entry.id===item.id&&entry.url===item.url));assert.equal(officialUrl(item.url)?.href,item.url);}
  let calls=0;const pass=createHttpSourcePass({resolve:async()=>{calls++;return [address];},fetch:async()=>{calls++;return response();}});
  for(const id of ['http://127.0.0.1/','https://169.254.169.254/','https://user:secret@platform.claude.com/','https://platform.claude.com.evil.invalid/','https://platform.claude.com:444/','file:///etc/passwd',source.url,source.url+'?token=secret',{},'s-unknown'])error(await pass.check(id),'source_not_allowlisted',null);
  for(const url of [source.url+'#x',source.url+'?x=1',source.url.replace('https:','http:'),source.url.replace('platform.claude.com','127.0.0.1')])assert.equal(officialUrl(url),null);
  error(await pass.check(source.id,{...last,authorization:'secret'}),'invalid_last_good_state',null);
  error(await pass.check(source.id,{...last,mode:'fixture'}),'invalid_last_good_state',null);
  error(await pass.check(source.id,{...last,hash:'a'.repeat(63)+'\n'}),'invalid_last_good_state',null);
  assert.equal(calls,0);assert.equal(pass.requestsUsed(),0);
});

test('public-address policy rejects private, link-local, metadata, mapped/tunnel/documentation and mixed DNS answers',async()=>{
  for(const ip of ['0.0.0.0','10.0.0.1','127.0.0.1','169.254.169.254','172.31.1.1','192.168.0.1','100.100.100.200','192.0.2.1','198.18.0.1','203.0.113.1','224.0.0.1','255.255.255.255','168.63.129.16'])assert.equal(publicAddress({address:ip,family:4}),false,ip);
  for(const ip of ['::','::1','::ffff:127.0.0.1','::ffff:8.8.8.8','64:ff9b::808:808','fc00::1','fe80::1','ff02::1','2001:db8::1','2001::1','2002:7f00:1::','3fff::1','2606:4700::1%eth0'])assert.equal(publicAddress({address:ip,family:6}),false,ip);
  assert.equal(publicAddress(address),true);assert.equal(publicAddress({address:'2606:4700:4700::1111',family:6}),true);assert.equal(publicAddress({address:'1.1.1.1',family:6}),false);
  let fetches=0;
  for(const answers of [[],[{address:'127.0.0.1',family:4}],[address,{address:'::1',family:6}],Array(9).fill(address),Array(2)]){
    const pass=createHttpSourcePass({resolve:async()=>answers as PublicAddress[],fetch:async()=>{fetches++;return response();}});
    error(await pass.check(source.id,last),'dns_not_public');assert.equal(pass.requestsUsed(),1);
  }
  assert.equal(fetches,0);
});

test('conditional requests prefer ETag, accept evidenced 304 and preserve or validate replacement validators',async()=>{
  const pass=createHttpSourcePass({resolve,clock:()=>now,fetch:async(url,options)=>{
    assert.equal(url,source.url);assert.equal(options.redirect,'manual');assert.deepEqual(options.address,address);assert.equal(options.headers.get('If-None-Match'),'"v1"');assert.equal(options.headers.has('If-Modified-Since'),false);assert.equal(options.headers.has('Authorization'),false);assert.equal(options.headers.has('Cookie'),false);return new Response(null,{status:304,headers:{ETag:'W/"v2"'}});
  }});
  const result=await pass.check(source.id,last);assert.equal(result.ok,true);if(result.ok){assert.equal(result.observation.kind,'not-modified');assert.equal(result.observation.bytes,0);assert.deepEqual(result.state,{...last,etag:'W/"v2"',checkedAt:now});}
  const modified={...last,etag:null};const datePass=createHttpSourcePass({resolve,fetch:async(_,options)=>{assert.equal(options.headers.get('If-Modified-Since'),date);return new Response(null,{status:304});}});assert.equal((await datePass.check(source.id,modified)).ok,true);
  error(await createHttpSourcePass({resolve,fetch:async()=>new Response(null,{status:304})}).check(source.id),'unexpected_not_modified',null);
  const noValidators={...last,etag:null,lastModified:null};error(await createHttpSourcePass({resolve,fetch:async()=>new Response(null,{status:304})}).check(source.id,noValidators),'unexpected_not_modified',noValidators);
  error(await createHttpSourcePass({resolve,fetch:async()=>new Response(null,{status:304,headers:{ETag:'bad'}})}).check(source.id,last),'invalid_validator');
});

test('200 returns hash-only baseline/same/change metadata; input is snapshotted and failures keep last-good timestamp',async()=>{
  const pass=createHttpSourcePass({resolve,clock:()=>now,fetch:async()=>response('Synthetic source text, never retained.',{ETag:'"new"','Last-Modified':date})});
  const first=await pass.check(source.id);assert.equal(first.ok,true);if(!first.ok)throw new Error('baseline');assert.equal(first.observation.kind,'baseline');assert.equal(first.state.hash.length,64);assert.equal(JSON.stringify(first).includes('never retained'),false);
  const same=await pass.check(source.id,first.state);assert.equal(same.ok,true);if(same.ok)assert.equal(same.observation.kind,'unchanged');
  const changed=await pass.check(source.id,last);assert.equal(changed.ok,true);if(changed.ok)assert.equal(changed.observation.kind,'changed');assert.equal(last.checkedAt,now-1000);
  let release!:(value:PublicAddress[])=>void;const input={...last};const captured=createHttpSourcePass({clock:()=>now,resolve:()=>new Promise(resolve=>{release=resolve;}),fetch:async(_,options)=>{assert.equal(options.headers.get('If-None-Match'),'"v1"');return new Response(null,{status:304});}});
  const pending=captured.check(source.id,input);input.etag='"mutated"';release([address]);const saved=await pending;assert.equal(saved.ok,true);if(saved.ok)assert.equal(saved.state.etag,'"v1"');
});

test('redirects, unexpected final URLs and HTTP failures cancel without following or replacing last good state',async()=>{
  let fetches=0;let cancelled=0;
  for(const status of [301,302,303,307,308,401,404,408,429,500]){
    const pass=createHttpSourcePass({resolve,fetch:async()=>{fetches++;return new Response(new ReadableStream({cancel(){cancelled++;}}),{status,headers:{Location:'http://169.254.169.254/private'}});}});
    const result=await pass.check(source.id,last);error(result,status<400?'redirect_blocked':'http_'+status);if(!result.ok)assert.equal(result.error.retryable,[408,429,500].includes(status));assert.equal(pass.requestsUsed(),1);
  }
  assert.equal(fetches,10);assert.equal(cancelled,10);
  const final=response();Object.defineProperty(final,'url',{value:'http://127.0.0.1/'});error(await createHttpSourcePass({resolve,fetch:async()=>final}).check(source.id,last),'redirect_blocked');
  const followed=response();Object.defineProperty(followed,'redirected',{value:true});error(await createHttpSourcePass({resolve,fetch:async()=>followed}).check(source.id,last),'redirect_blocked');
});

test('media, encoding, validator, empty/malformed and declared/streamed size failures preserve last good state',async()=>{
  const cases:[()=>Response,string][]=[
    [()=>response('x',{'Content-Type':'image/svg+xml'}),'unsupported_content_type'],
    [()=>response('x',{'Content-Type':'text/html;charset=iso-8859-1'}),'unsupported_content_type'],
    [()=>response('x',{'Content-Type':'text/html;charset=utf-8;charset=latin1'}),'unsupported_content_type'],
    [()=>response('x',{'Content-Encoding':'gzip'}),'unsupported_content_encoding'],
    [()=>response('x',{ETag:'invalid'}),'invalid_validator'],
    [()=>response('x',{'Last-Modified':'2026-10-01'}),'invalid_validator'],
    [()=>response(''),'empty_body'],
    [()=>new Response(new Uint8Array([0xff]),{headers:{'Content-Type':'text/plain'}}),'malformed_body'],
    [()=>response('{bad',{'Content-Type':'application/json'}),'malformed_body'],
    [()=>response('x',{'Content-Length':String(httpLimits.bodyBytes+1)}),'body_too_large'],
    [()=>response('x',{'Content-Length':'1,1'}),'invalid_content_length'],
    [()=>response('two',{'Content-Length':'2'}),'content_length_mismatch'],
    [()=>response('x'.repeat(httpLimits.bodyBytes+1)),'body_too_large'],
  ];
  for(const [make,code] of cases)error(await createHttpSourcePass({resolve,fetch:async()=>make()}).check(source.id,last),code);
  let cancelled=false;const stream=new ReadableStream<Uint8Array>({start(c){c.enqueue(new Uint8Array(httpLimits.bodyBytes));c.enqueue(new Uint8Array(1));},cancel(){cancelled=true;}});
  error(await createHttpSourcePass({resolve,fetch:async()=>new Response(stream,{headers:{'Content-Type':'text/plain'}})}).check(source.id,last),'body_too_large');assert.equal(cancelled,true);
  assert.equal((await createHttpSourcePass({resolve,fetch:async()=>response('x'.repeat(httpLimits.bodyBytes))}).check(source.id)).ok,true);
});

test('four reservations are atomic across concurrent checks, include failures, and never retry implicitly',async()=>{
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let calls=0;
  const pass=createHttpSourcePass({resolve,fetch:async()=>{calls++;await gate;return response();}});
  const pending=httpSources.slice(0,4).map(item=>pass.check(item.id));assert.equal(pass.requestsUsed(),4);error(await pass.check(source.id,last),'http_pass_budget');release();assert.equal((await Promise.all(pending)).every(result=>result.ok),true);assert.equal(calls,4);
  const failed=createHttpSourcePass({resolve,fetch:async()=>{throw new Error('upstream diagnostic must not escape');}});for(let i=0;i<4;i++)error(await failed.check(source.id,last),'http_network_failed');error(await failed.check(source.id,last),'http_pass_budget');assert.equal(failed.requestsUsed(),4);
});

test('external abort stops late DNS before connection and cancels a late response body',async()=>{
  let releaseDns!:(value:PublicAddress[])=>void;let calls=0;const controller=new AbortController();
  const pass=createHttpSourcePass({resolve:()=>new Promise(resolve=>{releaseDns=resolve;}),fetch:async()=>{calls++;return response();}});
  const pending=pass.check(source.id,last,controller.signal);controller.abort();error(await pending,'http_aborted');releaseDns([address]);await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,0);
  let releaseFetch!:(response:Response)=>void;let cancelled=false;const second=new AbortController();const late=createHttpSourcePass({resolve,fetch:()=>new Promise(resolve=>{releaseFetch=resolve;})});
  const checking=late.check(source.id,last,second.signal);await new Promise(resolve=>setImmediate(resolve));second.abort();error(await checking,'http_aborted');releaseFetch(new Response(new ReadableStream({cancel(){cancelled=true;}})));await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelled,true);
});

test('actual total deadline bounds uncooperative fetch, slow body and DNS without later dispatch',async()=>{
  error(await createHttpSourcePass({resolve,fetch:()=>new Promise(()=>{})}).check(source.id,last),'http_timeout');
  let cancelled=false;const stream=new ReadableStream<Uint8Array>({start(c){c.enqueue(new TextEncoder().encode('partial'));},cancel(){cancelled=true;}});
  error(await createHttpSourcePass({resolve,fetch:async()=>new Response(stream,{headers:{'Content-Type':'text/plain'}})}).check(source.id,last),'http_timeout');assert.equal(cancelled,true);
  let release!:(value:PublicAddress[])=>void;let calls=0;const pass=createHttpSourcePass({resolve:()=>new Promise(resolve=>{release=resolve;}),fetch:async()=>{calls++;return response();}});
  error(await pass.check(source.id,last),'http_timeout');release([address]);await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,0);
});

test('native HTTPS transport uses the public pin, original SNI/TLS, no proxy or credentials, and bounded headers',async()=>{
  type Sender=NonNullable<Parameters<typeof createNodeFetch>[0]>;
  let called=0;
  const send:Sender=(url,options,listener)=>{
    called++;assert.equal(url.href,source.url);assert.equal(options.method,'GET');assert.equal(options.servername,url.hostname);assert.equal(options.rejectUnauthorized,true);assert.equal(options.family,4);assert.equal(options.maxHeaderSize,8192);
    const agent=options.agent as Agent;assert.deepEqual(agent.options.proxyEnv,{});assert.equal(agent.options.keepAlive,false);assert.equal(agent.options.maxCachedSessions,0);
    options.lookup!(url.hostname,{family:4,all:false},(error,address,family)=>{assert.equal(error,null);assert.equal(address,'1.1.1.1');assert.equal(family,4);});
    options.lookup!('evil.invalid',{family:4,all:false},error=>assert.ok(error));
    const req=new EventEmitter() as ClientRequest;req.end=(()=>{queueMicrotask(()=>listener(Object.assign(Readable.from([Buffer.from('Synthetic HTTPS body')]),{statusCode:200,headers:{'content-type':'text/plain'}}) as IncomingMessage));return req;}) as ClientRequest['end'];return req;
  };
  const result=await createHttpSourcePass({resolve,fetch:createNodeFetch(send)}).check(source.id);assert.equal(result.ok,true);assert.equal(called,1);
  await assert.rejects(createNodeFetch(send)('https://127.0.0.1/',{address,redirect:'manual',signal:new AbortController().signal,headers:new Headers()}));assert.equal(called,1);
  for(const name of ['Authorization','Cookie','Host','Proxy-Authorization'])await assert.rejects(createNodeFetch(send)(source.url,{address,redirect:'manual',signal:new AbortController().signal,headers:new Headers({[name]:'synthetic-rejected-value'})}));
  await assert.rejects(createNodeFetch(send)(source.url,{address,redirect:'manual',signal:new AbortController().signal,headers:new Headers({'User-Agent':'x'.repeat(1025)})}));assert.equal(called,1);
});

test('native transport rejects malformed upstream status/headers and thrown diagnostics without escaping source data',async()=>{
  type Sender=NonNullable<Parameters<typeof createNodeFetch>[0]>;
  for(const mode of ['status','header','throw']){
    const send:Sender=(_,_options,listener)=>{
      if(mode==='throw')throw new Error('synthetic credential diagnostic');
      const req=new EventEmitter() as ClientRequest;req.end=(()=>{queueMicrotask(()=>listener(Object.assign(Readable.from([]),{statusCode:mode==='status'?700:200,headers:{'content-type':mode==='header'?'text/plain\nsecret':'text/plain'}}) as IncomingMessage));return req;}) as ClientRequest['end'];return req;
    };
    const result=await createHttpSourcePass({resolve,fetch:createNodeFetch(send)}).check(source.id,last);error(result,'http_network_failed');assert.equal(JSON.stringify(result).includes('secret'),false);assert.equal(JSON.stringify(result).includes('credential'),false);
  }
});

test('native transport rejects a private or changed connected peer even after a public DNS pin',async()=>{
  type Sender=NonNullable<Parameters<typeof createNodeFetch>[0]>;
  for(const remoteAddress of ['127.0.0.1','8.8.8.8']){
    const send:Sender=()=>{
      const req=new EventEmitter() as ClientRequest;req.destroy=((error?:Error)=>{req.emit('error',error);return req;}) as ClientRequest['destroy'];
      req.end=(()=>{queueMicrotask(()=>{const socket=Object.assign(new EventEmitter(),{remoteAddress});req.emit('socket',socket);socket.emit('secureConnect');});return req;}) as ClientRequest['end'];return req;
    };
    error(await createHttpSourcePass({resolve,fetch:createNodeFetch(send)}).check(source.id,last),'http_network_failed');
  }
});

test('fixture transport and Worker imports stay isolated from the HTTP implementation',async()=>{
  assert.equal(fixtureTransport.mode,'fixture');const fixture=await fixtureTransport.fetch('https://example.invalid/',{headers:new Headers(),redirect:'manual',signal:new AbortController().signal,scenario:'baseline',attempt:1});assert.ok((await fixture.text()).startsWith('Synthetic fixture'));
  for(const file of ['src/editorial/worker.ts','src/monitoring/routes.ts','src/monitoring/runner.ts','src/monitoring/batch.ts'])assert.equal(/from ['"].*http(?:-node|-policy)?(?:\.ts)?['"]/.test(readFileSync(file,'utf8')),false,file);
});
