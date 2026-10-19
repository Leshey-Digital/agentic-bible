import {integrationLimits} from './limits.ts';
type IntegrationRecord={ownerRef:string;revision:number;requestKeys:string[];testsUsed:number;lastTest:'connected'|'rejected'|'unavailable'|'timeout'|'pending'|'never';pendingTest:{revision:number;requestKey:string}|null;audit:{operation:'configure'|'rotate'|'test';revision:number;eventId:string;at:number;result:'connected'|'rejected'|'unavailable'|'timeout'|'configured'|'rotated'|'reserved'}[]};

const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(value);
const result=(value:unknown)=>['connected','rejected','unavailable','timeout'].includes(value as string);
const fail=():never=>{throw new Error('integration_contract_unavailable');};

export function validateIntegrationRecord(value:unknown):IntegrationRecord|null{
  if(value===null)return null;
  if(!object(value))fail();const current=value as unknown as IntegrationRecord;
  if(Object.keys(current).sort().join(',')!=='audit,lastTest,ownerRef,pendingTest,requestKeys,revision,testsUsed'||typeof current.ownerRef!=='string'||!/^signed-admin:[a-f0-9]{64}$/.test(current.ownerRef)||!Number.isSafeInteger(current.revision)||current.revision<1||current.revision>integrationLimits.events||!Array.isArray(current.requestKeys)||current.requestKeys.length>integrationLimits.events||current.requestKeys.some(k=>!uuid(k))||new Set(current.requestKeys).size!==current.requestKeys.length||!Number.isSafeInteger(current.testsUsed)||current.testsUsed<0||current.testsUsed>integrationLimits.tests||(!result(current.lastTest)&&!['pending','never'].includes(current.lastTest))||!Array.isArray(current.audit)||current.audit.length>integrationLimits.events)fail();
  if(current.pendingTest!==null&&(!object(current.pendingTest)||Object.keys(current.pendingTest).sort().join(',')!=='requestKey,revision'||!uuid(current.pendingTest.requestKey)||current.pendingTest.revision!==current.revision||!current.requestKeys.includes(current.pendingTest.requestKey)))fail();
  if((current.lastTest==='pending')!==(current.pendingTest!==null))fail();
  for(const event of current.audit){
    if(!object(event)||Object.keys(event).sort().join(',')!=='at,eventId,operation,result,revision'||!['configure','rotate','test'].includes(event.operation)||!uuid(event.eventId)||!Number.isSafeInteger(event.revision)||event.revision<1||event.revision>current.revision||!Number.isSafeInteger(event.at)||event.at<0||(!result(event.result)&&!['configured','rotated','reserved'].includes(event.result)))fail();
  }
  return structuredClone(current);
}
