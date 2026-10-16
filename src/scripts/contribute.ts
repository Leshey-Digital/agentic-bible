export {};
const form = document.querySelector<HTMLFormElement>('#contribution-form')!;
const fields = document.querySelector<HTMLFieldSetElement>('#contribution-fields')!;
const message = document.querySelector<HTMLElement>('#intake-status')!;
const error = document.querySelector<HTMLElement>('#form-error')!;
const receipt = document.querySelector<HTMLElement>('#receipt')!;
const send = document.querySelector<HTMLButtonElement>('#send-suggestion')!;
const requestKey = document.querySelector<HTMLInputElement>('#request-key')!;
const draftKey = 'agentic-bible:synthetic-suggestion:v1';
const names = ['articleId', 'kind', 'message', 'sourceUrl', 'requestKey'] as const;
const control = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
requestKey.value = crypto.randomUUID();
try {
  const saved = JSON.parse(sessionStorage.getItem(draftKey) ?? 'null');
  if (saved && typeof saved === 'object') for (const name of names) if (typeof saved[name] === 'string') control(name).value = saved[name];
} catch { /* A blocked or malformed local draft must not break the form. */ }
const article = new URLSearchParams(location.search).get('article');
if (article && [...control('articleId').querySelectorAll('option')].some(option => (option as HTMLOptionElement).value === article)) control('articleId').value = article;
function persist() {
  try { sessionStorage.setItem(draftKey, JSON.stringify(Object.fromEntries(names.map(name => [name, control(name).value])))); } catch { /* Browser storage can be unavailable; in-memory form remains usable. */ }
}
form.addEventListener('input', persist);
document.querySelector('#clear-draft')!.addEventListener('click', () => {
  form.reset(); requestKey.value = crypto.randomUUID(); error.textContent = ''; receipt.hidden = true;
  try { sessionStorage.removeItem(draftKey); } catch { /* No stored draft to remove. */ }
  control('message').focus();
});
async function init() {
  try {
    const response = await fetch('/api/editorial/status', { credentials: 'same-origin' });
    const state = await response.json();
    if (!response.ok || !state.enabled || state.mode !== 'local-synthetic-only') return;
    fields.disabled = false;
    document.querySelector<HTMLElement>('#editorial-inbox-link')!.hidden = false;
    message.textContent = 'Local synthetic preview only. Saved suggestions go to the local editorial inbox. No email is sent.';
  } catch { /* Public static deployments intentionally have no intake API. */ }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (fields.disabled) return;
  error.textContent = ''; receipt.hidden = true;
  for (const el of form.querySelectorAll<HTMLElement>('.field-error')) el.textContent = '';
  for (const name of names) control(name).removeAttribute('aria-invalid');
  persist(); send.disabled = true; send.textContent = 'Saving suggestion…';
  try {
    const response = await fetch('/api/submissions', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    const result = await response.json();
    if (!response.ok) {
      for (const [name, text] of Object.entries(result.fields ?? {})) {
        const target = document.getElementById(`${name}-error`);
        if (target) { target.textContent = String(text); control(name).setAttribute('aria-invalid', 'true'); }
      }
      error.textContent = `${result.error ?? 'Could not save this suggestion.'} Your draft has been kept.`;
      form.querySelector<HTMLElement>('[aria-invalid=true]')?.focus();
      return;
    }
    receipt.hidden = false;
    receipt.textContent = result.reference ? `Suggestion saved. Reference ${result.reference}. ${result.duplicate ? 'This matches a previously saved suggestion.' : 'It is available in the local editorial inbox.'}` : 'Suggestion received.';
    form.reset(); requestKey.value = crypto.randomUUID();
    try { sessionStorage.removeItem(draftKey); } catch { /* Saved successfully even if browser storage is blocked. */ }
    receipt.focus();
  } catch { error.textContent = 'Could not confirm the save. Your draft and request reference are kept. Retry safely when the connection returns.'; }
  finally { send.disabled = false; send.textContent = 'Send local suggestion'; }
});
void init();
