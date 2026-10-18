// Process-death injection is test-only; no crash controls exist in the CLI.
import {readFileSync} from 'node:fs';
import {WikiBridge} from '../../src/wiki-bridge/store.ts';
import {localObservations} from '../../src/wiki-bridge/local-d1.ts';
const [name,observations,file,phase]=process.argv.slice(2);
const local=await localObservations(observations);
try{await new WikiBridge(name).execute(JSON.parse(readFileSync(file,'utf8')),local.db,'fixtures/wiki-bridge/sources',{checkpoint(value){if(value===phase)process.kill(process.pid,'SIGKILL');}});}
finally{await local.runtime.dispose();}
