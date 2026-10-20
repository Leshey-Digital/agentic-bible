# Editorial draft navigation checkpoint

Selected milestone: strengthen the already implemented contribution-to-review inbox so editors do not silently lose review work when opening/reloading a suggestion. Existing local and hosted code already supports twenty-article intake, dispositions/tags, audit history, signed-admin source review, immutable reviewed-note approvals and GitHub draft proposals. Production remains the read-only module wiki; no intake or editorial service is enabled by this branch.

Ancestry: branch feat/editorial-draft-navigation descends from recovery commit6390e84dda31f6420954f781d815062ae703b52d, preserving deployed source/artifacts/receipts. Main8a38252384c6fe6024a75b462ad95294a131100c remains unchanged. Recovery files retain historical states and are not release-controller integration.

Changed behavior: explicit native discard confirmation for unsaved disposition/tags/note/confirmation/uncertain review; cancellation keeps the original draft. A failed detail read keeps fields. Edits made during detail loading get a second discard decision. Save/source actions invalidate older detail reads so a pending review cannot be detached from its suggestion. Successfully saved tags normalize whitespace/duplicates for dirty comparison; saved notes alone do not prompt again. No session/local storage is added; closing the tab still loses unsaved drafts.

Validation:
- Real Chromium desktop1440px/mobile390px checks2/2 passed. They exercise cancel/no detail request, accepted discard, failed detail read, in-flight edits, held detail→held review→detail completion, saved-review navigation and saved tag formatting. Controlled responses exercise actual shipped HTML/JS but do not claim new backend/live-provider acceptance.
- Astro/TypeScript check:195files,0errors/0warnings/0hints.
- Markdown validation:422files,393relative links passed before this report; final docs check recorded in handoff.
- Independent bounded review accepted source SHA-256 d3e934cb8480a328176b8ffc6799f610e6eb28ef78e4841e2732e7fe3a24bb52. Reviewer reproduced the tag false positive and detail-read/review-write race, then verified both fixes; actual-JavaScript race probe passed. No remaining blocking findings in that scope.
- Full qualification/build/deployment and broad backend suites were not rerun: this isolated client navigation change is not a release candidate. Historical test failures and production acceptance limits remain preserved on the recovery ancestor.

Push preflight: no tracked GitHub Actions workflows; fresh Cloudflare reads show zero build triggers on both Agentic Bible Workers. Earlier account Pages inventory is empty. GitHub hook API remains unavailable in this executor; no known deploy-on-push path is configured. No merge or deployment requested.

Change record: [proposal](../../openspec/changes/editorial-draft-navigation/proposal.md), [acceptance delta](../../openspec/changes/editorial-draft-navigation/spec-delta.md), [tasks](../../openspec/changes/editorial-draft-navigation/tasks.md).
