import {canonical,hash,type VerifiedAdmin} from './contracts.ts';
export const hostedOrigin='https://staging.agenticbible.si';
type PublicKey=JsonWebKey&{kid:string};
export type AdminTrust={issuer:string;audience:string;assertionHeader:'cf-access-jwt-assertion';subjects:string[];keys:PublicKey[]};
const object=(v:any)=>v&&typeof v==='object'&&!Array.isArray(v);
export function adminTrust(raw:unknown):AdminTrust|null{
  try{
    if(typeof raw!=='string'||raw.length>16384)return null;const v=JSON.parse(raw);
    if(!object(v)||Object.keys(v).sort().join(',')!=='assertionHeader,audience,issuer,keys,subjects'||v.assertionHeader!=='cf-access-jwt-assertion'||typeof v.issuer!=='string'||v.issuer.length>256||typeof v.audience!=='string'||!v.audience||v.audience.length>256)return null;
    const issuer=new URL(v.issuer);if(issuer.protocol!=='https:'||issuer.username||issuer.password||issuer.search||issuer.hash)return null;
    if(!Array.isArray(v.subjects)||!v.subjects.length||v.subjects.length>8||new Set(v.subjects).size!==v.subjects.length||v.subjects.some((s:any)=>typeof s!=='string'||!s||s.length>256||['local-editor','local-reader'].includes(s)))return null;
    if(!Array.isArray(v.keys)||!v.keys.length||v.keys.length>2||new Set(v.keys.map((k:any)=>k?.kid)).size!==v.keys.length||v.keys.some((k:any)=>!object(k)||Object.keys(k).some(x=>!['kty','kid','n','e','alg','use','key_ops','ext'].includes(x))||k.kty!=='RSA'||k.alg!=='RS256'||k.use!=='sig'||typeof k.kid!=='string'||! /^[a-zA-Z0-9._-]{1,64}$/.test(k.kid)||typeof k.n!=='string'||! /^[a-zA-Z0-9_-]{342,683}$/.test(k.n)||k.e!=='AQAB'||(k.key_ops!==undefined&&(!Array.isArray(k.key_ops)||k.key_ops.join(',')!=='verify'))))return null;
    return v;
  }catch{return null;}
}
function decode(value:string){if(!/^[a-zA-Z0-9_-]+$/.test(value))throw Error('invalid assertion');const binary=atob(value.replaceAll('-','+').replaceAll('_','/'));return Uint8Array.from(binary,c=>c.charCodeAt(0));}
export async function verifySignedAdmin(request:Request,trust:AdminTrust,now=Date.now()):Promise<VerifiedAdmin|null>{
  try{
    if(new URL(request.url).origin!==hostedOrigin)return null;
    if(!['GET','HEAD'].includes(request.method)&&(request.headers.get('origin')!==hostedOrigin||request.headers.get('sec-fetch-site')==='cross-site'||request.headers.get('x-agentic-bible-request')!=='admin'))return null;
    const token=request.headers.get(trust.assertionHeader);if(!token||token.length>12288)return null;const parts=token.split('.');if(parts.length!==3||parts[0].length>1024||parts[1].length>8192||parts[2].length>1024)return null;
    const header=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decode(parts[0]))),claims=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decode(parts[1])));
    if(!object(header)||header.alg!=='RS256'||typeof header.kid!=='string'||Object.keys(header).some(k=>!['alg','kid','typ'].includes(k))||(header.typ!==undefined&&header.typ!=='JWT')||!object(claims))return null;
    const key=trust.keys.find(k=>k.kid===header.kid);if(!key||claims.iss!==trust.issuer||(claims.aud!==trust.audience&&!(Array.isArray(claims.aud)&&claims.aud.length===1&&claims.aud[0]===trust.audience))||!trust.subjects.includes(claims.sub))return null;
    const seconds=Math.floor(now/1000);if(!Number.isSafeInteger(claims.iat)||!Number.isSafeInteger(claims.exp)||claims.exp<=seconds||claims.iat>seconds+30||claims.iat<seconds-3600||claims.exp<=claims.iat||claims.exp-claims.iat>3600||(claims.nbf!==undefined&&(!Number.isSafeInteger(claims.nbf)||claims.nbf>seconds+30)))return null;
    const imported=await crypto.subtle.importKey('jwk',key,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    if((imported.algorithm as RsaKeyAlgorithm).modulusLength<2048)return null;
    if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',imported,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))return null;
    return {subject:'signed-admin:'+await hash(canonical({issuer:trust.issuer,audience:trust.audience,subject:claims.sub})),role:'admin',expiresAt:claims.exp*1000,csrfVerified:true};
  }catch{return null;}
}
