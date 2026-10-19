import type {SqlDatabase} from '../editorial/contracts.ts';

const dayMs=86_400_000,retentionDays=14;
export const abuseOutcomes=['accepted','duplicate','honeypot','rate_limited','rejected','forbidden','capacity','other_error'] as const;
export type AbuseOutcome=typeof abuseOutcomes[number];

/** HMAC a Cloudflare ingress address before using it as the existing rate key. */
export function createHmacClientKey(key:CryptoKey){
  return async(request:Request):Promise<string|null>=>{
    const address=request.headers.get('cf-connecting-ip');
    if(!address||address.length>64||/[\s\u0000-\u001f\u007f]/.test(address))return null;
    const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('agentic-bible-intake-rate-v1\n'+address));
    return 'hosted:'+Array.from(new Uint8Array(signature),b=>b.toString(16).padStart(2,'0')).join('');
  };
}

/** Aggregate only fixed outcomes by UTC day. No request, identity or content fields are accepted. */
export async function recordAbuseOutcome(db:SqlDatabase,outcome:AbuseOutcome,now=Date.now()):Promise<void>{
  if(!(abuseOutcomes as readonly string[]).includes(outcome)||!Number.isSafeInteger(now)||now<0)throw Error('abuse_counter_unavailable');
  const day=Math.floor(now/dayMs),cutoff=day-retentionDays+1;
  await db.batch([
    db.prepare('INSERT INTO hosted_abuse_counters(day,outcome,count) VALUES(?,?,1) ON CONFLICT(day,outcome) DO UPDATE SET count=MIN(count+1,1000000)').bind(day,outcome),
    db.prepare('DELETE FROM hosted_abuse_counters WHERE day < ?').bind(cutoff)
  ]);
}

export async function listAbuseOutcomes(db:SqlDatabase,now=Date.now()){
  const today=Math.floor(now/dayMs),cutoff=today-retentionDays+1;
  const result=await db.prepare('SELECT day,outcome,count FROM hosted_abuse_counters WHERE day>=? AND day<=? ORDER BY day DESC,outcome ASC LIMIT 112').bind(cutoff,today).all<{day:number;outcome:AbuseOutcome;count:number}>();
  if(result.results.length>112||result.results.some(row=>!Number.isSafeInteger(row.day)||!Number.isSafeInteger(row.count)||row.count<1||!(abuseOutcomes as readonly string[]).includes(row.outcome)))throw Error('abuse_counter_unavailable');
  return {retentionDays,items:result.results};
}
