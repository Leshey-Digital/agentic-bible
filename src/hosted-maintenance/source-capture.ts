import type {SqlDatabase} from '../editorial/contracts.ts';
import {canonical,hash} from '../publishing/contracts.ts';
import {verifyAcquiredSource,type AcquiredSource} from '../maintenance-adapters/acquisition.ts';
import {sourceBodyLimit} from '../monitoring/http-registry.ts';
export const sourceCaptureLimits=Object.freeze({captures:128,chunks:32,chunkBytes:32768,packetBytes:24576});
export type CaptureReference={citationId:string;sourceId:string;requestKey:string;rawHash:string;rawBytes:number;extractedHash:string;packetHash:string};
type CaptureRow={request_key:string;event_id:string;source_id:string;citation_id:string;state:'capturing'|'ready';packet:string;packet_hash:string;raw_hash:string;raw_bytes:number;chunk_count:number};
function stop(code:string):never{throw Object.assign(new Error(code),{code});}
function uuid(value:unknown){return typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);}
export async function readSourceCapture(db:SqlDatabase,eventId:string,reference:{citationId:string;sourceId:string;requestKey:string},historicalReplay=false,clock:()=>number=Date.now):Promise<AcquiredSource|null>{
 if(!uuid(reference.requestKey))stop('hosted_capture_reference');
 const row=await db.prepare('SELECT * FROM hosted_maintenance_source_captures WHERE request_key=?').bind(reference.requestKey).first<CaptureRow>();if(!row)return null;
 if(row.event_id!==eventId||row.source_id!==reference.sourceId||row.citation_id!==reference.citationId||row.state!=='ready'||hash(row.packet)!==row.packet_hash||Buffer.byteLength(row.packet)>sourceCaptureLimits.packetBytes||row.raw_bytes<1||row.raw_bytes>sourceBodyLimit(row.source_id)||row.chunk_count!==Math.ceil(row.raw_bytes/sourceCaptureLimits.chunkBytes)||row.chunk_count>sourceCaptureLimits.chunks)stop('hosted_capture_unconfirmed_or_corrupt');
 const chunks=(await db.prepare('SELECT chunk_index,chunk_bytes,chunk_hash,data FROM hosted_maintenance_source_chunks WHERE request_key=? ORDER BY chunk_index LIMIT 33').bind(reference.requestKey).all<{chunk_index:number;chunk_bytes:number;chunk_hash:string;data:string}>()).results;
 if(chunks.length!==row.chunk_count)stop('hosted_capture_unconfirmed_or_corrupt');const bytes=[];
 for(let index=0;index<chunks.length;index++){const part=chunks[index],decoded=Buffer.from(part.data,'base64'),length=Math.min(sourceCaptureLimits.chunkBytes,row.raw_bytes-index*sourceCaptureLimits.chunkBytes);if(part.chunk_index!==index||part.chunk_bytes!==length||decoded.length!==length||decoded.toString('base64')!==part.data||hash(decoded)!==part.chunk_hash)stop('hosted_capture_unconfirmed_or_corrupt');bytes.push(decoded);}
 const raw=Buffer.concat(bytes);if(raw.length!==row.raw_bytes||hash(raw)!==row.raw_hash)stop('hosted_capture_unconfirmed_or_corrupt');
 let packet:any;try{packet=JSON.parse(row.packet);}catch{return stop('hosted_capture_unconfirmed_or_corrupt');}
 if(packet?.source?.raw?.hash!==row.raw_hash||'bytes' in packet.source.raw||packet.source.sourceId!==row.source_id||packet.receipt?.requestKey!==row.request_key)stop('hosted_capture_unconfirmed_or_corrupt');
 return verifyAcquiredSource({...packet,source:{...packet.source,raw:{...packet.source.raw,bytes:raw}}},{db,clock,historicalReplay});
}
export async function retainSourceCapture(db:SqlDatabase,eventId:string,citationId:string,value:AcquiredSource,clock:()=>number=Date.now):Promise<CaptureReference>{
 const packet=await verifyAcquiredSource(value,{db,clock}),raw=Buffer.from(packet.source.raw.bytes),reference={citationId,sourceId:packet.source.sourceId,requestKey:packet.receipt.requestKey},prior=await readSourceCapture(db,eventId,reference,false,clock);
 if(prior){if(hash(prior.source.raw.bytes)!==packet.source.raw.hash)stop('hosted_capture_reference');return captureReference(citationId,prior);}
 if(raw.length>sourceBodyLimit(packet.source.sourceId)||raw.length>sourceCaptureLimits.chunks*sourceCaptureLimits.chunkBytes)stop('hosted_capture_limit');
 const metadata={...packet,source:{...packet.source,raw:{hash:packet.source.raw.hash,contentType:packet.source.raw.contentType}}},encoded=canonical(metadata),count=Math.ceil(raw.length/sourceCaptureLimits.chunkBytes);if(Buffer.byteLength(encoded)>sourceCaptureLimits.packetBytes)stop('hosted_capture_limit');
 // One D1 batch atomically publishes header+all finite chunks+ready marker.
 // If the response is lost, verify complete retained bytes; partial/corrupt data
 // stays held and never causes a source refetch or an AI retry.
 const operations=[db.prepare(`INSERT INTO hosted_maintenance_source_captures(request_key,event_id,source_id,citation_id,state,packet,packet_hash,raw_hash,raw_bytes,chunk_count) SELECT ?,?,?,?,'capturing',?,?,?,?,? WHERE (SELECT COUNT(*) FROM hosted_maintenance_source_captures)<128 AND (SELECT COUNT(*) FROM hosted_maintenance_source_captures WHERE event_id=?)<2 ON CONFLICT DO NOTHING`).bind(reference.requestKey,eventId,reference.sourceId,citationId,encoded,hash(encoded),packet.source.raw.hash,raw.length,count,eventId)];
 for(let index=0;index<count;index++){const bytes=raw.subarray(index*sourceCaptureLimits.chunkBytes,(index+1)*sourceCaptureLimits.chunkBytes);operations.push(db.prepare(`INSERT INTO hosted_maintenance_source_chunks(request_key,chunk_index,chunk_bytes,chunk_hash,data) SELECT request_key,?,?,?,? FROM hosted_maintenance_source_captures WHERE request_key=? AND event_id=? AND packet_hash=? AND state='capturing' AND (SELECT COUNT(*) FROM hosted_maintenance_source_chunks WHERE request_key=?)<32 ON CONFLICT DO NOTHING`).bind(index,bytes.length,hash(bytes),bytes.toString('base64'),reference.requestKey,eventId,hash(encoded),reference.requestKey));}
 operations.push(db.prepare(`UPDATE hosted_maintenance_source_captures SET state='ready' WHERE request_key=? AND event_id=? AND state='capturing' AND packet_hash=? AND (SELECT COUNT(*) FROM hosted_maintenance_source_chunks WHERE request_key=?)=? AND (SELECT SUM(chunk_bytes) FROM hosted_maintenance_source_chunks WHERE request_key=?)=raw_bytes`).bind(reference.requestKey,eventId,hash(encoded),reference.requestKey,count,reference.requestKey));
 try{await db.batch(operations);}catch{/* Reconcile exact committed bytes, never repeat inserts or fetch. */}
 const saved=await readSourceCapture(db,eventId,reference,false,clock);if(!saved||canonical(captureReference(citationId,saved))!==canonical(captureReference(citationId,packet)))stop('hosted_capture_unconfirmed_or_corrupt');return captureReference(citationId,saved);
}
export function captureReference(citationId:string,packet:AcquiredSource):CaptureReference{const metadata={...packet,source:{...packet.source,raw:{hash:packet.source.raw.hash,contentType:packet.source.raw.contentType}}};return {citationId,sourceId:packet.source.sourceId,requestKey:packet.receipt.requestKey,rawHash:packet.source.raw.hash,rawBytes:packet.source.raw.bytes.byteLength,extractedHash:packet.source.evidence.hash,packetHash:hash(canonical(metadata))};}

export async function assertSourceCaptureSchema(db:SqlDatabase){try{await db.prepare('SELECT request_key,event_id,source_id,citation_id,state,packet,packet_hash,raw_hash,raw_bytes,chunk_count FROM hosted_maintenance_source_captures LIMIT 0').all();await db.prepare('SELECT request_key,chunk_index,chunk_bytes,chunk_hash,data FROM hosted_maintenance_source_chunks LIMIT 0').all();}catch{stop('hosted_capture_schema_required');}}
