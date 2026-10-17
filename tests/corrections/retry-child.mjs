import {correctionPreview} from '../../src/corrections/server.ts';
const [name,id,phase]=process.argv.slice(2);const app=await correctionPreview(name);
try{await app.coordinator.retry(id,'local-editor',point=>{if(point===phase)process.kill(process.pid,'SIGKILL');});}finally{await app.close();}
