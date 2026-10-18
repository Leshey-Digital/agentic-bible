import {lstatSync} from 'node:fs';
import {bounded} from './files.ts';
import {join} from 'node:path';
import type {SqlDatabase} from '../editorial/contracts.ts';
import {commandInput,canonical,hash,type Publish,type Reference} from '../publishing/contracts.ts';
import {officialSource} from '../monitoring/http-registry.ts';

import {bridgeLimits,reject} from './limits.ts';
export {bridgeLimits,BridgeError,reject} from './limits.ts';
export const digest=(value:unknown):value is string=>typeof value==='string'&&value.length===64&&/^[a-f0-9]{64}$/.test(value);
export const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export function exact(value:unknown,keys:string[]):asserts value is Record<string,unknown>{if(!object(value)||Object.keys(value).sort().join(',')!==[...keys].sort().join(','))reject('invalid_bridge_schema');}
export function reference(value:unknown):Reference|null{if(value===null)return null;exact(value,['id','manifestHash']);if(!digest(value.id)||!digest(value.manifestHash))reject('invalid_bridge_reference');return {id:value.id,manifestHash:value.manifestHash};}
const event=(value:unknown):string=>{if(typeof value!=='string'||value.length>80||value!==value.trim()||!/^[a-z0-9][a-z0-9-]{2,79}$/.test(value))reject('invalid_bridge_event');return value;};
export type Evidence={citationId:string;sourceId:string;url:string;receiptKey:string;bodyHash:string;file:string};
export type Apply={schemaVersion:1;kind:'apply';mode:'local-synthetic-only';eventId:string;originalMarkdownHash:string;expectedSite:Reference|null;expectedPublisher:Reference|null;revision:Publish;evidence:Evidence[]};
export type Rollback={schemaVersion:1;kind:'rollback';mode:'local-synthetic-only';eventId:string;originalMarkdownHash:string;expectedSite:Reference;expectedPublisher:Reference;targetSite:Reference|null};
export type BridgeCommand=Apply|Rollback;
export type Binding=Omit<Evidence,'file'>&{bytes:number;observedAt:number;reservationToken:string;day:number;attempt:number};
export function bridgeInput(value:unknown):BridgeCommand{
  let bytes;try{bytes=Buffer.byteLength(JSON.stringify(value));}catch{return reject('invalid_bridge_schema');}if(bytes>bridgeLimits.inputBytes)reject('bridge_input_too_large');
  if(!object(value)||value.schemaVersion!==1||value.mode!=='local-synthetic-only')reject('invalid_bridge_schema');
  const eventId=event(value.eventId);if(!digest(value.originalMarkdownHash))reject('invalid_original_hash');
  const expectedSite=reference(value.expectedSite);const expectedPublisher=reference(value.expectedPublisher);
  if(value.kind==='rollback'){
    exact(value,['schemaVersion','kind','mode','eventId','originalMarkdownHash','expectedSite','expectedPublisher','targetSite']);if(!expectedSite||!expectedPublisher)reject('invalid_rollback_base');
    return {schemaVersion:1,kind:'rollback',mode:'local-synthetic-only',eventId,originalMarkdownHash:value.originalMarkdownHash,expectedSite,expectedPublisher,targetSite:reference(value.targetSite)};
  }
  if(value.kind!=='apply')reject('unsupported_bridge_command');
  exact(value,['schemaVersion','kind','mode','eventId','originalMarkdownHash','expectedSite','expectedPublisher','revision','evidence']);
  const revision=commandInput(value.revision);if(revision.kind!=='publish'||revision.eventId!==eventId||revision.article.id!=='tool-use'||revision.article.topic!=='Capabilities'||revision.article.sources.length<2||revision.article.sources.length>3)reject('unsupported_bridge_revision');
  if(!Array.isArray(value.evidence)||value.evidence.length!==revision.article.sources.length)reject('invalid_bridge_evidence');
  const evidence=value.evidence.map((entry):Evidence=>{
    exact(entry,['citationId','sourceId','url','receiptKey','bodyHash','file']);
    if(typeof entry.citationId!=='string'||typeof entry.sourceId!=='string'||typeof entry.url!=='string'||typeof entry.receiptKey!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(entry.receiptKey)||!digest(entry.bodyHash)||typeof entry.file!=='string'||!/^[a-z0-9][a-z0-9.-]{0,70}$/.test(entry.file)||entry.file.includes('..'))reject('invalid_bridge_evidence');
    const source=officialSource(entry.sourceId);const citation=revision.article.sources.find(source=>source.id===entry.citationId);
    if(!source||source.url!==entry.url||!citation||citation.url!==entry.url)reject('citation_evidence_mismatch');
    return {citationId:entry.citationId,sourceId:entry.sourceId,url:entry.url,receiptKey:entry.receiptKey,bodyHash:entry.bodyHash,file:entry.file};
  });
  if(new Set(evidence.map(x=>x.citationId)).size!==evidence.length||new Set(evidence.map(x=>x.sourceId)).size!==evidence.length||new Set(evidence.map(x=>x.receiptKey)).size!==evidence.length)reject('duplicate_bridge_evidence');
  return {schemaVersion:1,kind:'apply',mode:'local-synthetic-only',eventId,originalMarkdownHash:value.originalMarkdownHash,expectedSite,expectedPublisher,revision,evidence};
}
type Row={source_id:string;state:string;attempts:number;result:string;finished_token:string;token:string;outcome:string;attempt:number;day:number;actual_bytes:number;budget_day:number;used:number;day_count:number};
export async function validateEvidence(command:Pick<Apply,'evidence'>,db:SqlDatabase,sourceDirectory:string){
  const bindings:Binding[]=[];const files:Record<string,Buffer>={};
  // Read every bounded file before issuing any publisher/build/journal operation.
  for(const evidence of command.evidence){
    const path=join(sourceDirectory,evidence.file);const stat=lstatSync(path);if(!stat.isFile()||stat.isSymbolicLink())reject('unsafe_evidence_file');if(!stat.size||stat.size>bridgeLimits.sourceBytes)reject('source_file_too_large');
    const bytes=bounded(path,bridgeLimits.sourceBytes);if(bytes.length!==stat.size||bytes.length>bridgeLimits.sourceBytes||hash(bytes)!==evidence.bodyHash)reject('source_hash_mismatch');
    try{new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{reject('invalid_source_encoding');}files[evidence.bodyHash]=bytes;
  }
  for(const evidence of command.evidence){
    let row:Row|null;try{row=await db.prepare(`SELECT j.source_id,j.state,j.attempts,j.result,j.finished_token,r.token,r.outcome,r.attempt,r.day,r.actual_bytes,b.day AS budget_day,b.used,
      (SELECT COUNT(*) FROM http_request_reservations charged WHERE charged.day=r.day) AS day_count
      FROM http_check_jobs j JOIN http_request_reservations r ON r.token=j.finished_token AND r.request_key=j.request_key JOIN http_request_budget b ON b.id=1 WHERE j.request_key=?`).bind(evidence.receiptKey).first<Row>();}catch{return reject('evidence_accounting_unavailable');}
    if(!row||row.state!=='succeeded'||row.outcome!=='succeeded'||row.source_id!==evidence.sourceId||row.finished_token!==row.token||row.attempt!==row.attempts||row.attempt<1||row.attempt>3||!Number.isSafeInteger(row.day)||row.budget_day<row.day||row.used<0||row.used>20||row.day_count<1||row.day_count>20||(row.budget_day===row.day&&row.used<row.day_count))reject('uncharged_observation');
    let receipt;try{receipt=JSON.parse(row.result);}catch{return reject('invalid_observation_receipt');}
    if(receipt?.status!=='succeeded'||receipt.ok!==true||receipt.state?.mode!=='http'||receipt.state.sourceId!==evidence.sourceId||receipt.state.hash!==evidence.bodyHash||receipt.observation?.hash!==evidence.bodyHash||!Number.isSafeInteger(receipt.state.checkedAt)||receipt.state.checkedAt<0)reject('observation_hash_mismatch');
    if(!['baseline','changed','unchanged'].includes(receipt.observation.kind))reject('unsupported_304_evidence');
    const bytes=files[evidence.bodyHash].length;if(row.actual_bytes!==bytes||receipt.observation.bytes!==bytes)reject('observation_length_mismatch');
    bindings.push({...evidence,bytes,observedAt:receipt.state.checkedAt,reservationToken:row.token,day:row.day,attempt:row.attempt});delete (bindings.at(-1) as Binding&{file?:string}).file;
  }
  return {bindings,files,evidenceHash:hash(canonical(bindings))};
}
