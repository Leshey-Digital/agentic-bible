import {test,expect} from '@playwright/test';

test('article link and citation copy have keyboard, failure, and no-JavaScript fallbacks',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await page.goto('/articles/tool-use/');
  const citation=page.locator('#article-citation'),copyCitation=page.getByRole('button',{name:'Copy citation'}),copyLink=page.getByRole('button',{name:'Copy article link'});
  await expect(citation).toContainText('Tool use');await expect(copyCitation).toBeVisible();await expect(copyLink).toBeVisible();
  await copyCitation.focus();await page.keyboard.press('Enter');await expect(page.locator('[data-share-status]')).toHaveText('Copied to clipboard.');
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain('Tool use');
  await copyLink.focus();await page.keyboard.press('Enter');await expect(page.locator('[data-share-status]')).toHaveText('Copied to clipboard.');
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(page.url());

  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new DOMException('denied','NotAllowedError'))}}));
  await page.reload();await page.getByRole('button',{name:'Copy citation'}).click();
  await expect(page.locator('[data-share-status]')).toContainText('Copy failed.');await expect(page.locator('#article-citation')).toBeVisible();

  for(const width of [320,390,768]){
    await page.setViewportSize({width,height:900});
    const dimensions=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,share:(document.querySelector('.share-tools') as HTMLElement).scrollWidth}));
    expect(dimensions.document).toBeLessThanOrEqual(width);expect(dimensions.share).toBeLessThanOrEqual(width);
  }

  const browser=context.browser();expect(browser).not.toBeNull();
  const noJsContext=await browser!.newContext({javaScriptEnabled:false,baseURL:'http://127.0.0.1:8787'});
  const noJsPage=await noJsContext.newPage();await noJsPage.goto('/articles/tool-use/');
  await expect(noJsPage.locator('#article-citation')).toBeVisible();await expect(noJsPage.getByRole('button',{name:'Copy citation'})).toBeHidden();
  await noJsContext.close();
});

test('article and site previews use page-specific title and description metadata',async({page})=>{
  const pages=[['/articles/tool-use/','Tool use'],['/about/','About the library'],['/history/','Revision history']];
  for(const [path,title] of pages){
    await page.goto(path);await expect(page).toHaveTitle(new RegExp(title));
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content',/.{20,}/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content',new RegExp(title));
    await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute('content',/.{20,}/);
  }
});
