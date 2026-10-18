import {createHash} from 'node:crypto';
import {canonical,hash} from '../publishing/contracts.ts';
export {canonical,hash};
export const repository='Leshey-Digital/agentic-bible',branch='main',articlePath='src/content/articles/tool-use.md',pointerPath='src/content/maintenance/tool-use.json';
export const writerLimits=Object.freeze({rows:16,lifetimeRequests:40,invocationRequests:16,responseBytes:262144,requestBytes:98304,markdownBytes:65536,intentBytes:65536,requestMs:2000,invocationMs:25000,leaseMs:60000,treeEntries:1024});
export class WriterError extends Error {code:string;constructor(code:string){super(code);this.code=code;}}
export function stop(code:string):never{throw new WriterError(code);}
export const sha=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
export const digest=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export const event=(value:unknown):value is string=>typeof value==='string'&&/^[a-z0-9][a-z0-9-]{2,79}$/.test(value);
export const historyPath=(id:string)=>'src/content/maintenance/history/'+hash(id)+'.json';
export const blobSha=(content:string|Uint8Array)=>createHash('sha1').update('blob '+Buffer.byteLength(content)+'\0').update(content).digest('hex');
export type Intent={schemaVersion:1;expectedBase:string;previousEvent:string|null;files:Record<string,string>};
export type WriterReceipt={schemaVersion:1;mode:'local-synthetic-only';state:'canonical-commit-verified';livePublished:false;eventId:string;authorityHash:string;baseCommit:string;commit:string;articleRevision:string;markdownSha256:string;historyPath:string;historySha256:string;flags:string[]};
export const commitMutation='mutation CanonicalMaintenanceCommit($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { clientMutationId commit { oid } } }';
export function intentInput(value:unknown,id:string):Intent{
 if(!value||typeof value!=='object'||Array.isArray(value))stop('writer_intent_corrupt');const v=value as Intent;
 if(Object.keys(v).sort().join(',')!=='expectedBase,files,previousEvent,schemaVersion'||v.schemaVersion!==1||!sha(v.expectedBase)||(v.previousEvent!==null&&!event(v.previousEvent))||!v.files||typeof v.files!=='object'||Array.isArray(v.files)||Object.keys(v.files).sort().join(',')!==[articlePath,pointerPath,historyPath(id)].sort().join(','))stop('writer_intent_corrupt');
 for(const [path,text]of Object.entries(v.files))if(typeof text!=='string'||Buffer.byteLength(text)>(path===articlePath?writerLimits.markdownBytes:32768))stop('writer_intent_corrupt');if(Buffer.byteLength(canonical(v))>writerLimits.intentBytes)stop('writer_intent_corrupt');return v;
}
