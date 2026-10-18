// Test-only transport isolation; never loaded by the release adapter.
import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {appendFileSync} from 'node:fs';
const require=createRequire(import.meta.url),undici=require(require.resolve('undici',{paths:[dirname(require.resolve('miniflare'))]})),agent=new undici.Agent();
const dispatch=agent.dispatch.bind(agent);agent.dispatch=(options,handler)=>{
 if(new URL(String(options.origin)).hostname!=='127.0.0.1'){appendFileSync(process.env.AB_RELEASE_NETWORK_EVIDENCE,JSON.stringify({blocked:true,host:new URL(String(options.origin)).hostname,method:options.method})+'\n');handler.onError(Error('external test transport disabled'));return true;}
 return dispatch(options,handler);
};undici.setGlobalDispatcher(agent);
