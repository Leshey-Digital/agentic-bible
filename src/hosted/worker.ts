import {inspectSourceAttempt} from './source-attempt.ts';
import {configuredMeasurement} from '../measurement/collector.ts';
import {CloudflareDraftError} from './cloudflare-drafts.ts';
import {prepareDraftForInbox,recoverDraftForInbox} from './cloudflare-draft-inbox.ts';
import {draftAdminHtml,draftAdminJs,sourceAttemptJs,draftRecoveryJs} from './cloudflare-draft-admin.ts';
import {ProposalError,uuid,type Ports,type RuntimeEnv} from './contracts.ts';
import {proposeGitHubCorrection} from './github.ts';
import {runtimeRelease} from '../release/public.ts';
import {configuredPorts} from './configuration.ts';
import {createApproval,listApprovals,revokeApproval} from './approvals.ts';
import {sourcePreview} from './source.ts';
import {createRestorationApproval,revokeRestorationApproval} from '../maintenance-history/restoration-approvals.ts';
import {MaintenanceReviewError,verifiedCatalog,listMaintenanceReviews,saveMaintenanceReview} from '../maintenance-history/review.ts';
import {maintenanceAdminPage,maintenanceAdminCss,maintenanceAdminJs} from '../maintenance-history/admin.ts';
import {adminHtml,adminForInboxHtml,adminCss,adminJs} from './admin.ts';
import {createContributionHandler,intakeConfigured} from './contributions.ts';
import {adminTrust,verifySignedAdmin} from './identity.ts';
import {contributionAdminPage,contributionAdminCss,contributionAdminJs} from './contribution-admin.ts';
import {integrationAdminHtml,integrationAdminCss,integrationAdminJs} from '../integration-settings/admin.ts';
import {createIntegrationSettingsContract} from '../integration-settings/contracts.ts';
import {recordAbuseOutcome,type AbuseOutcome} from './privacy.ts';
import {jevLimits,jevModels} from '../maintenance-adapters/jev.ts';
const origin='https://staging.agenticbible.si';
const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers});
function publicJevDecision(value:unknown){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;const v=value as any;
  if(Object.keys(v).sort().join(',')!=='advisoryOnly,answers,capability,model,usage'||v.capability!=='structured-decision'||v.advisoryOnly!==true||!jevModels.includes(v.model)||!v.answers||typeof v.answers!=='object'||Array.isArray(v.answers)||Object.keys(v.answers).join(',')!=='needs_editorial_attention')return null;
  const answer=v.answers.needs_editorial_attention,usage=v.usage;
  if(!answer||typeof answer!=='object'||Array.isArray(answer)||Object.keys(answer).sort().join(',')!=='noul,type'||answer.type!=='noul'||typeof answer.noul!=='number'||!Number.isFinite(answer.noul)||answer.noul<0||answer.noul>1||!usage||typeof usage!=='object'||Array.isArray(usage)||Object.keys(usage).sort().join(',')!=='inputTokens,outputTokens'||!Number.isSafeInteger(usage.inputTokens)||usage.inputTokens<1||!Number.isSafeInteger(usage.outputTokens)||usage.outputTokens<0)return null;
  return {capability:'structured-decision',advisoryOnly:true,model:v.model,answers:{needs_editorial_attention:{type:'noul',noul:answer.noul}},usage:{inputTokens:usage.inputTokens,outputTokens:usage.outputTokens}};
}
// Ports are trusted server code, not environment flags, cookies or request fields.
// Existing hosted correction ports use explicit server trust, D1 and secret bindings.
// Integration settings use explicit server trust, D1 and vault key bindings.
// Request fields and local fixture identities cannot configure trusted adapters.
export function createHostedRuntime(ports:Ports={}){
const maintenance=ports.maintenance;
const contributions=ports.contributions?createContributionHandler(ports.contributions,ports.sendGitHub,ports.reviewSource):undefined;
const integrationSettings=ports.integrationSettings?createIntegrationSettingsContract(ports.integrationSettings):undefined;
const jevSettings=ports.integrationSettings?createIntegrationSettingsContract(ports.integrationSettings,'typesafe-jev'):undefined;
return {async scheduled(event:import('../hosted-maintenance/scheduled.ts').HostedMaintenanceEvent){
 if(!maintenance)return {state:'unconfigured',canonicalGitChanged:false,deploymentChanged:false,livePublished:false};
 return maintenance.scheduled({scheduledTime:event.scheduledTime,cron:event.cron});
},async fetch(request:Request,env:RuntimeEnv):Promise<Response>{
  const url=new URL(request.url),path=url.pathname;
  try{
    if(path==='/api/measurement')return configuredMeasurement(env)(request);
    // Decode once only to reject aliases of the private settings namespace. Never
    // dispatch a decoded alias; malformed encodings retain existing route behavior.
    let decodedPath=path;try{decodedPath=decodeURIComponent(path);}catch{}
    if(decodedPath!==path&&(decodedPath==='/api/submissions'||decodedPath.startsWith('/api/admin/drafts/')||decodedPath.startsWith('/admin/drafts/')||decodedPath.startsWith('/api/admin/jev/')||decodedPath.startsWith('/api/admin/submissions/')||decodedPath==='/api/admin/submissions'||decodedPath==='/api/admin/abuse-counters'||decodedPath.startsWith('/admin/contributions/')||decodedPath.startsWith('/admin/integrations/')||decodedPath==='/api/admin/settings'||decodedPath.startsWith('/api/admin/settings/')))return json({error:'hosted_admin_and_public_intake_not_configured'},503);
    if(path.startsWith('/admin/integrations/')){
      if(url.origin!==origin)return json({error:'hosted_origin_required'},403);
      if(!integrationSettings)return json({error:'integration_settings_unconfigured'},503);
      const trust=adminTrust(ports.integrationSettings?.trust),admin=trust?await verifySignedAdmin(request,trust):null;
      if(!admin||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'verified_admin_required'},403);
      if(request.method!=='GET'||url.search)return json({error:'invalid_request'},400);
      const asset=path==='/admin/integrations/'?[integrationAdminHtml,'text/html; charset=utf-8']:path==='/admin/integrations/style.css'?[integrationAdminCss,'text/css; charset=utf-8']:path==='/admin/integrations/app.js'?[integrationAdminJs,'text/javascript; charset=utf-8']:null;return asset?new Response(asset[0],{headers:{...headers,'Content-Type':asset[1]}}):json({error:'not_found'},404);
    }
    if(path==='/api/admin/settings/integrations/github-content'||path==='/api/admin/settings/integrations/typesafe-jev'){
      if(url.origin!==origin)return json({error:'hosted_origin_required'},403);
      if(url.search)return json({error:'invalid_request'},400);
      if(!['GET','POST'].includes(request.method))return new Response(JSON.stringify({error:'method_not_allowed'}),{status:405,headers:{...headers,'Content-Type':'application/json','Allow':'GET, POST'}});
      if(!integrationSettings)return json({error:'integration_settings_unconfigured'},503);
      const response=await (path.endsWith('/typesafe-jev')?jevSettings!:integrationSettings)(request),secured=new Headers(response.headers);
      for(const [key,value] of Object.entries(headers))secured.set(key,value);
      return new Response(response.body,{status:response.status,headers:secured});
    }
    if(path==='/api/admin/drafts/recover'||path==='/api/admin/drafts/cloudflare'||path==='/api/admin/drafts/source'||path.startsWith('/api/admin/drafts/attempt/')||path.startsWith('/admin/drafts/')){
      if(!ports.contributions)return json({error:'cloudflare_draft_unconfigured'},503);
      if(url.origin!==origin||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'same_origin_required'},403);
      if(!ports.verifyAdmin||!env.EDITORIAL_DB)return json({error:'hosted_admin_identity_unconfigured'},503);
      const admin=await ports.verifyAdmin(request);
      if(!admin||admin.role!=='admin'||admin.csrfVerified!==true||!Number.isSafeInteger(admin.expiresAt)||admin.expiresAt<=Date.now()||!/^signed-admin:[a-f0-9]{64}$/.test(admin.subject))return json({error:'verified_admin_required'},403);
      if(url.search)return json({error:'invalid_request'},400);
      if(path.startsWith('/admin/drafts/')){
        if(request.method!=='GET')return json({error:'method_not_allowed'},405);
        const asset=path==='/admin/drafts/'?[draftAdminHtml,'text/html; charset=utf-8']:path==='/admin/drafts/app.js'?[draftAdminJs+sourceAttemptJs+draftRecoveryJs,'text/javascript; charset=utf-8']:null;
        return asset?new Response(asset[0],{headers:{...headers,'Content-Type':asset[1]}}):json({error:'not_found'},404);
      }
      if(path.startsWith('/api/admin/drafts/attempt/')){
        if(request.method!=='GET')return json({error:'method_not_allowed'},405);
        const key=path.slice('/api/admin/drafts/attempt/'.length);if(!uuid(key))return json({error:'invalid_request'},400);
        const attempt=await inspectSourceAttempt(env.EDITORIAL_DB,key);return attempt?json(attempt):json({error:'source_attempt_not_found'},404);
      }
      if(request.method!=='POST')return json({error:'explicit_post_required'},405);
      if(request.headers.get('origin')!==origin||request.headers.get('x-agentic-bible-request')!=='admin')return json({error:'same_origin_required'},403);
      if(path==='/api/admin/drafts/recover'){
        try{const input=await inputJson(request,128);if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).join(',')!=='requestKey'||!uuid(input.requestKey))return json({error:'invalid_request'},400);return json(await recoverDraftForInbox(request,input.requestKey,env.EDITORIAL_DB,admin));}
        catch(error){if(error instanceof CloudflareDraftError)return json({error:error.code,published:false},error.status);throw error;}
      }
      if(!ports.cloudflareDrafts||ports.cloudflareDrafts.state!=='configured')return json({error:'cloudflare_draft_unconfigured'},503);
      try{const input=await inputJson(request,2048);if(path==='/api/admin/drafts/source')return json(await ports.cloudflareDrafts.qualifySource(request,input));return json(await prepareDraftForInbox(ports.cloudflareDrafts,request,input,env.EDITORIAL_DB,admin));}
      catch(error){if(error instanceof CloudflareDraftError)return json({error:error.code,published:false},error.status);throw error;}
    }
    if(path==='/api/admin/jev/evaluate'){
      if(url.origin!==origin)return json({error:'hosted_origin_required'},403);
      if(request.method!=='POST')return new Response(JSON.stringify({error:'explicit_post_required'}),{status:405,headers:{...headers,'Content-Type':'application/json','Allow':'POST'}});
      if(request.headers.get('origin')!==origin||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'same_origin_required'},403);
      if(!ports.verifyAdmin)return json({error:'hosted_admin_identity_unconfigured'},503);
      const admin=await ports.verifyAdmin(request);
      if(!admin||admin.role!=='admin'||admin.csrfVerified!==true||!Number.isSafeInteger(admin.expiresAt)||admin.expiresAt<=Date.now()||typeof admin.subject!=='string'||!admin.subject||admin.subject.length>256||['local-editor','local-reader'].includes(admin.subject))return json({error:'verified_admin_required'},403);
      if(!ports.jevDispatch||ports.jevDispatch.state!=='configured')return json({error:'jev_dispatch_unconfigured'},503);
      if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return json({error:'json_required'},415);
      const input=await inputJson(request,jevLimits.requestBytes+2048);
      if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).join(',')!=='content')return json({error:'content_only_required'},400);
      if(typeof input.content!=='string'||input.content.trim().length<1||new TextEncoder().encode(input.content).byteLength>jevLimits.requestBytes)return json({error:'jev_content_limit'},413);
      try{
        const decision=publicJevDecision(await ports.jevDispatch.evaluate(input.content,admin.subject,request.signal));
        if(!decision)return json({error:'jev_result_unavailable'},503);
        return json({decision});
      }catch{return json({error:'jev_evaluation_unavailable'},503);}
    }
    if(path==='/api/submissions'||path==='/api/admin/submissions'||path.startsWith('/api/admin/submissions/')||path==='/api/admin/abuse-counters'||path.startsWith('/admin/contributions/')){
      if(url.origin!==origin)return json({error:'hosted_origin_required'},403);
      if(!contributions||!env.EDITORIAL_DB)return json({error:'hosted_contributions_unconfigured',publicIntake:false,reason:'trusted_server_adapters_and_approved_policy_required'},503);
      if(path.startsWith('/admin/contributions/')){
        const trust=adminTrust(ports.contributions?.trust);const admin=trust?await verifySignedAdmin(request,trust):null;if(!admin||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'verified_admin_required'},403);
        if(request.method!=='GET'||url.search)return json({error:'invalid_request'},400);
        const asset=path==='/admin/contributions/'?[contributionAdminPage(!!ports.sendGitHub),'text/html; charset=utf-8']:path==='/admin/contributions/style.css'?[contributionAdminCss,'text/css; charset=utf-8']:path==='/admin/contributions/app.js'?[contributionAdminJs,'text/javascript; charset=utf-8']:null;return asset?new Response(asset[0],{headers:{...headers,'Content-Type':asset[1]}}):json({error:'not_found'},404);
      }
      const response=await contributions(request,env.EDITORIAL_DB);
      if(path==='/api/submissions'&&request.method==='POST'){
        let outcome:AbuseOutcome=response.status===201?'accepted':response.status===202?'honeypot':response.status===429?'rate_limited':response.status===403?'forbidden':response.status===503?'capacity':'rejected';
        try{const body=await response.clone().json() as {duplicate?:unknown;error?:unknown};if(body.duplicate===true)outcome='duplicate';else if(response.status===503&&body.error==='editorial_unavailable')outcome='other_error';}catch{}
        try{await recordAbuseOutcome(env.EDITORIAL_DB,outcome);}catch{return json({error:'editorial_unavailable'},503);}
      }
      const secured=new Headers(response.headers);for(const [key,value]of Object.entries(headers))secured.set(key,value);return new Response(response.body,{status:response.status,headers:secured});
    }
    if(path==='/api/runtime/status'&&request.method==='GET')return json({schemaVersion:1,contentAuthority:'github-build',...await runtimeRelease(env.ASSETS),publicIntake:!!env.EDITORIAL_DB&&intakeConfigured(ports.contributions),integrationSettingsConfigured:!!integrationSettings&&!!adminTrust(ports.integrationSettings?.trust),contributionAdminConfigured:!!env.EDITORIAL_DB&&!!adminTrust(ports.contributions?.trust),publicIntakeReason:intakeConfigured(ports.contributions)?'trusted_policy_configured':'approved_terms_privacy_moderation_and_rate_identity_required',jevTransportAvailable:true,jevDispatchState:ports.jevDispatch?.state??'not-mounted',jevDispatchConfigured:ports.jevDispatch?.state==='configured',adminVerifierConfigured:!!ports.verifyAdmin,adminApprovalsConfigured:!!ports.hostedApprovals,gitHubProposalsConfigured:!!ports.verifyAdmin&&!!ports.approvedNote&&!!ports.sendGitHub&&!!env.EDITORIAL_DB,hostedCanonicalWrites:false,localFixtureIdentity:false});
    if(path==='/api/editorial/status'&&request.method==='GET')return json({enabled:!!ports.hostedApprovals||!!env.EDITORIAL_DB&&!!adminTrust(ports.contributions?.trust),mode:ports.contributions?'hosted-contributions':ports.hostedApprovals?'hosted-admin-notes':'hosted-unconfigured',publicIntake:!!env.EDITORIAL_DB&&intakeConfigured(ports.contributions),reason:intakeConfigured(ports.contributions)?'trusted_policy_configured':'approved_terms_privacy_moderation_and_rate_identity_required',policy:intakeConfigured(ports.contributions)?{termsPath:ports.contributions!.policy!.termsPath,privacyPath:ports.contributions!.policy!.privacyPath,revision:ports.contributions!.policy!.policyRevision}:null});
    const maintenancePath=path==='/admin/'||path.startsWith('/admin/maintenance/')||path.startsWith('/api/admin/maintenance/');
    if(maintenancePath){
      if(url.origin!==origin)return json({error:'hosted_origin_required'},403);
      if(request.headers.get('sec-fetch-site')==='cross-site')return json({error:'verified_admin_required'},403);
      if(!ports.verifyAdmin||!env.EDITORIAL_DB)return json({error:'maintenance_review_unconfigured'},503);
      const admin=await ports.verifyAdmin(request);if(!admin||admin.role!=='admin'||admin.csrfVerified!==true||!Number.isSafeInteger(admin.expiresAt)||admin.expiresAt<=Date.now()||!/^signed-admin:[a-f0-9]{64}$/.test(admin.subject))return json({error:'verified_admin_required'},403);
      if(request.method==='GET'&&(path==='/admin/'||path.startsWith('/admin/maintenance/'))){
        if(path==='/admin/'&&ports.contributions)return new Response(null,{status:302,headers:{...headers,Location:'/admin/contributions/'}});
        if(path==='/admin/'||path==='/admin/maintenance/'){
          let available=false;
          if(ports.maintenanceReview)try{available=(await verifiedCatalog(env.ASSETS)).catalog.history.some(entry=>entry.current);}catch(error){if(!(error instanceof MaintenanceReviewError))throw error;}
          return new Response(maintenanceAdminPage({inbox:!!ports.contributions,github:!!ports.hostedApprovals,unavailable:!available}),{headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
        }
        const asset=path==='/admin/maintenance/style.css'?[maintenanceAdminCss,'text/css; charset=utf-8']:path==='/admin/maintenance/app.js'?[maintenanceAdminJs,'text/javascript; charset=utf-8']:null;
        return asset?new Response(asset[0],{headers:{...headers,'Content-Type':asset[1]}}):json({error:'not_found'},404);
      }
      if(!ports.maintenanceReview)return json({error:'maintenance_review_unconfigured'},503);
      if(!['/api/admin/maintenance/review','/api/admin/maintenance/restore-approval','/api/admin/maintenance/restore-revoke'].includes(path))return json({error:'not_found'},404);
      if(!['GET','POST'].includes(request.method))return json({error:'explicit_post_required'},405);
      if(request.method==='POST'&&(request.headers.get('origin')!==origin||request.headers.get('sec-fetch-site')==='cross-site'||request.headers.get('x-agentic-bible-request')!=='admin'))return json({error:'same_origin_required'},403);
      if(request.method==='POST'&&request.headers.get('content-type')?.split(';')[0]!=='application/json')return json({error:'json_required'},415);
      const view=await verifiedCatalog(env.ASSETS);
      if(path!=='/api/admin/maintenance/review'){if(request.method!=='POST')return json({error:'explicit_post_required'},405);const input=await inputJson(request);if(path.endsWith('/restore-approval')){const result=await createRestorationApproval(env.EDITORIAL_DB,input,admin,view);return json({approvalId:result.approval.approvalId,requestId:result.approval.requestId,active:result.active,articleChanged:false,canonicalDispatchEnabled:false});}if(!input||Object.keys(input).join(',')!=='approvalId')return json({error:'approval_id_only'},400);return json(await revokeRestorationApproval(env.EDITORIAL_DB,input.approvalId,admin));}
      return json(request.method==='GET'?await listMaintenanceReviews(env.EDITORIAL_DB,admin,view):await saveMaintenanceReview(env.EDITORIAL_DB,admin,await inputJson(request),view));
    }
    const connectedAdmin=ports.hostedApprovals&&path!=='/api/admin/corrections/github-proposal'&&(path.startsWith('/admin/corrections/')||path.startsWith('/api/admin/corrections/'));
    if(connectedAdmin){
      if(url.origin!==origin)return json({error:'hosted_origin_required'},403);
      if(!ports.verifyAdmin||!ports.approvedNote||!ports.sendGitHub||!env.EDITORIAL_DB)return json({error:'hosted_identity_approval_and_github_not_configured'},503);
      const admin=await ports.verifyAdmin(request);if(!admin||admin.role!=='admin'||admin.csrfVerified!==true||admin.expiresAt<=Date.now())return json({error:'verified_admin_required'},403);
      if(request.method==='GET'&&path.startsWith('/admin/corrections/')){
        const asset=path==='/admin/corrections/'?[ports.contributions?adminForInboxHtml:adminHtml,'text/html; charset=utf-8']:path==='/admin/corrections/style.css'?[adminCss,'text/css; charset=utf-8']:path==='/admin/corrections/app.js'?[adminJs,'text/javascript; charset=utf-8']:null;
        return asset?new Response(asset[0],{headers:{...headers,'Content-Type':asset[1]}}):json({error:'not_found'},404);
      }
      if(request.method==='GET'&&path==='/api/admin/corrections/approvals')return json(await listApprovals(env.EDITORIAL_DB,admin,!!ports.contributions));
      if(request.method==='GET'&&path==='/api/admin/corrections/base'){if(request.headers.get('x-agentic-bible-request')!=='admin'||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'same_origin_required'},403);return json(await sourcePreview(env.EDITORIAL_DB,ports.sendGitHub));}
      if(request.method==='POST'&&['/api/admin/corrections/approvals','/api/admin/corrections/revoke'].includes(path)){
        if(request.headers.get('origin')!==origin||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'same_origin_required'},403);
        if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return json({error:'json_required'},415);const input=await inputJson(request);
        if(path.endsWith('/approvals')){
          // Actual-inbox composition permits old standalone authority replay only.
          // New notes must bind the reviewed current submission through its route.
          if(ports.contributions){const existing=uuid(input?.approvalId)?await ports.approvedNote(input.approvalId,admin):null;if(!existing)return json({error:'actual_submission_review_required'},409);}
          return json(await createApproval(env.EDITORIAL_DB,input,admin));
        }
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
async function inputJson(request:Request,maxBytes=8192){
  if(request.headers.get('content-type')?.split(';')[0]!=='application/json')throw new SyntaxError('json required');const reader=request.body?.getReader();if(!reader)throw new SyntaxError('body required');const chunks:Uint8Array[]=[];let bytes=0;
  try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>maxBytes){void reader.cancel();throw new ProposalError('input_capacity');}chunks.push(part.value);}}finally{reader.releaseLock();}
  const body=new Uint8Array(bytes);let offset=0;for(const part of chunks){body.set(part,offset);offset+=part.length;}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body));
}
export default {async fetch(request:Request,env:RuntimeEnv){return createHostedRuntime(await configuredPorts(env,request)).fetch(request,env);},async scheduled(event:import('../hosted-maintenance/scheduled.ts').HostedMaintenanceEvent,_env:RuntimeEnv){await createHostedRuntime().scheduled(event);}};
