# Trace a contribution through review and draft proposal

The existing workflow admits suggestions, records signed-owner reviewed notes and creates explicit GitHub draft proposals. Editors returning to the originating inbox item cannot see which of their reviews resulted in a draft, became stale/revoked, or have an uncertain outcome. Add an owner-scoped history read and inbox rendering from the existing immutable bindings and outbox receipts.

User value: resume editorial work after reload/restart and inspect provenance from suggestion revision through approved source note to a recorded draft. This advances the sourced encyclopedia contribution/review milestone without turning the wiki into a directory or silently publishing content.

Scope: authenticated read-only endpoint and bounded UI; no new database schema, external read, job, credential, paid call, public intake, retention expansion or production change. The recorded draft is historical evidence, not proof of current remote state, merge or publication. Corrupt evidence fails closed. Revoked/stale review history stays visible to its owner without conferring write authority. Only actual bound schema2 reviews are projected; legacy standalone approvals retain their existing separate interface.

Ancestry: feat/contribution-review-history follows PR53 head b9c9d5a and its deployed recovery ancestry. Neither PR is merged. Production and main are unchanged.
