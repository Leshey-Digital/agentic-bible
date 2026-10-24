import {policyPath} from '../hosted/policy.ts';
const form = document.querySelector<HTMLFormElement>('#contribution-form')!;
const fields = document.querySelector<HTMLFieldSetElement>('#contribution-fields')!;
const message = document.querySelector<HTMLElement>('#intake-status')!;
const error = document.querySelector<HTMLElement>('#form-error')!;
const receipt = document.querySelector<HTMLElement>('#receipt')!;
const send = document.querySelector<HTMLButtonElement>('#send-suggestion')!;
const requestKey = document.querySelector<HTMLInputElement>('#request-key')!;
const renew = document.querySelector<HTMLButtonElement>('#renew-reference')!;
const recoveryHelp = document.querySelector<HTMLElement>('#draft-recovery')!;
const articleContext = document.querySelector<HTMLElement>('#article-context')!;
const contextTitle = document.querySelector<HTMLElement>('#context-title')!;
const contextSources = document.querySelector<HTMLAnchorElement>('#context-sources')!;
const contextRevision = document.querySelector<HTMLAnchorElement>('#context-revision')!;
const draftKey = 'agentic-bible:synthetic-suggestion:v1';
const names = ['articleId', 'kind', 'message', 'sourceUrl', 'requestKey'] as const;
const control = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
function showArticleContext(id: string) {
  const option = [...control('articleId').querySelectorAll<HTMLOptionElement>('option')].find(item => item.value === id);
  if (!option || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) { articleContext.hidden = true; return; }
  contextTitle.textContent = option.textContent ?? id;
  contextSources.href = `/articles/${id}/#sources`;
  contextRevision.href = `/articles/${id}/#revision`;
  articleContext.hidden = false;
}
let sendLabel = 'Send suggestion';
let inboxDescription = 'It is available in the local editorial inbox.';
let recoveryNeeded = false;
let saving = false;
let restoredArticle = false;
function showRecovery(needed: boolean) {
  recoveryNeeded = needed; renew.hidden = !needed; recoveryHelp.hidden = !needed;
}
requestKey.value = crypto.randomUUID();
try {
  const saved = JSON.parse(sessionStorage.getItem(draftKey) ?? 'null');
  if (saved && typeof saved === 'object') {
    for (const name of names) if (typeof saved[name] === 'string') control(name).value = saved[name];
    restoredArticle = typeof saved.articleId === 'string';
    showRecovery(saved.recoveryNeeded === true);
  }
} catch { /* A blocked or malformed local draft must not break the form. */ }
const article = new URLSearchParams(location.search).get('article');
const articleIsKnown = !!article && [...control('articleId').querySelectorAll('option')].some(option => (option as HTMLOptionElement).value === article);
if (!restoredArticle && articleIsKnown) control('articleId').value = article!;
if (restoredArticle || articleIsKnown) showArticleContext(control('articleId').value);
control('articleId').addEventListener('change', () => showArticleContext(control('articleId').value));
function persist() {
  try { sessionStorage.setItem(draftKey, JSON.stringify({ ...Object.fromEntries(names.map(name => [name, control(name).value])), recoveryNeeded })); } catch { /* Browser storage can be unavailable; in-memory form remains usable. */ }
}
form.addEventListener('input', persist);
renew.addEventListener('click', () => {
  if (saving) return;
  requestKey.value = crypto.randomUUID(); showRecovery(false); persist();
  error.textContent = ''; receipt.hidden = false;
  receipt.textContent = 'Your draft is kept with a new request reference. Review it, then send when ready. An earlier version may already be saved.';
  receipt.focus();
});
document.querySelector('#clear-draft')!.addEventListener('click', () => {
  form.reset(); requestKey.value = crypto.randomUUID(); showRecovery(false); error.textContent = ''; receipt.hidden = true;
  try { sessionStorage.removeItem(draftKey); } catch { /* No stored draft to remove. */ }
  control('message').focus();
});
async function init() {
  try {
    const response = await fetch('/api/editorial/status', { credentials: 'same-origin' });
    const state = await response.json();
    if (!response.ok) return;
    if (state.mode === 'hosted-contributions' && state.publicIntake === true && state.policy && policyPath(state.policy.termsPath) && policyPath(state.policy.privacyPath)) {
      form.hidden = false; fields.disabled = false; sendLabel = 'Send suggestion'; send.textContent = sendLabel; inboxDescription = 'It is available for editorial review.';
      message.textContent = 'Suggestions enter editorial review and do not directly change an article. No email delivery is configured.';
      for (const item of document.querySelectorAll<HTMLElement>('[data-local-intake]')) item.hidden = true;
      const policy = document.querySelector<HTMLElement>('#hosted-intake-policy')!; policy.hidden = false;
      const terms = document.querySelector<HTMLAnchorElement>('#contribution-terms')!; terms.href = state.policy.termsPath;
      const privacy = document.querySelector<HTMLAnchorElement>('#contribution-privacy')!; privacy.href = state.policy.privacyPath;
      return;
    }
    if (!state.enabled || state.mode !== 'local-synthetic-only') return;
    form.hidden = false; fields.disabled = false; sendLabel = 'Send local suggestion'; send.textContent = sendLabel;
    for (const item of document.querySelectorAll<HTMLElement>('[data-local-intake]')) item.hidden = false;
    document.querySelector<HTMLElement>('#editorial-inbox-link')!.hidden = false;
    message.textContent = 'Local synthetic preview only. Saved suggestions go to the local editorial inbox. No email is sent.';
  } catch { /* Public static deployments intentionally have no intake API. */ }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (fields.disabled || saving) return;
  error.textContent = ''; receipt.hidden = true;
  for (const el of form.querySelectorAll<HTMLElement>('.field-error')) el.textContent = '';
  for (const name of names) control(name).removeAttribute('aria-invalid');
  const submitted = Object.fromEntries(new FormData(form));
  persist(); saving = true; send.disabled = true; renew.disabled = true; send.textContent = 'Saving suggestion…';
  try {
    const response = await fetch('/api/submissions', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submitted),
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 409 && requestKey.value === submitted.requestKey) { showRecovery(true); persist(); }
      for (const [name, text] of Object.entries(result.fields ?? {})) {
        const target = document.getElementById(`${name}-error`);
        if (target) { target.textContent = String(text); control(name).setAttribute('aria-invalid', 'true'); }
      }
      error.textContent = `${result.error ?? 'Could not save this suggestion.'} Your draft has been kept.`;
      form.querySelector<HTMLElement>('[aria-invalid=true]')?.focus();
      return;
    }
    receipt.hidden = false;
    receipt.textContent = result.reference ? `Suggestion saved. Reference ${result.reference}. ${result.duplicate ? 'This matches a previously saved suggestion.' : inboxDescription}` : 'Suggestion received.';
    if (names.every(name => control(name).value === submitted[name])) {
      form.reset(); requestKey.value = crypto.randomUUID(); showRecovery(false);
      try { sessionStorage.removeItem(draftKey); } catch { /* Saved successfully even if browser storage is blocked. */ }
    } else {
      // A completed request owns only its snapshot, never edits or a cleared/new draft made while it was pending.
      showRecovery(false);
      if (requestKey.value === submitted.requestKey) {
        requestKey.value = crypto.randomUUID(); persist();
      }
      // A cleared/new draft owns its storage already; an older response must not recreate a cleared draft.
      receipt.textContent += ' Your newer draft is kept with its own request reference.';
    }
    receipt.focus();
  } catch {
    if (requestKey.value === submitted.requestKey) { showRecovery(true); persist(); }
    error.textContent = 'Could not confirm the save. Your draft and request reference are kept. Retry unchanged to confirm it, or keep your draft with a new reference.';
  }
  finally { saving = false; send.disabled = false; renew.disabled = false; send.textContent = sendLabel; }
});
void init();
