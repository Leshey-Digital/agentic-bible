import {hash} from '../hosted/contracts.ts';
export const releaseTarget={account:'c370be29e4065365de03bc8652da2cdc',worker:'agentic-bible-staging',origin:'https://staging.agenticbible.si'} as const;
declare const __AGENTIC_RELEASE_MANIFEST_SHA256__:string|undefined;
export async function runtimeRelease(assets:{fetch(request:Request):Promise<Response>}){
  const absent={releaseCommit:null,releaseVerified:false,releaseManifestVerified:false};
  if(typeof __AGENTIC_RELEASE_MANIFEST_SHA256__!=='string'||!/^[a-f0-9]{64}$/.test(__AGENTIC_RELEASE_MANIFEST_SHA256__))return absent;
  try{
    const response=await assets.fetch(new Request(releaseTarget.origin+'/release.json'));
    if(response.status!==200||Number(response.headers.get('content-length'))>4096)return absent;
    const reader=response.body?.getReader();if(!reader)return absent;let count=0;const chunks:Uint8Array[]=[];
    try{for(;;){const part=await reader.read();if(part.done)break;count+=part.value.length;if(count>4096){void reader.cancel();return absent;}chunks.push(part.value);}}finally{reader.releaseLock();}
    const bytes=new Uint8Array(count);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    if(await hash(bytes)!==__AGENTIC_RELEASE_MANIFEST_SHA256__)return absent;
    const manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    if(manifest.schemaVersion!==1||!/^[a-f0-9]{40}$/.test(manifest.sourceCommit)||!/^[a-f0-9]{64}$/.test(manifest.buildId)||JSON.stringify(manifest.target)!==JSON.stringify(releaseTarget))return absent;
    return {releaseCommit:manifest.sourceCommit,releaseVerified:false,releaseManifestVerified:true,releaseBuildId:manifest.buildId,releaseManifestSha256:__AGENTIC_RELEASE_MANIFEST_SHA256__,releaseVerification:'compiled-worker-manifest-binding'};
  }catch{return absent;}
}
