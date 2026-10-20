# Vault-backed GitHub drafts — local source checkpoint

This successor connects the existing encrypted settings vault to the existing restricted GitHub draft adapter. It does not configure a credential or change either deployed Worker. The completed private review trial and its synthetic note remain unchanged; that note expressly forbids draft creation and is not a fixture for this successor.

## Selection and secure setup boundary

- `GITHUB_DRAFT_CREDENTIAL_SOURCE=vault` selects the GitHub value entered by the signed editor through `/admin/integrations/`. The existing D1/vault key/trust bindings are required. `GITHUB_CONTENT_TOKEN` must be absent; even an empty conflicting binding closes drafting.
- `binding`, or an absent selector, uses only the existing `GITHUB_CONTENT_TOKEN` binding for compatibility. No vault fallback occurs in this mode. An invalid/disabled selector closes drafting.
- A stored vault value alone never enables drafting. Explicit vault selection does not prove that a credential exists or has provider permission. Runtime configured status describes the selected adapter, not successful provider authorization.
- No raw secret is exposed by the vault transport. Existing AES-256-GCM storage, owner binding, masked status and secure user entry are reused. Do not provide secrets in chat or repurpose connector access.

Each HTTP request gets a lazy transport. The first explicit source-load/proposal call verifies the signed editor and pins that owner's current vault revision. Every outbound request rechecks ownership/revision under the existing durable vault lock. Approval revocation is rechecked after vault awaits, and expiry/abort are checked immediately before dispatch. Rotation cannot overtake a dispatch; rotation between requests stops the old invocation. A fresh explicit retry selects the new revision and uses the retained proposal reconciliation. Existing durable interrupted-lock behavior remains fail-closed; no automatic lock takeover is added.

History, settings inspection, page rendering and completed proposal replay make no GitHub requests. Explicit source loading remains a bounded remote main/source read. The settings connection-check button retains its separate explicit metadata read; it does not establish write permission.

Provider-side revocation is detectable only when an explicit request is rejected. It does not trigger a background probe or automatic retry. Disabling the selector closes new runtime requests; it cannot undo an already sent request. Lost outcomes retain existing outbox evidence and require explicit reconciliation. Credential rotation does not revoke the old token at GitHub.

## Draft-only effects

The existing orchestrator alone supplies request bodies: pinned source tree/commit, one approved article change, deterministic `content-corrections/<approval UUID>` branch and `draft:true` PR against main in Leshey-Digital/agentic-bible. It never merges, force-updates, deletes, deploys or publishes. Transport endpoint restrictions are not a GitHub token permission boundary; repository Contents write is broader than this application's behavior.

## Qualification and remaining decision

Run `npm run test:vault-github` for disposable real workerd/D1 plus a fake GitHub provider. Tests exercise shipped configuration, ownership, encryption, rotation and locks, disabled/conflicting selection, stale source, approval revocation, rejected credential, lost PR response/restart and completed replay without duplicate drafts. Retained vault tests cover encryption integrity, crash locks and storage faults. No completed private-review browser trial is repeated.

Real setup still needs separately approved repository-only GitHub authority (Contents read/write, Pull requests read/write, metadata read), secure user entry, explicit staging selector change and deployment of qualified source. No new account-level permission or paid service is required by this implementation. Organization token policy remains unverified. Do not enable a legacy secret alongside vault mode.

Current remote main is 8a38252384c6fe6024a75b462ad95294a131100c; the preserved private acceptance note pins b81e2093e80cb8dc31b56fcb14f969dad124bdfa and says not to draft. A later explicitly authorized synthetic draft trial must use a distinct suitable note, revalidated against then-current main. Never silently rebase, rewrite or reuse the acceptance evidence to force success.

Rollback is a source rollback or future selector disable; preserve vault ciphertext, keys, outbox and prior receipts. No schema migration is introduced.
