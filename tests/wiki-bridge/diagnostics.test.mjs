import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeFailure} from '../../src/wiki-bridge/diagnostics.ts';
test('diagnostics preserve known failure codes and suppress raw payloads and arbitrary metadata',()=>{
  const secret='PRIVATE_PAYLOAD cookie=secret https://example.com/?token=secret SELECT raw';const error=Object.assign(new Error(secret),{name:secret,code:secret,body:secret,cause:Object.assign(new Error(secret),{name:'SocketError',code:'UND_ERR_SOCKET'})});
  const summary=safeFailure(error),text=JSON.stringify(summary);assert.equal(summary.type,'UnknownError');assert.equal(summary.code,'unclassified');assert.equal(summary.cause.code,'UND_ERR_SOCKET');assert.ok(!text.includes('PRIVATE_PAYLOAD'));assert.ok(!text.includes('cookie'));assert.ok(!text.includes('https:'));assert.ok(!text.includes('SELECT'));assert.deepEqual(safeFailure(summary),summary);
});
