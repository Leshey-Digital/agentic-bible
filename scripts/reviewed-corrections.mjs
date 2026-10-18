import {correctionPreview} from '../src/corrections/server.ts';
import {close} from 'pagefind';
const name=process.argv[2]??'local';const app=await correctionPreview(name);
app.server.listen(8788,'127.0.0.1',()=>console.info('Local reviewed correction preview: http://127.0.0.1:8788/contribute/ — synthetic identities only'));
let closing=false;for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{if(closing)return;closing=true;await app.close();await close();process.exit(0);});
