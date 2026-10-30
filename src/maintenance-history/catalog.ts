import type {HistoryView} from './canonical.ts';
export function canonicalMaintenanceCatalog(history:HistoryView[],enabled:boolean,sourceCommit:string|null){
 const generic=history.some(e=>e.articleId!=='tool-use'||e.qualityRequired);
 return {schemaVersion:history.some(e=>e.receipt.mode==='hosted-source-backed')?3:generic?2:1,mode:'controlled-static-preview',enabled,sourceCommit:enabled?sourceCommit:null,noindex:true,history:enabled?history.map(({receipt,current,articleId})=>({... (generic?{articleId}:{}),receipt,current})):[]};
}
