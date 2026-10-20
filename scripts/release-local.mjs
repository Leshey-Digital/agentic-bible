import {execFileSync} from 'node:child_process';import {join,resolve} from 'node:path';import {existsSync} from 'node:fs';import {executeQualifiedRelease,executeQualifiedLegacyRollback} from '../src/release/local.ts';import {connectorBridge} from '../src/release/bridge.ts';import {durableJson} from '../src/release/qualification.ts';import {canonical} from '../src/release/artifact.ts';import {readReleaseFile} from '../src/release/files.ts';
// No Actions/environment secret/API token. Live connector operations require the
// trusted operator to service explicit pending requests after independent review.
if(process.env.RELEASE_OWNER_ENABLED!=='true'||process.env.RELEASE_EXCLUSIVE_WRITER!=='true'||process.env.RELEASE_CONFIRM!=='agentic-bible-staging')throw Error('release_owner_review_and_exclusive_writer_confirmation_required');
const [root,qDigest,cDigest,sourceCommit,requestId,active,action,prior,...extra]=process.argv.slice(2);
const actionOk=['deploy','rollback','rollback-legacy'].includes(action??'');
const argsOk=action==='deploy'?!prior&&!extra.length:action==='rollback'?!!prior&&!extra.length:action==='rollback-legacy'?!!prior&&extra.length===1&&/^[a-f0-9]{64}$/.test(extra[0]??''):false;
if(!root||!argsOk||!actionOk||!/^[a-f0-9]{64}$/.test(qDigest??'')||!/^[a-f0-9]{64}$/.test(cDigest??'')||!/^[a-f0-9]{40}$/.test(sourceCommit??'')||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(requestId??'')||!(active==='none'||/^[a-f0-9-]{36}$/.test(active??''))||(action==='rollback-legacy'&&active==='none'))throw Error('release_exact_local_inputs_required');
const git=execFileSync('git',['rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim(),directory=join(git,'release-executions',requestId),expectedActive=active==='none'?null:active,ports=connectorBridge(process.cwd(),join(directory,'rpc'),sourceCommit,expectedActive,{qualificationDigest:qDigest});
if(action==='rollback-legacy'){
 const review={decision:'accepted',qualificationDigest:qDigest,candidateDigest:cDigest,sourceCommit,legacyBaselineDigest:extra[0]};
 const outcome=await executeQualifiedLegacyRollback(process.cwd(),resolve(root),resolve(prior),review,{ownerEnabled:true,exclusiveWriter:true,requestId,expectedActive},ports,join(directory,'legacy-journal.json'));
 const path=join(directory,'legacy-rollback.json');if(existsSync(path)){if(readReleaseFile(path,65536).toString('utf8')!==canonical(outcome))throw Error('release_legacy_record_conflict');}else durableJson(path,outcome);
 console.log(JSON.stringify({state:outcome.state,sourceCommit:outcome.sourceCommit,versionId:outcome.versionId,legacyBaselineDigest:outcome.legacyBaselineDigest,record:path}));
}else{
 const priorReceipt=prior?JSON.parse(readReleaseFile(resolve(prior),65536).toString('utf8')):undefined;
 const receipt=await executeQualifiedRelease(process.cwd(),resolve(root),{decision:'accepted',qualificationDigest:qDigest,candidateDigest:cDigest,sourceCommit},{ownerEnabled:true,exclusiveWriter:true,requestId,expectedActive,action,priorReceipt},ports,join(directory,'journal.json'));
 const path=join(directory,'receipt.json');if(existsSync(path)){if(readReleaseFile(path,65536).toString('utf8')!==canonical(receipt))throw Error('release_receipt_conflict');}else durableJson(path,receipt);console.log(JSON.stringify({state:receipt.state,sourceCommit:receipt.sourceCommit,versionId:receipt.versionId,receipt:path}));
}
