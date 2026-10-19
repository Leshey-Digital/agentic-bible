// Combined browser-only trusted synthetic composition; never a deployment entrypoint.
import {createHostedRuntime} from '../../src/hosted/worker.ts';
import {createEncryptedIntegrationAdapters} from '../../src/integration-settings/vault.ts';
import {configuredPorts} from '../../src/hosted/configuration.ts';
let runtime:ReturnType<typeof createHostedRuntime>|undefined;
export default {async fetch(request:Request,env:any){
  if(!runtime){const key=await crypto.subtle.importKey('raw',Uint8Array.from(atob(env.TEST_KEY),c=>c.charCodeAt(0)),'AES-GCM',false,['encrypt','decrypt']);runtime=createHostedRuntime({...await configuredPorts(env),contributions:{trust:env.HOSTED_ADMIN_TRUST,policy:{termsPath:'/synthetic-terms/',privacyPath:'/synthetic-privacy/',policyRevision:'synthetic-v1',moderationReady:true},clientKey:async()=> 'hosted:'+'a'.repeat(64)},integrationSettings:createEncryptedIntegrationAdapters({db:env.EDITORIAL_DB,key,keyId:'synthetic-v1',connectionEvidence:'controlled',trust:env.HOSTED_ADMIN_TRUST,send:request=>fetch(request)})});}
  return runtime.fetch(request,env);
}};
