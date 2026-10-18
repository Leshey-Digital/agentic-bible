// Explicit synthetic collector preparation, separate from the bridge's read-only evidence action.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {Response as ControlledResponse} from 'miniflare';
import {localObservations} from '../src/wiki-bridge/local-d1.ts';
import {hash} from '../src/publishing/contracts.ts';
export async function prepareWikiEvidence(name='wiki-observations-local'){
  const packet=JSON.parse(readFileSync('fixtures/wiki-bridge/packet.json','utf8'));let fetches=0;
  const data=Object.fromEntries(packet.evidence.map(e=>{const body=readFileSync(join('fixtures/wiki-bridge/sources',e.file));if(hash(body)!==e.bodyHash)throw new Error('demo_fixture_changed');return [e.url,body];}));
  const local=await localObservations(name,true,request=>{const body=data[request.url];if(!body)throw new Error('demo_target_rejected');fetches++;return new ControlledResponse(body,{headers:{'Content-Type':'text/plain',ETag:'"'+hash(body).slice(0,16)+'"'}});});
  try{
    if(!await local.db.prepare("SELECT name FROM sqlite_master WHERE name='http_check_jobs'").first())for(const sql of readFileSync('migrations/0005_http_observations.sql','utf8').replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(Boolean))await local.db.prepare(sql).run();
    for(const e of packet.evidence){const response=await local.runtime.dispatchFetch('http://localhost/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:e.sourceId,key:e.receiptKey})});const result=await response.json();if(response.status!==200||result.status!=='succeeded'||result.state.hash!==e.bodyHash)throw new Error('demo_observation_failed');}
    return {mode:'local-synthetic-only',fetches,packet:'fixtures/wiki-bridge/packet.json',observations:name};
  }finally{await local.runtime.dispose();}
}
