import {readFileSync,statSync} from 'node:fs';
import {PublicationStore} from '../src/publishing/store.ts';
import {PublicationError,publicationLimits} from '../src/publishing/contracts.ts';
import {publicationServer} from '../src/publishing/preview.ts';

const [action='status',...args]=process.argv.slice(2);
const option=(key,fallback)=>{const index=args.indexOf(key);return index<0?fallback:args[index+1];};
try{
  const store=new PublicationStore(option('--state','article-publication'));
  if(action==='apply'){
    const path=option('--file',undefined);if(!path||statSync(path).size>publicationLimits.inputBytes)throw new PublicationError('bounded_input_file_required');
    let value;try{value=JSON.parse(readFileSync(path,'utf8'));}catch{throw new PublicationError('invalid_json');}
    console.log(JSON.stringify(await store.execute(value)));
  }else if(action==='demo'){
    const fixture=JSON.parse(readFileSync('fixtures/local-publication/article-v1.json','utf8'));
    const first=await store.execute(fixture);
    const article=structuredClone(fixture.article);article.title='Agent loop & tools — revised fixture';article.blocks[1].content[0].text='Cedarharbor is the distinctive token in this revised synthetic fixture. This supplied example demonstrates a cited local article publication, without fetching or generating source material.';
    console.log(JSON.stringify(await store.execute({...fixture,eventId:'local-demo-revision-two',baseRevision:first.revisionId,article})));
  }else if(action==='status'){
    const current=store.current();console.log(JSON.stringify(current?{...current.reference,sequence:current.manifest.state.sequence,articles:current.manifest.state.articles}:null));
  }else if(action==='preview'){
    const server=publicationServer(store);server.listen(8790,'127.0.0.1',()=>console.log('Read-only local publication preview: http://127.0.0.1:8790/local-publications/'));
    for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
  }else throw new PublicationError('unsupported_command');
}catch(error){console.error(error instanceof PublicationError?error.code:'publication_outcome_unconfirmed_retry_same_event');process.exitCode=1;}
