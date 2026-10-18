import {officialSource,httpLimits} from '../monitoring/http-registry.ts';

export class SourceAdapterError extends Error {
  code:string;
  constructor(code:string){super(code);this.code=code;}
}
export function reject(code:string):never{throw new SourceAdapterError(code);}
export const extractionLimits=Object.freeze({rawBytes:httpLimits.bodyBytes,evidenceBytes:8192,spans:256,depth:64,tokens:4096});
export type SourceLineage={publisherGroup:string;originIds:readonly string[];provenance:'unknown'};
export type ExtractionProfile={id:string;sourceId:string;url:string;title:string;lineage:SourceLineage};

// Trusted compiled policy, never supplied by a candidate, fetched body or request.
// Publication lineage remains unknown: publisher identity is NOT origin independence.
const selected=[
  ['s-90f2bf11e4fb71c8f42ae128','Function calling | OpenAI API','openai-documentation'],
  ['s-bfba858067cc3eb54024f532','Tools - Model Context Protocol','mcp-documentation'],
] as const;
export const extractionProfiles:readonly ExtractionProfile[]=Object.freeze(selected.map(([sourceId,title,publisherGroup])=>{
  const source=officialSource(sourceId);if(!source)reject('adapter_registry_mismatch');
  return Object.freeze({id:'strict-canonical-main-html-v1',sourceId,url:source.url,title,
    lineage:Object.freeze({publisherGroup,originIds:Object.freeze([] as string[]),provenance:'unknown' as const})});
}));
export function extractionProfile(sourceId:unknown){return typeof sourceId==='string'?extractionProfiles.find(profile=>profile.sourceId===sourceId):undefined;}
export function exact(value:unknown,keys:readonly string[]):asserts value is Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==[...keys].sort().join(','))reject('adapter_invalid_shape');
}
export function canonical(value:unknown):string{
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical((value as Record<string,unknown>)[key])).join(',')+'}';
  return JSON.stringify(value);
}
export async function digest(bytes:Uint8Array|string){
  const value=typeof bytes==='string'?new TextEncoder().encode(bytes):Uint8Array.from(bytes);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',value))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
