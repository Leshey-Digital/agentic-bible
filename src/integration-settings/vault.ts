import type {SqlDatabase} from '../editorial/contracts.ts';
import type {IntegrationStorage,IntegrationRecord,IntegrationTransaction,IntegrationId,IntegrationAdapters,ConnectionEvidence} from './contracts.ts';
import {validateIntegrationRecord} from './record.ts';
import {repository} from '../hosted/contracts.ts';

type VaultRow={key_id:string;metadata_json:string;nonce:string;ciphertext:string};
type Options={connectionEvidence?:ConnectionEvidence;db:SqlDatabase;key:CryptoKey;keyId:string;trust:unknown;send:(request:Request)=>Promise<Response>};
const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes));
const decode=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const utf8=new TextEncoder();
const error=()=>new Error('integration_vault_unavailable');
// No construction occurs in configuredPorts or the shipped entrypoint. A server
// owner must supply a non-exportable key and scoped trusted transport explicitly.
export function createEncryptedIntegrationAdapters(options:Options):IntegrationAdapters{
  if(options.key.type!=='secret'||options.key.extractable||options.key.algorithm.name!=='AES-GCM'||(options.key.algorithm as AesKeyAlgorithm).length!==256||!options.key.usages.includes('encrypt')||!options.key.usages.includes('decrypt')||!/^[a-zA-Z0-9._-]{1,64}$/.test(options.keyId)||typeof options.send!=='function')throw error();
  const aad=(metadata:string,integration:IntegrationId)=>utf8.encode('agentic-bible-integration-vault-v1\n'+integration+'\n'+options.keyId+'\n'+metadata);
  async function lock<T>(integration:IntegrationId,work:()=>Promise<T>):Promise<T>{
    const token=crypto.randomUUID();
    const admitted=await options.db.prepare("INSERT INTO integration_vault_locks(integration,token,acquired_at) VALUES(?,?,?) ON CONFLICT DO NOTHING").bind(integration,token,Date.now()).run();
    if(admitted.meta.changes!==1)throw error();
    try{return await work();}finally{
      // A failed release deliberately leaves durable closed state. Never hide it
      // by taking over the lock or replaying a possibly started operation.
      const released=await options.db.prepare("DELETE FROM integration_vault_locks WHERE integration=? AND token=?").bind(integration,token).run();if(released.meta.changes!==1)throw error();
    }
  }
  async function load(integration:IntegrationId){
    const row=await options.db.prepare("SELECT * FROM integration_vault WHERE integration=?").bind(integration).first<VaultRow>();
    if(!row)return {record:null as IntegrationRecord|null,secret:null as string|null};
    if(row.key_id!==options.keyId||row.metadata_json.length>32768||row.ciphertext.length>1400||row.nonce.length!==16)throw error();
    const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(row.nonce),additionalData:aad(row.metadata_json,integration)},options.key,decode(row.ciphertext));
    const secret=new TextDecoder('utf-8',{fatal:true}).decode(clear);new Uint8Array(clear).fill(0);
    return {record:JSON.parse(row.metadata_json) as IntegrationRecord,secret};
  }
  const storage:IntegrationStorage={transaction<T>(integration:IntegrationId,work:(tx:IntegrationTransaction)=>Promise<T>):Promise<T>{
    if(!['github-content','typesafe-jev'].includes(integration))return Promise.reject(error());
    return lock(integration,async()=>{
      const current=await load(integration);let next:IntegrationRecord|null=null,replacement:string|null=null;
      const result=await work({read:async()=>structuredClone(current.record),replaceSecret:async secret=>{replacement=secret;},write:async record=>{next=structuredClone(record);}});
      if(!next){if(replacement!==null)throw error();return result;}
      const record:IntegrationRecord=next;
      if(record.revision!==(current.record?.revision??0)+(replacement===null?0:1)||(!current.record&&replacement===null))throw error();
      const secret=replacement??current.secret;if(!secret||utf8.encode(secret).byteLength>512)throw error();
      const metadata=JSON.stringify(record);if(metadata.length>32768)throw error();
      const nonce=crypto.getRandomValues(new Uint8Array(12)),plain=utf8.encode(secret);let ciphertext:ArrayBuffer;
      try{ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce,additionalData:aad(metadata,integration)},options.key,plain);}finally{plain.fill(0);}
      // Credential ciphertext, revision, ownership, budgets and audit live in one
      // atomic row statement. Callback failure never commits staged replacements.
      await options.db.prepare(`INSERT INTO integration_vault(integration,key_id,metadata_json,nonce,ciphertext) VALUES(?,?,?,?,?)
        ON CONFLICT(integration) DO UPDATE SET key_id=excluded.key_id,metadata_json=excluded.metadata_json,nonce=excluded.nonce,ciphertext=excluded.ciphertext`).bind(integration,options.keyId,metadata,encode(nonce),encode(new Uint8Array(ciphertext))).run();
      return result;
    });
  }};
  const testConnection:IntegrationAdapters['testConnection']=async input=>{
    if(input.integration!=='github-content'||input.signal.aborted)return 'unavailable';
    return lock(input.integration,async()=>{
      const current=await load(input.integration);
      if(!current.record||current.record.revision!==input.revision||!current.record.pendingTest||current.record.pendingTest.revision!==input.revision||!current.secret||input.signal.aborted)return 'unavailable';
      const controller=new AbortController(),abort=()=>controller.abort();input.signal.addEventListener('abort',abort,{once:true});
      let timer:ReturnType<typeof setTimeout>|undefined,reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
      const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();void reader?.cancel().catch(()=>{});reject(error());},900);});
      try{
        const transport=async()=>{
          // Current revision, credential resolution and this synchronous invocation
          // share the durable lock. Rotation cannot overtake dispatch admission.
          if(input.signal.aborted||controller.signal.aborted)return 'unavailable';
          const response=await options.send(new Request('https://api.github.com/repos/'+repository,{method:'GET',headers:{Authorization:'Bearer '+current.secret,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10','User-Agent':'Agentic-Bible-Integration-Check'},redirect:'manual',credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal}));
          if(response.redirected||![200,401,403,404].includes(response.status)){void response.body?.cancel().catch(()=>{});return 'unavailable';}
          if(Number(response.headers.get('content-length'))>8192){void response.body?.cancel().catch(()=>{});return 'unavailable';}
          reader=response.body?.getReader();let bytes=0;if(reader){for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>8192){void reader.cancel().catch(()=>{});return 'unavailable';}}}
          if(input.signal.aborted||controller.signal.aborted)return 'unavailable';
          return response.status===200?'connected':'rejected';
        };
        return await Promise.race([transport(),deadline]);
      }catch{return 'unavailable';}finally{clearTimeout(timer);controller.abort();input.signal.removeEventListener('abort',abort);try{reader?.releaseLock();}catch{}}
    });
  };
  const resolveJevCredential=async(ownerRef:string):Promise<string|null>=>{
    if(typeof ownerRef!=='string'||!/^signed-admin:[a-f0-9]{64}$/.test(ownerRef))return null;
    return lock('typesafe-jev',async()=>{
      const current=await load('typesafe-jev');
      const checked=validateIntegrationRecord(current.record);
      if(!checked||checked.ownerRef!==ownerRef||!current.secret)return null;
      return current.secret;
    });
  };
  return {trust:options.trust,storage,testConnection,resolveJevCredential,connectionEvidence:options.connectionEvidence??'unverified'};
}
