const KEY_BYTES=32,MAX_PAYLOAD_BYTES=96*1024*1024,MAX_ENVELOPE_BYTES=132*1024*1024,DEFAULT_RETENTION_DAYS=7;
const SOURCE=/^[a-f0-9]{40}$/;
const SHA=/^[a-f0-9]{64}$/;
const DAY=/^\d{4}-\d\d-\d\d$/;

export type RecoveryObject={key:string;uploaded?:Date};
export interface RecoveryObjectStore{
 put(key:string,value:ArrayBuffer|ArrayBufferView,options?:{httpMetadata?:{contentType?:string};customMetadata?:Record<string,string>}):Promise<unknown>;
 get(key:string):Promise<{size:number;arrayBuffer():Promise<ArrayBuffer>}|null>;
 list(options:{prefix:string;cursor?:string;limit?:number}):Promise<{objects:RecoveryObject[];truncated?:boolean;cursor?:string}>;
 delete(key:string):Promise<unknown>;
}
export type RecoveryCloudflareEnv={
 RECOVERY_BACKUP_ENABLED?:string;
 RECOVERY_BACKUP_BUCKET?:RecoveryObjectStore;
 RECOVERY_BACKUP_ENCRYPTION_KEY?:string;
 RECOVERY_BACKUP_RETENTION_DAYS?:string;
};
export type RecoveryConfiguration={
 enabled:boolean;reason:'enabled'|'disabled'|'bucket_missing'|'key_missing'|'key_invalid'|'retention_invalid';
 bucket?:RecoveryObjectStore;key?:CryptoKey;keyId?:string;retentionDays:number;prefix:string;
};
export type RecoveryMetadata={sourceCommit:string;capturedAt:string};

type Envelope={schemaVersion:1;kind:'agentic-bible-encrypted-recovery';cipher:'AES-256-GCM';keyId:string;nonce:string;sourceCommit:string;capturedAt:string;payloadSha256:string;ciphertext:string};

function bufferSource(bytes:Uint8Array){const copy=new ArrayBuffer(bytes.byteLength);new Uint8Array(copy).set(bytes);return copy;}
async function digest(bytes:Uint8Array){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bufferSource(bytes)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
function validTimestamp(value:string){return /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;}
function fromBase64Url(value:string):Uint8Array{
 if(!/^[A-Za-z0-9_-]{43}$/.test(value))throw new Error('recovery_encryption_key_invalid');
 const raw=atob(value.replace(/-/g,'+').replace(/_/g,'/')+'=');
 const result=Uint8Array.from(raw,c=>c.charCodeAt(0));
 if(result.length!==KEY_BYTES)throw new Error('recovery_encryption_key_invalid');
 return result;
}
function base64(value:Uint8Array){let raw='';for(const byte of value)raw+=String.fromCharCode(byte);return btoa(raw);}
function unbase64(value:string){
 if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))throw new Error('recovery_envelope_invalid');
 const raw=atob(value);return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
function aad(key:string,sourceCommit:string,capturedAt:string){return new TextEncoder().encode(`${key}\n${sourceCommit}\n${capturedAt}`);}
function objectKey(prefix:string,day:string){return `${prefix}/${day}/daily.enc.json`;}
function dayCutoff(capturedAt:string,retentionDays:number){const d=new Date(capturedAt);d.setUTCHours(0,0,0,0);d.setUTCDate(d.getUTCDate()-retentionDays+1);return d.toISOString().slice(0,10);}

/** Resolve an opt-in Cloudflare R2 adapter. No schedule or binding is created here. */
export async function recoveryConfiguration(env:RecoveryCloudflareEnv):Promise<RecoveryConfiguration>{
 const base={retentionDays:DEFAULT_RETENTION_DAYS,prefix:'agentic-bible/recovery/v1'};
 if(env.RECOVERY_BACKUP_ENABLED!=='true')return {...base,enabled:false,reason:'disabled'};
 if(!env.RECOVERY_BACKUP_BUCKET)return {...base,enabled:false,reason:'bucket_missing'};
 if(!env.RECOVERY_BACKUP_ENCRYPTION_KEY)return {...base,enabled:false,reason:'key_missing'};
 let bytes:Uint8Array;
 try{bytes=fromBase64Url(env.RECOVERY_BACKUP_ENCRYPTION_KEY);}catch{return {...base,enabled:false,reason:'key_invalid'};}
 const configuredRetention=env.RECOVERY_BACKUP_RETENTION_DAYS;
 let retentionDays=DEFAULT_RETENTION_DAYS;
 if(configuredRetention!==undefined){
  if(!/^(?:[1-9]|[1-2]\d|30)$/.test(configuredRetention))return {...base,enabled:false,reason:'retention_invalid'};
  retentionDays=Number(configuredRetention);
 }
 const key=await crypto.subtle.importKey('raw',bufferSource(bytes),{name:'AES-GCM'},false,['encrypt','decrypt']);
 const keyId=(await digest(bytes)).slice(0,16);
 bytes.fill(0);
 return {enabled:true,reason:'enabled',bucket:env.RECOVERY_BACKUP_BUCKET,key,keyId,retentionDays,prefix:base.prefix};
}

