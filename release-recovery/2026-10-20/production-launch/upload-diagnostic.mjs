import {extractSession,responseDiagnostic,assetUploadOptions} from './diagnostics.mjs';
// One bounded, independently reviewed production upload. No activation or secrets.
export async function diagnosticUpload(p, cloudflare) {
 const account='c370be29e4065365de03bc8652da2cdc',name='agentic-bible-production';
 const base='/accounts/'+account,script=base+'/workers/scripts/'+name,worker=base+'/workers/workers/'+name;
 const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const bytes=s=>Uint8Array.from(atob(s),x=>x.charCodeAt(0));
 let count=0;const api=async(method,path,body,query)=>{if(++count>12)throw Error('production_request_budget');const r=await cloudflare.request({method,path,...(body?{body}:{}),...(query?{query}:{})});if(!r.success||![200,201].includes(r.status))throw Error('production_api_unconfirmed_'+r.status);return r.result;};
 if(await sha(new TextEncoder().encode(p.candidateRaw))!==p.digest)throw Error('production_candidate_digest');
 const c=JSON.parse(p.candidateRaw);
 if(c.target.account!==account||c.target.worker!==name||c.target.origin!=='https://agenticbible.si'||c.expectedActive!==null||c.externalBindings.length!==0)throw Error('production_target');
 if(c.source.commit!=='8a38252384c6fe6024a75b462ad95294a131100c')throw Error('production_source');
 if(JSON.stringify(Object.keys(p.files).sort())!==JSON.stringify(Object.keys(c.inventory).sort()))throw Error('production_inventory');
 const manifest={},uploads={};
 for(const [path,file] of Object.entries(p.files)){
  const b=bytes(file);if(b.length!==c.inventory[path].bytes||await sha(b)!==c.inventory[path].sha256)throw Error('production_bytes');
  if(path==='_headers'||path==='_redirects')continue;
  const basename=path.slice(path.lastIndexOf('/')+1),ext=basename.includes('.')?basename.slice(basename.lastIndexOf('.')+1):'';
  const h=(await sha(new TextEncoder().encode(file+ext))).slice(0,32);manifest['/'+path]={hash:h,size:b.length};uploads[h]={content:file,type:({html:'text/html',css:'text/css',js:'application/javascript',json:'application/json',wasm:'application/wasm',svg:'image/svg+xml',txt:'text/plain',woff2:'font/woff2',png:'image/png',ico:'image/x-icon',xml:'application/xml'})[ext]??'application/octet-stream'};
 }
 const meta=await api('GET',worker);if(meta.name!==name||meta.subdomain?.enabled!==false||meta.subdomain?.previews_enabled!==false)throw Error('production_previews');
 const active=async()=>{const r=await api('GET',script+'/deployments');const list=r.deployments??r;if(!Array.isArray(list)||list.length)throw Error('production_expected_empty');};
 await active();
 const {session,diagnostic:sessionDiagnostic}=extractSession(await cloudflare.request({method:'POST',path:script+'/assets-upload-session',body:{manifest}}));
 const jwt=s=>typeof s==='string'&&s.length>0&&s.length<=8192&&!/\s/.test(s);
 if(!jwt(session.jwt)||!Array.isArray(session.buckets)||session.buckets.length>8)throw Error('production_session');
 const hashes=session.buckets.flat();if(session.buckets.some(b=>!Array.isArray(b)||!b.length)||hashes.some(h=>!Object.hasOwn(uploads,h))||new Set(hashes).size!==hashes.length)throw Error('production_buckets');
 if(sessionDiagnostic.token.singleAssetUploadMode===true)throw Error('production_diagnostic_single_upload_mode_unsupported:'+JSON.stringify(sessionDiagnostic));
 if(!session.buckets.length)return {candidateDigest:p.digest,operation:p.operation,session:sessionDiagnostic,uploadAttempted:false,noVersionCreated:true};
 // Proposal only: exactly one first-bucket POST. Never create a version or activate.
 const bucket=session.buckets[0],form=new FormData();for(const hash of bucket)form.append(hash,new Blob([uploads[hash].content],{type:uploads[hash].type}),hash);
 let response;try{response=await fetch('https://api.cloudflare.com/client/v4'+base+'/workers/assets/upload?base64=true',assetUploadOptions(session,form));}catch{throw Error('production_diagnostic_transport_uncertain:'+JSON.stringify({session:sessionDiagnostic,candidateDigest:p.digest,operation:p.operation}));}
 const diagnostic={candidateDigest:p.digest,operation:p.operation,session:sessionDiagnostic,upload:await responseDiagnostic(response),noVersionCreated:true};
 if(![200,201].includes(response.status))throw Error('production_diagnostic_http_failure:'+JSON.stringify(diagnostic));
 return diagnostic;
}
