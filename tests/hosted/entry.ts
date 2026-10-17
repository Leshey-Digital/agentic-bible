// Controlled-test entry only. Never referenced by a deployment configuration.
import {createHostedRuntime} from '../../src/hosted/worker.ts';
const fixture=createHostedRuntime({
  verifyAdmin:async request=>request.headers.get('X-Controlled-Admin')==='test-admin'?{subject:'test-verified-admin',role:'admin',expiresAt:Date.now()+60000,csrfVerified:true}:null,
  approvedNote:async(id,_admin)=>{const env=(globalThis as any).__testEnv;const row=await env.EDITORIAL_DB.prepare('SELECT value FROM test_approved_notes WHERE id=?').bind(id).first();return row?JSON.parse(row.value):null;},
  sendGitHub:request=>fetch(request),
});
export default {fetch(request:Request,env:any){(globalThis as any).__testEnv=env;return fixture.fetch(request,env);}};
