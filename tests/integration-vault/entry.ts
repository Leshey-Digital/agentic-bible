// Disposable native-only composition. No deployment config references this file.
import {createHostedRuntime} from '../../src/hosted/worker.ts';
import {createEncryptedIntegrationAdapters} from '../../src/integration-settings/vault.ts';
let adapters:ReturnType<typeof createEncryptedIntegrationAdapters>|undefined;
export default {async fetch(request:Request,env:any){
  if(!adapters){const raw=Uint8Array.from(atob(env.TEST_KEY),c=>c.charCodeAt(0));const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);raw.fill(0);adapters=createEncryptedIntegrationAdapters({db:env.EDITORIAL_DB,key,keyId:'synthetic-v1',trust:env.TEST_TRUST,send:request=>{if(request.redirect!=='manual'||(request.credentials!==undefined&&request.credentials!=='omit'))throw Error('synthetic transport shape');return fetch(request);}});}
  if(new URL(request.url).pathname==='/__synthetic/interrupt'){await adapters.storage.transaction('github-content',async tx=>{await tx.read();await new Promise(()=>{});});return Response.json({done:true});}
  if(new URL(request.url).pathname==='/__synthetic/stale-probe'){await adapters.testConnection({integration:'github-content',revision:1,signal:new AbortController().signal});return Response.json({done:true});}
  return createHostedRuntime({integrationSettings:adapters}).fetch(request,env);
}};
