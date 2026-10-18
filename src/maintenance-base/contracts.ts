import {sha,digest,event,historyPath} from '../maintenance-github/contracts.ts';
import type {RestoreReference} from '../maintenance-history/restoration-approvals.ts';
export type CanonicalBase={schemaVersion:1;kind:'controlled-canonical-maintenance-base';sourceCommit:string;receipt:RestoreReference};
export function canonicalBaseInput(value:any):CanonicalBase{
 const exact=(v:any,keys:string[])=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
 if(!exact(value,['schemaVersion','kind','sourceCommit','receipt'])||value.schemaVersion!==1||value.kind!=='controlled-canonical-maintenance-base'||!sha(value.sourceCommit))throw Error('maintenance_canonical_base_schema');
 const r=value.receipt;if(!exact(r,['eventId','commit','articleRevision','markdownSha256','historyPath','historySha256','receiptHash'])||!event(r.eventId)||!sha(r.commit)||![r.articleRevision,r.markdownSha256,r.historySha256,r.receiptHash].every(digest)||r.historyPath!==historyPath(r.eventId))throw Error('maintenance_canonical_base_schema');return value;
}
