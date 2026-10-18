import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {correctionPreview} from '../../src/corrections/server.ts';
const require=createRequire(import.meta.url),undici=require(require.resolve('undici',{paths:[dirname(require.resolve('miniflare'))]}));
const prior=undici.getGlobalDispatcher(),agent=new undici.MockAgent();let externalAttempts=0,app;
agent.disableNetConnect();agent.enableNetConnect(host=>{const local=/^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host);if(!local)externalAttempts++;return local;});undici.setGlobalDispatcher(agent);
// A contrary inherited setting and missing cache cannot override constructor isolation.
process.env.CLOUDFLARE_CF_FETCH_ENABLED='true';process.env.CLOUDFLARE_CF_FETCH_PATH=join(dirname(process.argv[2]),'corrections-missing-cf-'+randomUUID()+'.json');
try{
  app=await correctionPreview('network-'+randomUUID());
  const table=await app.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='correction_operations'").first();
  const count=await app.db.prepare('SELECT COUNT(*) AS n FROM correction_operations').first();
  const result={externalFrameworkAttempts:externalAttempts,actualD1Table:table.name,initialOperations:count.n,constructorIsolation:true};
  writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');if(externalAttempts!==0||table.name!=='correction_operations'||count.n!==0)throw Error('correction runtime isolation failed');
}finally{await app?.close();undici.setGlobalDispatcher(prior);await agent.close();}
