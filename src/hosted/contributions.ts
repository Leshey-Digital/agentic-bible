import {policyPath} from './policy.ts';
import {articleIds,dispositions,type SqlDatabase,type Disposition} from '../editorial/contracts.ts';
import {D1EditorialStore} from '../editorial/store.ts';
import {InputError,RateLimitError,ReplayConflictError,CapacityError,submissionInput,changeInput} from '../editorial/validation.ts';
import {adminTrust,hostedOrigin,verifySignedAdmin} from './identity.ts';
import {sourcePreview} from './source.ts';
import {uuid,type Ports} from './contracts.ts';
import {submissionHistory} from './submission-history.ts';
import {createSubmissionReview} from './submission-reviews.ts';
import {listAbuseOutcomes} from './privacy.ts';

// Only trusted server composition can supply this policy. No env or request flag
// is interpreted as approval; paths name the owner's future approved documents.
export type IntakePolicy={termsPath:string;privacyPath:string;policyRevision:string;moderationReady:true};
export type ContributionAdapters={trust:unknown;policy?:IntakePolicy;clientKey?:(request:Request)=>Promise<string|null>};
const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers});
export class ContributionError extends Error{readonly code:string;readonly status:number;constructor(code:string,status=400){super(code);this.code=code;this.status=status;}}
function fail(code:string,status=400):never{throw new ContributionError(code,status);}
export function intakeConfigured(adapters?:ContributionAdapters){const p=adapters?.policy;return !!adminTrust(adapters?.trust)&&!!p&&p.moderationReady===true&&policyPath(p.termsPath)&&policyPath(p.privacyPath)&&/^[a-zA-Z0-9._-]{1,64}$/.test(p.policyRevision)&&typeof adapters?.clientKey==='function';}
export async function contributionJson(request:Request):Promise<any>{
  if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')fail('json_required',415);
  if(!request.body)fail('invalid_request');const reader=request.body.getReader(),parts:Uint8Array[]=[];let bytes=0,timer:ReturnType<typeof setTimeout>|undefined;
  const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{reject(new ContributionError('body_timeout',408));void reader.cancel().catch(()=>{});},1000);});
  try{for(;;){const part=await Promise.race([reader.read(),timeout]);if(part.done)break;bytes+=part.value.byteLength;if(bytes>8192){void reader.cancel().catch(()=>{});fail('body_too_large',413);}parts.push(part.value);}}finally{clearTimeout(timer);reader.releaseLock();}
  const body=new Uint8Array(bytes);let offset=0;for(const part of parts){body.set(part,offset);offset+=part.byteLength;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body));}catch{fail('invalid_request');}
}
const exact=(value:any,keys:string[])=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===keys.sort().join(',');
export function createContributionHandler(adapters:ContributionAdapters,send?:Ports['sendGitHub']){
  const trust=adminTrust(adapters.trust);
  return async(request:Request,db:SqlDatabase):Promise<Response>=>{
    try{
      const url=new URL(request.url),publicRoute=url.pathname==='/api/submissions';
      if(url.origin!==hostedOrigin)fail('hosted_origin_required',403);
      if(request.headers.get('sec-fetch-site')==='cross-site'||(!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!==hostedOrigin))fail('same_origin_required',403);
      const store=new D1EditorialStore(db,true,'hosted-submitter');
      if(url.pathname==='/api/admin/abuse-counters'){
        if(request.method!=='GET'||url.search)fail('invalid_request',400);
        if(!trust||request.headers.get('x-agentic-bible-request')!=='admin')fail('verified_admin_required',403);
        const admin=await verifySignedAdmin(request,trust);if(!admin||admin.expiresAt<=Date.now())fail('verified_admin_required',403);
        return json(await listAbuseOutcomes(db));
      }
      if(publicRoute){
        if(!intakeConfigured(adapters))return json({error:'public_intake_policy_unconfigured',publicIntake:false},503);
        if(request.method!=='POST')fail('explicit_post_required',405);
        if(url.search)fail('invalid_request');
        const value=await contributionJson(request);if(!exact(value,['requestKey','articleId','kind','message','sourceUrl','website']))fail('invalid_request');
        const input=submissionInput(value);if(input.website)return json({received:true},202);
        // Adapter must derive a stable privacy-preserving key from trusted ingress.
        // Raw client headers and IPs are never persisted by this handler.
        const key=await adapters.clientKey!(request);if(!key||!/^hosted:[a-f0-9]{64}$/.test(key))fail('trusted_rate_identity_unavailable',503);
        const receipt=await store.submit(input,key,Date.now());return json({received:true,reference:receipt.id,duplicate:receipt.duplicate},receipt.duplicate?200:201);
      }
      if(!trust||request.headers.get('x-agentic-bible-request')!=='admin')fail('verified_admin_required',403);
      const admin=await verifySignedAdmin(request,trust);if(!admin)fail('verified_admin_required',403);
      const fresh=()=>{if(admin.expiresAt<=Date.now())fail('verified_admin_required',403);};
      if(url.pathname==='/api/admin/submissions'&&request.method==='GET'){
        if([...url.searchParams.keys()].some(k=>!['status','before'].includes(k)))fail('invalid_request');
        const status=url.searchParams.get('status')??'new';if(!(dispositions as readonly string[]).includes(status))fail('invalid_request');
        const result=await store.list(status as Disposition,url.searchParams.get('before')??undefined);fresh();return json(result);
      }
      const match=/^\/api\/admin\/submissions\/([a-f0-9-]{36})(\/(?:review|source|reviews))?$/.exec(url.pathname);
      if(!match||!uuid(match[1])||url.search)fail('not_found',404);
      const id=match[1];if(match[2]==='/reviews'){if(request.method!=='GET')fail('method_not_allowed',405);if(!await store.get(id))fail('not_found',404);const history=await submissionHistory(db,id,admin);fresh();return json(history);}if(match[2]==='/source'){if(request.method!=='GET')fail('method_not_allowed',405);if(!send)fail('source_adapter_unconfigured',503);const item=await store.get(id);if(!item)fail('not_found',404);const preview=await sourcePreview(db,send,item.articleId);fresh();return json(preview);}
      if(match[2]){if(request.method!=='POST')fail('explicit_post_required',405);const value=await contributionJson(request);fresh();return json(await createSubmissionReview(db,id,value,admin));}
      if(request.method==='GET'){const item=await store.get(id);if(!item)fail('not_found',404);const audit=await store.audit(id);fresh();return json({item,audit});}
      if(request.method!=='PATCH')fail('method_not_allowed',405);
      const value=await contributionJson(request);if(!exact(value,['status','tags','version']))fail('invalid_request');const change=changeInput(value);fresh();
      if(!await store.update(id,change,admin.subject,Date.now()))fail('stale_submission_revision',409);return json({updated:true,articleChanged:false});
    }catch(error){
      if(error instanceof ContributionError)return json({error:error.code},error.status);
      if(error instanceof InputError)return json({error:'invalid_fields',fields:error.fields},error.status);
      if(error instanceof RateLimitError)return json({error:'rate_limit'},429);
      if(error instanceof ReplayConflictError)return json({error:'request_replayed_with_different_content'},409);
      if(error instanceof CapacityError)return json({error:'inbox_capacity'},503);
      return json({error:'editorial_unavailable'},503);
    }
  };
}
export {articleIds};
