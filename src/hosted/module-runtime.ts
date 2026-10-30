import {createHostedRuntime} from './worker.ts';
import {configuredPorts} from './configuration.ts';
import {buildReviewSource,type BuildReviewSnapshot} from './build-review-source.ts';
import type {RuntimeEnv} from './contracts.ts';
/** Keep the dynamic router outermost: the read-only file server is only ASSETS. */
export function createModuleRuntime(assets:RuntimeEnv['ASSETS'],snapshot:BuildReviewSnapshot,options:{maintenance?:import('../hosted-maintenance/scheduled.ts').HostedMaintenanceAction}={}){
 const reviewSource=buildReviewSource(snapshot),maintenance=options.maintenance;
 return {async scheduled(event:import('../hosted-maintenance/scheduled.ts').HostedMaintenanceEvent){return createHostedRuntime({maintenance}).scheduled(event);},async fetch(request:Request,bindings:Omit<RuntimeEnv,'ASSETS'>){
  const env:RuntimeEnv={...bindings,ASSETS:assets},ports=await configuredPorts(env,request,reviewSource);
  if(env.HOSTED_PRIVATE_INBOX==='enabled'&&ports.contributions)ports.reviewSource=reviewSource;
  return createHostedRuntime(ports).fetch(request,env);
 }};
}
