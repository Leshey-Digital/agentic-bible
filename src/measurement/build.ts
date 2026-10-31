import {measurementPage} from './aggregate.ts';
export function publicMeasurementBuild(raw:unknown,context:{mode:string;origin:string;path:string;synthetic:boolean}){
 if(context.synthetic||context.mode!=='canonical'||context.origin!=='https://agenticbible.si'||!measurementPage(context.path)||typeof raw!=='string'||raw.length>128)return false;
 try{const v=JSON.parse(raw);return !!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')==='enabled,policyRevision,schemaVersion'&&v.enabled===true&&v.policyRevision==='aggregate-v1'&&v.schemaVersion===1;}catch{return false;}
}
