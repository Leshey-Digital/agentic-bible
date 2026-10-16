import {execFileSync} from 'node:child_process';
import {readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
export const git=execFileSync('git',['rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim();
export const packet=()=>JSON.parse(readFileSync('fixtures/wiki-bridge/packet.json','utf8'));
export function clean(name){if(!/^wiki-(?:bridge|observations)-test-[a-z0-9-]+$/.test(name))throw new Error('unsafe_test_cleanup');rmSync(join(git,name),{recursive:true,force:true});if(name.startsWith('wiki-bridge'))rmSync(join(git,'article-publication-'+name),{recursive:true,force:true});}
export async function accounting(db){const rows={};for(const table of ['http_source_state','http_check_jobs','http_request_reservations','http_request_budget'])rows[table]=(await db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()).results;return rows;}
export function successor(bridge,eventId,word='Elderbrook'){
  const value=packet(),current=bridge.current();value.eventId=eventId;value.revision.eventId=eventId;value.expectedSite=current.reference;value.expectedPublisher=current.manifest.state.publisher;value.revision.baseRevision=current.manifest.state.articleRevision;value.revision.article.blocks[1].content[0].text=`${word} identifies a supplied replacement local synthetic revision. Byte integrity does not establish factual truth or official-source authenticity.`;return value;
}
