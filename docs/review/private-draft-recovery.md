# Private draft recovery local evidence

Base: `3cd219dad64eb773cfed6ef47bc7398f5d68b2f1`. Isolated branch: `feat/durable-cloudflare-draft-recovery`. This evidence covers the bounded private inbox recovery implementation, pending independent exact-head review and combined qualification.

Passed:

- `npm run check`: 205 files; zero errors, warnings or hints after runtime, UI and test changes.
- `npm run test:docs`: 484 Markdown files / 412 relative links before this evidence file; no broken targets or conflict markers. Rechecked when committing.
- `git diff --check`: clean.
- `node --test --test-concurrency=1 tests/hosted/cloudflare-drafts.test.mjs tests/hosted/cloudflare-draft-inbox.test.mjs tests/hosted/cloudflare-draft-errors.test.mjs tests/maintenance-adapters/sourced-draft.test.mjs`: 30/30 passed, 46.94 seconds. Uses real disposable workerd/D1, synthetic signed identity, controlled original HTML and deterministic fake AI outputs. This includes all nine new native recovery/capacity/ownership/auth/concurrency/fault tests, request-ID reload UI coverage and retained-prompt parser cases.
- Earlier single-file native run passed 15/15 before the last capacity/concurrency/expiry and UI/parser cases were added.

Failed and investigated:

- The four-file default-concurrency focused run passed 29/30. Existing test `a source-shaped error after AI dispatch remains uncertain and retains its monetary hold` observed zero AI calls where one was expected, after 11.32 seconds. Its expected outer error still matched; no post-dispatch assertion was relaxed. The cause is not established.
- That exact test then passed alone (1/1, 2.14-second case time), and the complete final focused sequential run passed 30/30 without changing its deadlines, assertions or source/model limits. These later results do not prove the earlier failure's cause.

Not run here:

- Full retained qualification, broad hosted/maintenance suites, build/static/browser/screenshots or release dry runs. The parent is coordinating combined-head qualification and independent review; these focused results do not claim full product or deployment readiness.
- Live source/provider calls, live D1 migration, expired-policy renewal, credentials, uploads, deployment, remote article writes, GitHub push or merge. None were attempted.

Resource change: additive migration 0027 creates at most sixteen retained immutable prompt checkpoints (8192 bytes maximum each, plus bounded metadata), matching the current sixteen-row paid ledger. Paid outputs remain in the existing ledger. Pre-AI failures retain their claims; no cleanup/archive/refund authority is added. Missing migration fails before source calls. Existing source and article bytes, old synthetic records and all uncertainty holds remain unchanged.

Rollback: revert application code, retain all new checkpoints and existing accounting/inbox evidence. Older code cannot recover unsaved new checkpoints; never silently regenerate them or drop the table to reset capacity. Live migration/promotion and independent acceptance remain separate prerequisites.
