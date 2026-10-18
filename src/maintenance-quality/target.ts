import {readingArticleIds} from '../lib/article-ids.ts';
// Pure compiled authority, safe to import into Workers. No URL, path or catalog
// supplied by a request can expand the canonical twenty-article inventory.
export function maintenanceTarget(articleId:unknown){
 if(typeof articleId!=='string'||!(readingArticleIds as readonly string[]).includes(articleId))throw Object.assign(new Error('maintenance_article_target'),{code:'maintenance_article_target'});
 return {articleId,articlePath:'src/content/articles/'+articleId+'.md',pointerPath:articleId==='tool-use'?'src/content/maintenance/tool-use.json':'src/content/maintenance/heads/'+articleId+'.json'};
}