async function encryptPayload(config:RecoveryConfiguration,key:string,metadata:RecoveryMetadata,payload:Uint8Array):Promise<Uint8Array>{
 if(!config.key||!config.keyId)throw new Error('recovery_adapter_unconfigured');
 if(payload.byteLength>MAX_PAYLOAD_BYTES)throw new Error('recovery_payload_limit');
 if(!SOURCE.test(metadata.sourceCommit)||!validTimestamp(metadata.capturedAt))throw new Error('recovery_metadata_invalid');
 const nonce=new Uint8Array(new ArrayBuffer(12));crypto.getRandomValues(nonce);
 const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:bufferSource(nonce),additionalData:bufferSource(aad(key,metadata.sourceCommit,metadata.capturedAt)),tagLength:128},config.key,bufferSource(payload)));
 const envelope:Envelope={schemaVersion:1,kind:'agentic-bible-encrypted-recovery',cipher:'AES-256-GCM',keyId:config.keyId,nonce:base64(nonce),sourceCommit:metadata.sourceCommit,capturedAt:metadata.capturedAt,payloadSha256:await digest(payload),ciphertext:base64(ciphertext)};
 return new TextEncoder().encode(JSON.stringify(envelope));
}

function parseEnvelope(value:unknown):Envelope{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('recovery_envelope_invalid');
 const x=value as Record<string,unknown>,keys=['schemaVersion','kind','cipher','keyId','nonce','sourceCommit','capturedAt','payloadSha256','ciphertext'];
 if(Object.keys(x).sort().join(',')!==keys.sort().join(',')||x.schemaVersion!==1||x.kind!=='agentic-bible-encrypted-recovery'||x.cipher!=='AES-256-GCM'||typeof x.keyId!=='string'||!/^[a-f0-9]{16}$/.test(x.keyId)||typeof x.sourceCommit!=='string'||!SOURCE.test(x.sourceCommit)||typeof x.capturedAt!=='string'||!validTimestamp(x.capturedAt)||typeof x.payloadSha256!=='string'||!SHA.test(x.payloadSha256)||typeof x.nonce!=='string'||typeof x.ciphertext!=='string')throw new Error('recovery_envelope_invalid');
 return x as Envelope;
}

async function decryptPayload(config:RecoveryConfiguration,key:string,bytes:ArrayBuffer):Promise<{metadata:RecoveryMetadata;payload:Uint8Array}>{
 if(!config.key||!config.keyId)throw new Error('recovery_adapter_unconfigured');
 let envelope:Envelope;
 try{envelope=parseEnvelope(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));}catch{throw new Error('recovery_envelope_invalid');}
 if(envelope.keyId!==config.keyId)throw new Error('recovery_encryption_key_mismatch');
 let payload:Uint8Array;
 try{payload=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:bufferSource(unbase64(envelope.nonce)),additionalData:bufferSource(aad(key,envelope.sourceCommit,envelope.capturedAt)),tagLength:128},config.key,bufferSource(unbase64(envelope.ciphertext))));}catch{throw new Error('recovery_authentication_failed');}
 if(payload.byteLength>MAX_PAYLOAD_BYTES||await digest(payload)!==envelope.payloadSha256)throw new Error('recovery_payload_digest_mismatch');
 return {metadata:{sourceCommit:envelope.sourceCommit,capturedAt:envelope.capturedAt},payload};
}

/** Store a caller-produced recovery bundle encrypted at rest in the configured bucket. */
export async function storeEncryptedRecovery(config:RecoveryConfiguration,payload:Uint8Array,metadata:RecoveryMetadata){
 if(!config.enabled||!config.bucket)throw new Error('recovery_adapter_unconfigured');
 if(!SOURCE.test(metadata.sourceCommit)||!validTimestamp(metadata.capturedAt))throw new Error('recovery_metadata_invalid');
 const day=metadata.capturedAt.slice(0,10),key=objectKey(config.prefix,day),envelope=await encryptPayload(config,key,metadata,payload);
 if(envelope.byteLength>MAX_ENVELOPE_BYTES)throw new Error('recovery_envelope_limit');
 await config.bucket.put(key,envelope,{httpMetadata:{contentType:'application/vnd.agentic-bible.recovery+json'},customMetadata:{kind:'encrypted-recovery-v1',sourceCommit:metadata.sourceCommit,capturedAt:metadata.capturedAt,keyId:config.keyId!}});
 const removed=await pruneExpiredRecovery(config,metadata.capturedAt);
 return {key,day,sourceCommit:metadata.sourceCommit,retentionDays:config.retentionDays,removed};
}

/** Decrypt and authenticate an exact object before handing it to restoreRecoveryBackup. */
export async function loadEncryptedRecovery(config:RecoveryConfiguration,key:string){
 if(!config.enabled||!config.bucket||!key.startsWith(`${config.prefix}/`))throw new Error('recovery_adapter_unconfigured');
 const object=await config.bucket.get(key);if(!object)throw new Error('recovery_object_missing');
 if(!Number.isSafeInteger(object.size)||object.size<1||object.size>MAX_ENVELOPE_BYTES)throw new Error('recovery_envelope_limit');
 const result=await decryptPayload(config,key,await object.arrayBuffer());
 return {...result,key};
}

/** Retention is opt-in with the store operation; default is a provisional seven UTC days. */
export async function pruneExpiredRecovery(config:RecoveryConfiguration,now:string){
 if(!config.enabled||!config.bucket)throw new Error('recovery_adapter_unconfigured');
 if(!validTimestamp(now))throw new Error('recovery_metadata_invalid');
 const cutoff=dayCutoff(now,config.retentionDays);let cursor:string|undefined,removed=0;
 do{
  const page=await config.bucket.list({prefix:`${config.prefix}/`,cursor,limit:1000});
  for(const item of page.objects){
   const remainder=item.key.startsWith(`${config.prefix}/`)?item.key.slice(config.prefix.length+1):'';
   const match=/^(\d{4}-\d{2}-\d{2})\/daily\.enc\.json$/.exec(remainder);
   if(match&&DAY.test(match[1])&&match[1]<cutoff){await config.bucket.delete(item.key);removed++;}
  }
  cursor=page.truncated?page.cursor:undefined;
  if(page.truncated&&!cursor)throw new Error('recovery_bucket_cursor_invalid');
 }while(cursor);
 return removed;
}
