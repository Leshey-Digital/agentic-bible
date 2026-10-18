import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {extractMaintenanceSource,validateExtractedSource} from '../../src/maintenance-adapters/extraction.ts';
import {extractionProfiles,extractionProfile} from '../../src/maintenance-adapters/profiles.ts';
import {document,bytes,mcp,openai,urls} from './fixtures.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');

test('literal original bytes, normalized evidence and UTF-8 source spans have distinct reproducible hashes',async()=>{
 const raw=bytes(document(mcp,'Café agents use A&amp;B records and &#x3c;bounded&#x3e; results.'));
 const source=await extractMaintenanceSource(mcp,raw,'text/html; charset=utf-8');
 assert.equal(source.raw.hash,hash(raw));assert.equal(source.evidence.hash,hash(source.evidence.text));
 assert.notEqual(source.raw.hash,source.evidence.hash);
 assert.match(source.evidence.text,/Café agents use A&B records and <bounded> results\./);
 assert.doesNotMatch(source.evidence.text,/Navigation|Script text|Sidebar|Footer/);
 assert.equal(source.lineage.provenance,'unknown');assert.deepEqual(source.lineage.originIds,[]);
 for(const span of source.evidence.spans){const text=new TextDecoder().decode(raw.slice(span.startByte,span.endByte));assert.ok(text.length);if(span.text.startsWith('Café'))assert.match(text,/Café.*&amp;B/);}
 assert.deepEqual(await validateExtractedSource(source),source);
 raw.fill(0);assert.notEqual(source.raw.bytes[0],0,'capture owns an independent copy');
});

test('profile registry is compiled, bounded to known official URLs and cannot assert origin independence',async()=>{
 assert.equal(extractionProfiles.length,2);assert.equal(extractionProfile('https://127.0.0.1/'),undefined);
 for(const profile of extractionProfiles){assert.ok(Object.isFrozen(profile));assert.ok(Object.isFrozen(profile.lineage));assert.ok(Object.isFrozen(profile.lineage.originIds));assert.equal(profile.lineage.provenance,'unknown');}
 const source=await extractMaintenanceSource(openai,bytes(document(openai)),'text/html');assert.equal(source.url,urls[openai]);
 await assert.rejects(extractMaintenanceSource('s-d4b8988f42afd69d3b72da14',bytes(document()),'text/html'),{code:'adapter_profile_not_registered'});
});

test('leading UTF-8 BOM is rejected before decoding can shift original byte spans',async()=>{
 const original=bytes(document(mcp,'Café source spans must map to the exact original UTF-8 bytes.'));
 const raw=new Uint8Array(original.length+3);raw.set([0xef,0xbb,0xbf]);raw.set(original,3);
 await assert.rejects(extractMaintenanceSource(mcp,raw,'text/html'),{code:'adapter_raw_bom'});
 const packet=await extractMaintenanceSource(mcp,original,'text/html');packet.raw.bytes=raw;packet.raw.hash=hash(raw);
 await assert.rejects(validateExtractedSource(packet),{code:'adapter_raw_bom'});
});

test('unsupported JSON/plain profiles, ambiguous HTML and identity/structure failures fail closed',async()=>{
 for(const [raw,type,code] of [
  [bytes('{"text":"A JSON object cannot nominate a new source profile."}'),'application/json','adapter_profile_content_type'],
  [bytes('Original plain text is not this HTML profile.'),'text/plain','adapter_profile_content_type'],
  [bytes(document().replace(urls[mcp],'https://example.invalid/copied')),'text/html','adapter_source_identity'],
  [bytes(document().replace('<main>','<section>')),'text/html','adapter_html_structure'],
  [bytes(document().replace('</main>','</main><main><p>second</p></main>')),'text/html','adapter_html_markers'],
  [bytes(document().replace('Tools - Model Context Protocol','Copied source')),'text/html','adapter_html_markers'],
  [bytes(document().replace(/<link[^>]+>/,'')),'text/html','adapter_html_markers'],
  [bytes(document().replace('</p>','</div>')),'text/html','adapter_html_structure'],
  [bytes(document(mcp,'Unsupported &copy; entity.')),'text/html','adapter_unsupported_entity'],
  [new Uint8Array([255,254]),'text/html','adapter_raw_encoding'],
  [bytes(document(mcp,'x'.repeat(8193))),'text/html','adapter_evidence_limit'],
  [bytes('x'.repeat(32769)),'text/html','adapter_raw_limit'],
 ])await assert.rejects(extractMaintenanceSource(mcp,raw,type),{code});
});

test('candidate changes to raw bytes, text, hashes, spans, identity and lineage cannot revalidate',async()=>{
 const original=await extractMaintenanceSource(mcp,bytes(document()),'text/html');
 for(const change of [
  value=>{value.raw.bytes[15]^=1;},value=>{value.raw.hash='0'.repeat(64);},
  value=>{value.evidence.text+=' Invented claim.';},value=>{value.evidence.hash='1'.repeat(64);},
  value=>{value.evidence.spans[0].startByte++;},value=>{value.profileId='caller-profile';},
  value=>{value.url=urls[openai];},value=>{value.sourceId=openai;},
  value=>{value.lineage.publisherGroup='claimed-independent';},
  value=>{value.lineage.provenance='original';value.lineage.originIds=['invented-origin'];},
 ]){const modified=structuredClone(original);change(modified);await assert.rejects(validateExtractedSource(modified));}
});
