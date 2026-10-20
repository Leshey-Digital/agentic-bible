import {test,expect} from '@playwright/test';
test('read and search send no external requests and have no runtime or CSP errors', async ({ page }) => {
  const failures: string[] = [];
  const external: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('console', message => { if (message.type() === 'error') failures.push(message.text()); });
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:8790/') && !request.url().startsWith('data:')) external.push(request.url()); });
  await page.goto('/articles/ai-agent/');
  await page.goto('/search/#q=agent');
  await expect(page.locator('#search-results a')).not.toHaveCount(0);
  expect(external).toEqual([]);
  expect(failures).toEqual([]);
});
