import {executeRelease,type Permit,type Ports} from './controller.ts';
import {verifyQualification,cleanSource,lockReleaseWriter} from './qualification.ts';
import {canonical} from './artifact.ts';
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
