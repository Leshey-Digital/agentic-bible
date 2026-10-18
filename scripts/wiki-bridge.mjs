import {PublicationError} from '../src/publishing/contracts.ts';
import {close} from 'pagefind';
import {WikiBridge} from '../src/wiki-bridge/store.ts';
import {BridgeError,bridgeLimits} from '../src/wiki-bridge/limits.ts';
import {bounded} from '../src/wiki-bridge/files.ts';
import {localObservations} from '../src/wiki-bridge/local-d1.ts';
import {wikiServer} from '../src/wiki-bridge/preview.ts';
import {prepareWikiEvidence} from './wiki-bridge-demo.mjs';
const [action='status',...args]=process.argv.slice(2);
const option=(name,fallback)=>{const n=args.indexOf(name);if(n<0)return fallback;if(!args[n+1]||args[n+1].startsWith('--'))throw new BridgeError('missing_cli_value');return args[n+1];};
let local;let timer;
try{
  if(action==='prepare'){console.log(JSON.stringify(await prepareWikiEvidence(option('--observations','wiki-observations-local'))));}
  else{
    const bridge=new WikiBridge(option('--state','wiki-bridge-local'));
    if(action==='status')console.log(JSON.stringify(bridge.status()));
    else if(action==='preview'){
      const server=wikiServer(bridge);server.listen(8793,'127.0.0.1',()=>console.log('Local synthetic wiki: http://127.0.0.1:8793/'));
      for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
    }else if(action==='apply'){
      const file=option('--file',undefined);if(!file)throw new BridgeError('bounded_input_file_required');
      let command;try{command=JSON.parse(bounded(file,bridgeLimits.inputBytes).toString());}catch{throw new BridgeError('invalid_bridge_input_file');}
      timer=setTimeout(()=>{console.error('bridge_outcome_unconfirmed_retry_same_event');process.exit(2);},110000);timer.unref();
      local=await localObservations(option('--observations','wiki-observations-local'));
      console.log(JSON.stringify(await bridge.execute(command,local.db,option('--sources','fixtures/wiki-bridge/sources'))));
    }else throw new BridgeError('unsupported_bridge_command');
  }
}catch(error){console.error(error instanceof BridgeError||error instanceof PublicationError?error.code:'bridge_outcome_unconfirmed_retry_same_event');process.exitCode=1;}
finally{if(timer)clearTimeout(timer);if(local)await local.runtime.dispose();await close();}
