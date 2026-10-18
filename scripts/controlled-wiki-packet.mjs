// Construct a NEW controlled demonstration input for the current source edition.
// Never apply this to a saved command, receipt, pending operation or historical store.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const frozenTemplateHash='c8eb8fb8a68eb0c10c62e69b099abbca984ff250b3c624c66b675c2303ea2611';
export function controlledWikiPacket(root=process.cwd()){
 const template=readFileSync(join(root,'fixtures/wiki-bridge/packet.json'));
 if(sha256(template)!==frozenTemplateHash)throw Error('controlled_packet_template_changed');
 const packet=JSON.parse(template.toString('utf8'));
 packet.originalMarkdownHash=sha256(readFileSync(join(root,'src/content/articles/tool-use.md')));
 return packet;
}
