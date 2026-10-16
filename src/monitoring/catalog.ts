import { digest } from '../editorial/validation.ts';

export interface CatalogSource { id: string; url: string; title: string; articleIds: string[]; }
export interface SourceCatalog { version: 1; articles: { id: string; title: string }[]; sources: CatalogSource[]; }
const allowedHosts = new Set(['www.anthropic.com', 'arxiv.org', 'platform.claude.com', 'developers.openai.com', 'modelcontextprotocol.io']);
const articleIds = new Set(['ai-agent', 'tool-use', 'model-context-protocol']);
export const sourceId = async (url: string) => 's-' + (await digest(url)).slice(0, 24);
export async function buildCatalog(articles: { id: string; data: { title: string; sources: { title: string; url: string }[] } }[]): Promise<SourceCatalog> {
  const sources = new Map<string, CatalogSource>();
  for (const article of articles) for (const source of article.data.sources) {
    const url = new URL(source.url); url.hash = '';
    const key = url.href;
    const entry = sources.get(key) ?? { id: await sourceId(key), url: key, title: source.title, articleIds: [] };
    entry.articleIds.push(article.id); sources.set(key, entry);
  }
  return validateCatalog({ version: 1, articles: articles.map(article => ({ id: article.id, title: article.data.title })), sources: [...sources.values()].map(source => ({ ...source, articleIds: [...new Set(source.articleIds)].sort() })).sort((a,b) => a.id.localeCompare(b.id)) });
}
export async function validateCatalog(value: unknown): Promise<SourceCatalog> {
  const catalog = value as SourceCatalog;
  if (!catalog || catalog.version !== 1 || !Array.isArray(catalog.articles) || catalog.articles.length !== 3 || !Array.isArray(catalog.sources) || catalog.sources.length < 1 || catalog.sources.length > 12) throw new Error('invalid_catalog');
  if (new Set(catalog.articles.map(article => article.id)).size !== 3) throw new Error('invalid_catalog');
  for (const article of catalog.articles) if (!articleIds.has(article.id) || typeof article.title !== 'string' || article.title.length > 100) throw new Error('invalid_catalog');
  const urls = new Set<string>(); const ids = new Set<string>();
  for (const source of catalog.sources) {
    const url = new URL(source.url);
    if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname) || url.port || url.username || url.password || url.search || url.hash || url.href !== source.url || source.id !== await sourceId(source.url) || urls.has(source.url) || ids.has(source.id)) throw new Error('source_not_allowlisted');
    if (typeof source.title !== 'string' || source.title.length < 1 || source.title.length > 200 || !Array.isArray(source.articleIds) || source.articleIds.length < 1 || source.articleIds.length > 3 || source.articleIds.some(id => !articleIds.has(id))) throw new Error('invalid_catalog');
    urls.add(source.url); ids.add(source.id);
  }
  return catalog;
}
