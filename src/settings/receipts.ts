import { fieldsFor, groups, record, validateValues } from './contracts.ts';

export const receiptLimits=Object.freeze({count:128,windowMs:86_400_000,responseBytes:32768});
export class SettingsReceiptCapacityError extends Error {}
const exact=(value:Record<string,unknown>,keys:string[])=>Object.keys(value).length===keys.length&&Object.keys(value).every(key=>keys.includes(key));
const integer=(value:unknown,min=0)=>Number.isSafeInteger(value)&&(value as number)>=min;

// Historical replies stay private. Revalidate their complete allowlisted shape before returning any bytes.
export function validateReceiptResponse(response:string):void{
  if(new TextEncoder().encode(response).byteLength>receiptLimits.responseBytes)throw new SettingsReceiptCapacityError();
  const value:unknown=JSON.parse(response);
  if(!record(value)||!exact(value,['settings','audit','trackingEnabled','secretsStatus','adsEnabled','result'])||value.result!=='unchanged'||value.trackingEnabled!==false||value.adsEnabled!==false||value.secretsStatus!=='unavailable'||!record(value.settings)||!exact(value.settings,[...groups])||!Array.isArray(value.audit)||value.audit.length>30)throw new Error('settings_receipt_unavailable');
  for(const group of groups){
    const setting=value.settings[group];
    if(!record(setting)||!exact(setting,['group','values','version','updatedAt'])||setting.group!==group||!integer(setting.version,1)||!integer(setting.updatedAt))throw new Error('settings_receipt_unavailable');
    try{validateValues(group,setting.values);}catch{throw new Error('settings_receipt_unavailable');}
  }
  for(const entry of value.audit){
    if(!record(entry)||!exact(entry,['actor','group','version','fields','createdAt'])||typeof entry.actor!=='string'||!/^[a-z0-9-]{1,100}$/.test(entry.actor)||!(groups as readonly unknown[]).includes(entry.group)||!integer(entry.version,1)||!integer(entry.createdAt)||!Array.isArray(entry.fields)||entry.fields.length>4||entry.fields.some(field=>typeof field!=='string'||!fieldsFor(entry.group as typeof groups[number]).includes(field)))throw new Error('settings_receipt_unavailable');
  }
}
