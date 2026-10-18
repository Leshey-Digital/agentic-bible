import {mkdtempSync,symlinkSync,readFileSync} from 'node:fs';import {join,resolve} from 'node:path';import {execFileSync} from 'node:child_process';
import {git} from '../wiki-bridge/helpers.mjs';import {hash} from '../../src/maintenance-github/contracts.ts';
export function buildCanonicalHistorySite(site,commit){
 const project=mkdtempSync(join(git,'restoration-render-'));execFileSync('git',['clone','--local','--no-hardlinks','-b','main',site.remote.state.root,project],{stdio:'pipe'});execFileSync('git',['-C',project,'checkout','--detach',commit],{stdio:'pipe'});symlinkSync(resolve('node_modules'),join(project,'node_modules'),'dir');
 execFileSync('npm',['run','build'],{cwd:project,env:{PATH:process.env.PATH,CI:'1',ASTRO_TELEMETRY_DISABLED:'1',CLOUDFLARE_CF_FETCH_ENABLED:'false',AGENTIC_BIBLE_MAINTENANCE_HISTORY_MODE:'controlled-static-preview',AGENTIC_BIBLE_SOURCE_COMMIT:commit},timeout:60000,maxBuffer:131072});const assets=join(project,'dist'),manifest=readFileSync(join(assets,'maintenance-history.json'));return {...site,project,assets,manifest,catalog:JSON.parse(manifest),catalogHash:hash(manifest)};
}
