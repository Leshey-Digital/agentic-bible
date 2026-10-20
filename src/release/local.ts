import {executeRelease,type Permit,type Ports} from './controller.ts';
import {executeLegacyRollback,type LegacyRollbackPermit,type LegacyRollbackReview} from './legacy.ts';
import {verifyQualification,cleanSource,lockReleaseWriter} from './qualification.ts';
import {canonical} from './artifact.ts';
import {verifyLegacyBaseline} from './legacy-baseline.ts';
export type IndependentReview={decision:'accepted';sourceCommit:string;candidateDigest:string;qualificationDigest:string};
// Review pins come from the trusted operator/independent review, never from a
// self-approval field inside the qualification directory. Checksums are integrity,
// not a signature or independent proof that an untrusted executor ran the tests.
export async function executeQualifiedRelease(repo:string,qualificationRoot:string,review:IndependentReview,operation:Pick<Permit,'ownerEnabled'|'exclusiveWriter'|'requestId'|'expectedActive'|'action'|'priorReceipt'>,ports:Ports,journal:string){
 if(review?.decision!=='accepted'||operation.ownerEnabled!==true||operation.exclusiveWriter!==true)throw Error('release_independent_review_and_exclusive_writer_required');
 const verified=verifyQualification(qualificationRoot,review.qualificationDigest,review.candidateDigest),q=verified.qualification;
 if(review.sourceCommit!==q.sourceCommit)throw Error('release_review_source_mismatch');
 const unlock=lockReleaseWriter(repo);try{
  const assertQualification=(current=false)=>{verifyQualification(qualificationRoot,review.qualificationDigest,review.candidateDigest);if(current&&operation.action==='deploy'&&canonical(cleanSource(repo))!==canonical({commit:q.sourceCommit,tree:q.sourceTree}))throw Error('release_qualification_source_changed');};
  const guarded:Ports={...ports,assertSource:async()=>{assertQualification(true);await ports.assertSource();assertQualification(true);},upload:async(...args)=>{assertQualification(true);return ports.upload(...args);},activate:async(...args)=>{assertQualification(true);return ports.activate(...args);}};
  assertQualification();
  return await executeRelease(verified.candidateRoot,{...operation,environment:'staging',repository:'Leshey-Digital/agentic-bible',sourceCommit:q.sourceCommit,candidateDigest:q.candidateDigest,qualificationDigest:review.qualificationDigest,reviewedQualificationDigest:review.qualificationDigest},guarded,journal);
 }finally{unlock();}
}

export async function executeQualifiedLegacyRollback(repo:string,qualificationRoot:string,baselinePath:string,review:LegacyRollbackReview,operation:LegacyRollbackPermit,ports:Ports,journal:string){
 if(review?.decision!=='accepted'||operation.ownerEnabled!==true||operation.exclusiveWriter!==true)throw Error('release_independent_review_and_exclusive_writer_required');
 if(!ports.legacyVersion||!ports.activateLegacy)throw Error('release_legacy_rollback_transport_required');
 const qualified=verifyQualification(qualificationRoot,review.qualificationDigest,review.candidateDigest),q=qualified.qualification;
 if(review.sourceCommit!==q.sourceCommit)throw Error('release_review_source_mismatch');
 const {baseline,digest:baselineDigest}=verifyLegacyBaseline(baselinePath,review.legacyBaselineDigest);
 const unlock=lockReleaseWriter(repo);try{
  const assertQualification=()=>verifyQualification(qualificationRoot,review.qualificationDigest,review.candidateDigest);
  const guarded:Ports={...ports,
   legacyVersion:async id=>{assertQualification();return ports.legacyVersion!(id);},
   activateLegacy:async(...args)=>{assertQualification();return ports.activateLegacy!(...args);},
  };
  return await executeLegacyRollback(qualified.candidateRoot,baseline,baselineDigest,{...review,legacyBaselineDigest:baselineDigest},operation,guarded,journal);
 }finally{unlock();}
}
