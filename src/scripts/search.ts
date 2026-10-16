export {};
interface SearchResult { url: string; meta: { title?: string; description?: string }; plain_excerpt?: string; }
interface Pagefind { options?: (config:{baseUrl:string})=>Promise<void>; search: (query: string) => Promise<{ results: { data: () => Promise<SearchResult> }[] }>; }
const input = document.querySelector<HTMLInputElement>('#search-input')!;
const form = document.querySelector<HTMLFormElement>('#search-form')!;
const searchStatus = document.querySelector<HTMLElement>('#search-status')!;
const results = document.querySelector<HTMLOListElement>('#search-results')!;
const error = document.querySelector<HTMLElement>('#search-error')!;
const empty = document.querySelector<HTMLElement>('#no-results')!;
const snapshotBase=document.body.dataset.wikiSnapshotBase??'/';
input.disabled = false;
form.querySelector<HTMLButtonElement>('button[type=submit]')!.disabled = false;
let sequence = 0;
let timer: ReturnType<typeof setTimeout>;
let engine: Promise<Pagefind> | undefined;

async function search() {
  const request = ++sequence;
  const query = input.value.trim();
  results.replaceChildren();
  error.hidden = true;
  empty.hidden = true;
  history.replaceState(null, '', query ? `#q=${encodeURIComponent(query)}` : location.pathname);
  if (!query) { searchStatus.textContent = 'Enter a word or phrase to search the collection.'; return; }
  searchStatus.textContent = 'Searching the collection…';
  try {
    const moduleUrl = snapshotBase+'pagefind/pagefind.js';
    engine ??= (import(/* @vite-ignore */ moduleUrl) as Promise<Pagefind>).then(async module=>{if(snapshotBase!=='/')await module.options?.({baseUrl:'/'});return module;});
    const pagefind = await engine;
    if (request !== sequence) return;
    const found = await pagefind.search(query);
    const entries = await Promise.all(found.results.slice(0, 20).map(result => result.data()));
    if (request !== sequence) return;
    searchStatus.textContent = `${found.results.length} ${found.results.length === 1 ? 'entry' : 'entries'} found for “${query}”.`;
    empty.hidden = entries.length !== 0;
    for (const entry of entries) {
      const url = new URL(entry.url, location.origin);
      if (url.origin !== location.origin || !url.pathname.startsWith(snapshotBase+'articles/')) continue;
      const li = document.createElement('li');
      const link = document.createElement('a');
      link.href = url.pathname + url.hash;
      link.textContent = entry.meta.title ?? 'Reference entry';
      const p = document.createElement('p');
      p.textContent = entry.plain_excerpt ?? entry.meta.description ?? '';
      li.append(link, p);
      results.append(li);
    }
  } catch {
    if (request !== sequence) return;
    engine = undefined;
    searchStatus.textContent = 'Search could not be completed.';
    error.hidden = false;
  }
}
input.addEventListener('input', () => {
  ++sequence; // Invalidate an older in-flight query immediately, before debouncing.
  clearTimeout(timer);
  timer = setTimeout(search, 180);
});
form.addEventListener('submit', event => { event.preventDefault(); clearTimeout(timer); void search(); });
function clear() { clearTimeout(timer); input.value = ''; void search(); input.focus(); }
input.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); clear(); } });
document.querySelector('#clear-search')!.addEventListener('click', clear);
// Reload clears a browser-cached failed dynamic import; the URL fragment restores the query.
document.querySelector('#search-retry')!.addEventListener('click', () => { location.reload(); });
function restore() { input.value = new URLSearchParams(location.hash.slice(1)).get('q')?.slice(0, 180) ?? ''; void search(); }
window.addEventListener('hashchange', restore);
restore();
