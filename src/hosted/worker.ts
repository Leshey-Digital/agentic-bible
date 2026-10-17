import {ProposalError,uuid,type Ports,type RuntimeEnv} from './contracts.ts';
import {proposeGitHubCorrection} from './github.ts';
const origin='https://staging.agenticbible.si';
const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers});
// Ports are trusted server code, not environment flags, cookies or request fields.
// The shipped default entrypoint below leaves every write port unconfigured.
export function createHostedRuntime(ports:Ports={}){return {async fetch(request:Request,env:RuntimeEnv):Promise<Response>{
  const url=new URL(request.url),path=url.pathname;
  try{
    if(path==='/api/runtime/status'&&request.method==='GET')return json({schemaVersion:1,contentAuthority:'github-build',releaseCommit:null,releaseVerified:false,publicIntake:false,adminVerifierConfigured:!!ports.verifyAdmin,gitHubProposalsConfigured:!!ports.verifyAdmin&&!!ports.approvedNote&&!!ports.sendGitHub&&!!env.EDITORIAL_DB,hostedCanonicalWrites:false,localFixtureIdentity:false});
    if(path==='/api/editorial/status'&&request.method==='GET')return json({enabled:false,mode:'hosted-unconfigured',publicIntake:false});
    if(path==='/api/admin/corrections/github-proposal'){
      if(url.origin!==origin)return json({error:'hosted_origin_required'},403);
      if(!ports.verifyAdmin||!ports.approvedNote||!ports.sendGitHub||!env.EDITORIAL_DB)return json({error:'hosted_identity_approval_and_github_not_configured'},503);
      if(request.method!=='POST')return json({error:'explicit_post_required'},405);
      if(request.headers.get('origin')!==origin||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'same_origin_required'},403);
      const admin=await ports.verifyAdmin(request);if(!admin||admin.role!=='admin'||admin.csrfVerified!==true||!Number.isSafeInteger(admin.expiresAt)||admin.expiresAt<=Date.now()||typeof admin.subject!=='string'||!admin.subject||admin.subject.length>256||['local-editor','local-reader'].includes(admin.subject))return json({error:'verified_admin_required'},403);
      if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return json({error:'json_required'},415);
      const reader=request.body?.getReader();if(!reader)return json({error:'approval_id_required'},400);const chunks:Uint8Array[]=[];let bytes=0;
      try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>8192){void reader.cancel();return json({error:'input_capacity'},413);}chunks.push(part.value);}}finally{reader.releaseLock();}
      const body=new Uint8Array(bytes);let offset=0;for(const part of chunks){body.set(part,offset);offset+=part.length;}const input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body));
      if(!input||Object.keys(input).join(',')!=='approvalId'||!uuid(input.approvalId))return json({error:'approval_id_only'},400);
      return json(await proposeGitHubCorrection(input.approvalId,admin,env.EDITORIAL_DB,ports));
    }
    if(path==='/admin'||path.startsWith('/admin/')||path.startsWith('/api/'))return json({error:'hosted_admin_and_public_intake_not_configured'},503);
    if(!['GET','HEAD'].includes(request.method))return json({error:'read_only_assets'},405);
    const response=await env.ASSETS.fetch(request),merged=new Headers(response.headers);merged.set('X-Robots-Tag','noindex, nofollow');return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers:merged});
  }catch(error){if(error instanceof SyntaxError)return json({error:'invalid_json'},400);return json({error:error instanceof ProposalError?error.code:'github_outcome_unconfirmed',published:false},error instanceof ProposalError&&new Set(['github_approval_conflict','github_proposal_busy','github_outbox_capacity','github_request_budget_or_lease','github_invocation_budget','stale_github_base','stale_github_content','github_foreign_branch','github_proposal_conflict','stale_github_base_after_proposal','github_correction_capacity_or_duplicate','github_markdown_capacity']).has(error.code)?409:503);}
}};}
export default createHostedRuntime();
