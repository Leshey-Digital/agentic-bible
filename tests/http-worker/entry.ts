// Test-only entry; never referenced by any Wrangler app/deployment configuration.
import {request as httpsRequest} from 'node:https';
import {httpSources} from '../../src/monitoring/http-registry.ts';
import {HttpObservationStore,HttpStoreError} from '../../src/monitoring/http-store.ts';
import {checkHttpSource} from '../../src/monitoring/http-service.ts';
import type {SqlDatabase} from '../../src/editorial/contracts.ts';
export default {async fetch(request:Request,env:{EDITORIAL_DB:SqlDatabase}){
  if(new URL(request.url).hostname!=='localhost')return new Response('Test-only local entry', {status:403});
  const store=new HttpObservationStore(env.EDITORIAL_DB);
  try{
    if(new URL(request.url).pathname==='/probe'){
      let lookupCalled=false;
      try{const status=await new Promise<number>((resolve,reject)=>{
        const req=httpsRequest(httpSources[0].url,{lookup(_host,_options,callback){lookupCalled=true;callback(new Error('Pin must fail closed'),'',4);}},response=>{response.resume();response.on('end',()=>resolve(response.statusCode??0));});
        req.on('error',reject);req.end();
      });
      return Response.json({status,lookupCalled});}catch(error){return Response.json({unsupported:typeof error==='object'&&error!==null&&'code' in error&&error.code==='ERR_OPTION_NOT_IMPLEMENTED',lookupCalled});}
    }
    const input=await request.json() as {id:string;key:string;action?:string;now?:number};
    const clock=()=>input.now??Date.now();
    if(input.action==='claim'){await store.enqueue(input.id,input.key,clock());return Response.json(await store.claim(input.key,clock()));}
    return new Response(await checkHttpSource(store,input.id,input.key,undefined,clock),{headers:{'Content-Type':'application/json'}});
  }catch(error){return Response.json({error:error instanceof HttpStoreError?error.code:'http_storage_unavailable'},{status:503});}
}};
