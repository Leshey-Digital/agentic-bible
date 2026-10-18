import {canonical,digest,exact,extractionLimits,extractionProfile,reject,type SourceLineage} from './profiles.ts';

export type EvidenceSpan={startByte:number;endByte:number;text:string};
export type ExtractedSource={schemaVersion:2;sourceId:string;url:string;profileId:string;
  raw:{bytes:Uint8Array;hash:string;contentType:'text/html'};
  evidence:{text:string;hash:string;spans:EvidenceSpan[]};lineage:SourceLineage};
const encoder=new TextEncoder();
const voidTags=new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const excluded=new Set('script style template noscript nav header footer aside svg math'.split(' '));
const contentTags=new Set('p li h1 h2 h3 h4 h5 h6 pre blockquote td th dt dd'.split(' '));
const safeText=(text:string)=>{if(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text))reject('adapter_unsafe_text');return text;};
function decode(text:string){
  const entities:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
  if(/&(?:#|[a-z])/i.test(text.replace(/&[^;\s&<>]{1,32};/g,'')))reject('adapter_unsupported_entity');
  const decoded=text.replace(/&([^;\s&<>]{1,32});/g,(_whole,key:string)=>{
    if(Object.hasOwn(entities,key))return entities[key];
    if(!/^#(?:[0-9]+|x[0-9a-f]+)$/i.test(key))return reject('adapter_unsupported_entity');
    const point=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));
    if(!Number.isSafeInteger(point)||point<1||point>0x10ffff||(point>=0xd800&&point<=0xdfff))reject('adapter_unsupported_entity');
    return String.fromCodePoint(point);
  });
  // Ambiguous HTML character references are outside this intentionally strict profile.
  return safeText(decoded).replace(/\s+/gu,' ').trim();
}
type Tag={name:string;closing:boolean;selfClosing:boolean;attrs:Record<string,string>};
function tag(token:string):Tag{
  const parsed=/^<(\/?)([a-z][a-z0-9:-]*)([\s\S]*?)>$/i.exec(token);if(!parsed)reject('adapter_html_structure');
  const closing=parsed[1]==='/',name=parsed[2].toLowerCase();let rest=parsed[3],selfClosing=false;
  if(closing){if(rest.trim())reject('adapter_html_structure');return {name,closing,selfClosing,attrs:{}};}
  if(/\/\s*$/.test(rest)){selfClosing=true;rest=rest.replace(/\/\s*$/,'');}
  const attrs:Record<string,string>={};
  while(rest){
    if(!/^\s/.test(rest))reject('adapter_html_structure');rest=rest.trimStart();if(!rest)break;
    const attr=/^([^\s="'<>`/]+)(?:\s*=\s*(?:"([^"<>]*)"|'([^'<>]*)'|([^\s"'`=<>]+)))?/.exec(rest);
    if(!attr)reject('adapter_html_structure');const key=attr[1].toLowerCase();if(Object.hasOwn(attrs,key))reject('adapter_html_structure');
    attrs[key]=attr[2]??attr[3]??attr[4]??'';rest=rest.slice(attr[0].length);
  }
  if(selfClosing&&!voidTags.has(name))reject('adapter_html_structure');
  return {name,closing,selfClosing,attrs};
}

// A bounded, deliberately strict HTML subset, NOT a general browser DOM parser.
// Every output span maps to the exact original UTF-8 text run before entity/space decoding.
export async function extractMaintenanceSource(sourceId:unknown,input:Uint8Array,contentType:unknown):Promise<ExtractedSource>{
  const profile=extractionProfile(sourceId);if(!profile)reject('adapter_profile_not_registered');
  if(!(input instanceof Uint8Array)||input.byteLength<1||input.byteLength>extractionLimits.rawBytes)reject('adapter_raw_limit');
  if(typeof contentType!=='string'||!/^text\/html(?:;\s*charset\s*=\s*(?:utf-8|"utf-8"))?$/i.test(contentType))reject('adapter_profile_content_type');
  const bytes=Uint8Array.from(input);let html:string;
  // TextDecoder strips a leading UTF-8 BOM by default. Reject it in the raw
  // bytes so character-derived spans cannot be shifted before byte mapping.
  if(bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf)reject('adapter_raw_bom');
  try{html=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return reject('adapter_raw_encoding');}
  if(html.charCodeAt(0)===0xfeff)reject('adapter_html_structure');safeText(html);
  const stack:{name:string;excluded:boolean}[]=[],spans:EvidenceSpan[]=[];
  let position=0,tokens=0,mains=0,titles=0,canonicalLinks=0,title='',evidenceBytes=0;
  while(position<html.length){
    if(++tokens>extractionLimits.tokens)reject('adapter_html_limit');
    const rawParent=stack.at(-1)?.name;
    if(rawParent==='script'||rawParent==='style'){
      const end=new RegExp(`</${rawParent}\\s*>`,'ig');end.lastIndex=position;const match=end.exec(html);
      if(!match)reject('adapter_html_structure');position=match.index; // Parse its closing tag below.
    }
    if(html.startsWith('<!--',position)){const end=html.indexOf('-->',position+4);if(end<0)reject('adapter_html_structure');position=end+3;continue;}
    if(/^<!doctype html\s*>/i.test(html.slice(position))){const end=html.indexOf('>',position);position=end+1;continue;}
    if(html[position]==='<'){
      // Attribute values containing angle brackets are outside the accepted subset.
      const end=html.indexOf('>',position);if(end<0)reject('adapter_html_structure');
      const current=tag(html.slice(position,end+1));position=end+1;
      if(current.closing){if(voidTags.has(current.name)||stack.pop()?.name!==current.name)reject('adapter_html_structure');continue;}
      if(current.name==='main'&&++mains!==1)reject('adapter_html_markers');
      if(current.name==='title'&&++titles!==1)reject('adapter_html_markers');
      if(current.name==='link'&&(current.attrs.rel??'').toLowerCase().split(/\s+/).includes('canonical')){
        if(++canonicalLinks!==1||decode(current.attrs.href??'')!==profile.url)reject('adapter_source_identity');
      }
      if(!voidTags.has(current.name)){
        if(stack.length>=extractionLimits.depth)reject('adapter_html_limit');
        stack.push({name:current.name,excluded:excluded.has(current.name)||stack.some(parent=>parent.excluded)});
      }
      continue;
    }
    const next=html.indexOf('<',position),end=next<0?html.length:next;
    const rawText=html.slice(position,end);
    if(stack.some(parent=>parent.name==='title'))title+=decode(rawText);
    if(stack.some(parent=>parent.name==='main')&&!stack.some(parent=>parent.excluded)&&stack.some(parent=>contentTags.has(parent.name))){
      const text=decode(rawText);
      if(text){
        evidenceBytes+=encoder.encode(text).length+(spans.length?1:0);
        if(spans.length>=extractionLimits.spans||evidenceBytes>extractionLimits.evidenceBytes)reject('adapter_evidence_limit');
        spans.push({startByte:encoder.encode(html.slice(0,position)).length,endByte:encoder.encode(html.slice(0,end)).length,text});
      }
    }
    position=end;
  }
  if(stack.length)reject('adapter_html_structure');
  if(mains!==1||titles!==1||canonicalLinks!==1||title!==profile.title||!spans.length)reject('adapter_html_markers');
  const text=spans.map(span=>span.text).join('\n');
  return {schemaVersion:2,sourceId:profile.sourceId,url:profile.url,profileId:profile.id,
    raw:{bytes,hash:await digest(bytes),contentType:'text/html'},evidence:{text,hash:await digest(text),spans},
    lineage:{publisherGroup:profile.lineage.publisherGroup,originIds:[],provenance:'unknown'}};
}

export async function validateExtractedSource(value:unknown):Promise<ExtractedSource>{
  exact(value,['schemaVersion','sourceId','url','profileId','raw','evidence','lineage']);
  exact(value.raw,['bytes','hash','contentType']);exact(value.evidence,['text','hash','spans']);exact(value.lineage,['publisherGroup','originIds','provenance']);
  if(value.schemaVersion!==2||!(value.raw.bytes instanceof Uint8Array))reject('adapter_invalid_shape');
  if(typeof value.url!=='string'||value.url.length>256||typeof value.profileId!=='string'||value.profileId.length>80||typeof value.raw.hash!=='string'||!/^[a-f0-9]{64}$/.test(value.raw.hash)||typeof value.evidence.hash!=='string'||!/^[a-f0-9]{64}$/.test(value.evidence.hash)||typeof value.lineage.publisherGroup!=='string'||value.lineage.publisherGroup.length>80)reject('adapter_invalid_shape');
  if(typeof value.evidence.text!=='string'||encoder.encode(value.evidence.text).length>extractionLimits.evidenceBytes||!Array.isArray(value.evidence.spans)||value.evidence.spans.length>extractionLimits.spans||!Array.isArray(value.lineage.originIds)||value.lineage.originIds.length!==0||value.lineage.provenance!=='unknown')reject('adapter_invalid_shape');
  let spanBytes=0;for(const span of value.evidence.spans){exact(span,['startByte','endByte','text']);if(!Number.isSafeInteger(span.startByte)||!Number.isSafeInteger(span.endByte)||typeof span.text!=='string')reject('adapter_invalid_shape');spanBytes+=encoder.encode(span.text).length;if(spanBytes>extractionLimits.evidenceBytes)reject('adapter_invalid_shape');}
  const recomputed=await extractMaintenanceSource(value.sourceId,value.raw.bytes,value.raw.contentType);
  const declared={...value,raw:{...value.raw,bytes:[]}},expected={...recomputed,raw:{...recomputed.raw,bytes:[]}};
  if(canonical(declared)!==canonical(expected))reject('adapter_extraction_mismatch');
  return recomputed;
}
