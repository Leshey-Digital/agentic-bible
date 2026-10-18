import {createHostedRuntime} from '../../src/hosted/worker.ts';
import {configuredPorts} from '../../src/hosted/configuration.ts';
export default {fetch(request:Request,env:any){return createHostedRuntime({...configuredPorts(env),contributions:{trust:env.HOSTED_ADMIN_TRUST,...(env.TEST_POLICY==='synthetic-approved'?{policy:{termsPath:'/synthetic-terms/',privacyPath:'/synthetic-privacy/',policyRevision:'synthetic-v1',moderationReady:true as const},clientKey:async()=> 'hosted:'+'a'.repeat(64)}:{})}}).fetch(request,env);}};
