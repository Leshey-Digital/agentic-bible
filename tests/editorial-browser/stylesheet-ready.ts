import type {Page} from '@playwright/test';

// Native form navigation can resolve at document commit before its stylesheet.
// DOM text assertions do not establish readiness for a layout/accessibility audit.
export async function waitForEditorialStyles(page:Page){
  await page.waitForLoadState('load');
  const loaded=await page.locator('link[href="/editorial.css"]').evaluate(link=>!!(link as HTMLLinkElement).sheet);
  if(!loaded)throw new Error('Editorial stylesheet did not load');
}
