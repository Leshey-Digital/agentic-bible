import { test, expect } from '@playwright/test';
import { readingArticleIds } from '../../src/lib/article-ids.ts';

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`canonical article choices and recovered drafts stay consistent at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': viewport.width === 390 ? '192.0.2.201' : '192.0.2.202' });
    await page.goto('/contribute/?article=computer-use-agents');
    const select = page.getByLabel('Article', { exact: true });
    await expect(select).toBeEnabled();
    expect(await select.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value).sort())).toEqual([...readingArticleIds].sort());
    await expect(select).toHaveValue('computer-use-agents');
    const catalog = await (await page.request.get('/source-catalog.json')).json();
    expect(catalog.articles.map((article: { id: string }) => article.id).sort()).toEqual([...readingArticleIds].sort());
    await select.selectOption('agent-budgets');
    const draft = 'Synthetic expanded-collection correction: preserve this newer article choice and evidence through reload.';
    await page.getByLabel('What needs attention?').fill(draft);
    await page.goto('/contribute/?article=tool-use');
    await expect(select).toHaveValue('agent-budgets');
    await expect(page.getByLabel('What needs attention?')).toHaveValue(draft);
    await select.focus();
    await page.keyboard.press('ArrowDown');
    await expect(select).toHaveValue('computer-use-agents');
    await page.getByRole('button', { name: 'Send local suggestion' }).click();
    await expect(page.locator('#receipt')).toContainText('Suggestion saved');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath('published-intake.png'), fullPage: true });
  });
}
