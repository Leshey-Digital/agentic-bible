import {createRequire} from 'node:module';
import {dirname} from 'node:path';
import {appendFileSync} from 'node:fs';
const require=createRequire(import.meta.url),undici=require(require.resolve('undici',{paths:[dirname(require.resolve('miniflare'))]})),agent=new undici.MockAgent();
let written=0;const record=value=>{if(written++<16)appendFileSync(process.env.AB_SEO_CLI_NETWORK_EVIDENCE,JSON.stringify(value)+'\n');else if(written===17)appendFileSync(process.env.AB_SEO_CLI_NETWORK_EVIDENCE,JSON.stringify({phase:'diagnostic-cap'})+'\n');};
const local=host=>['127.0.0.1','localhost','[::1]'].includes(host);
agent.disableNetConnect();agent.enableNetConnect(host=>local(new URL('http://'+host).hostname));
const dispatch=agent.dispatch.bind(agent);agent.dispatch=(options,handler)=>{
  const host=new URL(String(options.origin)).hostname;
  if(!local(host))record({phase:'blocked-external',target:host==='workers.cloudflare.com'?'cf-metadata':host==='registry.npmjs.org'?'package-update':'external',method:['GET','HEAD','POST'].includes(options.method)?options.method:'OTHER'});
  return dispatch(options,handler);
};undici.setGlobalDispatcher(agent);record({phase:'preloaded',pid:process.pid});
