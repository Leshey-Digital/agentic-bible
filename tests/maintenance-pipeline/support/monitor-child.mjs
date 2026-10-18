// Test-owned scheduling shim. The actual unchanged review script runs after the scan boundary.
import {existsSync} from 'node:fs';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const project=process.argv[2],until=Date.now()+45000;
while(!existsSync(join(project,'.astro/monitor-ready'))){if(Date.now()>until)throw Error('test_monitor_boundary_not_reached');await new Promise(resolve=>setTimeout(resolve,5));}
await import(pathToFileURL(join(project,'scripts/maintenance-review-build.mjs')).href);
