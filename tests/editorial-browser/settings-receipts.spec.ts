import {test,expect,type Page} from '@playwright/test';

const origin='http://127.0.0.1:8788';
async function setup(page:Page){
  await page.goto('/admin/sign-in/');await page.getByRole('button',{name:'Start local test session'}).click();
  const session=await(await page.request.get('/api/admin/session')).json();
  const headers={Origin:origin,'X-CSRF-Token':session.csrf};
  const state=async()=>{const response=await page.request.get('/api/admin/settings');expect(response.status()).toBe(200);return response.json();};
  return {headers,state,patch:(data:unknown)=>page.request.patch('/api/admin/settings',{headers,data})};
}

test('lost no-op response replays byte-for-byte after reload and a later settings change',async({page})=>{
  const {headers,state,patch}=await setup(page);const before=await state();
  const data={group:'google',values:before.settings.google.values,version:before.settings.google.version,requestKey:crypto.randomUUID()};
  let committed='';
  await page.route('**/api/admin/settings',async route=>{
    const response=await route.fetch();expect(response.status()).toBe(200);committed=await response.text();await route.abort('failed');
  });
  const interrupted=await page.evaluate(async({headers,data})=>{try{await fetch('/api/admin/settings',{method:'PATCH',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(data)});return false;}catch{return true;}},{headers,data});
  expect(interrupted).toBe(true);expect(JSON.parse(committed).result).toBe('unchanged');
  await page.unrouteAll({behavior:'wait'});await page.reload();
  const changed=await patch({...data,requestKey:crypto.randomUUID(),values:{tagId:'GT-RECEIPT99',ga4Id:'',enabled:false}});expect(changed.status()).toBe(200);
  const current=await state();expect(current.audit.length).toBe(before.audit.length+1);expect(current.settings.google.version).toBe(before.settings.google.version+1);
  const replay=await patch(data);expect(replay.status()).toBe(200);expect(await replay.text()).toBe(committed);
  expect((await patch({...data,values:{tagId:'GT-REBOUND99',ga4Id:'',enabled:false}})).status()).toBe(409);
  expect(await state()).toEqual(current);
  await page.goto('/articles/ai-agent/');await expect(page.locator('#measurement-policy')).toHaveCount(0);
});

test('actual D1 serializes identical no-ops and a no-op versus changed write sharing one key',async({page})=>{
  const {state,patch}=await setup(page);const before=await state();
  const data={group:'google',values:before.settings.google.values,version:before.settings.google.version,requestKey:crypto.randomUUID()};
  const responses=await Promise.all([patch(data),patch(data)]);expect(responses.map(response=>response.status())).toEqual([200,200]);
  expect(await responses[0].text()).toBe(await responses[1].text());expect(await state()).toEqual(before);
  const noop={...data,requestKey:crypto.randomUUID()};const changed={...noop,values:{tagId:'GT-RACERECEIPT9',ga4Id:'',enabled:false}};
  const races=await Promise.all([patch(noop),patch(changed)]);expect(races.map(response=>response.status()).sort()).toEqual([200,409]);
  const winner=races.findIndex(response=>response.status()===200);const raw=await races[winner].text();const result=JSON.parse(raw).result;
  const current=await state();expect(current.audit.length).toBe(before.audit.length+(result==='saved'?1:0));expect(current.settings.google.version).toBe(before.settings.google.version+(result==='saved'?1:0));
  const retry=await patch(winner===0?noop:changed);expect(retry.status()).toBe(200);if(winner===0)expect(await retry.text()).toBe(raw);
  expect((await patch(winner===0?changed:noop)).status()).toBe(409);expect(await state()).toEqual(current);
});
