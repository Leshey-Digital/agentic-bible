import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readFileSync,writeFileSync} from 'node:fs';
import {waitForEditorialStyles} from './stylesheet-ready.ts';

const origin='http://127.0.0.1:8788';
const catalog=JSON.parse(readFileSync('dist/source-catalog.json','utf8'));
const source=catalog.sources.find((source:{title:string})=>source.title==='Building effective agents');

test('source change automatically publishes a fixture revision, flags it afterward and supports review/revert/restore',async({page})=>{
  await page.goto('/admin/sign-in/');await page.getByRole('button',{name:'Start local test session'}).click();
  await page.getByRole('link',{name:'Source monitoring'}).click();
  await expect(page.getByRole('heading',{name:'Track a source. Keep the evidence.'})).toBeVisible();
  await page.getByLabel('Source',{exact:true}).selectOption(source.id);
  await page.getByLabel('Synthetic response').selectOption('baseline');
  await page.getByRole('button',{name:'Run fixture check'}).click();
  await expect(page.locator('.monitor-jobs')).toContainText('baseline · succeeded');
  await expect(page.getByLabel('Source',{exact:true})).toHaveValue(source.id);
  await expect(page.locator('#publication-queue')).toContainText('No source-change candidates yet');
  await page.getByLabel('Source',{exact:true}).selectOption(source.id);
  await page.getByLabel('Synthetic response').selectOption('change');await page.getByRole('button',{name:'Run fixture check'}).click();
  await expect(page.locator('.monitor-candidate')).toHaveCount(source.articleIds.length);
  for(const articleId of source.articleIds)await expect(page.locator('.monitor-candidate').filter({hasText:articleId+' · local fixture ledger'}).locator('h3')).toHaveText('published · review flagged');
  const candidate=page.locator('.monitor-candidate').filter({has:page.locator('.kicker',{hasText:/^ai-agent ·/})});
  await waitForEditorialStyles(page);
  await page.setViewportSize({width:390,height:844});
  const measure=()=>page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,mobile:matchMedia('(max-width: 800px)').matches,grid:getComputedStyle(document.querySelector('.monitor-controls')!).gridTemplateColumns,overflow:[...document.querySelectorAll('body *')].filter(element=>element.getBoundingClientRect().right>innerWidth+.1).slice(0,12).map(element=>({tag:element.tagName,className:element.className,text:element.textContent?.slice(0,100),right:element.getBoundingClientRect().right,width:element.getBoundingClientRect().width,minWidth:getComputedStyle(element).minWidth,whiteSpace:getComputedStyle(element).whiteSpace,font:getComputedStyle(element).fontFamily}))}));
  const immediate=await measure();await page.evaluate(()=>new Promise<void>(done=>requestAnimationFrame(()=>requestAnimationFrame(()=>done()))));const geometry={immediate,afterPaint:await measure()};
  writeFileSync(test.info().outputPath('monitoring-mobile-geometry.json'),JSON.stringify(geometry,null,2));console.info('Monitoring mobile geometry: '+JSON.stringify(geometry));
  expect(immediate.scrollWidth,JSON.stringify(geometry)).toBeLessThanOrEqual(immediate.viewport);
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await page.screenshot({path:test.info().outputPath('monitoring-mobile.png'),fullPage:true});
  await candidate.getByRole('button',{name:'Clear review flag'}).click();await expect(candidate).toContainText('published · review cleared');
  await candidate.getByRole('button',{name:'Revert local revision'}).click();await expect(candidate).toContainText('reverted · review flagged');
  await candidate.getByRole('button',{name:'Restore local revision'}).click();await expect(candidate).toContainText('published · review flagged');
  await expect(page.locator('.monitor-candidate').filter({hasText:'agent-orchestration · local fixture ledger'}).locator('h3')).toHaveText('published · review flagged');
  await page.reload();await expect(page.locator('.monitor-audit')).toContainText('restore');
  await page.setViewportSize({width:1440,height:1000});
  expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
  await page.screenshot({path:test.info().outputPath('monitoring-desktop.png'),fullPage:true});
});

