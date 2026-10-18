import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractMaintenanceSource} from '../../src/maintenance-adapters/extraction.ts';
import {validateQualitySourceExtraction} from '../../src/maintenance-adapters/quality-source.ts';
import {document,bytes,mcp} from './fixtures.mjs';

async function qualityInput(){const source=await extractMaintenanceSource(mcp,bytes(document()),'text/html');return {
 citationId:'mcp-tools',sourceId:source.sourceId,url:source.url,bodyHash:source.raw.hash,bytes:source.raw.bytes,
 extraction:{profileId:source.profileId,rawHash:source.raw.hash,extractedHash:source.evidence.hash,text:source.evidence.text,spans:source.evidence.spans},
 lineage:{originIds:[],provenance:'unknown'},
};}

test('quality consumer preserves original bytes and exact raw/profile/extracted identity with unknown lineage',async()=>{
 const input=await qualityInput(),verified=await validateQualitySourceExtraction(input);
 assert.deepEqual(verified,input);assert.notEqual(verified.bytes,input.bytes);
 assert.equal(verified.bodyHash,verified.extraction.rawHash);assert.notEqual(verified.bodyHash,verified.extraction.extractedHash);
 assert.deepEqual(verified.lineage,{originIds:[],provenance:'unknown'});
});

test('quality consumer rejects fixture-like text substitution, profile/hash/span tampering and caller origin assertions',async()=>{
 for(const change of [
  value=>{value.bytes=bytes(value.extraction.text);},
  value=>{value.bodyHash=value.extraction.extractedHash;},
  value=>{value.extraction.rawHash='1'.repeat(64);},
  value=>{value.extraction.extractedHash='2'.repeat(64);},
  value=>{value.extraction.profileId='caller-profile';},
  value=>{value.extraction.spans[0].endByte--;},
  value=>{value.extraction.text+=' Model invented support.';},
  value=>{value.lineage.provenance='original';value.lineage.originIds=['candidate-origin'];},
  value=>{value.lineage.originIds=['different-vendor-means-independent'];},
 ]){const input=await qualityInput();change(input);await assert.rejects(validateQualitySourceExtraction(input));}
});
