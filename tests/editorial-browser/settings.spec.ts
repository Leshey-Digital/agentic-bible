import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {waitForEditorialStyles} from './stylesheet-ready.ts';

const origin='http://127.0.0.1:8788';
const google={tagId:'GT-SYNTHETIC1',ga4Id:'G-TEST000001',enabled:true};
const clarity={projectId:'synthetic01',enabled:true};
const privacy={previewEnabled:false,analyticsConsent:'denied',adConsent:'denied',respectDnt:true};
async function login(page:Page,identity='local-editor') {
  await page.goto('/admin/sign-in/');await page.getByLabel('Test identity').selectOption(identity);await page.getByRole('button',{name:'Start local test session'}).click();
}
async function saveForm(page:Page,name:string) {
  await Promise.all([page.waitForEvent('domcontentloaded'),page.getByRole('button',{name,exact:true}).click()]);
}
async function state(page:Page) {const response=await page.request.get('/api/admin/settings');expect(response.status()).toBe(200);return response.json();}
async function save(page:Page,group:string,values:unknown) {
  const current=await state(page);const session=await(await page.request.get('/api/admin/session')).json();
  const response=await page.request.patch('/api/admin/settings',{headers:{Origin:origin,'X-CSRF-Token':session.csrf},data:{group,values,version:current.settings[group].version,requestKey:crypto.randomUUID()}});
  expect(response.status()).toBe(200);return response.json();
}

