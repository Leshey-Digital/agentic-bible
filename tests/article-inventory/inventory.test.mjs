import test from 'node:test';
import assert from 'node:assert/strict';
import {checkedReaderInventory} from '../../src/lib/article-inventory.ts';

const article=(id,order,related=['ai-agent'])=>({id,data:{order,related,sources:[{id:'primary-source'}]}});
test('reader inventory rejects unsafe paths, duplicate IDs/orders, invalid anchors and unresolved links',()=>{
  assert.deepEqual(checkedReaderInventory([article('reader-entry',21),article('ai-agent',1,['reader-entry'])]).map(entry=>entry.id),['ai-agent','reader-entry']);
  for(const records of [
    [article('../private',21)],
    [article('reader-entry',21),article('reader-entry',22)],
    [article('reader-entry',21),article('other-entry',21)],
    [{...article('reader-entry',21),data:{...article('reader-entry',21).data,sources:[{id:'bad id'}]}}],
    [article('reader-entry',21,['missing-entry'])],
    [article('reader-entry',21,['reader-entry'])],
  ])assert.throws(()=>checkedReaderInventory(records));
});
