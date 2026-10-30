import {createRecorder,measurementRevision,type Measurement,type Recorder} from './aggregate.ts';
import {installMeasurement} from './browser.ts';
export type ClientState='idle'|'submitted-unconfirmed'|'stopped'|'revoked';
export function createMeasurementClient(options:{enabled:boolean;origin:'https://agenticbible.si'|'http://127.0.0.1';consent:()=>boolean;send?:typeof fetch}){
 let queue:Measurement[]=[],pending:Promise<ClientState>|undefined,stopped=false,failed=false,state:ClientState='idle';
 const permitted=()=>{try{return options.enabled===true&&options.consent()&&navigator.doNotTrack!=='1'&&(navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl!==true;}catch{return false;}};
 const stop=(next:ClientState)=>{stopped=true;if(next==='stopped')failed=true;queue=[];state=next;};
 async function flush():Promise<ClientState>{
  if(pending)return pending;if(stopped)return state;
  if(!permitted()){queue=[];return state='revoked';}if(!queue.length)return state;
  const batch=queue;queue=[];
  const payload=JSON.stringify({schemaVersion:1,policyRevision:measurementRevision,consent:'granted',events:batch.map(({page,signal})=>({page,signal}))});
  if(new TextEncoder().encode(payload).length>4096){stop('stopped');return state;}
  // Recheck immediately before dispatch. Never persist or retry an unknown batch.
  if(!permitted()){queue=[];return state='revoked';}
  pending=(async()=>{let timer:ReturnType<typeof setTimeout>|undefined;try{
    await Promise.resolve(); // Assign pending before any sync transport failure.
    if(stopped||!permitted()){queue=[];return state='revoked';}
    const controller=new AbortController(),timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('unconfirmed send'));},5000);});
    const response=await Promise.race([(options.send??fetch)('/api/measurement',{method:'POST',credentials:'omit',mode:'same-origin',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json'},body:payload,signal:controller.signal}),timeout]);
    if(response.status!==202){stop('stopped');return state;}
    return state=stopped?state:'submitted-unconfirmed';
   }catch{stop('stopped');return state;}finally{if(timer)clearTimeout(timer);pending=undefined;}
  })();
  return pending;
 }
 const recorder:Recorder=createRecorder({enabled:options.enabled,origin:options.origin,sink(row){
  if(stopped||!permitted()||queue.length>=8)throw Error('measurement_queue_closed');queue.push(row);
  if(queue.length===8)queueMicrotask(()=>{void flush();});
 }});
 return {recorder,flush,revoke(){stop('revoked');},resume(){if(failed){state='stopped';return;}if(state==='revoked'&&permitted()){stopped=false;state='idle';}},dispose(){stop('stopped');},state:()=>state,queued:()=>queue.length};
}
/** The preference is a versioned boolean, never a visitor/session identifier. */
export function mountMeasurementConsent(root:HTMLElement,options:{enabled:boolean;origin:'https://agenticbible.si'|'http://127.0.0.1';send?:typeof fetch;storage?:Pick<Storage,'getItem'|'setItem'>}){
 const allowed=root.querySelector<HTMLButtonElement>('[data-measurement-allow]'),denied=root.querySelector<HTMLButtonElement>('[data-measurement-deny]'),status=root.querySelector<HTMLElement>('[data-measurement-status]');
 if(options.enabled!==true||!allowed||!denied||!status||location.origin!==options.origin)return ()=>{};
 const key='agentic-bible-aggregate-consent-v1';let granted=false,client:ReturnType<typeof createMeasurementClient>|undefined,uninstall:(()=>void)|undefined;
 let storage=options.storage;try{storage??=localStorage;granted=storage.getItem(key)==='aggregate-v1:granted';}catch{granted=false;}
 const optedOut=()=>navigator.doNotTrack==='1'||(navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl===true;
 const consent=()=>{try{return granted&&!optedOut()&&storage?.getItem(key)==='aggregate-v1:granted';}catch{return false;}};
 const start=()=>{if(!consent())return;client??=createMeasurementClient({...options,consent});client.resume();uninstall=installMeasurement(client.recorder,consent);void client.flush().then(render);};
 const render=()=>{root.hidden=false;allowed.disabled=optedOut();status.textContent=optedOut()?'Collection is off because your browser requests no tracking.':client?.state()==='stopped'?'Measurement paused for this page after an unconfirmed send. No retry was made.':consent()?'Optional aggregate measurement is on.':'Optional aggregate measurement is off.';};
 const grant=()=>{if(optedOut())return;granted=true;try{if(!storage)throw Error('preference unavailable');storage.setItem(key,'aggregate-v1:granted');}catch{granted=false;}uninstall?.();start();render();};
 const revoke=(persist:boolean)=>{granted=false;client?.revoke();uninstall?.();uninstall=undefined;if(persist)try{storage?.setItem(key,'aggregate-v1:denied');}catch{}render();};
 const deny=()=>revoke(true);
 const changed=(event:StorageEvent)=>{if((event.key===key&&event.newValue!=='aggregate-v1:granted')||event.key===null)revoke(false);};
 const flush=()=>{if(document.visibilityState==='hidden')void client?.flush().then(render);};
 allowed.addEventListener('click',grant);denied.addEventListener('click',deny);window.addEventListener('storage',changed);document.addEventListener('visibilitychange',flush);start();render();
 // Finite periodic flush, no persistent queue or automatic request retries.
 const timer=setInterval(()=>{void client?.flush().then(render);},2000);
 return ()=>{clearInterval(timer);uninstall?.();client?.dispose();allowed.removeEventListener('click',grant);denied.removeEventListener('click',deny);window.removeEventListener('storage',changed);document.removeEventListener('visibilitychange',flush);};
}
