import {ProposalError,uuid,type Ports,type RuntimeEnv} from './contracts.ts';
import {proposeGitHubCorrection} from './github.ts';
import {runtimeRelease} from '../release/public.ts';
import {configuredPorts} from './configuration.ts';
import {createApproval,listApprovals,revokeApproval} from './approvals.ts';
import {sourcePreview} from './source.ts';
import {MaintenanceReviewError,verifiedCatalog,listMaintenanceReviews,saveMaintenanceReview} from '../maintenance-history/review.ts';
import {maintenanceAdminHtml,maintenanceAdminCss,maintenanceAdminJs} from '../maintenance-history/admin.ts';
import {adminHtml,adminCss,adminJs} from './admin.ts';
const origin='https://staging.agenticbible.si';
const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers});
// Ports are trusted server code, not environment flags, cookies or request fields.
// The shipped entrypoint configures ports only from explicit server trust, D1 and secret bindings.
export function createHostedRuntime(ports:Ports={}){return {async fetch(request:Request,env:RuntimeEnv):Promise<Response>{
  const url=new URL(request.url),path=url.pathname;
  try{
    if(path==='/api/runtime/status'&&request.method==='GET')return json({schemaVersion:1,contentAuthority:'github-build',...await runtimeRelease(env.ASSETS),publicIntake:false,adminVerifierConfigured:!!ports.verifyAdmin,adminApprovalsConfigured:!!ports.hostedApprovals,gitHubProposalsConfigured:!!ports.verifyAdmin&&!!ports.approvedNote&&!!ports.sendGitHub&&!!env.EDITORIAL_DB,hostedCanonicalWrites:false,localFixtureIdentity:false});
    if(path==='/api/editorial/status'&&request.method==='GET')return json({enabled:!!ports.hostedApprovals,mode:ports.hostedApprovals?'hosted-admin-notes':'hosted-unconfigured',publicIntake:false});
    const maintenancePath=path==='/admin/'||path.startsWith('/admin/maintenance/')||path.startsWith('/api/admin/maintenance/');
    if(maintenancePath){
      if(url.origin!==origin)return json({error:'hosted_origin_required'},403);
      if(!ports.maintenanceReview||!ports.verifyAdmin||!env.EDITORIAL_DB)return json({error:'maintenance_review_unconfigured'},503);
      const admin=await ports.verifyAdmin(request);if(!admin||admin.role!=='admin'||admin.csrfVerified!==true||!Number.isSafeInteger(admin.expiresAt)||admin.expiresAt<=Date.now()||!/^signed-admin:[a-f0-9]{64}$/.test(admin.subject))return json({error:'verified_admin_required'},403);
      if(request.method==='GET'&&(path==='/admin/'||path.startsWith('/admin/maintenance/'))){const asset=path==='/admin/'||path==='/admin/maintenance/'?[maintenanceAdminHtml,'text/html; charset=utf-8']:path==='/admin/maintenance/style.css'?[maintenanceAdminCss,'text/css; charset=utf-8']:path==='/admin/maintenance/app.js'?[maintenanceAdminJs,'text/javascript; charset=utf-8']:null;return asset?new Response(asset[0],{headers:{...headers,'Content-Type':asset[1]}}):json({error:'not_found'},404);}
      if(path!=='/api/admin/maintenance/review')return json({error:'not_found'},404);
      if(!['GET','POST'].includes(request.method))return json({error:'explicit_post_required'},405);
      if(request.method==='POST'&&(request.headers.get('origin')!==origin||request.headers.get('sec-fetch-site')==='cross-site'||request.headers.get('x-agentic-bible-request')!=='admin'))return json({error:'same_origin_required'},403);
      if(request.method==='POST'&&request.headers.get('content-type')?.split(';')[0]!=='application/json')return json({error:'json_required'},415);
      const view=await verifiedCatalog(env.ASSETS);
      return json(request.method==='GET'?await listMaintenanceReviews(env.EDITORIAL_DB,admin,view):await saveMaintenanceReview(env.EDITORIAL_DB,admin,await inputJson(request),view));
    }
    const connectedAdmin=ports.hostedApprovals&&path!=='/api/admin/corrections/github-proposal'&&(path.startsWith('/admin/corrections/')||path.startsWith('/api/admin/corrections/'));
    if(connectedAdmin){
      if(url.origin!==origin)return json({error:'hosted_origin_required'},403);
      if(!ports.verifyAdmin||!ports.approvedNote||!ports.sendGitHub||!env.EDITORIAL_DB)return json({error:'hosted_identity_approval_and_github_not_configured'},503);
      const admin=await ports.verifyAdmin(request);if(!admin||admin.role!=='admin'||admin.csrfVerified!==true||admin.expiresAt<=Date.now())return json({error:'verified_admin_required'},403);
      if(request.method==='GET'&&path.startsWith('/admin/corrections/')){
        const asset=path==='/admin/corrections/'?[adminHtml,'text/html; charset=utf-8']:path==='/admin/corrections/style.css'?[adminCss,'text/css; charset=utf-8']:path==='/admin/corrections/app.js'?[adminJs,'text/javascript; charset=utf-8']:null;
        return asset?new Response(asset[0],{headers:{...headers,'Content-Type':asset[1]}}):json({error:'not_found'},404);
      }
      if(request.method==='GET'&&path==='/api/admin/corrections/approvals')return json(await listApprovals(env.EDITORIAL_DB,admin));
      if(request.method==='GET'&&path==='/api/admin/corrections/base'){if(request.headers.get('x-agentic-bible-request')!=='admin'||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'same_origin_required'},403);return json(await sourcePreview(env.EDITORIAL_DB,ports.sendGitHub));}
      if(request.method==='POST'&&['/api/admin/corrections/approvals','/api/admin/corrections/revoke'].includes(path)){
        if(request.headers.get('origin')!==origin||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'same_origin_required'},403);
        if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return json({error:'json_required'},415);const input=await inputJson(request);
        if(path.endsWith('/approvals'))return json(await createApproval(env.EDITORIAL_DB,input,admin));
        if(!input||Object.keys(input).join(',')!=='approvalId'||!uuid(input.approvalId))return json({error:'approval_id_only'},400);return json(await revokeApproval(env.EDITORIAL_DB,input.approvalId,admin));
      }
    }
    if(path==='/api/admin/corrections/github-proposal'){
      if(url.origin!==origin)return json({error:'hosted_origin_required'},403);
      if(!ports.verifyAdmin||!ports.approvedNote||!ports.sendGitHub||!env.EDITORIAL_DB)return json({error:'hosted_identity_approval_and_github_not_configured'},503);
      if(request.method!=='POST')return json({error:'explicit_post_required'},405);
      if(request.headers.get('origin')!==origin||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'same_origin_required'},403);
      const admin=await ports.verifyAdmin(request);if(!admin||admin.role!=='admin'||admin.csrfVerified!==true||!Number.isSafeInteger(admin.expiresAt)||admin.expiresAt<=Date.now()||typeof admin.subject!=='string'||!admin.subject||admin.subject.length>256||['local-editor','local-reader'].includes(admin.subject))return json({error:'verified_admin_required'},403);
      if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return json({error:'json_required'},415);
      const input=await inputJson(request);
      if(!input||Object.keys(input).join(',')!=='approvalId'||!uuid(input.approvalId))return json({error:'approval_id_only'},400);
      return json(await proposeGitHubCorrection(input.approvalId,admin,env.EDITORIAL_DB,ports));
    }
    if(path==='/admin'||path.startsWith('/admin/')||path.startsWith('/api/'))return json({error:'hosted_admin_and_public_intake_not_configured'},503);
    if(!['GET','HEAD'].includes(request.method))return json({error:'read_only_assets'},405);
    const response=await env.ASSETS.fetch(request),merged=new Headers(response.headers);merged.set('X-Robots-Tag','noindex, nofollow');return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers:merged});
  }catch(error){if(error instanceof MaintenanceReviewError)return json({error:error.code,articleChanged:false},error.status);if(error instanceof SyntaxError)return json({error:'invalid_json'},400);return json({error:error instanceof ProposalError?error.code:'github_outcome_unconfirmed',published:false},error instanceof ProposalError&&error.code==='input_capacity'?413:error instanceof ProposalError&&new Set(['github_approval_conflict','github_proposal_busy','github_outbox_capacity','github_request_budget_or_lease','github_invocation_budget','stale_github_base','stale_github_content','github_foreign_branch','github_proposal_conflict','stale_github_base_after_proposal','github_correction_capacity_or_duplicate','github_markdown_capacity','hosted_approval_capacity','hosted_approval_key_conflict','hosted_approval_revoked','hosted_source_daily_budget']).has(error.code)?409:error instanceof ProposalError&&path==='/api/admin/corrections/approvals'&&['invalid_verified_approval','explicit_hosted_review_required'].includes(error.code)?400:503);}
}};}
async function inputJson(request:Request){
  if(request.headers.get('content-type')?.split(';')[0]!=='application/json')throw new SyntaxError('json required');const reader=request.body?.getReader();if(!reader)throw new SyntaxError('body required');const chunks:Uint8Array[]=[];let bytes=0;
  try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>8192){void reader.cancel();throw new ProposalError('input_capacity');}chunks.push(part.value);}}finally{reader.releaseLock();}
  const body=new Uint8Array(bytes);let offset=0;for(const part of chunks){body.set(part,offset);offset+=part.length;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body));
}
export default {fetch(request:Request,env:RuntimeEnv){return createHostedRuntime(configuredPorts(env)).fetch(request,env);}};
