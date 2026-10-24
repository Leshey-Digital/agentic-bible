import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {draftAdminJs,sourceFailureMessages} from '../../src/hosted/cloudflare-draft-admin.ts';
test('draft UI distinguishes terminal source failure from uncertain model outcome and never retries',async()=>{
 for(const [code,expected] of [...Object.entries(sourceFailureMessages),['cloudflare_draft_unavailable','The draft outcome is unconfirmed or unavailable.'],['<script>provider text</script>','The draft outcome is unconfirmed or unavailable.']]){
  let submit,calls=0;const button={disabled:false},status={},form={querySelector:()=>button,addEventListener:(_event,fn)=>{submit=fn;}};
  const nodes={'#check-source':{addEventListener(){}},'#source-result':{},'#source-evidence':{},'#draft-form':form,'#result':status,'#source':{value:'s-bfba858067cc3eb54024f532|mcp-tools'},'#article':{value:'tool-use'}};
  runInNewContext(draftAdminJs,{document:{querySelector:key=>nodes[key]},crypto:{randomUUID:()=> 'synthetic-ui-request'},fetch:async()=>{calls++;return {ok:false,status:422,json:async()=>({error:code})};}});
  await submit({preventDefault(){}});assert.ok(status.textContent.startsWith(expected));assert.equal(button.disabled,true);assert.equal(calls,1);
  await submit({preventDefault(){}});assert.equal(calls,1);assert.ok(!status.textContent.includes('<script>'));
 }
});

test('draft request ID survives reload and recovery explicitly posts only that ID without regenerating',async()=>{
 const {draftRecoveryJs}=await import('../../src/hosted/cloudflare-draft-admin.ts');const saved=new Map();
 function ui(fetch){
  const handlers={},nodes={
   '#draft-form':{querySelector:()=>nodes.draftButton,addEventListener:(_event,fn)=>{handlers.prepare=fn;}},draftButton:{disabled:false},
   '#draft-recovery-form':{querySelector:()=>nodes.recoveryButton,addEventListener:(_event,fn)=>{handlers.recover=fn;}},recoveryButton:{disabled:false},
   '#check-source':{addEventListener(){}},'#source-result':{},'#source-evidence':{},'#result':{},'#source':{value:'s-bfba858067cc3eb54024f532|mcp-tools'},'#article':{value:'tool-use'},'#recovery-key':{value:''},'#draft-request':{},'#recovery-result':{},'#recovered-inbox':{hidden:true},'#inbox':{hidden:true}
  };
  runInNewContext(draftAdminJs+draftRecoveryJs,{document:{querySelector:key=>nodes[key]},crypto:{randomUUID:()=> '11111111-1111-4111-8111-111111111111'},localStorage:{getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)},fetch});return {nodes,handlers};
 }
 const initial=ui(async()=>({ok:false,status:503,json:async()=>({error:'draft_save_unconfirmed'})}));await initial.handlers.prepare({preventDefault(){}});assert.equal(initial.nodes['#recovery-key'].value,'11111111-1111-4111-8111-111111111111');
 let calls=0;const loaded=ui(async(url,options)=>{calls++;assert.equal(url,'/api/admin/drafts/recover');assert.equal(options.method,'POST');assert.deepEqual(JSON.parse(options.body),{requestKey:'11111111-1111-4111-8111-111111111111'});return {ok:true,json:async()=>({submissionId:'22222222-2222-4222-8222-222222222222',approved:false,published:false})};});
 assert.equal(loaded.nodes['#recovery-key'].value,'11111111-1111-4111-8111-111111111111');await loaded.handlers.recover({preventDefault(){}});assert.equal(calls,1);assert.equal(loaded.nodes['#recovered-inbox'].hidden,false);assert.equal(loaded.nodes.recoveryButton.disabled,false);assert.match(loaded.nodes['#recovery-result'].textContent,/Nothing was published/);
});
