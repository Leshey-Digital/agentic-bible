# Proposed requirements

A local authorized admin can turn a tool-use correction submission into a cited, attributed canonical correction note by a distinct explicit approval action. Disposition alone never publishes. Require same-origin admin session, CSRF, submission revision, complete site/publisher bases and source-tree/baseline hashes. Reject stale or changed retries. D1 approval, submission version and audit commit atomically; pending approvals lock ordinary disposition changes. A missing/forged approval cannot publish.

Retain full original article prose/code, prior notes, source context, opaque contributor reference and local reviewer attribution in canonical/current/history output. Rebuild real Pagefind for twenty entries; history is excluded. A technical/factual/rights guarantee is not implied by approval. Explicit authorized rollback restores baseline as a whole-site operation while retaining history and receipts. Exact replay after rollback must not reactivate the old correction.

Exercise browser submission/review/approval, two admin actions in conflict, reader/anonymous/CSRF/remote denial, no implicit contributor text trust, repeated/lost/interrupted responses and restart. Preserve baseline Markdown, ordinary dist, interactive editorial state and existing budgets/transports.