test('admin edits providers independently, preserves valid stale/invalid input and sees audited privacy defaults',async({page})=>{
  await login(page);await page.getByRole('link',{name:'Measurement settings'}).click();
  await expect(page.getByRole('heading',{name:'Measure with care.'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Ads are off.'})).toBeVisible();
  await expect(page.getByLabel('Public policy preview')).toHaveValue('false');
  const before=await state(page);
  await page.getByLabel('Google tag ID',{exact:true}).fill(google.tagId);await page.getByLabel('GA4 measurement ID').fill(google.ga4Id);
  await page.locator('#google-enabled').selectOption('true');await saveForm(page,'Save Google settings');
  await expect(page.getByRole('status')).toContainText('Collection remains off');
  await page.getByLabel('Clarity project ID').fill(clarity.projectId);await page.locator('#clarity-enabled').selectOption('true');await saveForm(page,'Save Microsoft Clarity settings');
  await page.reload();await expect(page.getByLabel('Google tag ID',{exact:true})).toHaveValue(google.tagId);await expect(page.getByLabel('Clarity project ID')).toHaveValue(clarity.projectId);
  const after=await state(page);expect(after.audit.length).toBe(before.audit.length+2);expect(after.settings.privacy.version).toBe(before.settings.privacy.version);
  await page.getByLabel('Google tag ID',{exact:true}).fill('sk-synthetic-private-do-not-store');await saveForm(page,'Save Google settings');
  await expect(page.getByRole('alert')).toContainText('Use a GT- or G-');expect(await page.content()).not.toContain('sk-synthetic-private-do-not-store');await expect(page.getByLabel('GA4 measurement ID')).toHaveValue(google.ga4Id);
  await page.getByLabel('Google tag ID',{exact:true}).fill('GT-MYNEWEDIT1');
  await save(page,'google',{...google,tagId:'GT-OTHEREDIT1'});
  const conflict=page.waitForResponse(response=>response.url().endsWith('/admin/settings/')&&response.request().method()==='POST');
  await saveForm(page,'Save Google settings');expect((await conflict).status()).toBe(409);
  await expect(page.getByRole('alert')).toContainText('Your valid entered settings are kept');await expect(page.getByLabel('Google tag ID',{exact:true})).toHaveValue('GT-MYNEWEDIT1');
  await saveForm(page,'Save Google settings');await expect(page.getByRole('status')).toContainText('Settings saved');
  await waitForEditorialStyles(page);
  await page.setViewportSize({width:1440,height:1000});expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await page.screenshot({path:test.info().outputPath('settings-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await page.screenshot({path:test.info().outputPath('settings-mobile.png'),fullPage:true});
});

test('actual public HTML omits disabled IDs and emits only inert policy on eligible pages with no tracking network',async({page})=>{
  await login(page);await save(page,'google',google);await save(page,'clarity',clarity);await save(page,'privacy',privacy);
  const external:string[]=[];page.on('request',request=>{if(!request.url().startsWith(origin))external.push(request.url());});
  await page.goto('/articles/ai-agent/');await expect(page.locator('#measurement-policy')).toHaveCount(0);expect(await page.content()).not.toContain(google.tagId);
  await save(page,'privacy',{...privacy,previewEnabled:true});await page.reload();
  const policy=await page.locator('#measurement-policy').evaluate(element=>JSON.parse((element as HTMLTemplateElement).content.textContent!));
  expect(policy.trackingEnabled).toBe(false);expect(policy.adsEnabled).toBe(false);expect(policy.consent).toEqual({analytics:'denied',advertising:'denied'});expect(policy.providers).toEqual([{provider:'google',identifiers:[google.tagId,google.ga4Id],status:'not-connected'},{provider:'clarity',identifiers:[clarity.projectId],status:'not-connected'}]);
  expect(await page.locator('script[src^="http"]').count()).toBe(0);expect((await page.request.get('/articles/ai-agent/')).headers()['cache-control']).toBe('private, no-store');
  for(const path of ['/admin/settings/','/admin/','/admin/sources/','/contribute/','/search/?q=synthetic-private-query','/articles/ai-agent/?q=synthetic-private-query','/unknown-settings-page/']){await page.goto(path);await expect(page.locator('#measurement-policy')).toHaveCount(0);}
  for(const header of ['DNT','Sec-GPC']){await page.setExtraHTTPHeaders({[header]:'1'});await page.goto('/articles/ai-agent/');await expect(page.locator('#measurement-policy')).toHaveCount(0);expect(await page.content()).not.toContain(google.tagId);}
  await page.setExtraHTTPHeaders({});expect(external).toEqual([]);
  const adminState=await state(page);expect(adminState.secretsStatus).toBe('unavailable');expect(adminState.trackingEnabled).toBe(false);expect(JSON.stringify(policy)).not.toContain('csrf');expect(JSON.stringify(policy)).not.toContain('local-editor');
  await save(page,'privacy',privacy);
});

test('actual settings endpoints reject anonymous, reader, CSRF, cross-origin, scripts, secret fields and ad activation',async({page,request})=>{
  expect((await request.get('/api/admin/settings')).status()).toBe(401);
  expect((await request.patch('/api/admin/settings',{headers:{Origin:origin},data:{}})).status()).toBe(401);
  await login(page,'local-reader');expect((await page.request.get('/api/admin/settings')).status()).toBe(403);expect((await page.request.get('/admin/settings/')).status()).toBe(403);
  await page.getByRole('button',{name:'Sign out'}).click();await page.getByRole('button',{name:'Start local test session'}).click();
  const current=await state(page);const session=await(await page.request.get('/api/admin/session')).json();const data={group:'google',values:google,version:current.settings.google.version,requestKey:crypto.randomUUID()};
  expect((await page.request.patch('/api/admin/settings',{headers:{Origin:origin},data})).status()).toBe(403);
  expect((await page.request.patch('/api/admin/settings',{headers:{Origin:'https://evil.invalid','X-CSRF-Token':session.csrf},data})).status()).toBe(403);
  const headers={Origin:origin,'X-CSRF-Token':session.csrf};
  for(const invalid of [{...data,apiKey:'sk-synthetic-private'},{...data,values:{...google,tagId:'<script>alert(1)</script>'}},{...data,group:'advertising',values:{enabled:true},version:current.settings.advertising.version},{...data,group:'privacy',values:{...privacy,analyticsConsent:'granted'},version:current.settings.privacy.version}]){
    const response=await page.request.patch('/api/admin/settings',{headers,data:invalid});expect(response.status()).toBe(422);const body=await response.text();expect(body).not.toContain('sk-synthetic-private');expect(body).not.toContain('<script>');
  }
  const after=await state(page);expect(after.settings).toEqual(current.settings);expect(after.audit).toEqual(current.audit);
});

test('actual D1 serializes concurrent settings updates and replay audit without overwriting another section',async({page})=>{
  await login(page);const current=await state(page);const session=await(await page.request.get('/api/admin/session')).json();const headers={Origin:origin,'X-CSRF-Token':session.csrf};
  const data={group:'google',values:{...google,tagId:'GT-CONCURRENT1'},version:current.settings.google.version,requestKey:crypto.randomUUID()};
  const duplicate=await Promise.all([page.request.patch('/api/admin/settings',{headers,data}),page.request.patch('/api/admin/settings',{headers,data})]);expect(duplicate.map(response=>response.status())).toEqual([200,200]);
  const middle=await state(page);expect(middle.audit.length).toBe(current.audit.length+1);expect(middle.settings.google.version).toBe(current.settings.google.version+1);
  const races=await Promise.all(['GT-FIRSTWIN1','GT-SECONDWIN1'].map(tagId=>page.request.patch('/api/admin/settings',{headers,data:{...data,values:{...google,tagId},version:middle.settings.google.version,requestKey:crypto.randomUUID()}})));expect(races.map(response=>response.status()).sort()).toEqual([200,409]);
  const latest=await state(page);const independent=await Promise.all([
    page.request.patch('/api/admin/settings',{headers,data:{group:'google',values:{...google,enabled:false},version:latest.settings.google.version,requestKey:crypto.randomUUID()}}),
    page.request.patch('/api/admin/settings',{headers,data:{group:'clarity',values:{...clarity,projectId:'synthetic02'},version:latest.settings.clarity.version,requestKey:crypto.randomUUID()}}),
  ]);expect(independent.map(response=>response.status())).toEqual([200,200]);
  const final=await state(page);expect(final.audit.length).toBe(current.audit.length+4);expect(JSON.stringify(final.audit)).not.toContain('GT-CONCURRENT1');expect(final.settings.advertising.values.enabled).toBe(false);
});
