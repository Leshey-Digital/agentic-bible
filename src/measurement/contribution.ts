import type {Signal} from './aggregate.ts';
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
export function closedIntakeSignal(status:number,value:unknown):Signal {
  if(status===200&&object(value)&&value.publicIntake===false&&typeof value.mode==='string'&&
    (['hosted-contributions','hosted-admin-notes','hosted-unconfigured'].includes(value.mode)||value.mode==='local-synthetic-only'&&value.enabled===false))return {event:'contribution_result',outcome:'closed'};
  return {event:'reader_error',component:'contribution'};
}
export function submissionSignal(status:number,value:unknown):Signal {
  if(object(value)&&value.received===true&&typeof value.reference==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value.reference)){
    if(status===201&&value.duplicate===false)return {event:'contribution_result',outcome:'saved'};
    if(status===200&&value.duplicate===true)return {event:'contribution_result',outcome:'duplicate'};
  }
  if([400,403,409,415,422,429].includes(status)&&object(value)&&typeof value.error==='string')return {event:'contribution_result',outcome:'rejected'};
  // 202 is deliberately not a saved receipt. Unknown 2xx, 5xx and lost replies
  // do not establish that nothing was saved; no retry or reference is recorded.
  return {event:'contribution_result',outcome:'unconfirmed'};
}
