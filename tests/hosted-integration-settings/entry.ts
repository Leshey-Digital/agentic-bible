// Test-only server composition. No deployment configuration references this module.
import {createHostedRuntime} from '../../src/hosted/worker.ts';
import type {IntegrationStorage,IntegrationRecord,IntegrationId,IntegrationTransaction} from '../../src/integration-settings/contracts.ts';

class DisposableMemoryStorage implements IntegrationStorage{
  record:IntegrationRecord|null=null;
  secret:string|null=null;
  tail:Promise<unknown>=Promise.resolve();
  transaction<T>(_id:IntegrationId,work:(tx:IntegrationTransaction)=>Promise<T>):Promise<T>{
    const operation=this.tail.then(async()=>{
      let record=structuredClone(this.record),secret=this.secret;
      const value=await work({read:async()=>structuredClone(record),replaceSecret:async value=>{secret=value;},write:async value=>{record=structuredClone(value);}});
      this.record=record;this.secret=secret;return value;
    });
    this.tail=operation.catch(()=>{});return operation;
  }
}
const storage=new DisposableMemoryStorage();let runtime:ReturnType<typeof createHostedRuntime>|undefined,testCalls=0;
export default {fetch(request:Request,env:any){
  runtime??=createHostedRuntime({
    // Deliberately forged legacy port cannot authorize integration settings.
    verifyAdmin:async()=>({subject:'signed-admin:'+'a'.repeat(64),role:'admin',csrfVerified:true,expiresAt:Date.now()+60000}),
    integrationSettings:{connectionEvidence:'controlled',trust:env.TEST_SIGNED_TRUST,storage,testConnection:async input=>{
      // Revision validation and credential resolution occur synchronously under the
      // same serialized storage transaction; there is no external work in this fake.
      return storage.transaction(input.integration,async tx=>{
        const current=await tx.read();if(!current||current.revision!==input.revision||input.signal.aborted)return 'unavailable';
        testCalls++;
        if(testCalls===1)return 'connected';
        if(testCalls===2)throw Error(storage.secret??'disposable-adapter-error');
        if(testCalls===3)return {secret:storage.secret,result:'connected'};
        return 'rejected';
      });
    }},
  });
  return runtime.fetch(request,env);
}};
