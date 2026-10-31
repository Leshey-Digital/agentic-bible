import test from 'node:test';import assert from 'node:assert/strict';
import {closedIntakeSignal,submissionSignal} from '../../src/measurement/contribution.ts';
test('only a recognized current status can establish closed intake',()=>{
 const known={mode:'hosted-contributions',publicIntake:false,enabled:true};
 assert.deepEqual(closedIntakeSignal(200,known),{event:'contribution_result',outcome:'closed'});
 for(const [status,value]of [[503,known],[200,{}],[200,null],[200,{...known,publicIntake:true}],[200,{...known,mode:'unknown'}]])assert.deepEqual(closedIntakeSignal(status,value),{event:'reader_error',component:'contribution'});
});
test('confirmed receipts, rejection, honeypot and unknown outcomes remain distinct',()=>{
 const receipt={received:true,reference:'00000000-0000-4000-8000-000000000001',duplicate:false};
 assert.equal(submissionSignal(201,receipt).outcome,'saved');assert.equal(submissionSignal(200,{...receipt,duplicate:true}).outcome,'duplicate');
 assert.equal(submissionSignal(422,{error:'invalid_fields'}).outcome,'rejected');
 for(const [status,value]of [[202,{received:true}],[200,{}],[201,{...receipt,reference:'raw'}],[503,{error:'editorial_unavailable'}],[200,receipt],[400,{}]])assert.equal(submissionSignal(status,value).outcome,'unconfirmed');
});
