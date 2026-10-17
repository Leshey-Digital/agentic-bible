// Inert attribution metadata; authority comes from the separate persisted admin approval.
export type CorrectionCredit={approvalId:string;submissionId:string;submissionVersion:number;reviewer:'local-editor';approvedAt:number};
export function correctionCredits(value:unknown):CorrectionCredit[]{
  if(!Array.isArray(value)||value.length<1||value.length>6)throw Error('invalid_correction_credit');
  const ids=new Set<string>();return value.map(v=>{
    if(!v||Object.keys(v).sort().join(',')!=='approvalId,approvedAt,reviewer,submissionId,submissionVersion'||!/^([a-f0-9]{8}-){1}[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v.approvalId)||!/^([a-f0-9]{8}-){1}[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v.submissionId)||v.reviewer!=='local-editor'||!Number.isSafeInteger(v.submissionVersion)||v.submissionVersion<1||!Number.isSafeInteger(v.approvedAt)||v.approvedAt<0||ids.has(v.approvalId))throw Error('invalid_correction_credit');
    ids.add(v.approvalId);return {...v};
  });
}