test('native monitoring navigation waits for a delayed stylesheet before strict mobile layout checks',async({page})=>{
  await page.goto('/admin/sign-in/');await page.getByRole('button',{name:'Start local test session'}).click();await page.getByRole('link',{name:'Source monitoring'}).click();await waitForEditorialStyles(page);
  let releaseCss!:()=>void,cssRequested!:()=>void;const gate=new Promise<void>(done=>releaseCss=done),requested=new Promise<void>(done=>cssRequested=done);let intercepted=false;
  await page.route('**/editorial.css',async route=>{if(intercepted)return route.continue();intercepted=true;const response=await route.fetch();cssRequested();await gate;await route.fulfill({response});});
  const measure=()=>page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,stylesheetLoaded:!!document.querySelector<HTMLLinkElement>('link[href="/editorial.css"]')?.sheet}));
  try{
    const clicked=page.getByRole('button',{name:'Queue next hourly fixture batch'}).click();await requested;await page.locator('.monitor-controls').waitFor({state:'attached'});await clicked;await page.setViewportSize({width:390,height:844});
    const pending=await measure();expect(pending.stylesheetLoaded).toBe(false);
    let readySettled=false;const ready=waitForEditorialStyles(page).then(()=>readySettled=true);await page.evaluate(()=>document.readyState);expect(readySettled,'DOM availability must not complete the layout-readiness guard').toBe(false);
    releaseCss();await ready;const loaded=await measure();expect(loaded.stylesheetLoaded).toBe(true);expect(loaded.scrollWidth).toBeLessThanOrEqual(loaded.viewport);
    const evidence={pending,loaded,nativeClickResolvedBeforeStyles:true,guardWaitedForStyles:true,strictWidthBoundary:true};writeFileSync(test.info().outputPath('monitoring-stylesheet-readiness.json'),JSON.stringify(evidence,null,2));console.info('Monitoring stylesheet readiness: '+JSON.stringify(evidence));
  }finally{releaseCss();}
});

test('monitor APIs reject anonymous/reader/CSRF/arbitrary URL requests and preserve duplicate-run idempotency',async({page,request})=>{
  expect((await request.get('/api/admin/monitor/state')).status()).toBe(401);
  await page.goto('/admin/sign-in/');await page.getByLabel('Test identity').selectOption('local-reader');await page.getByRole('button',{name:'Start local test session'}).click();
  expect((await page.request.get('/api/admin/monitor/state')).status()).toBe(403);
  await page.getByRole('button',{name:'Sign out'}).click();await page.getByRole('button',{name:'Start local test session'}).click();
  const session=await(await page.request.get('/api/admin/session')).json();
  const data={sourceId:source.id,scenario:'change',requestKey:crypto.randomUUID()};
  expect((await page.request.post('/api/admin/monitor/run',{headers:{Origin:origin},data})).status()).toBe(403);
  const headers={Origin:origin,'X-CSRF-Token':session.csrf};
  expect((await page.request.post('/api/admin/monitor/run',{headers,data:{...data,sourceId:'http://127.0.0.1/private'}})).status()).toBe(422);
  const before=await(await page.request.get('/api/admin/monitor/state')).json();
  const responses=await Promise.all([page.request.post('/api/admin/monitor/run',{headers,data}),page.request.post('/api/admin/monitor/run',{headers,data})]);
  expect(responses.map(response=>response.status())).toEqual([200,200]);
  const after=await(await page.request.get('/api/admin/monitor/state')).json();
  expect(after.budget.attempts).toBe(before.budget.attempts+1);
  expect(after.candidates.length).toBe(before.candidates.length);
  expect(after.mode).toBe('fixture-only');expect(after.publicRelease).toBe(false);
});

test('concurrent jobs cannot overspend the persisted daily fixture request budget',async({page})=>{
  await page.goto('/admin/sign-in/');await page.getByRole('button',{name:'Start local test session'}).click();
  const session=await(await page.request.get('/api/admin/session')).json();const headers={Origin:origin,'X-CSRF-Token':session.csrf};
  let state=await(await page.request.get('/api/admin/monitor/state')).json();
  for(let index=0;state.budget.attempts<19&&index<20;index++) {
    expect((await page.request.post('/api/admin/monitor/run',{headers,data:{sourceId:source.id,scenario:'baseline',requestKey:crypto.randomUUID()}})).status()).toBe(200);
    state=await(await page.request.get('/api/admin/monitor/state')).json();
  }
  expect(state.budget.attempts).toBe(19);
  const other=catalog.sources.find((entry:{id:string})=>entry.id!==source.id);
  await Promise.all([source.id,other.id].map(sourceId=>page.request.post('/api/admin/monitor/run',{headers,data:{sourceId,scenario:'baseline',requestKey:crypto.randomUUID()}})));
  const after=await(await page.request.get('/api/admin/monitor/state')).json();
  expect(after.budget.attempts).toBe(20);expect(after.jobs.some((job:{state:string})=>job.state==='budget_blocked')).toBe(true);
  expect(after.budget.reservedBytes).toBe(20*32768);
});
