# Continue an inspected revision into the existing GitHub draft workflow

The saved-review preview currently ends with a link to another administration page. The module composition also omits immutable preview source when GitHub transport is configured, so the two independently implemented capabilities cannot work together in that runtime.

Retain immutable preview source alongside the configured restricted transport. Add an explicit Request GitHub draft button to the inspected revision, using only the existing approval-ID POST action. Compare its receipt against the captured preview's article/path/base/hash and exact repository URL. Preserve uncertain state by approval across history reloads; reconciliation is explicit and reuses the same ID. Current review/source authority is still enforced by the existing server transport. A changed canonical base requires fresh review, never a silent rebase.

No new pipeline, storage, schema, provider route, credential, policy, automatic retry, merge or publication authority. Unconfigured workspaces keep preview but omit the action. A recorded draft is not publication; revocation does not delete remote work or revert an article. Existing publication/restoration controls remain separate.

Costs and live resources are unchanged. Controlled tests use disposable D1, synthetic identities and an in-memory provider, not real GitHub authority or inference. Rollback reverts application code only. Existing published resources and receipts remain intact.
