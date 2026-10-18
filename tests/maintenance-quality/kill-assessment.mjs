import {localObservations} from '../../src/wiki-bridge/local-d1.ts';
import {assessQuality} from '../../src/maintenance-quality/admission.ts';
import {sample,quality} from './helpers.mjs';
process.once('message',async({name})=>{try{const local=await localObservations(name),{article,sources}=sample();await assessQuality('quality-killed-assessment',article,sources,{db:local.db,quality:quality(),checkpoint:async phase=>{if(phase==='quality-dispatched'){process.send({phase});await new Promise(()=>{});}}});}catch{process.send({error:'controlled-assessment-failed'});process.exitCode=1;}});
