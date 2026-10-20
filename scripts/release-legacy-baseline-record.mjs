import {execFileSync} from 'node:child_process';
import {mkdirSync,join} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createLegacyBaseline} from '../src/release/legacy-baseline.ts';
import {readReleaseFile} from '../src/release/files.ts';
import {durableJson} from '../src/release/qualification.ts';
import {canonical} from '../src/release/artifact.ts';

const [inputPath,...extra]=process.argv.slice(2);if(!inputPath||extra.length)throw Error('release_legacy_baseline_observation_required');
const git=execFileSync('git',['rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim(),directory=join(git,'legacy-baselines');mkdirSync(directory,{recursive:true,mode:0o700});
const observation=JSON.parse(readReleaseFile(inputPath,262144).toString('utf8'));
const {baseline,digest}=createLegacyBaseline(observation),raw=canonical(baseline);if(Buffer.byteLength(raw)>262144)throw Error('release_legacy_baseline_capacity');
const output=join(directory,randomUUID()+'.json');durableJson(output,baseline);
console.log(JSON.stringify({state:'legacy-baseline-recorded',path:output,digest,versionId:baseline.version.versionId,observedAt:baseline.observedAt}));
