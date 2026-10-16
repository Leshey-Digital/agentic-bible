import { validateCatalog, type SourceCatalog } from './catalog.ts';
import { limits, MonitorError, type FixtureTransport, type Lease, type Observation } from './contracts.ts';
import { MonitorStore } from './store.ts';

function validator(value:string|null,kind:'etag'|'date') {
  if(value===null)return null;
  if(value.length>200||/[\r\n\x00-\x1f]/.test(value)||(kind==='etag'?!/^(W\/)?"[\x21\x23-\x7e]*"$/.test(value):!Number.isFinite(Date.parse(value)))) throw new MonitorError('malformed_validator');
  return value;
}
async function observe(lease:Lease,transport:FixtureTransport,signal:AbortSignal):Promise<Observation> {
  const headers=new Headers({Accept:'text/html, text/plain, application/json','User-Agent':'AgenticBible-LocalFixture/1'});
  if(lease.source.etag)headers.set('If-None-Match',validator(lease.source.etag,'etag')!);
  else if(lease.source.lastModified)headers.set('If-Modified-Since',validator(lease.source.lastModified,'date')!);
  const response=await transport.fetch(lease.source.url,{headers,redirect:'manual',signal,scenario:lease.job.scenario,attempt:lease.job.attempts});
  if(response.status===304) {
    if(!lease.source.hash)throw new MonitorError('missing_baseline_evidence');
    return {kind:'not-modified',hash:lease.source.hash,etag:lease.source.etag,lastModified:lease.source.lastModified,bytes:0};
  }
  if(response.status>=300&&response.status<400)throw new MonitorError('redirect_blocked');
  if(response.status===429||response.status===408||response.status>=500)throw new MonitorError('http_'+response.status,true);
  if(response.status!==200)throw new MonitorError('http_'+response.status);
  const contentType=response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  if(!['text/html','text/plain','application/json'].includes(contentType??''))throw new MonitorError('malformed_content_type');
  const etag=validator(response.headers.get('ETag'),'etag');
  const lastModified=validator(response.headers.get('Last-Modified'),'date');
  const reader=response.body?.getReader();if(!reader)throw new MonitorError('empty_payload');
  const cancel=()=>{void reader.cancel().catch(()=>{});};
  signal.addEventListener('abort',cancel,{once:true});
  const chunks:Uint8Array[]=[];let length=0;
  try {
    while(true) {
      if(signal.aborted)throw new MonitorError('timeout',true);
      const {value,done}=await reader.read();if(done)break;
      length+=value.byteLength;
      if(length>limits.responseBytes){await reader.cancel();throw new MonitorError('payload_too_large');}
      chunks.push(value);
    }
  } finally {signal.removeEventListener('abort',cancel);}
  if(!length)throw new MonitorError('empty_payload');
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try {const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(contentType==='application/json')JSON.parse(text);}catch{throw new MonitorError('malformed_payload');}
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  return {kind:lease.source.hash===null?'baseline':lease.source.hash===hash?'unchanged':'changed',hash,etag,lastModified,bytes:length};
}

export async function runJob(store:MonitorStore,catalog:SourceCatalog,id:string,transport:FixtureTransport,clock:()=>number=Date.now,timeoutMs:number=limits.timeoutMs) {
  const now=clock();
  await validateCatalog(catalog);
  // A caller cannot switch this foundation to live HTTP, or enlarge its deadline.
  if(transport.mode!=='fixture'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>limits.timeoutMs)throw new MonitorError('live_transport_disabled');
  const job=await store.job(id);if(!job)throw new MonitorError('missing_job');
  const allowed=catalog.sources.find(source=>source.id===job.sourceId);
  if(!allowed)throw new MonitorError('source_not_allowlisted');
  const lease=await store.claim(id,now);if(!lease)return {state:(await store.job(id))?.state??'missing',dispatched:false};
  if(lease.source.url!==allowed.url||!Array.isArray(lease.source.articleIds)||lease.source.articleIds.some(article=>!allowed.articleIds.includes(article))) {
    await store.fail(lease,new MonitorError('source_not_allowlisted'),now);return {state:'dead',dispatched:false};
  }
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  try {
    const observation=await Promise.race([
      observe(lease,transport,controller.signal).catch(error=>{throw error instanceof MonitorError?error:new MonitorError('network_failure',true);}),
      new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new MonitorError('timeout',true));},timeoutMs);}),
    ]);
    const saved=await store.complete(lease,observation,clock());
    if(!saved)await store.fail(lease,new MonitorError('recording_conflict_or_capacity',true),clock());
  } catch(error) {await store.fail(lease,error instanceof MonitorError?error:new MonitorError('storage_failure',true),clock());}
  finally {if(timer)clearTimeout(timer);controller.abort();}
  return {state:(await store.job(id))?.state??'missing',dispatched:true};
}

export async function runDue(store:MonitorStore,catalog:SourceCatalog,transport:FixtureTransport,clock:()=>number=Date.now) {
  const results=[];for(const job of await store.due(clock()))results.push(await runJob(store,catalog,job.id,transport,clock));return results;
}

// This is a callable planner, not a registered Worker scheduled handler or live cron.
export async function scheduleChecks(store:MonitorStore,catalog:SourceCatalog,now=Date.now()) {
  await validateCatalog(catalog);await store.seed(catalog);
  const slot=Math.floor(now/3_600_000);const jobs=[];
  const states=await store.sources();
  for(const source of states.filter(source=>catalog.sources.some(allowed=>allowed.id===source.id))) {
    const key=`hour:${slot}:${source.id}`;
    if(await store.hasJobKey(key))continue;
    const job=await store.enqueue(source.id,'unchanged',key,now);
    jobs.push(job);if(jobs.length>=limits.perRun)break;
  }
  return jobs;
}
