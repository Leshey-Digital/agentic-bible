// Explicit offline queue inspection. No provider transport or credentials are accepted here.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync,lstatSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {enqueueIndexing,disabledIndexing} from '../src/seo/outbox.ts';
import {bounded} from '../src/wiki-bridge/files.ts';
const [action='status',...args]=process.argv.slice(2);
const option=(name,fallback)=>{const at=args.indexOf(name);if(at<0)return fallback;if(!args[at+1]||args[at+1].startsWith('--'))throw Error('missing_indexing_option');return args[at+1];};
let raw;
try{
  if(!['status','queue'].includes(action))throw Error('unsupported_indexing_action');
  // Default disabled exits before creating any durable queue or reading a manifest.
  if(!args.includes('--enable-offline-queue'))console.log(JSON.stringify({status:'disabled',submissions:0}));
  else{
    const git=execFileSync('git',['rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim(),root=join(git,'indexing-outbox-local'),marker=join(root,'store.json');
    if(existsSync(root)&&lstatSync(root).isSymbolicLink())throw Error('unsafe_indexing_store');
    const expected='local-offline-indexing-outbox\n';
    if(existsSync(marker)){if(lstatSync(marker).isSymbolicLink()||bounded(marker,100).toString()!==expected)throw Error('unsafe_indexing_store');}
    else{if(existsSync(root)&&readdirSync(root).length)throw Error('unsafe_indexing_store');mkdirSync(root,{recursive:true});writeFileSync(marker,expected);}
    const path=join(root,'queue.sqlite');if(existsSync(path)&&lstatSync(path).isSymbolicLink())throw Error('unsafe_indexing_store');
    raw=new DatabaseSync(path);raw.exec('PRAGMA foreign_keys=ON;PRAGMA busy_timeout=1000;');
    if(!raw.prepare("SELECT name FROM sqlite_master WHERE name='indexing_notifications'").get())raw.exec(readFileSync('migrations/0006_indexing_outbox.sql','utf8'));
    const prepare=(sql,values=[])=>({bind:(...v)=>prepare(sql,v),first:async()=>raw.prepare(sql).get(...values)??null,all:async()=>({results:raw.prepare(sql).all(...values)}),run:async()=>({meta:{changes:Number(raw.prepare(sql).run(...values).changes)}})});
    const db={prepare,batch:async statements=>{raw.exec('BEGIN IMMEDIATE');try{const result=[];for(const s of statements)result.push(await s.run());raw.exec('COMMIT');return result;}catch(error){raw.exec('ROLLBACK');throw error;}}};
    if(action==='queue'){
      const file=option('--manifest',undefined);if(!file)throw Error('indexing_manifest_required');
      const config={...disabledIndexing,enabled:true,provider:'indexnow',origin:option('--origin',null),ownershipVerified:args.includes('--ownership-verified')};
      console.log(JSON.stringify({...await enqueueIndexing(db,JSON.parse(bounded(file,8192).toString()),option('--event',undefined),config),mode:'offline-only',submissions:0}));
    }else console.log(JSON.stringify({mode:'offline-only',submissions:0,entries:raw.prepare('SELECT id,event_key,url,revision,state,attempts,acknowledgment FROM indexing_notifications ORDER BY event_key,id LIMIT 96').all()}));
  }
}catch(error){console.error(error?.code??'indexing_operation_failed');process.exitCode=1;}finally{raw?.close();}
