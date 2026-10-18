import {createHostedRuntime} from '../../src/hosted/worker.ts';
import {hash} from '../../src/hosted/contracts.ts';
import {configuredPorts} from '../../src/hosted/configuration.ts';
export default {fetch(request:Request,env:any){return createHostedRuntime({...configuredPorts(env),contributions:{trust:env.HOSTED_ADMIN_TRUST,...(env.TEST_POLICY==='synthetic-approved'?{policy:{termsPath:'/synthetic-terms/',privacyPath:'/synthetic-privacy/',policyRevision:'synthetic-v1',moderationReady:true as const},clientKey:async(request:Request)=>env.TEST_CLIENT_KEYS==='distinct-synthetic-ingress'?'hosted:'+await hash('synthetic-ingress:'+request.headers.get('x-synthetic-ingress-client')):'hosted:'+'a'.repeat(64)}:{})}}).fetch(request,env);}};
