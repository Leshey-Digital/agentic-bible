import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {close} from 'pagefind';
import {generalizedFixture} from '../maintenance-quality/generalized-helpers.mjs';
import {origin} from '../maintenance-history/hosted-fixture.mjs';
import {verifySignedAdmin} from '../../src/hosted/identity.ts';
import {restoreMaintenanceRevision} from '../../src/maintenance-restore/coordinator.ts';
import {readCanonicalMaintenance} from '../../src/maintenance-history/canonical.ts';
import {buildCanonicalHistorySite} from '../maintenance-restore/build-site.mjs';

after(async()=>close());

test('an MCP restoration renders a real detail link for MCP and preserves the Tool use head',async()=>{
  const f=await generalizedFixture('history-link-restoration');
  try{
    const toolUse=await f.run('tool-use','first');
    const earlier=await f.run('model-context-protocol','second');
    const latest=await f.run('model-context-protocol','third');
    const request=f.app.input({
      receiptCommit:latest.canonical.commit,
      decision:'revert-requested',
      targetCommit:earlier.canonical.commit,
      note:'Controlled review restores an earlier MCP revision and keeps the Tool use head unchanged.',
    });
    assert.equal((await f.app.request(request)).status,200);
    const approvalId=crypto.randomUUID(),assertion=await f.app.token();
    const headers={Origin:origin,'Content-Type':'application/json','X-Agentic-Bible-Request':'admin','cf-access-jwt-assertion':assertion};
    const approval=await f.app.dispatch('/api/admin/maintenance/restore-approval',{method:'POST',headers,body:JSON.stringify({approvalId,requestId:request.requestId,confirm:'approve-canonical-restoration'})});
    assert.equal(approval.status,200,await approval.text());
    const admin=await verifySignedAdmin(new Request(origin+'/api/admin/maintenance/restore-approval',{method:'POST',headers}),f.app.trust);
    assert.ok(admin);
    const restored=await restoreMaintenanceRevision({approvalId},{enabled:true,admin,db:f.db,repo:process.cwd(),canonicalRepo:f.remote.state.root,transport:f.remote.port});
    assert.equal(restored.articleRevision.length,64);
    assert.equal(restored.restoredFromCommit,earlier.canonical.commit);
    const current=readCanonicalMaintenance({mode:'controlled-static-preview',repo:f.remote.state.root,sourceCommit:restored.commit});
    assert.deepEqual(current.history.filter(entry=>entry.current).map(entry=>[entry.articleId,entry.receipt.commit]),[
      ['model-context-protocol',restored.commit],['tool-use',toolUse.canonical.commit],
    ]);
    assert.equal(current.history[0].operation,'restoration');

    const built=buildCanonicalHistorySite({remote:f.remote},restored.commit);
    const out=built.assets,article=readFileSync(join(out,'articles','model-context-protocol','index.html'),'utf8');
    const route=`/history/model-context-protocol/restore-${approvalId}/`;
    const detailPath=join(out,'history','model-context-protocol',`restore-${approvalId}`,'index.html');
    assert.ok(article.includes(`href="${route}"`),'MCP restoration link targets its own article-aware route');
    assert.ok(existsSync(detailPath),'the linked MCP restoration detail page is generated');
    const detail=readFileSync(detailPath,'utf8');
    assert.match(detail,/<h1>Model Context Protocol: revision record\.<\/h1>/);
    assert.ok(detail.includes(`/articles/model-context-protocol/`));
    assert.ok(!article.includes(`/history/tool-use/restore-${approvalId}/`));
  }finally{await f.close();}
});
