import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';

test('article actions and native contents support keyboard and reduced motion',async({page},info)=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/articles/tool-use/');
  expect(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
  const contents=page.locator('[data-article-contents]'),summary=contents.locator('summary');
  const opened=await contents.evaluate((el:HTMLDetailsElement)=>el.open);
  expect(opened).toBe(info.project.name==='desktop');
  await summary.focus();await page.keyboard.press('Enter');
  await expect(contents).toHaveJSProperty('open',!opened);
  await page.keyboard.press('Enter');await expect(contents).toHaveJSProperty('open',opened);
  const actions=page.getByRole('navigation',{name:'Article actions'});
  await actions.getByRole('link',{name:'Sources (3)'}).focus();await page.keyboard.press('Enter');
  await expect(page.locator('#sources')).toBeInViewport();
  await actions.getByRole('link',{name:'Revision history'}).click();
  await expect(page.locator('#revision')).toBeInViewport();
  await expect(page.locator('#revision a[data-source-commit]')).toHaveAttribute('href',/\/commits\/[a-f0-9]{40}\/src\/content\/articles\/tool-use\.md$/);
  await actions.getByRole('link',{name:'Correction options'}).click();
  await expect(page).toHaveURL(/\/contribute\/\?article=tool-use$/);
  await expect(page.locator('#intake-status')).toContainText('Reader submissions are currently closed');
  await expect(page.locator('#article-context')).toBeVisible();
  await expect(page.locator('#context-title')).toHaveText('Tool use');
  await expect(page.locator('#context-sources')).toHaveAttribute('href','/articles/tool-use/#sources');
  await expect(page.locator('#context-revision')).toHaveAttribute('href','/articles/tool-use/#revision');
  await expect(page.locator('#contribution-form')).toBeHidden();
});

test('an explicitly enabled local status reveals the existing contribution form',async({page})=>{
  await page.route('**/api/editorial/status',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({enabled:true,mode:'local-synthetic-only'})}));
  await page.goto('/contribute/?article=computer-use-agents');
  await expect(page.locator('#contribution-form')).toBeVisible();
  await expect(page.getByLabel('What needs attention?')).toBeEnabled();
  await expect(page.getByLabel('Article',{exact:true})).toHaveValue('computer-use-agents');
  await expect(page.locator('#intake-status')).toContainText('Local synthetic preview only');
});

test('narrow, tablet and desktop reading keep labelled navigation and bounded prose',async({page},info)=>{
  const measurements=[];
  for(const width of [320,390,768,1024,1440]){
    await page.setViewportSize({width,height:1000});await page.goto('/articles/agent-to-agent-communication/');
    const m=await page.evaluate(()=>{
      const body=document.querySelector('.prose')!,search=document.querySelector('.header-search')!,title=document.querySelector('h1')!,contents=document.querySelector('.contents')!;
      return {viewport:innerWidth,width:document.documentElement.scrollWidth,proseWidth:body.getBoundingClientRect().width,font:parseFloat(getComputedStyle(body).fontSize),searchWidth:search.getBoundingClientRect().width,searchHeight:search.getBoundingClientRect().height,titleY:title.getBoundingClientRect().top,contentsY:contents.getBoundingClientRect().top};
    });
    expect(m.width).toBeLessThanOrEqual(width);expect(m.proseWidth).toBeLessThanOrEqual(680);expect(m.font).toBeGreaterThanOrEqual(18);expect(m.searchWidth).toBeGreaterThanOrEqual(44);expect(m.searchHeight).toBeGreaterThanOrEqual(44);
    await expect(page.locator('.header-search')).toHaveText(/Search/);
    if(width<=720)expect(m.titleY).toBeLessThan(m.contentsY);
    measurements.push(m);
  }
  const git=execFileSync('git',['rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim();
  writeFileSync(join(git,'usability-widths-'+info.project.name+'.json'),JSON.stringify(measurements,null,2)+'\n');
});

test('search exposes busy state, then real results, and retains an empty collection fallback',async({page},info)=>{
  let release!:()=>void;const held=new Promise<void>(resolve=>release=resolve);
  await page.route('**/pagefind/pagefind.js',async route=>{await held;await route.continue();});
  await page.goto('/search/');const input=page.getByRole('searchbox');
  await input.fill('MCP');await expect(page.getByRole('status')).toHaveText('Searching the collection…');
  await expect(page.locator('#search-results')).toHaveAttribute('aria-busy','true');
  await page.screenshot({path:info.outputPath('search-loading.png'),fullPage:true});release();
  await expect(page.locator('#search-results')).toContainText('Model Context Protocol');await expect(page.locator('#search-results')).toHaveAttribute('aria-busy','false');
  await page.screenshot({path:info.outputPath('search-success.png'),fullPage:true});
  await input.fill('zzunfindablewordzz');await expect(page.locator('#no-results')).toBeVisible();
  await expect(page.locator('.search-browse>a')).toHaveCount(20);await page.screenshot({path:info.outputPath('search-empty.png'),fullPage:true});
  await page.getByRole('button',{name:'Clear search'}).focus();await page.keyboard.press('Enter');await expect(input).toBeFocused();await expect(input).toHaveValue('');
});
