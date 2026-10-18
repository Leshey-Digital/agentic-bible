import {readFileSync} from 'node:fs';import {join} from 'node:path';
import {verifyCandidate,canonical} from './artifact.ts';import {directUploadPlan} from './direct.ts';import {releaseTarget} from './public.ts';
// Serialized with no Node dependency. The tool's native fetch handles only the
// short-lived asset JWT; account API authority stays in cloudflare.request().
async function uploadCapsule(payload:any,cloudflare:any){
 const account='/accounts/c370be29e4065365de03bc8652da2cdc',script=account+'/workers/scripts/agentic-bible-staging',worker=account+'/workers/workers/agentic-bible-staging';
 const sha=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const bytes=(s:string)=>Uint8Array.from(atob(s),x=>x.charCodeAt(0));let calls=0;
 const api=async(method:'GET'|'POST',path:string,body?:unknown,query?:Record<string,boolean>)=>{if(++calls>12)throw Error('release_connector_upload_budget');const r=await cloudflare.request({method,path,...(body?{body}:{}),...(query?{query}:{})});if(!r.success||![200,201].includes(r.status))throw Error('release_connector_upload_unconfirmed');return r.result;};
 const active=async()=>{const r=await api('GET',script+'/deployments'),list=r.deployments??r;if(!Array.isArray(list)||list.length>100)throw Error('release_deployments_response');if(!list.length)return null;if(list[0].strategy!=='percentage'||list[0].versions?.length!==1||list[0].versions[0].percentage!==100)throw Error('release_split_traffic_unsupported');return list[0].versions[0].version_id;};
 if(payload.target.account!=='c370be29e4065365de03bc8652da2cdc'||payload.target.worker!=='agentic-bible-staging'||payload.target.origin!=='https://staging.agenticbible.si'||!/^ab-candidate:[a-f0-9]{64}:[a-f0-9-]{36}$/.test(payload.version.annotations['workers/message']))throw Error('release_capsule_target');
 if(await sha(new TextEncoder().encode(payload.candidateRaw))!==payload.candidateDigest)throw Error('release_capsule_candidate_digest');const candidate=JSON.parse(payload.candidateRaw);
 if(await sha(new TextEncoder().encode(payload.configRaw))!==candidate.configSha256)throw Error('release_capsule_config');const config=JSON.parse(payload.configRaw);
 if(JSON.stringify(Object.keys(payload.inventory).sort())!==JSON.stringify(Object.keys(candidate.assets).sort())||payload.version.main_module!=='worker.js'||payload.version.bindings?.length!==1||payload.version.bindings[0].name!=='ASSETS'||payload.version.bindings[0].type!=='assets'||payload.version.compatibility_date!==config.compatibility_date||JSON.stringify(payload.version.assets.config)!==JSON.stringify({html_handling:config.assets.html_handling,not_found_handling:config.assets.not_found_handling,run_worker_first:config.assets.run_worker_first}))throw Error('release_capsule_config');
 for(const [path,item]of Object.entries(payload.inventory) as [string,any][]){const data=bytes(item.content),pin=candidate.assets[path];if(data.length!==pin.bytes||await sha(data)!==pin.sha256)throw Error('release_capsule_bytes');if(path==='_headers'&&!new TextDecoder().decode(data).startsWith('/*\n  X-Robots-Tag: noindex, nofollow\n'))throw Error('release_capsule_noindex');}
 const names=payload.version.modules.map((m:any)=>m.name).sort(),required=['worker.js',...['_headers','_redirects'].filter(p=>candidate.assets[p])].sort();if(JSON.stringify(names)!==JSON.stringify(required))throw Error('release_capsule_modules');
 for(const m of payload.version.modules)if(await sha(bytes(m.content_base64))!==(m.name==='worker.js'?candidate.workerSha256:candidate.assets[m.name].sha256))throw Error('release_capsule_worker_bytes');
 if(JSON.stringify(Object.keys(payload.version).sort())!==JSON.stringify(['annotations','assets','bindings','compatibility_date','compatibility_flags','main_module','modules'])||JSON.stringify(payload.version.compatibility_flags)!=='[]'||JSON.stringify(Object.keys(payload.version.assets))!==JSON.stringify(['config']))throw Error('release_capsule_config');
 for(const m of payload.version.modules)if(JSON.stringify(Object.keys(m).sort())!==JSON.stringify(['content_base64','content_type','name'])||m.content_type!==(m.name==='worker.js'?'application/javascript+module':'text/plain'))throw Error('release_capsule_modules');
 if(payload.version.annotations['workers/message']!=='ab-candidate:'+payload.candidateDigest+':'+payload.requestId)throw Error('release_capsule_marker');
 if(JSON.stringify(Object.keys(payload.manifest).sort())!==JSON.stringify(Object.keys(candidate.assets).filter(p=>!['_headers','_redirects'].includes(p)).map(p=>'/'+p).sort()))throw Error('release_capsule_manifest');
 for(const [path,item]of Object.entries(payload.manifest) as [string,any][]){const pin=payload.inventory[path.slice(1)],file=payload.files[item.hash],name=path.slice(path.lastIndexOf('/')+1),ext=name.includes('.')?name.slice(name.lastIndexOf('.')+1):'';if(!pin||item.size!==candidate.assets[path.slice(1)].bytes||file?.content!==pin.content||(await sha(new TextEncoder().encode(pin.content+ext))).slice(0,32)!==item.hash)throw Error('release_capsule_manifest');}
 for(const file of Object.values(payload.files) as any[]){const name=file.path,ext=name.includes('.')?name.slice(name.lastIndexOf('.')):'',mime=({'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.wasm':'application/wasm','.svg':'image/svg+xml','.txt':'text/plain','.woff2':'font/woff2','.png':'image/png','.ico':'image/x-icon'} as Record<string,string>)[ext]??'application/octet-stream';if(file.contentType!==mime)throw Error('release_capsule_content_type');}
 if(JSON.stringify(Object.keys(payload.version.annotations).sort())!==JSON.stringify(['workers/message','workers/tag'])||payload.version.annotations['workers/tag']!==payload.candidateDigest.slice(0,32))throw Error('release_capsule_marker');
 const metadata=await api('GET',worker);if(metadata.name!=='agentic-bible-staging'||metadata.subdomain?.enabled!==false||metadata.subdomain?.previews_enabled!==false)throw Error('release_closed_previews_required');
 if(await active()!==payload.expectedActive)throw Error('release_active_changed');
 const session=await api('POST',script+'/assets-upload-session',{manifest:payload.manifest});
 const jwt=(s:unknown):s is string=>typeof s==='string'&&s.length>0&&s.length<=8192&&!/\s/.test(s);
 if(!jwt(session.jwt)||!Array.isArray(session.buckets)||session.buckets.length>8)throw Error('release_assets_session_invalid');
 const hashes=session.buckets.flat();if(session.buckets.some((b:any)=>!Array.isArray(b)||!b.length)||hashes.some((h:any)=>typeof h!=='string'||!/^[a-f0-9]{32}$/.test(h)||!Object.hasOwn(payload.files,h))||new Set(hashes).size!==hashes.length)throw Error('release_assets_bucket_conflict');
 let completion:string|null=session.buckets.length?null:session.jwt;
 for(const bucket of session.buckets){const form=new FormData();for(const h of bucket){const f=payload.files[h];form.append(h,new Blob([f.content],{type:f.contentType}),h);}
  // Tokens never leave this execution, including failures. No account credential
  // is copied to native fetch, and neither upload nor completion JWT is returned.
  const r=await fetch('https://api.cloudflare.com/client/v4'+account+'/workers/assets/upload?base64=true',{method:'POST',headers:{Authorization:'Bearer '+session.jwt},body:form,redirect:'manual',signal:AbortSignal.timeout(10000)});
  if(r.status===401)throw Error('release_assets_upload_unauthorized');if(![200,201].includes(r.status))throw Error('release_assets_upload_unconfirmed');const text=await r.text();if(text.length>262144)throw Error('release_assets_response_capacity');const value=JSON.parse(text);if(value.success!==true)throw Error('release_assets_upload_unconfirmed');if(value.result?.jwt!==undefined){if(!jwt(value.result.jwt))throw Error('release_assets_completion_invalid');completion=value.result.jwt;}
 }
 if(!completion)throw Error('release_assets_completion_required');if(await active()!==payload.expectedActive)throw Error('release_active_changed');
 const version=await api('POST',worker+'/versions',{...payload.version,assets:{...payload.version.assets,jwt:completion}},{deploy:false});
 if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(version.id))throw Error('release_upload_unconfirmed');
 return {versionId:version.id,candidateDigest:payload.candidateDigest,requestId:payload.requestId};
}
export function uploadConnectorCode(root:string,id:string,requestId:string,expectedActive:string|null){
 const {candidate}=verifyCandidate(root,id),plan=directUploadPlan(root,id,requestId);
 const inventory=Object.fromEntries(Object.entries(candidate.assets).map(([path,item])=>[path,{...item,content:readFileSync(join(root,'assets',path)).toString('base64')}]));
 // Avoid duplicate base64 content: upload files/modules refer to inventory entries
 // at execution time, keeping the actual current candidate below the tested limit.
 const compressedPlan={...plan,files:Object.fromEntries(Object.entries(plan.files).map(([hash,file])=>[hash,{contentType:file.contentType,path:Object.keys(plan.manifest).find(p=>plan.manifest[p].hash===hash)!.slice(1)}])),version:{...plan.version,modules:plan.version.modules.map(m=>m.name==='worker.js'?m:{...m,content_base64:undefined})}};
 const payload={...compressedPlan,inventory,candidateRaw:readFileSync(join(root,'candidate.json'),'utf8'),configRaw:readFileSync(join(root,'wrangler.json'),'utf8'),target:releaseTarget,candidateDigest:id,requestId,expectedActive};
 const source=uploadCapsule.toString().replace(/^async function uploadCapsule/,'async function');
 const code='async()=>{try{const p='+canonical(payload).trim()+';for(const f of Object.values(p.files))f.content=p.inventory[f.path].content;for(const m of p.version.modules)if(m.name!=="worker.js")m.content_base64=p.inventory[m.name].content;return await ('+source+')(p,cloudflare);}catch(e){throw Error(/^release_[a-z_]+$/.test(String(e?.message))?e.message:"release_connector_upload_unconfirmed");}}';
 if(Buffer.byteLength(code)>2*1024*1024-4096)throw Error('release_connector_capsule_capacity');return code;
}
async function controlCapsule(req:any,expectedActive:string|null|undefined,cloudflare:any){
 try{
  const base='/accounts/c370be29e4065365de03bc8652da2cdc/workers/scripts/agentic-bible-staging';
  if(req.method==='POST'){
   if(expectedActive===undefined||req.path!==base+'/deployments'||req.body?.strategy!=='percentage'||req.body.versions?.length!==1||req.body.versions[0].percentage!==100)throw Error('release_activation_input');
   const r=await cloudflare.request({method:'GET',path:base+'/deployments'});if(!r.success||r.status!==200)throw Error('release_connector_control_unconfirmed');const list=r.result.deployments??r.result;
   if(!Array.isArray(list)||list.length>100||list.length&&(list[0].strategy!=='percentage'||list[0].versions?.length!==1||list[0].versions[0].percentage!==100))throw Error('release_split_traffic_unsupported');
   const current=list.length?list[0].versions[0].version_id:null,operation=req.body.annotations?.['workers/message'];if(!/^ab-release:[a-f0-9-]{36}:[a-f0-9]{64}$/.test(operation??''))throw Error('release_activation_input');
   if(current===req.body.versions[0].version_id&&list[0]?.annotations?.['workers/message']===operation)return {status:200,success:true,result:{}};
   if(current!==expectedActive)throw Error('release_active_changed');
   const v=await cloudflare.request({method:'GET',path:base+'/versions/'+req.body.versions[0].version_id}),bindings=v.result?.resources?.bindings??v.result?.bindings,message=(v.result?.annotations??v.result?.metadata?.annotations??{})['workers/message'];
   if(!v.success||v.status!==200||bindings?.length!==1||bindings[0].name!=='ASSETS'||bindings[0].type!=='assets'||!String(message??'').startsWith('ab-candidate:'+operation.split(':')[2]+':'))throw Error('release_version_binding');
  }
  const r=await cloudflare.request(req);
  const strip=(v:any)=>{const message=(v.annotations??v.metadata?.annotations??{})['workers/message']??'';return {id:v.id,strategy:v.strategy,versions:v.versions,annotations:{'workers/message':/^(ab-candidate:[a-f0-9]{64}:[a-f0-9-]{36}|ab-release:[a-f0-9-]{36}:[a-f0-9]{64})$/.test(message)?message:''},resources:{bindings:(v.resources?.bindings??v.bindings??[]).map((b:any)=>({name:b.name==='ASSETS'&&b.type==='assets'?'ASSETS':'UNREVIEWED',type:b.type==='assets'?'assets':'unreviewed'}))}};};
  const x=r.result;return {status:r.status,success:r.success,result:Array.isArray(x)?x.map(strip):x?.items?{items:x.items.map(strip)}:x?.deployments?{deployments:x.deployments.map(strip)}:strip(x??{})};
 }catch(e){throw Error(/^release_[a-z_]+$/.test(String((e as Error)?.message))?(e as Error).message:'release_connector_control_unconfirmed');}
}
export function controlConnectorCode(path:string,body?:any,expectedActive?:string|null){
 const prefix='/accounts/'+releaseTarget.account+'/workers/scripts/'+releaseTarget.worker;
 if(!(/^\/deployments$/.test(path)||/^\/versions\?per_page=100$/.test(path)||/^\/versions\/[a-f0-9-]{36}$/.test(path))||(body!==undefined&&path!=='/deployments'))throw Error('release_connector_target');
 const [suffix,query]=path.split('?'),request={method:body===undefined?'GET':'POST',path:prefix+suffix,...(query?{query:{per_page:100}}:{}),...(body===undefined?{}:{body})};
 return 'async()=>await ('+controlCapsule.toString()+')('+JSON.stringify(request)+','+(expectedActive===undefined?'undefined':JSON.stringify(expectedActive))+',cloudflare)';
}
