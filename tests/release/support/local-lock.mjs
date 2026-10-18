import {lockReleaseWriter} from '../../../src/release/qualification.ts';lockReleaseWriter(process.argv[2]);process.send('locked');setInterval(()=>{},1000);
