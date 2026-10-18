import type {SqlDatabase} from '../editorial/contracts.ts';
import type {IntegrationAdapters} from '../integration-settings/contracts.ts';
export const repository='Leshey-Digital/agentic-bible';
export const contentPath='src/content/articles/tool-use.md';
export const baseRef='main';
export const limits=Object.freeze({rows:4,lifetimeRequests:24,invocationRequests:12,responseBytes:262144,markdownBytes:65536,requestMs:2000,invocationMs:25000,leaseMs:60000});
export class ProposalError extends Error{code:string;constructor(code:string){super(code);this.code=code;}}
export function reject(code:string):never{throw new ProposalError(code);}
export const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(v);
export const gitSha=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
export const digest=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export const canonical=(v:unknown):string=>JSON.stringify(v,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0)):value)+'\n';
export async function hash(value:string|Uint8Array){const bytes=typeof value==='string'?new TextEncoder().encode(value):value;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export type VerifiedAdmin={subject:string;role:'admin';expiresAt:number;csrfVerified:true};
// These functions are supplied by trusted server code, never env flags/request fields.
// The shipped runtime configures none. Local synthetic approvals are ineligible.
export type ApprovedNote={schemaVersion:1;mode:'verified-admin-github-proposal';approvalId:string;submissionId:string;submissionRevision:number;reviewerRef:string;approvedAt:number;baseCommit:string;baseMarkdownSha256:string;note:string;citationId:'openai'|'claude'|'mcp-tools'};
export type Ports={verifyAdmin?:(request:Request)=>Promise<VerifiedAdmin|null>;approvedNote?:(id:string,admin:VerifiedAdmin)=>Promise<ApprovedNote|null>;sendGitHub?:(request:Request)=>Promise<Response>;hostedApprovals?:true;maintenanceReview?:true;integrationSettings?:IntegrationAdapters};
export type RuntimeEnv={ASSETS:{fetch(request:Request):Promise<Response>};EDITORIAL_DB?:SqlDatabase;HOSTED_ADMIN_TRUST?:string;GITHUB_CONTENT_TOKEN?:string};
export type ProposalReceipt={schemaVersion:1;state:'draft-proposed';published:false;approvalId:string;baseCommit:string;headCommit:string;branch:string;pullRequest:number;url:string;markdownSha256:string};
export function approved(value:unknown,id:string,now:number):ApprovedNote{
  if(!value||typeof value!=='object'||Array.isArray(value))reject('approval_required');const v=value as ApprovedNote;
  const keys=['schemaVersion','mode','approvalId','submissionId','submissionRevision','reviewerRef','approvedAt','baseCommit','baseMarkdownSha256','note','citationId'];if(Object.keys(v).sort().join(',')!==keys.sort().join(',')||v.schemaVersion!==1||v.mode!=='verified-admin-github-proposal'||v.approvalId!==id||!uuid(id)||!uuid(v.submissionId)||!Number.isSafeInteger(v.submissionRevision)||v.submissionRevision<1||!Number.isSafeInteger(v.approvedAt)||v.approvedAt<0||v.approvedAt>now+60000||!gitSha(v.baseCommit)||!digest(v.baseMarkdownSha256)||typeof v.reviewerRef!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,63}$/.test(v.reviewerRef)||['local-editor','local-reader'].includes(v.reviewerRef)||typeof v.note!=='string'||v.note!==v.note.trim()||v.note.length<20||v.note.length>1000||/[<>\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(v.note)||!['openai','claude','mcp-tools'].includes(v.citationId))reject('invalid_verified_approval');return structuredClone(v);
}
