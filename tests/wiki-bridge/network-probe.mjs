import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {Miniflare,convertV4MiniflareOptions,Log,LogLevel} from 'miniflare';
import {localObservations} from '../../src/wiki-bridge/local-d1.ts';
import {git} from './helpers.mjs';
const require=createRequire(import.meta.url),undici=require(require.resolve('undici',{paths:[dirname(require.resolve('miniflare'))]}));
const prior=undici.getGlobalDispatcher(),agent=new undici.MockAgent();let externalAttempts=0,applicationFetches=0;
agent.disableNetConnect();agent.enableNetConnect(host=>{const local=/^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host);if(!local)externalAttempts++;return local;});undici.setGlobalDispatcher(agent);
const root=mkdtempSync(join(git,'wiki-bridge-test-network-control-'));const script='export default {fetch(){return new Response("controlled local runtime")}}';let control,legacy,live;
try{
  // Force a fresh metadata path: the control must attempt network even on a warm machine.
  control=new Miniflare({...convertV4MiniflareOptions({modules:true,script,compatibilityDate:'2026-10-16'}),cf:join(root,'missing-control-cf.json'),log:new Log(LogLevel.NONE)});await control.ready;await control.dispose();control=null;
  const controlBlockedMetadataAttempts=externalAttempts;if(controlBlockedMetadataAttempts<1)throw Error('metadata control did not exercise the denied network boundary');
  externalAttempts=0;process.env.CLOUDFLARE_CF_FETCH_ENABLED='false';process.env.CLOUDFLARE_CF_FETCH_PATH=join(root,'missing-legacy-cf.json');
  legacy=new Miniflare({...convertV4MiniflareOptions({modules:true,script,compatibilityDate:'2026-10-16'}),log:new Log(LogLevel.NONE)});await legacy.ready;await legacy.dispose();legacy=null;const legacyExternalAttempts=externalAttempts;
  // Constructor-level isolation remains effective even under a contrary inherited environment.
  process.env.CLOUDFLARE_CF_FETCH_ENABLED='true';externalAttempts=0;
  live=await localObservations('wiki-observations-test-network-isolation',true,()=>{applicationFetches++;throw Error('application fetch forbidden');});
  await live.db.prepare('CREATE TABLE IF NOT EXISTS network_probe(id INTEGER PRIMARY KEY,n INTEGER)').run();await live.db.prepare('INSERT OR REPLACE INTO network_probe(id,n) VALUES(1,7)').run();const row=await live.db.prepare('SELECT n FROM network_probe WHERE id=1').first();
  const result={controlBlockedMetadataAttempts,legacyEnvironmentExternalAttempts:legacyExternalAttempts,currentFactoryExternalAttempts:externalAttempts,applicationFetches,actualD1Value:row.n};
  writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');if(legacyExternalAttempts!==0||externalAttempts!==0||applicationFetches!==0||row.n!==7)throw Error('runtime network isolation failed');
}finally{await live?.runtime.dispose();await legacy?.dispose();await control?.dispose();undici.setGlobalDispatcher(prior);await agent.close();}
