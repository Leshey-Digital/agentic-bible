import {readReleaseFile} from './files.ts';
import {canonical,digest} from './artifact.ts';
import {releaseTarget} from './public.ts';
import {expectedStagingBindings,hasExactBindings,type RuntimeBinding} from './bindings.ts';

export type LegacyVersionSnapshot={
 versionId:string;
 number:number;
 createdOn:string;
 source:string;
 etag:string;
 candidateMessage:null;
 bindings:RuntimeBinding[];
};
export const legacyRuntimeSource='b41a422881921638833f92b2361a70eb1647d01f' as const;
export type LegacyRuntimeBodyB41a={
 schemaVersion:1;
 contentAuthority:'github-build';
 releaseCommit:typeof legacyRuntimeSource;
 releaseVerified:false;
 releaseManifestVerified:true;
 releaseManifestSha256:string;
 releaseBuildId:string;
 releaseVerification:'compiled-worker-manifest-binding';
 publicIntake:false;
 adminVerifierConfigured:true;
 adminApprovalsConfigured:false;
 gitHubProposalsConfigured:false;
 hostedCanonicalWrites:false;
 localFixtureIdentity:false;
};
export type LegacyRuntimeSnapshotB41a={
 schemaVersion:1;
 sourceCommit:typeof legacyRuntimeSource;
 status:200;
 body:LegacyRuntimeBodyB41a;
};
export type LegacyReleaseManifestB41a={
 schemaVersion:1;
 sourceCommit:typeof legacyRuntimeSource;
 sourceTree:string;
 buildId:string;
 assetsHash:string;
 target:typeof releaseTarget;
};
export type LegacyBaseline={
 schemaVersion:2;
 state:'legacy-baseline';
 target:typeof releaseTarget;
 observedAt:number;
 originalDeployment:{id:string;createdOn:string;source:string;strategy:'percentage';versionId:string;percentage:100};
 version:LegacyVersionSnapshot;
 releaseManifest:LegacyReleaseManifestB41a;
 assets:Record<string,{bytes:number;sha256:string}>;
 runtime:LegacyRuntimeSnapshotB41a;
};

const uuid=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);
const sha256=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const createdOn=(value:unknown)=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)&&Number.isFinite(Date.parse(value));
const exactKeys=(value:any,keys:string[])=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===keys.slice().sort().join(',');
const validSource=(value:unknown)=>typeof value==='string'&&['api','wrangler','terraform','dash','cf_cli','dash_template','integration','quick_editor','playground','workersci','unknown'].includes(value);
const validBindings=(value:unknown)=>Array.isArray(value)&&value.every((binding:any)=>typeof binding?.name==='string'&&typeof binding.type==='string'&&exactKeys(binding,binding.type==='d1'?['name','type','id']:['name','type'])&&(binding.type!=='d1'||typeof binding.id==='string'));
const runtimeBodyKeys=['schemaVersion','contentAuthority','releaseCommit','releaseVerified','releaseManifestVerified','releaseManifestSha256','releaseBuildId','releaseVerification','publicIntake','adminVerifierConfigured','adminApprovalsConfigured','gitHubProposalsConfigured','hostedCanonicalWrites','localFixtureIdentity'];
const releaseManifestKeys=['schemaVersion','sourceCommit','sourceTree','buildId','assetsHash','target'];
function legacyReleaseManifestBytes(value:LegacyReleaseManifestB41a){return Buffer.from(JSON.stringify({schemaVersion:value.schemaVersion,sourceCommit:value.sourceCommit,sourceTree:value.sourceTree,buildId:value.buildId,assetsHash:value.assetsHash,target:{account:value.target.account,worker:value.target.worker,origin:value.target.origin}})+'\n');}

function validLegacyRuntime(value:any):value is LegacyRuntimeSnapshotB41a{
 if(!exactKeys(value,['schemaVersion','sourceCommit','status','body'])||value.schemaVersion!==1||value.sourceCommit!==legacyRuntimeSource||value.status!==200)return false;
 const body=value.body;
 return exactKeys(body,runtimeBodyKeys)&&body.schemaVersion===1&&body.contentAuthority==='github-build'&&body.releaseCommit===legacyRuntimeSource&&body.releaseVerified===false&&body.releaseManifestVerified===true&&sha256(body.releaseManifestSha256)&&sha256(body.releaseBuildId)&&body.releaseVerification==='compiled-worker-manifest-binding'&&body.publicIntake===false&&body.adminVerifierConfigured===true&&body.adminApprovalsConfigured===false&&body.gitHubProposalsConfigured===false&&body.hostedCanonicalWrites===false&&body.localFixtureIdentity===false;
}
function validLegacyReleaseManifest(value:any):value is LegacyReleaseManifestB41a{
 return exactKeys(value,releaseManifestKeys)&&value.schemaVersion===1&&value.sourceCommit===legacyRuntimeSource&&/^[a-f0-9]{40}$/.test(value.sourceTree??'')&&sha256(value.buildId)&&sha256(value.assetsHash)&&canonical(value.target)===canonical(releaseTarget)&&value.buildId===digest(canonical({sourceCommit:value.sourceCommit,sourceTree:value.sourceTree,assetsHash:value.assetsHash,target:value.target}));
}

