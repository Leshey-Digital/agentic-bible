# Requirements

- `GITHUB_DRAFT_CREDENTIAL_SOURCE=vault` explicitly selects the encrypted GitHub credential; legacy binding must be absent. Invalid/disabled selectors close drafting. Unset/binding selects only legacy binding.
- Mere settings, status, history and page reads perform no GitHub request. Explicit source loading and draft submission may use the signed owner's transport.
- Never return or log vault secrets. Pin owner/revision per invocation; serialize dispatch admission with rotation using existing locks. Check expiry/abort and approval revocation after vault awaits.
- Preserve source pins, deterministic branches, draft-only PRs, bounded requests and uncertain-outcome recovery. No merge, force push, deletion or automatic publication.
- Local disposable credentials and fake provider demonstrate ownership, rotation, disabled/conflicting configuration, replay and lost-response recovery. No live acceptance is claimed.
