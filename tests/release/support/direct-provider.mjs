import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {join} from 'node:path';import {randomUUID,webcrypto} from 'node:crypto';import {runInNewContext} from 'node:vm';
import {verifyCandidate,digest} from '../../../src/release/artifact.ts';import {publicPath} from '../../../src/release/controller.ts';import {releaseTarget} from '../../../src/release/public.ts';
import {connectorBridge,inspectBridgeRequest} from '../../../src/release/bridge.ts';
export async function invokeCapsule(code,remote){return await runInNewContext(code,{cloudflare:{request:req=>remote.transport.request(JSON.parse(JSON.stringify(req)))},crypto:webcrypto,atob,TextEncoder,TextDecoder,Uint8Array,FormData,Blob,AbortSignal,fetch:async(url,options)=>{assert.ok(url.startsWith('https://api.cloudflare.com/client/v4/accounts/c370be29e4065365de03bc8652da2cdc/workers/assets/upload?base64=true'));const req=new Request(url,options),r=await remote.transport.request({method:'POST',path:new URL(url).pathname.slice('/client/v4'.length),query:{base64:true},assetSessionJwt:req.headers.get('authorization').slice(7),contentType:req.headers.get('content-type'),rawBody:true,body:await req.text()});return Response.json({success:r.success,result:r.result},{status:r.status});}})();}
export function bridgePorts(repo,artifact,remote,expectedActive){
 const ports=connectorBridge(repo,join(repo,'.git','controlled-bridge-'+randomUUID()),artifact.candidate.sourceCommit,expectedActive,{read:remote.send,onRequest:({requestPath,requestDigest})=>{const {request,code}=inspectBridgeRequest(requestPath,requestDigest);invokeCapsule(code,remote).then(result=>writeFileSync(request.responsePath,JSON.stringify({nonce:request.nonce,requestDigest,result})),error=>writeFileSync(request.responsePath,JSON.stringify({nonce:request.nonce,requestDigest,result:{error:/^release_[a-z_]+$/.test(error.message)?error.message:'release_connector_outcome_unconfirmed'}})));}});ports.assertSource=remote.assertSource;return ports;
}
export function directProvider(initial){
 let expected=initial,session,received=new Map();const versions=new Map(),state={active:null,assetSessions:0,assetUploads:0,versions:0,activations:0,sourceChanged:false,loseVersion:false,loseActivation:false,badBuckets:false,calls:[],workerHashes:[]};
 const account='/accounts/'+releaseTarget.account,script=account+'/workers/scripts/'+releaseTarget.worker,worker=account+'/workers/workers/'+releaseTarget.worker;
 const transport={capabilities:{assetSessionAuthorization:true,rawMultipart:true},request:async req=>{
  state.calls.push({method:req.method,path:req.path});assert.ok(req.path.startsWith(account+'/workers/'));assert.equal(req.query?.force,undefined);let result;
  if(req.path===worker&&req.method==='GET')result={name:releaseTarget.worker,subdomain:{enabled:false,previews_enabled:false}};
  else if(req.path===script+'/assets-upload-session'){state.assetSessions++;session=req.body.manifest;received=new Map();result={jwt:'controlled-upload-session',buckets:[Object.values(session).map(x=>state.badBuckets?'unknown':x.hash)]};}
  else if(req.path===account+'/workers/assets/upload'){
   state.assetUploads++;assert.equal(req.assetSessionJwt,'controlled-upload-session');assert.deepEqual(req.query,{base64:true});assert.equal(req.rawBody,true);
   const boundary=req.contentType.split('boundary=')[1];for(const part of req.body.split('--'+boundary).slice(1,-1)){const [headers,...body]=part.replace(/^\r\n/,'').split('\r\n\r\n');const hash=/name="([a-f0-9]{32})"/.exec(headers)?.[1];assert.ok(hash);received.set(hash,Buffer.from(body.join('\r\n\r\n').replace(/\r\n$/,''),'base64'));}
   for(const [path,item]of Object.entries(session)){const bytes=received.get(item.hash);assert.equal(bytes?.length,item.size);assert.equal(digest(bytes),expected.candidate.assets[path.slice(1)].sha256);}
   result={jwt:'controlled-completion'};
  }else if(req.path===worker+'/versions'){
   assert.deepEqual(req.query,{deploy:false});assert.equal(req.body.assets.jwt,'controlled-completion');assert.deepEqual(req.body.bindings,[{type:'assets',name:'ASSETS'}]);
   const main=req.body.modules.find(m=>m.name==='worker.js');const hash=digest(Buffer.from(main.content_base64,'base64'));assert.equal(hash,expected.candidate.workerSha256);state.workerHashes.push(hash);
   for(const module of req.body.modules.filter(m=>m.name!=='worker.js'))assert.equal(digest(Buffer.from(module.content_base64,'base64')),expected.candidate.assets[module.name].sha256);
   const id=randomUUID();versions.set(id,{id,resources:{bindings:[{type:'assets',name:'ASSETS'}]},annotations:req.body.annotations,root:expected.root});state.versions++;if(state.loseVersion){state.loseVersion=false;throw Error('controlled lost create response');}result={id};
  }else if(req.path===script+'/versions')result={items:[...versions.values()].map(({id,annotations})=>({id,annotations}))};
  else if(req.path.startsWith(script+'/versions/'))result=versions.get(req.path.slice(req.path.lastIndexOf('/')+1));
  else if(req.path===script+'/deployments'&&req.method==='GET')result={deployments:state.active?[state.active]:[]};
  else if(req.path===script+'/deployments'&&req.method==='POST'){state.active={strategy:req.body.strategy,versions:req.body.versions,annotations:req.body.annotations};state.activations++;result=state.active;if(state.loseActivation){state.loseActivation=false;throw Error('controlled lost activation response');}}
  else throw Error('unexpected controlled connector request');return {status:200,success:true,result};
 }};
 const send=async req=>{const {pathname}=new URL(req.url),row=versions.get(state.active?.versions[0].version_id),root=row.root,{candidate}=verifyCandidate(root);if(pathname==='/api/runtime/status')return Response.json({releaseCommit:candidate.sourceCommit,releaseManifestVerified:true,releaseManifestSha256:candidate.manifestSha256,releaseBuildId:candidate.buildId,releaseVerified:false,publicIntake:false,gitHubProposalsConfigured:false,hostedCanonicalWrites:false});const path=Object.keys(candidate.assets).find(p=>publicPath(p,candidate.buildId)===pathname);return new Response(readFileSync(join(root,'assets',path)),{status:path==='404.html'?404:200,headers:{'X-Robots-Tag':'noindex, nofollow'}});};
 return {state,transport,send,use:a=>{expected=a;},assertSource:async()=>{if(state.sourceChanged)throw Error('controlled main changed');}};
}
