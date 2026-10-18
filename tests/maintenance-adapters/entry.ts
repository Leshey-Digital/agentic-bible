// Test-only native Workers entry; no application/deployment config imports this.
import {acquireMaintenanceSource,verifyAcquiredSource} from '../../src/maintenance-adapters/acquisition.ts';
import {SourceAdapterError} from '../../src/maintenance-adapters/profiles.ts';
import type {SqlDatabase} from '../../src/editorial/contracts.ts';
export default {async fetch(request:Request,env:{EDITORIAL_DB:SqlDatabase}){
 if(new URL(request.url).hostname!=='localhost')return new Response('Controlled test entry only',{status:403});
 try{
  const input=await request.json() as {action?:string;selection:unknown;enabled?:boolean;now?:number;packet?:any};
  const context={enabled:input.enabled===true,db:env.EDITORIAL_DB,clock:()=>input.now??Date.now()};
  if(input.action==='verify'&&input.packet?.source?.raw){input.packet.source.raw.bytes=Uint8Array.from(input.packet.source.raw.bytes);}
  const packet=input.action==='verify'?await verifyAcquiredSource(input.packet,context):await acquireMaintenanceSource(input.selection,context);
  return Response.json({...packet,source:{...packet.source,raw:{...packet.source.raw,bytes:[...packet.source.raw.bytes]}}});
 }catch(error){return Response.json({error:error instanceof SourceAdapterError?error.code:'adapter_accounting_unavailable'},{status:503});}
}};
