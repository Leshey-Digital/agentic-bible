import {HttpObservationStore,HttpStoreError} from './http-store.ts';
import {createWorkersHttpPass} from './http-workers.ts';
import type {WebFetch} from './http-core.ts';

// Explicit single-job action for trusted callers. No route, cron, model or publisher.
// A retry requires the SAME key after persisted backoff, and charges a new reservation.
export async function checkHttpSource(store:HttpObservationStore,id:unknown,key:unknown,send?:WebFetch,clock:()=>number=Date.now){
  const job=await store.enqueue(id,key,clock());
  const lease=await store.claim(job.request_key,clock());
  if(!lease)return store.status(job.request_key);
  const result=await createWorkersHttpPass(send,clock).check(lease.sourceId,lease.lastGood);
  if(!await store.finish(lease,result,clock()))throw new HttpStoreError('http_lease_lost');
  return store.status(job.request_key);
}
