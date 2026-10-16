import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function saveForm(page:Page,name:string) {
  await Promise.all([page.waitForEvent('domcontentloaded'),page.getByRole('button',{name,exact:true}).click()]);
}

test('one human can recover a contribution, review it, publish fixture metadata and configure inert measurement independently',async({page})=>{
  await page.setExtraHTTPHeaders({'CF-Connecting-IP':'192.0.2.50'});
  await page.goto('/contribute/?article=tool-use');await expect(page.getByLabel('What needs attention?')).toBeEnabled();
  const original='Synthetic integration original: the committed response is lost before the reader receives a receipt.';
  const newer='Synthetic integration revised evidence: preserve this draft, then review it alongside source and measurement controls.';
  await page.getByLabel('What needs attention?').fill(original);let firstReference='';
  await page.route('**/api/submissions',async route=>{const response=await route.fetch();expect(response.status()).toBe(201);firstReference=(await response.json()).reference;await route.abort();});
  await page.getByRole('button',{name:'Send local suggestion'}).click();await expect(page.getByRole('alert')).toContainText('Could not confirm');await page.unroute('**/api/submissions');
  await page.getByLabel('What needs attention?').fill(newer);await page.getByLabel('Article',{exact:true}).selectOption('ai-agent');await page.reload();await expect(page.getByLabel('What needs attention?')).toBeEnabled();
  await expect(page.getByLabel('What needs attention?')).toHaveValue(newer);await expect(page.getByLabel('Article',{exact:true})).toHaveValue('ai-agent');
  await page.getByRole('button',{name:'Keep draft with new reference'}).click();
  const saved=page.waitForResponse(response=>response.url().endsWith('/api/submissions'));await page.getByRole('button',{name:'Send local suggestion'}).click();const response=await saved;expect(response.status()).toBe(201);const secondReference=(await response.json()).reference;expect(secondReference).not.toBe(firstReference);
  await page.goto('/admin/sign-in/');await page.getByRole('button',{name:'Start local test session'}).click();
  await page.goto(`/admin/items/${secondReference}/`);await expect(page.locator('.submitted-text')).toHaveText(newer);await page.getByLabel('Tags',{exact:true}).fill('Integration, Source follow-up');await page.getByLabel('Status',{exact:true}).selectOption('follow-up');await page.getByRole('button',{name:'Save disposition'}).click();await expect(page.getByRole('status')).toContainText('Disposition saved');
  const item=await(await page.request.get(`/api/admin/submissions/${secondReference}`)).json();expect(item.item.tags).toEqual(['Integration','Source follow-up']);expect(item.audit).toHaveLength(2);
  await page.getByRole('link',{name:'Source monitoring'}).click();
  await page.getByLabel('Synthetic response').selectOption('baseline');await page.getByRole('button',{name:'Run fixture check'}).click();await page.getByLabel('Synthetic response').selectOption('change');await page.getByRole('button',{name:'Run fixture check'}).click();
  await expect(page.locator('#publication-queue')).toContainText('published · review flagged');
  await page.getByRole('link',{name:'Measurement settings'}).click();await page.getByLabel('Clarity project ID').fill('integration01');await page.locator('#clarity-enabled').selectOption('true');await saveForm(page,'Save Microsoft Clarity settings');
  await page.getByLabel('Public policy preview').selectOption('true');await saveForm(page,'Save privacy defaults');
  const outside:string[]=[];page.on('request',request=>{if(!request.url().startsWith('http://127.0.0.1:8788'))outside.push(request.url());});
  await page.goto('/articles/ai-agent/');const policy=await page.locator('#measurement-policy').evaluate(element=>JSON.parse((element as HTMLTemplateElement).content.textContent!));expect(policy.trackingEnabled).toBe(false);expect(policy.adsEnabled).toBe(false);expect(policy.providers.some((provider:{provider:string;identifiers:string[]})=>provider.provider==='clarity'&&provider.identifiers.includes('integration01'))).toBe(true);expect(outside).toEqual([]);
  await page.goto('/admin/settings/');await expect(page.locator('#measurement-policy')).toHaveCount(0);await expect(page.getByRole('heading',{name:'Ads are off.'})).toBeVisible();
  const session=await(await page.request.get('/api/admin/session')).json();const headers={Origin:'http://127.0.0.1:8788','X-CSRF-Token':session.csrf};
  for(const action of ['schedule','process']){
    const requestKey=crypto.randomUUID();const first=await page.request.post('/api/admin/monitor/'+action,{headers,data:{requestKey}});expect(first.status()).toBe(200);const receipt=await first.text();
    const beforeReplay=await(await page.request.get('/api/admin/monitor/state')).json();const replay=await page.request.post('/api/admin/monitor/'+action,{headers,data:{requestKey}});expect(replay.status()).toBe(200);expect(await replay.text()).toBe(receipt);
    expect(await(await page.request.get('/api/admin/monitor/state')).json()).toEqual(beforeReplay);
  }
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await page.getByLabel('Public policy preview').selectOption('false');await saveForm(page,'Save privacy defaults');
  await page.getByLabel('Clarity project ID').fill('');await page.locator('#clarity-enabled').selectOption('false');await saveForm(page,'Save Microsoft Clarity settings');
  await page.getByRole('button',{name:'Sign out'}).click();expect((await page.request.get('/api/admin/settings')).status()).toBe(401);expect((await page.request.get('/api/admin/monitor/state')).status()).toBe(401);
});
