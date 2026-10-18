# Proposed delta

- Explicit signed-admin restoration approval is separate from the existing revert request and binds exact owner/request fingerprint, current receipt/catalog/source head and earlier retained target.
- Approval is immutable and bounded; revocation and newer review decisions invalidate new dispatch. Reconciliation of an already dispatched operation preserves actual historical outcomes without redispatch.
- A controlled local coordinator uses fixed repository/ref and default-disabled fixture transport. A real Git object store supplies pinned source/history, with all lazy fetching/transports disabled.
- Restore target body/source metadata through a new revision ID, immutable restoration record and current review pointer in one expected-head compare-and-swap commit. Preserve every prior record and unrelated path.
- Restoration lineage identifies the immediate previous revision and restored-from revision/commit, plus opaque approval references. It creates no synthetic model charge or factual approval claim.
- The shared outbox caps rows, request/response sizes, invocations and lifetime requests; one dispatched mutation may only be reconciled after ambiguous outcomes.
- Read-side verification reconstructs both record profiles, verifies original creation/parent/message/atomic file set, strict target lineage, restored Markdown and current pointer. Existing automatic record compatibility remains strict.
- No live provider, credential, remote mutation, deployment, indexing or license selection is enabled. Publication policy remains automatic for valid aligned candidates; technical producer-base reconciliation after restore remains explicit.
