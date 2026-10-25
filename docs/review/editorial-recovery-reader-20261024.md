# Editorial recovery and reader correction integration — 2026-10-24

## Delivered behavior

A validated generated draft can be recovered after an inbox save fails, using its retained owner/selection/source/article/prompt/generation pins and settled paid ledger result. The authenticated recovery action accepts only the existing request ID; it cannot fetch a source, call a model, release an uncertain reservation, approve or publish. The browser retains the ID across reload. Missing schema fails before source/model dispatch. Uncertain, foreign-owner or malformed checkpoints stay closed.

Reader correction options now expose article-specific source/revision links and keep the form hidden until the existing local or hosted status explicitly enables it. Article copy refers to current availability instead of promising an unavailable submission channel. Public forms remain noindex and excluded from discovery; all twenty article Markdown files are unchanged. No license, terms, privacy, moderation or public-intake decision is implied.

## Source and review

Base3cd219dad64eb773cfed6ef47bc7398f5d68b2f1 is the saved deployed receipt-inspection branch. Reader source2f483316a3351f99f9a1a6aefd2772fc8bdb6851 integrated asefd145370d9962c239585ca3afe41e2662d80d0a. Engine source653ea13edf48f30300885a874fbe9e1f98db5059 integrated asd6c0c16b7afe6f4eb45bf98f086271b096bc3641. Combined tested application/test head0ceda472d3bf25739a4b22180be4250f3ab7e01a; this evidence-only addition changes no runtime files.

Implementation used requested Sol6.1High(engine) and Luna6High(reader). Independent LunaHigh review checked reader gating, compiled article context, noindex and accessibility, with its stale-closure-copy finding corrected. Independent Sol6.1High security review accepted exact engine653ea13 after inspecting auth freshness, owner/selection/prompt/output integrity, historical currency checks, races, uncertainty, migration and negative tests. These are source reviews, not posted GitHub approvals.

## Passed and retained failures

- Engine sequential focused suite30/30; typecheck205files zero errors/warnings/hints; docs/diff checks passed. Native disposable D1 tests cover inbox fault/restart/concurrent recovery, lost committed response, foreign/unsigned/cross-origin/GET/fabricated input, missing migration/checkpoint fault, unknown usage, pin/paid/history tamper, sixteen-row capacity and late auth expiry.
- Reader build31pages/Pagefind20articles, static11/11, typecheck204files zero diagnostics; three focused browser cases each on desktop and mobile for closed intake, source/revision context and explicit local-mode form reveal. All article Markdown bytes preserved.
- Combined application head0ceda47: typecheck205files zero diagnostics, static build/Pagefind20articles, static11/11, documentation488files/413relative links, diffcheck passed. Real Chromium under CSP verified request-ID persistence across reload and explicit recovery with exactly one mocked generation call and one recovery call, no source fetch, safe rendering, no page errors and mobile overflow check.
- Earlier engine default-concurrency run29/30 failed an inherited post-dispatch case before the expected AI call. The unchanged isolated case passed, followed by the final serial30/30 pass. Root cause is not established; retain the failure instead of rewriting it as success. Original timeout/assertions remain intact. See engine review/private-draft-recovery.md.
- Reader setup errors were dependency/harness startup failures (no browser assertion ran); exact installed dependencies were reused after lockfile comparison and the corrected focused checks passed. No production acceptance is inferred.

## Runtime boundary and next execution

This is a source-only integration; no deployment or remote migration occurred. Existing staging remains version1f682ebd-d661-4ab6-9af3-321e2957b121 and production7eccb256-0659-43c4-b2e6-5f54ac652824 at the dated initial provider read. Migration0027 is required before enabling new generation/recovery code. It adds a bounded immutable outbox, sixteen lifetime claims including failures; no cleanup/refund/reset is included. Prior attempts without a checkpoint cannot be reconstructed. Qualified deployment must preserve existing D1/secrets/Access/noindex/rollback and the expired AI policy; this report is not release qualification or live browser acceptance.

The local OpenAI403 remains unresolved and was not retried or bypassed. No real inference occurred. The previous single-call policy expired2026-10-23 and was not renewed. Smallest future paid operation: after supported source access is resolved and source-only qualification succeeds, explicitly approve a new one-hour, one-call native model policy with a one-cent allocation,8192/2048token bounds, no retries/fallback/publication, fresh account/application usage baseline and the unchanged $20additionalmonthly AI ceiling. The existing execution-plan.md contains the bounded proposal; no new subscription or credential is needed for the existing binding.

PR58 governance retains its no-merge/no-deployment restriction; accepted guidance is not falsely represented as default-branch adoption. Search Console ownership/TXT, property creation and indexing submission remain unverified. Fresh article publication or runtime GitHub authority is not enabled by this change.
