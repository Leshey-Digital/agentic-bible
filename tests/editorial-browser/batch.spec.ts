import { test, expect, type Page } from '@playwright/test';

const origin='http://127.0.0.1:8788';
async function admin(page:Page){
  await page.goto('/admin/sign-in/');await page.getByRole('button',{name:'Start local test session'}).click();
  return (await(await page.request.get('/api/admin/session')).json()).csrf as string;
}
test('lost schedule/process responses replay exact receipts without selecting or charging another batch',async({page})=>{
  const csrf=await admin(page);
  const headers={Origin:origin,'X-CSRF-Token':csrf};
  const receipts:Record<string,{key:string;body:string}>={};
  for(const action of ['schedule','process']){
    const key=crypto.randomUUID();
    await page.route(`**/api/admin/monitor/${action}`,async route=>{
      const response=await route.fetch();expect(response.status()).toBe(200);
      receipts[action]={key,body:await response.text()};
      await route.abort(); // The real Worker/D1 committed; only response delivery is lost.
    });
    const failed=await page.evaluate(async({action,key,csrf})=>{
      try{await fetch('/api/admin/monitor/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({requestKey:key})});return false;}catch{return true;}
    },{action,key,csrf});
    expect(failed).toBe(true);
    await page.unrouteAll({behavior:'wait'});await page.reload();
    const before=await(await page.request.get('/api/admin/monitor/state')).json();
    const replay=await page.request.post('/api/admin/monitor/'+action,{headers,data:{requestKey:key}});
    expect(replay.status()).toBe(200);expect(await replay.text()).toBe(receipts[action].body);
    const after=await(await page.request.get('/api/admin/monitor/state')).json();
    expect(after).toEqual(before);
    expect(after.jobs).toHaveLength(4);expect(after.budget.attempts).toBe(action==='schedule'?0:4);
  }
  // Deliberately new keys may advance work, while old replies remain exact snapshots.
  expect((await page.request.post('/api/admin/monitor/schedule',{headers,data:{requestKey:crypto.randomUUID()}})).status()).toBe(200);
  const current=await(await page.request.get('/api/admin/monitor/state')).json();expect(current.jobs).toHaveLength(8);
  for(const [action,receipt] of Object.entries(receipts)){
    const replay=await page.request.post('/api/admin/monitor/'+action,{headers,data:{requestKey:receipt.key}});
    expect(replay.status()).toBe(200);expect(await replay.text()).toBe(receipt.body);
  }
  expect(await(await page.request.get('/api/admin/monitor/state')).json()).toEqual(current);
  expect((await page.request.post('/api/admin/monitor/process',{headers,data:{requestKey:receipts.schedule.key}})).status()).toBe(409);
  expect((await page.request.post('/api/admin/monitor/schedule',{headers,data:{requestKey:receipts.schedule.key,sourceId:'unexpected'}})).status()).toBe(422);
  expect(await(await page.request.get('/api/admin/monitor/state')).json()).toEqual(current);
});

test('concurrent identical process commands execute one frozen pass and preserve the daily reservation budget',async({page})=>{
  const csrf=await admin(page);const headers={Origin:origin,'X-CSRF-Token':csrf};const key=crypto.randomUUID();
  const before=await(await page.request.get('/api/admin/monitor/state')).json();
  const responses=await Promise.all([1,2].map(()=>page.request.post('/api/admin/monitor/process',{headers,data:{requestKey:key}})));
  expect(responses.every(response=>[200,409].includes(response.status()))).toBe(true);
  const complete=responses.find(response=>response.status()===200)!;expect(complete).toBeTruthy();
  const saved=await complete.text();
  for(const response of responses)if(response.status()===200)expect(await response.text()).toBe(saved);
  const retry=await page.request.post('/api/admin/monitor/process',{headers,data:{requestKey:key}});
  expect(retry.status()).toBe(200);expect(await retry.text()).toBe(saved);
  const after=await(await page.request.get('/api/admin/monitor/state')).json();
  expect(after.budget.attempts).toBe(before.budget.attempts+4);
  expect(after.jobs).toHaveLength(before.jobs.length);
  expect(after.jobs.every((job:{attempts:number;state:string})=>job.state==='succeeded'&&job.attempts===1)).toBe(true);
});