export function validateLegacyBaseline(value:unknown):LegacyBaseline{
 const b=value as any;
 if(!exactKeys(b,['schemaVersion','state','target','observedAt','originalDeployment','version','releaseManifest','assets','runtime'])||b.schemaVersion!==2||b.state!=='legacy-baseline'||canonical(b.target)!==canonical(releaseTarget)||!Number.isSafeInteger(b.observedAt))throw Error('release_legacy_baseline_invalid');
 if(!exactKeys(b.originalDeployment,['id','createdOn','source','strategy','versionId','percentage'])||!uuid(b.originalDeployment.id)||!createdOn(b.originalDeployment.createdOn)||!validSource(b.originalDeployment.source)||b.originalDeployment.strategy!=='percentage'||b.originalDeployment.versionId!==b.version?.versionId||b.originalDeployment.percentage!==100)throw Error('release_legacy_baseline_deployment');
 const v=b.version;
 if(!exactKeys(v,['versionId','number','createdOn','source','etag','candidateMessage','bindings'])||!uuid(v.versionId)||!Number.isSafeInteger(v.number)||v.number<1||!createdOn(v.createdOn)||!validSource(v.source)||!sha256(v.etag)||v.candidateMessage!==null||!validBindings(v.bindings)||!hasExactBindings(v.bindings,expectedStagingBindings))throw Error('release_legacy_baseline_version');
 if(!validLegacyRuntime(b.runtime))throw Error('release_legacy_baseline_runtime');
 if(!validLegacyReleaseManifest(b.releaseManifest)||b.runtime.body.releaseBuildId!==b.releaseManifest.buildId||b.runtime.body.releaseCommit!==b.releaseManifest.sourceCommit||b.runtime.body.releaseManifestSha256!==digest(legacyReleaseManifestBytes(b.releaseManifest)))throw Error('release_legacy_baseline_manifest');
 if(!b.assets||typeof b.assets!=='object'||Array.isArray(b.assets)||Object.keys(b.assets).length<1||Object.keys(b.assets).length>4096)throw Error('release_legacy_baseline_assets');
 for(const [path,file]of Object.entries(b.assets) as [string,any][]){if(!/^[a-zA-Z0-9_./-]{1,512}$/.test(path)||path.startsWith('/')||path.split('/').some((part:string)=>!part||part==='.'||part==='..')||path==='_headers'||path==='_redirects'||!exactKeys(file,['bytes','sha256'])||!Number.isSafeInteger(file.bytes)||file.bytes<0||!sha256(file.sha256))throw Error('release_legacy_baseline_assets');}
 const manifestBytes=legacyReleaseManifestBytes(b.releaseManifest);
 if(!b.assets['release.json']||b.assets['release.json'].bytes!==manifestBytes.length||b.assets['release.json'].sha256!==digest(manifestBytes))throw Error('release_legacy_baseline_manifest');
 return b as LegacyBaseline;
}

export function verifyLegacyBaseline(path:string,expectedDigest:string){
 if(!sha256(expectedDigest))throw Error('release_legacy_baseline_digest_required');
 const raw=readReleaseFile(path,262144).toString('utf8');let parsed:any;
 try{parsed=JSON.parse(raw);}catch{throw Error('release_legacy_baseline_invalid');}
 const baseline=validateLegacyBaseline(parsed);
 if(raw!==canonical(baseline)||digest(raw)!==expectedDigest)throw Error('release_legacy_baseline_digest_mismatch');
 return {baseline,digest:expectedDigest};
}

export function baselineDigest(baseline:LegacyBaseline){return digest(canonical(validateLegacyBaseline(baseline)));}

export function createLegacyBaseline(observation:Omit<LegacyBaseline,'schemaVersion'|'state'|'observedAt'|'target'>,observedAt=Date.now()){
 const baseline=validateLegacyBaseline({schemaVersion:2,state:'legacy-baseline',target:releaseTarget,observedAt,...observation});
 return {baseline,digest:baselineDigest(baseline)};
}

export function bindingSnapshot(bindings:readonly RuntimeBinding[]){
 return bindings.map(({name,type,id})=>({name,type,...(id===undefined?{}:{id})})).sort((a,b)=>a.name.localeCompare(b.name));
}

export function sameLegacyVersion(a:LegacyVersionSnapshot,b:LegacyVersionSnapshot){
 return canonical({versionId:a.versionId,number:a.number,createdOn:a.createdOn,source:a.source,etag:a.etag,candidateMessage:a.candidateMessage,bindings:bindingSnapshot(a.bindings)})===canonical({versionId:b.versionId,number:b.number,createdOn:b.createdOn,source:b.source,etag:b.etag,candidateMessage:b.candidateMessage,bindings:bindingSnapshot(b.bindings)});
}
