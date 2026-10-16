// Test-only isolated build entry. Never deploys or submits URLs.
import {build} from 'astro';
import {join} from 'node:path';
const [root,outDir]=process.argv.slice(2);
await build({root,outDir,cacheDir:join(root,'.astro'),vite:{cacheDir:join(root,'.vite')},logLevel:'silent'});
