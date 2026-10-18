export {};
interface SearchResult { url: string; meta: { title?: string; description?: string }; plain_excerpt?: string; }
interface Pagefind { options?: (config:{baseUrl?:string;noWorker:boolean})=>Promise<void>; search: (query: string) => Promise<{ results: { data: () => Promise<SearchResult> }[] }>; }
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

// Expand only two well-supported question patterns whose answer terms differ
// from the reader's wording. Everything else remains ordinary Pagefind search.
function relatedKeywordQuery(query: string): string | undefined {
  const words = query.toLowerCase();
  const protectiveIntent = /\b(protect|defend|prevent|avoid|safeguard|secure)\w*\b/.test(words);
  const agentContext = /\b(agent|agents|ai|model|assistant)\b/.test(words);
  const injectionContext = /\b(prompt injection|injection|malicious instruction|untrusted content|retrieved content|retrieved document)\b/.test(words);
  if (protectiveIntent && agentContext && injectionContext) return 'prompt injection';

  const repeatIntent = /\b(duplicate|repeat|again|twice|replay|retry|retries)\w*\b/.test(words);
  const interruption = /\b(crash|failure|failed|interruption|restart|recovery|after)\w*\b/.test(words);
  const actionContext = /\b(action|actions|effect|effects|operation|operations|request|requests|run|workflow)\w*\b/.test(words);
  if (repeatIntent && interruption && actionContext) return 'durable agent execution';
  return undefined;
}

async function search() {
  const request = ++sequence;
  const query = input.value.trim();
  results.replaceChildren();
  results.setAttribute('aria-busy', query ? 'true' : 'false');
  error.hidden = true;
  empty.hidden = true;
  history.replaceState(null, '', query ? `#q=${encodeURIComponent(query)}` : location.pathname);
  if (!query) { searchStatus.textContent = 'Enter a word or phrase to search the collection.'; return; }
  searchStatus.textContent = 'Searching the collection…';
  try {
    const moduleUrl = snapshotBase+'pagefind/pagefind.js';
    // The MVP index is bounded to twenty entries. Avoid Pagefind's five-second
    // worker-bootstrap fallback before a cold query can use the same local engine.
    engine ??= (import(/* @vite-ignore */ moduleUrl) as Promise<Pagefind>).then(async module=>{await module.options?.({noWorker:true,...(snapshotBase!=='/'?{baseUrl:'/'}:{})});return module;});
    const pagefind = await engine;
    if (request !== sequence) return;
    let found = await pagefind.search(query);
    let expandedTo: string | undefined;
    if (!found.results.length) {
      expandedTo = relatedKeywordQuery(query);
      if (expandedTo) found = await pagefind.search(expandedTo);
    }
    const entries = await Promise.all(found.results.slice(0, 20).map(result => result.data()));
    if (request !== sequence) return;
    searchStatus.textContent = expandedTo && entries.length
      ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} found using the related keyword “${expandedTo}” for “${query}”.`
      : `${found.results.length} ${found.results.length === 1 ? 'entry' : 'entries'} found for “${query}”.`;
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
  } finally {
    if (request === sequence) results.setAttribute('aria-busy', 'false');
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
function restore() {
  if (location.hash === '#focus') {
    history.replaceState(null, '', location.pathname);
    input.focus();
  }
  input.value = new URLSearchParams(location.hash.slice(1)).get('q')?.slice(0, 180) ?? '';
  void search();
}
window.addEventListener('hashchange', restore);
restore();
