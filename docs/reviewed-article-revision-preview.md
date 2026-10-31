# Saved review to proposed article revision

The existing path already supports recovered draft → private inbox → follow-up → explicit saved review, and the existing GitHub adapter already appends that review as a cited correction to the pinned article. This successor fills the missing step between saved review and an inspectable article revision while GitHub authority is unavailable.

In the inbox's **Review and draft history**, a current saved review offers **Preview article revision**. It prepares the complete proposed Markdown and an exact append diff, with the article, submission revision, approval, base commit and resulting Markdown SHA256. The existing article and source declarations are preserved. The preview uses the identical `projectNote` function used by GitHub proposals; it does not create an alternative writer.

POST `/api/admin/submissions/<id>/revision-preview` accepts only the saved approval ID. It requires signed same-origin administration and an owned current submission-bound review, then validates trusted immutable build source against that review's base/article/citation pins. A final lookup rejects intervening revocation or submission edits. Expiry and cancellation remain guarded after asynchronous work. A newer editor draft is preserved; delayed responses cannot repaint a superseded selection/review.

No source fetch, model call, token, policy renewal, migration or new storage is needed. Preview/replay does not mutate D1, charge money, create a GitHub proposal or approve publication. Remote main is explicitly unverified; a later proposal still performs its existing remote/base/authority checks. The original sixteen-row AI outbox bound and all failed/uncertain holds are unchanged. Existing automatic publication policy is unaffected.

This bounded transition projects a reviewed correction note into a complete article. It does not rewrite arbitrary article paragraphs or generate a new encyclopedia entry. Saved reviews whose base no longer matches this build must be reviewed against an appropriate current source; the preview never silently rebases them.

## Focused verification

```
node --test --test-concurrency=1 tests/production-hosted/revision-preview.test.mjs
node --test --test-concurrency=1 tests/production-hosted/revision-preview-browser.test.mjs tests/production-hosted/review-history-browser.test.mjs
npm run check
npm run test:docs
```

Native checks use actual disposable workerd/D1, original deterministic suggestion/review fixtures, pinned repository article bytes and controlled GitHub transport. They verify restart/replay, zero preview transport calls/writes, exact later proposal byte parity, ownership/stale/source/revocation/expiry/cancellation guards, caller-payload rejection and actual `git apply` of diffs with and without a final newline. Desktop/mobile checks use the real native backend through a loopback bridge and hold only a completed preview response while the actual submission advances.

[Actual focused outcomes and remaining qualification limits](review/reviewed-article-revision-preview.md).

No live setup, production identity, source/provider call, article mutation, merge, push, upload or deployment is performed. Full qualification and independent review remain separate. Rollback reverts the application change; there is no migration or data rollback.
