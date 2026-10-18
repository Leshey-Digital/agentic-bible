import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {controlledWikiPacket} from '../../scripts/controlled-wiki-packet.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('fresh controlled inputs bind this source edition without rebasing retained inputs or template bytes',()=>{
 const template=readFileSync('fixtures/wiki-bridge/packet.json'),original=JSON.parse(template),root=mkdtempSync(join(tmpdir(),'agentic-current-packet-'));
 try{
  mkdirSync(join(root,'fixtures/wiki-bridge'),{recursive:true});mkdirSync(join(root,'src/content/articles'),{recursive:true});
  writeFileSync(join(root,'fixtures/wiki-bridge/packet.json'),template);writeFileSync(join(root,'src/content/articles/tool-use.md'),'Earlier controlled source edition.\n');
  const retained=controlledWikiPacket(root),retainedBytes=JSON.stringify(retained);
  writeFileSync(join(root,'src/content/articles/tool-use.md'),'Later controlled source edition with reviewed examples.\n');
  const fresh=controlledWikiPacket(root);
  assert.notEqual(fresh.originalMarkdownHash,retained.originalMarkdownHash);assert.equal(JSON.stringify(retained),retainedBytes);
  assert.deepEqual({...fresh,originalMarkdownHash:original.originalMarkdownHash},original);
  assert.deepEqual(readFileSync(join(root,'fixtures/wiki-bridge/packet.json')),template);
  assert.equal(controlledWikiPacket().originalMarkdownHash,hash(readFileSync('src/content/articles/tool-use.md')));
  writeFileSync(join(root,'fixtures/wiki-bridge/packet.json'),Buffer.concat([template,Buffer.from('\n')]));
  assert.throws(()=>controlledWikiPacket(root),/controlled_packet_template_changed/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
