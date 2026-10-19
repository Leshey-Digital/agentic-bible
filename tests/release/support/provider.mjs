// Controlled loopback provider in a separate process: the real upload CLI is synchronous.
import {createServer} from 'node:http';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {releaseTarget} from '../../../src/release/public.ts';
import {verifyCandidate} from '../../../src/release/artifact.ts';
import {publicPath} from '../../../src/release/controller.ts';
const [statePath,candidateRoot]=process.argv.slice(2),{candidate}=verifyCandidate(candidateRoot);
const base='/accounts/'+releaseTarget.account+'/workers/scripts/'+releaseTarget.worker;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const server=createServer(async(req,res)=>{try{
 const state=JSON.parse(readFileSync(statePath)),url=new URL(req.url,'http://127.0.0.1'),path=url.pathname;
 const save=()=>writeFileSync(statePath,JSON.stringify(state));
 const reply=(result,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify({success:status===200,result,errors:status===200?[]:[{code:10000,message:'Controlled failure after creation'}]}));};
 state.calls.push({method:req.method,path,query:url.search});save();
 if(path.startsWith('/public/')){
   if(path==='/public/api/runtime/status')return replyStatus();
   const key=Object.keys(candidate.assets).find(key=>'/public'+publicPath(key,candidate.buildId)===path);if(!key)throw Error('unknown public path');
   res.writeHead(key==='404.html'?404:200,{'X-Robots-Tag':'noindex, nofollow'});res.end(state.wrongBytes?'corrupt':readFileSync(join(candidateRoot,'assets',key)));return;
 }
 function replyStatus(){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({releaseCommit:candidate.sourceCommit,releaseManifestVerified:true,releaseManifestSha256:candidate.manifestSha256,releaseBuildId:candidate.buildId,releaseVerified:false,adminVerifierConfigured:true,integrationSettingsConfigured:true,publicIntake:false,gitHubProposalsConfigured:false,hostedCanonicalWrites:false,jevDispatchState:'not-mounted',jevDispatchConfigured:false,localFixtureIdentity:false}));}
 if(req.headers.authorization!=='Bearer controlled-cloudflare-token')throw Error('unexpected token');
 if(path==='/accounts/'+releaseTarget.account+'/workers/services/'+releaseTarget.worker&&req.method==='GET')return reply({default_environment:{script:{tag:'controlled-worker',tags:[],last_deployed_from:'wrangler'}}});
 if(!path.startsWith(base+'/'))throw Error('target escaped');
 const buffers=[];for await(const chunk of req)buffers.push(chunk);const bytes=Buffer.concat(buffers);
 if(path===base+'/assets-upload-session'&&req.method==='POST'){
   state.assetManifest=JSON.parse(bytes).manifest;save();return reply({jwt:'e30.'+Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.controlled',buckets:[]});
 }
 if(path===base+'/versions'&&req.method==='POST'){
   if(url.search!=='?bindings_inherit=strict')throw Error('wrong upload query');
   const form=await new Response(bytes,{headers:{'Content-Type':req.headers['content-type']}}).formData(),metadata=JSON.parse(form.get('metadata')),worker=Buffer.from(await form.get(metadata.main_module).arrayBuffer());
   const id=state.versions.length===0?'ffffffff-ffff-4fff-afff-ffffffffffff':'11111111-1111-4111-a111-111111111111';
   const bindings=metadata.bindings.map(binding=>binding.type==='inherit'?{...binding,type:'secret_text'}:binding);state.versions.push({id,annotations:metadata.annotations,resources:{bindings},workerSha256:hash(worker),uploadMetadata:metadata});save();
   if(state.versions.length===1){if(state.fault==='drop'){req.socket.destroy();return;}if(state.fault==='500')return reply(null,500);}
   return reply({id,metadata:{has_preview:false},startup_time_ms:1});
 }
 if(path===base+'/versions'&&req.method==='GET')return reply({items:state.reverse?[...state.versions].reverse():state.versions});
 if(path.startsWith(base+'/versions/')&&req.method==='GET'){const row=state.versions.find(v=>v.id===path.slice((base+'/versions/').length));return reply({...row,...state.detailOverrides?.[row?.id]});}
 if(path===base+'/deployments'){
   if(req.method==='GET')return reply({deployments:state.active?[state.active]:[]});
   if(req.method==='POST'){state.active=JSON.parse(bytes);state.activations++;save();return reply(state.active);}
 }
 if(path===base+'/settings'&&req.method==='GET')return reply({bindings:state.settingsOverride??[{name:'EDITORIAL_DB',type:'d1',id:'1ca9a6f8-c0a9-4040-8a2f-e22d888a985a'},{name:'HOSTED_ADMIN_TRUST',type:'secret_text'},{name:'INTEGRATION_VAULT_KEY',type:'secret_text'},{name:'INTEGRATION_VAULT_KEY_ID',type:'secret_text'}],tags:[]});
 if(path===base+'/secrets'&&req.method==='GET')return reply([{name:'HOSTED_ADMIN_TRUST'},{name:'INTEGRATION_VAULT_KEY'},{name:'INTEGRATION_VAULT_KEY_ID'}]);
 throw Error('unexpected provider call '+req.method+' '+path);
 }catch(error){process.stderr.write(String(error)+'\n');res.writeHead(500);res.end();}});
server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
