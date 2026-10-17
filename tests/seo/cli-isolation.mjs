import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync,statSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {git} from '../wiki-bridge/helpers.mjs';
import {seoPreviewEnvironment} from './local-runtime.mjs';
export async function verifySeoCliIsolation(){
  const root=mkdtempSync(join(git,'seo-cli-network-')),assets=join(root,'assets');mkdirSync(assets);writeFileSync(join(assets,'index.html'),'<!doctype html><title>Controlled static CLI</title><p>Controlled local static response.</p>');
  const config=join(root,'wrangler.json');writeFileSync(config,JSON.stringify({name:'seo-cli-network-proof',compatibility_date:'2026-10-16',workers_dev:false,preview_urls:false,send_metrics:false,assets:{directory:assets}}));
  const results=[];
  try{for(const isolated of [false,true]){
    const name=isolated?'isolated':'control',evidence=join(root,name+'.jsonl'),cf=join(root,name+'-missing-cf.json');assert.equal(existsSync(cf),false);
    const port=await new Promise((done,failed)=>{const server=createServer();server.once('error',failed);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>done(port));});});
    const env={...seoPreviewEnvironment(join(root,name+'-config'),join(root,name+'-cache')),NODE_OPTIONS:'--import '+pathToFileURL(resolve('tests/seo/deny-external-preload.mjs')).href,AB_SEO_CLI_NETWORK_EVIDENCE:evidence,CLOUDFLARE_CF_FETCH_PATH:cf};if(!isolated)delete env.CLOUDFLARE_CF_FETCH_ENABLED;
    writeFileSync(evidence,'',{mode:0o600});
    const child=spawn(process.execPath,[resolve('node_modules/wrangler/bin/wrangler.js'),'dev','--local','--config',config,'--ip','127.0.0.1','--port',String(port),'--persist-to',join(root,name+'-state')],{env,stdio:'ignore'});
    let status,spawnFailed=false;child.once('error',()=>{spawnFailed=true;});const startup=performance.now();
    try{
      for(let i=0;i<150&&performance.now()-startup<15000;i++){if(spawnFailed||child.exitCode!==null||child.signalCode!==null)throw Error('controlled SEO CLI exited before ready');try{const response=await fetch('http://127.0.0.1:'+port+'/',{signal:AbortSignal.timeout(1000)});if(response.status===200){assert.ok((await response.text()).includes('Controlled local static response.'));status=200;break;}}catch(error){if(error?.code==='ERR_ASSERTION')throw error;}await new Promise(done=>setTimeout(done,100));}
      assert.equal(status,200,'real local Wrangler serves the controlled static artifact');
    }finally{if(!spawnFailed&&child.exitCode===null&&child.signalCode===null){const stopped=new Promise(done=>child.once('exit',done));child.kill('SIGTERM');const timer=setTimeout(()=>child.kill('SIGKILL'),5000);await stopped;clearTimeout(timer);}}
    assert.ok(statSync(evidence).size<=16384,'bounded CLI diagnostic file');const records=readFileSync(evidence,'utf8').trim().split('\n').map(line=>JSON.parse(line));assert.ok(records.some(r=>r.phase==='preloaded'));assert.ok(!records.some(r=>r.phase==='diagnostic-cap'),'CLI observer record bound');
    const attempts=records.filter(r=>r.phase==='blocked-external');writeFileSync(join(git,'seo-cli-network-isolation.json'),JSON.stringify({stage:name,httpStatus:status,attempts},null,2)+'\n');assert.ok(attempts.every(r=>r.target==='cf-metadata'&&r.method==='GET'),'no other external CLI attempts: '+JSON.stringify(attempts));
    results.push({mode:name,httpStatus:status,metadataGetAttempts:attempts.length,otherExternalAttempts:attempts.filter(r=>r.target!=='cf-metadata').length,preloadedProcesses:records.filter(r=>r.phase==='preloaded').length,externalNetworkBlocked:true,coldCache:true});
  }
  assert.ok(results[0].metadataGetAttempts>=1,'control proves the actual CLI network boundary is observed');assert.equal(results[1].metadataGetAttempts,0);
  writeFileSync(join(git,'seo-cli-network-isolation.json'),JSON.stringify({wrangler:JSON.parse(readFileSync(resolve('node_modules/wrangler/package.json'),'utf8')).version,results},null,2)+'\n');
  }finally{rmSync(root,{recursive:true,force:true});}
}
