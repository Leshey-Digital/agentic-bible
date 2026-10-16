import {rmSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {PublicationStore} from '../src/publishing/store.ts';
import {publicationServer} from '../src/publishing/preview.ts';

// Reset only the named disposable publication-browser directory, never original article files or editorial data.
const git=execFileSync('git',['rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim();
rmSync(join(git,'article-publication-browser'),{recursive:true,force:true});
const store=new PublicationStore('article-publication-browser');
await store.execute(JSON.parse(readFileSync('fixtures/local-publication/article-v1.json','utf8')));
const server=publicationServer(store);server.listen(8790,'127.0.0.1');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
