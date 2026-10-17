import {channel} from 'node:diagnostics_channel';
import {safeFailure} from '../../src/wiki-bridge/diagnostics.ts';
const started=new WeakMap(),errors=[];
const category=request=>{try{const host=new URL(String(request.origin)).hostname;return host==='workers.cloudflare.com'?'cf-metadata':['127.0.0.1','localhost','[::1]'].includes(host)?'loopback':'external';}catch{return 'unknown';}};
channel('undici:request:create').subscribe(({request})=>{if(request&&typeof request==='object')started.set(request,performance.now());});
channel('undici:request:error').subscribe(({request,error})=>{if(errors.length>=16)return;const at=request&&typeof request==='object'?started.get(request):undefined;errors.push({phase:'undici-request-error',target:category(request),method:['GET','POST','HEAD','PUT','PATCH','DELETE','OPTIONS'].includes(request?.method)?request.method:'OTHER',elapsedMs:at===undefined?null:Math.round(performance.now()-at),error:safeFailure(error)});});
export const runtimeNetworkDiagnostics=()=>({pid:process.pid,errors:[...errors]});
let reported=false;process.on('beforeExit',()=>{if(reported||!errors.length)return;reported=true;process.stderr.write('AB_RUNTIME_DIAGNOSTIC '+JSON.stringify(runtimeNetworkDiagnostics())+'\n');});
