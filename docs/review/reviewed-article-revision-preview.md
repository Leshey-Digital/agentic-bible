# Saved-review article revision preview evidence

Base: `2b3c644c12048a64e9814a2ad78d7b5536924b2b` (PR59 head). Isolated branch/worktree: `feat/pinned-draft-revision-preview`, `/workspace/agentic-bible-revision-preview`. The release checkout was not edited.

Already built: source-grounded draft recovery, private inbox, explicit owner/current-submission-bound saved review, and a GitHub transport that projects a cited correction into a complete article. The demonstrated missing transition was inspecting that exact article revision without GitHub authority. This candidate exposes the same projection through a bounded explicit preview action and the current inbox review history.

Passed:

- `node --test --test-concurrency=1 tests/production-hosted/revision-preview.test.mjs`: 4/4, 10.15 seconds. Actual disposable workerd/D1 verifies review → full article/diff → restart/replay; zero preview mutations/transport; exact Markdown/hash parity with the existing later controlled GitHub proposal; owner/CSRF/method/payload/submission/source/stale/revocation/expiry/cancellation guards. Real `git apply` verifies exact diffs with/without a final base newline.
- `node --test --test-concurrency=1 tests/production-hosted/revision-preview-browser.test.mjs tests/production-hosted/review-history-browser.test.mjs`: 4/4, 17.28 seconds. Both 1440px and 390px exercise keyboard activation, actual native-backend preview, complete article/diff/provenance readback, preserved newer editor text, zero GitHub proposals, no overflow, and delayed completed-response rejection after the actual D1 submission advances. The two existing history/link regressions also pass.
- `npm run check`: final 206 files, zero errors, warnings or hints.
- `npm run test:docs`: 493 Markdown files / 413 relative links before this record; rechecked for the commit.
- `git diff --check`: clean before the final documentation update; rechecked for the commit.
- Actual desktop/mobile component screenshots inspected at `/tmp/agentic-revision-preview-1440.png` and `/tmp/agentic-revision-preview-390.png`. Existing cream/green serif design, inert text rendering, keyboard-focusable scroll regions and mobile wrapping are retained. Screenshots are local test evidence, not live screenshots.

An initial native assertion expected the raw reviewed note to appear literally in Markdown. The shared projector correctly escapes Markdown punctuation. The assertion was corrected to retain exact projector-byte equality and verify the note's text before its escaped final punctuation; the final focused run passes. No runtime assertion, source/model limit or timeout was relaxed.

Not run: full/broad qualification, production/staging build, release dry runs or live acceptance. The parent requested focused checks on this successor while coordinating PR59 separately. Independent exact-head review and combined qualification remain pending.

No schema, dependency, source article, paid accounting, policy, sixteen-row draft-outbox limit, release artifact or live resource changes. Preview is read-only; it never fetches a source, invokes a model, creates a GitHub proposal, grants publication approval or rebases an old review. Controlled proposal calls in the parity test are an in-memory transport only. No live provider/network call, credential, upload, remote mutation, merge, push or deployment was attempted.

Limit: this projects the existing reviewed correction-note format into a complete article. Arbitrary paragraph editing/new article generation is not added. A saved review must match immutable source in the current build. A preview does not establish remote main, factual completeness, source authenticity, licensing or release readiness. Rollback is an application revert with no data migration.
