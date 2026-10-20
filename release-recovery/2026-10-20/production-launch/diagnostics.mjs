// Value-allowlisted diagnostics only. Never return raw bodies, JWTs or arbitrary error messages.
export function tokenMetadata(token,now=Math.floor(Date.now()/1000)) {
 const result={claimsVerified:false,decoded:false};
 try {if(typeof token!=='string'||token.length>8192) return result;const parts=token.split('.');if(parts.length!==3)return result;const raw=parts[1].replace(/-/g,'+').replace(/_/g,'/');const x=JSON.parse(atob(raw));if(!x||typeof x!=='object'||Array.isArray(x))return result;result.decoded=true;
 for(const k of ['iat','nbf','exp'])if(Number.isSafeInteger(x[k])&&x[k]>=0&&x[k]<=4102444800)result[k]=x[k];
 if(typeof x.wrangler_single_asset_uploads==='boolean')result.singleAssetUploadMode=x.wrangler_single_asset_uploads;
 result.audiencePresent=Object.hasOwn(x,'aud');result.audienceShape=typeof x.aud==='string'?'string':Array.isArray(x.aud)?'array':'other';
 // No audience/issuer/account strings are returned: they can carry arbitrary secrets.
 if(result.exp!==undefined)result.expiredAtObservation=result.exp<=now;if(result.nbf!==undefined)result.notYetValidAtObservation=result.nbf>now;
 }catch{}return result;
}
export async function responseDiagnostic(response) {
 const contentType=response.headers.get('content-type')??'';
 const result={status:response.status,contentType:/^application\/json(?:;|$)/i.test(contentType)?'application/json':/^text\/html(?:;|$)/i.test(contentType)?'text/html':/^text\/plain(?:;|$)/i.test(contentType)?'text/plain':'other',body:{format:'unavailable',truncated:false,bytesRead:0,errorCodes:[],messageClasses:[]}};
 const ray=response.headers.get('cf-ray');if(/^[a-f0-9]{16,32}(?:-[A-Z]{3})?$/.test(ray??''))result.cfRay=ray;
 const id=response.headers.get('x-request-id');if(/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(id??''))result.requestId=id;
 let reader,timer;try {reader=response.body?.getReader();if(!reader)return result;const chunks=[];let size=0;const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('bounded_body_timeout')),2000);});
 for(;;){const x=await Promise.race([reader.read(),deadline]);if(x.done)break;const take=Math.min(x.value.length,8192-size);if(take>0)chunks.push(x.value.slice(0,take));size+=take;result.body.bytesRead=size;if(x.value.length>take||size>=8192){result.body.truncated=true;void reader.cancel().catch(()=>{});break;}}
 const bytes=new Uint8Array(size);let at=0;for(const x of chunks){bytes.set(x,at);at+=x.length;}const raw=new TextDecoder().decode(bytes);
 result.body.format='non-json-redacted';if(!result.body.truncated){try{const body=JSON.parse(raw);result.body.format='json-redacted';if(typeof body?.success==='boolean')result.body.success=body.success;
 for(const e of (Array.isArray(body?.errors)?body.errors:[]).slice(0,8)){if(Number.isSafeInteger(e?.code)&&e.code>=0&&e.code<=2147483647)result.body.errorCodes.push(e.code);
 // Exact known phrases only, never echoed strings or token-like substrings.
 const msg=typeof e?.message==='string'?e.message.trim().toLowerCase():'';const known={'authentication error':'authentication-error','unauthorized':'unauthorized','invalid access token':'invalid-access-token','invalid token':'invalid-token','permission denied':'permission-denied'};if(Object.hasOwn(known,msg))result.body.messageClasses.push(known[msg]);}}
 catch{}}
 }catch{result.body.readFailed=true;void reader?.cancel().catch(()=>{});}finally{clearTimeout(timer);}return result;
}
export function extractSession(response) {
 if(!response||response.success!==true||![200,201].includes(response.status))throw Error('production_session_api_unconfirmed');
 const session=response.result;
 if(!session||typeof session.jwt!=='string'||!session.jwt||session.jwt.length>8192||/\s/.test(session.jwt)||!Array.isArray(session.buckets))throw Error('production_session_shape');
 return {session,diagnostic:{sessionStatus:response.status,token:tokenMetadata(session.jwt),bucketCount:session.buckets.length}};
}
export function assetUploadOptions(session,form) {return {method:'POST',headers:{Authorization:'Bearer '+session.jwt},body:form,redirect:'manual',signal:AbortSignal.timeout(10000)};}
