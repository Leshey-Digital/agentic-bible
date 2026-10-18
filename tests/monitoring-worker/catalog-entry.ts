// Test-only entry, never referenced by app/deployment configuration.
import {MonitorStore} from '../../src/monitoring/store.ts';
import {validateCatalog} from '../../src/monitoring/catalog.ts';
import {MonitorError} from '../../src/monitoring/contracts.ts';
import type {SqlDatabase} from '../../src/editorial/contracts.ts';
export default {async fetch(request:Request,env:{EDITORIAL_DB:SqlDatabase}){
  if(new URL(request.url).hostname!=='localhost'||request.method!=='POST')return new Response('Local test only',{status:403});
  try{await new MonitorStore(env.EDITORIAL_DB).seed(await validateCatalog(await request.json()));return Response.json({status:'seeded'});}
  catch(error){return Response.json({error:error instanceof MonitorError?error.code:'storage_failure'},{status:409});}
}};
