import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {draftAdminJs,sourceFailureMessages} from '../../src/hosted/cloudflare-draft-admin.ts';
test('draft UI distinguishes terminal source failure from uncertain model outcome and never retries',async()=>{
 for(const [code,expected] of [...Object.entries(sourceFailureMessages),['cloudflare_draft_unavailable','The draft outcome is unconfirmed or unavailable.'],['<script>provider text</script>','The draft outcome is unconfirmed or unavailable.']]){
  let submit,calls=0;const button={disabled:false},status={},form={querySelector:()=>button,addEventListener:(_event,fn)=>{submit=fn;}};
  const nodes={'#draft-form':form,'#result':status,'#source':{value:'s-bfba858067cc3eb54024f532|mcp-tools'},'#article':{value:'tool-use'}};
  runInNewContext(draftAdminJs,{document:{querySelector:key=>nodes[key]},crypto:{randomUUID:()=> 'synthetic-ui-request'},fetch:async()=>{calls++;return {ok:false,status:422,json:async()=>({error:code})};}});
  await submit({preventDefault(){}});assert.ok(status.textContent.startsWith(expected));assert.equal(button.disabled,true);assert.equal(calls,1);
  await submit({preventDefault(){}});assert.equal(calls,1);assert.ok(!status.textContent.includes('<script>'));
 }
});
