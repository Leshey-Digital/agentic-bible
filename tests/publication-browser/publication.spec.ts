import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readFileSync} from 'node:fs';
import {close as closePagefind} from 'pagefind';
import {PublicationStore} from '../../src/publishing/store.ts';
import type {Publish} from '../../src/publishing/contracts.ts';

async function search(page:Page,base:string,query:string,count:number){
  // Quoted terms verify exact replacement, independent of Pagefind's partial-word matching.
  await page.goto(base+'search/');await page.getByLabel('Search published local revisions',{exact:true}).fill(`"${query}"`);await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.getByRole('status')).toHaveText(`${count} ${count===1?'entry':'entries'} found in this snapshot.`);await expect(page.locator('#search-results>li')).toHaveCount(count);
}
test.afterAll(async()=>{await closePagefind();});

test('real rendered HTML, pinned Pagefind, readable history, post-publication flags and rollback stay coherent',async({page})=>{
  const store=new PublicationStore('article-publication-browser');const fixture=JSON.parse(readFileSync('fixtures/local-publication/article-v1.json','utf8')) as Publish;
  const first=store.current()!;const firstBase=`/local-publications/releases/${first.reference.id}/`;const original=await store.execute(fixture);
  const outside:string[]=[];const errors:string[]=[];page.on('request',request=>{if(!request.url().startsWith('http://127.0.0.1:8790'))outside.push(request.url());});page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/local-publications/');await page.getByRole('link',{name:'Agent loop & tools',exact:true}).click();
  await expect(page.getByRole('heading',{level:1})).toHaveText('Agent loop & tools');await expect(page.locator('.article-status')).toContainText('Published locally');await expect(page.locator('.prose')).toContainText('5 < 7');await expect(page.locator('script')).toHaveCount(0);
  await page.getByRole('link',{name:'Source 1',exact:true}).click();expect(new URL(page.url()).hash).toBe('#source-guide');await expect(page.locator('#source-guide')).toBeVisible();
  await page.getByRole('link',{name:'Read the existing tool-use draft'}).click();await expect(page.getByRole('heading',{level:1})).toHaveText('Tool use');
  await search(page,firstBase,'amberorchard',1);await page.locator('#search-results a').click();await expect(page.locator('.prose')).toContainText('Amberorchard');
  const revised=structuredClone(fixture);revised.eventId='browser-revised-event';revised.baseRevision=original.revisionId;revised.article.title='A revised local agent loop';(revised.article.blocks[1] as any).content[0].text='Cedarharbor is the distinctive token for the replacement fixture. Its supplied sourced text publishes automatically, while an editorial concern remains visible after publication.';
  await store.execute(revised);const second=store.current()!;const secondBase=`/local-publications/releases/${second.reference.id}/`;
  // An already-open snapshot keeps its own immutable index and article links after a newer activation.
  await search(page,firstBase,'amberorchard',1);await search(page,firstBase,'cedarharbor',0);
  await search(page,secondBase,'amberorchard',0);await search(page,secondBase,'cedarharbor',1);await page.locator('#search-results a').click();await expect(page.getByRole('heading',{level:1})).toHaveText('A revised local agent loop');
  await page.goto(secondBase+'review/');await expect(page.getByRole('link',{name:'A revised local agent loop',exact:true})).toBeVisible();await expect(page.getByRole('heading',{level:1})).toHaveText('Review after publication.');
  await page.goto(secondBase+'history/');await page.locator(`a[href$="/${original.revisionId}.html"]`).click();await expect(page.locator('.prose')).toContainText('Amberorchard');await expect(page.locator('.article-status')).toContainText('Retained revision');
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);await page.screenshot({path:test.info().outputPath(`published-revision-${width}.png`),fullPage:true});}
  await page.screenshot({path:test.info().outputPath('published-revision-mobile.png'),fullPage:true});
  const rollback={schemaVersion:1,kind:'rollback',eventId:'browser-rollback-event',expectedRelease:second.reference.id,targetRelease:first.reference.id};await store.execute(rollback);
  const restored=store.current()!;const restoredBase=`/local-publications/releases/${restored.reference.id}/`;await page.goto('/local-publications/');expect(page.url()).toContain(restored.reference.id);
  await search(page,restoredBase,'amberorchard',1);await search(page,restoredBase,'cedarharbor',0);await page.goto(restoredBase+'history/');await expect(page.locator('#article-fixture-agent-loop li')).toHaveCount(2);
  expect(await store.execute(revised)).toEqual(second.manifest.state.receipts[1]);expect(store.current()!.reference.id).toBe(restored.reference.id);
  await store.execute({schemaVersion:1,kind:'rollback',eventId:'browser-rollback-empty',expectedRelease:restored.reference.id,targetRelease:null});const empty=store.current()!;await search(page,`/local-publications/releases/${empty.reference.id}/`,'amberorchard',0);
  expect(outside).toEqual([]);expect(errors).toEqual([]);
});
