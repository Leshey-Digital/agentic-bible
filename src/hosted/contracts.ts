import {hostedTarget,type HostedArticleId} from './targets.ts';
import type {SqlDatabase} from '../editorial/contracts.ts';
import type {ContributionAdapters} from './contributions.ts';
import type {IntegrationAdapters} from '../integration-settings/contracts.ts';
import type {JevDispatchPort} from './jev-dispatch.ts';
export const repository='Leshey-Digital/agentic-bible';
export const contentPath='src/content/articles/tool-use.md';
export const baseRef='main';
export const limits=Object.freeze({rows:4,submissionRows:64,lifetimeRequests:24,invocationRequests:12,responseBytes:262144,markdownBytes:65536,requestMs:2000,invocationMs:25000,leaseMs:60000});
export class ProposalError extends Error{code:string;constructor(code:string){super(code);this.code=code;}}
export function reject(code:string):never{throw new ProposalError(code);}
export const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(v);
export const gitSha=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
export const digest=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export const canonical=(v:unknown):string=>JSON.stringify(v,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0)):value)+'\n';
export async function hash(value:string|Uint8Array){const bytes=typeof value==='string'?new TextEncoder().encode(value):value;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export type VerifiedAdmin={subject:string;role:'admin';expiresAt:number;csrfVerified:true};
// These functions are supplied by trusted server code, never env flags/request fields.
// The default ASSETS-only entrypoint has no authority. Explicit server trust/D1/
// token bindings configure existing ports; new adapters remain server composition.
// Local fixture identities are always ineligible.
export type ApprovedNoteV1={schemaVersion:1;mode:'verified-admin-github-proposal';approvalId:string;submissionId:string;submissionRevision:number;reviewerRef:string;approvedAt:number;baseCommit:string;baseMarkdownSha256:string;note:string;citationId:'openai'|'claude'|'mcp-tools'};
export type ApprovedNoteV2=Omit<ApprovedNoteV1,'schemaVersion'|'citationId'> & {schemaVersion:2;articleId:HostedArticleId;contentPath:string;citationId:string};
export type ApprovedNote=ApprovedNoteV1|ApprovedNoteV2;
export type ReviewSource={articleId:string;contentPath:string;baseCommit:string;baseMarkdownSha256:string;markdown:string;citations:string[];sourceAuthority?:'immutable-build';gitHubDraftAvailable?:boolean};
export type Ports={reviewSource?:(articleId:string)=>Promise<ReviewSource>;verifyAdmin?:(request:Request)=>Promise<VerifiedAdmin|null>;approvedNote?:(id:string,admin:VerifiedAdmin)=>Promise<ApprovedNote|null>;sendGitHub?:(request:Request)=>Promise<Response>;hostedApprovals?:true;maintenanceReview?:true;integrationSettings?:IntegrationAdapters;contributions?:ContributionAdapters;jevDispatch?:JevDispatchPort};
export type RuntimeEnv={
  ASSETS:{fetch(request:Request):Promise<Response>};
  EDITORIAL_DB?:SqlDatabase;
  HOSTED_ADMIN_TRUST?:string;
  GITHUB_CONTENT_TOKEN?:string;
  /** Optional operator bindings. Example values are deliberately invalid/closed. */
  /** Explicit private admin inbox opt-in; does not authorize public intake. */
  HOSTED_PRIVATE_INBOX?:string;
  HOSTED_INTAKE_POLICY?:string;
  HOSTED_INTAKE_RATE_KEY?:string;
  INTEGRATION_VAULT_KEY?:string;
  INTEGRATION_VAULT_KEY_ID?:string;
  /** Explicit owner-approved model, token bounds and currency limits; absent means no Jev dispatch. */
  JEV_DISPATCH_POLICY?:string;
};
export type ProposalReceiptV1={schemaVersion:1;state:'draft-proposed';published:false;approvalId:string;baseCommit:string;headCommit:string;branch:string;pullRequest:number;url:string;markdownSha256:string};
export type ProposalReceiptV2=Omit<ProposalReceiptV1,'schemaVersion'>&{schemaVersion:2;articleId:HostedArticleId;contentPath:string};
export type ProposalReceipt=ProposalReceiptV1|ProposalReceiptV2;
export function approved(value:unknown,id:string,now:number):ApprovedNote{
  if(!value||typeof value!=='object'||Array.isArray(value))reject('approval_required');const v=value as ApprovedNote;
  const keys=[...(v.schemaVersion===2?['articleId','contentPath']:[]),'schemaVersion','mode','approvalId','submissionId','submissionRevision','reviewerRef','approvedAt','baseCommit','baseMarkdownSha256','note','citationId'];if(Object.keys(v).sort().join(',')!==keys.sort().join(',')||![1,2].includes(v.schemaVersion)||v.mode!=='verified-admin-github-proposal'||v.approvalId!==id||!uuid(id)||!uuid(v.submissionId)||!Number.isSafeInteger(v.submissionRevision)||v.submissionRevision<1||!Number.isSafeInteger(v.approvedAt)||v.approvedAt<0||v.approvedAt>now+60000||!gitSha(v.baseCommit)||!digest(v.baseMarkdownSha256)||typeof v.reviewerRef!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,63}$/.test(v.reviewerRef)||['local-editor','local-reader'].includes(v.reviewerRef)||typeof v.note!=='string'||v.note!==v.note.trim()||v.note.length<20||v.note.length>1000||/[<>\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(v.note)||(v.schemaVersion===1?!['openai','claude','mcp-tools'].includes(v.citationId):typeof v.citationId!=='string'||!/^[a-z0-9][a-z0-9-]{0,63}$/.test(v.citationId)||!hostedTarget(v.articleId)||hostedTarget(v.articleId)!.contentPath!==v.contentPath))reject('invalid_verified_approval');return structuredClone(v);
}
