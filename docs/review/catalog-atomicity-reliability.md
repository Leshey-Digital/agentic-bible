# Catalog atomicity and reliability successor

Checkout `/workspace/agentic-bible-catalog-atomicity`, branch `fix/catalog-seed-atomicity`, starts at preserved PR25 `0a5fe0eab9d956887e00022ac7fb22f8f78c7cbc`. Its reviewed predecessor `8d3cb96c72ee11cb98ca3b555203d779d9979c57`, PR23 `54b9d0793af36c00c9feca7a8933d3c1a9fa9d95` and PR24 `f3d03eda69a82abc7f527f5f14e062f56a40a1b0` stay unchanged. Independent review accepts PR24's compatibility fix and PR23's six working drafts/18 primary records; this successor's code/composition acceptance remains pending. PR25 exists as a draft and records both its failed first CI and successful diagnostic CI. Green diagnostic CI did not resolve the review findings.

## Catalog failure and fix

Actual Worker/D1 reproduced the reported valid 37-source catalog against 47 stored rows: the API returned `catalog_capacity` after changing an existing title/article association and inserting one of two new IDs. The old batch's row-by-row guards committed these effects before its later existence check rejected.

The successor gates both bulk source upserts and publication heads on whole-catalog admission inside one atomic D1 batch: stored count plus distinct missing IDs must fit 48. Inserting an admitted ID increases count and decreases missing by one, preserving admission for the head write. The method inspects its own batch's affected-row result, avoiding a later read another seed could change. A capacity loser performs no writes; a later storage error rolls the entire batch back. No schema, capacity or transport/spending change.

The actual Worker/D1 regression proves the rejected 47-plus-two case preserves all rows across restart, exact 48-row admission, observation-field preservation, identical reseeds/restart, forced head-insertion failure rolling source writes back, competing seeds with one winner and no losing metadata updates, and identical concurrent admission. It runs in `test:monitoring`, therefore in validate before browsers. The retained native restart suite remains separately exercised. Source URLs are inert synthetic catalog metadata; no outbound fetch occurs.

## Cold search evidence

The pinned Pagefind 1.5.2 bundle contains a five-second Worker initialization timeout, followed by main-thread fallback. A controlled Worker that constructs but never responds reproduced a 5,659 ms cold current-snapshot MemGPT result and the explicit `Worker initialization timeout` fallback warning. [Red evidence](catalog-atomicity-cold-search-red.json) records actual resources and timing. The result was correct after the delay, matching the reported failure class; the reviewer's particular trace has not been supplied, so its historical incident is not claimed conclusively traced.

Current builds select `noWorker:true` for the existing bounded twenty-entry MVP engine. The same controlled test returned the correct result in 671 ms, with zero worker attempts or warnings; [green evidence](catalog-atomicity-cold-search-green.json) records resources/timing. The regression asserts no worker dependency rather than merely extending the original five-second result assertion; retained real upgrade queries still use their original assertions. Snapshot base URLs, rapid-query replacement, empty/error/retry behavior and archived code/bytes are preserved. This uses the existing main-thread engine without a framework/provider. Reassess CPU/loading behavior before expanding beyond the bounded MVP corpus; this is not a general performance SLA.

## Mobile blocker

The original CI's strict 390px overflow failure is preserved in [the original record](wiki-content-compatibility-ci-failure.json). Diagnostic CI at preserved PR25 logged immediate/after-paint widths of 390/390 with no overflow and passed all steps; that is not evidence of a root-cause fix. No CSS or assertion threshold is changed here.

The GitHub connector now returns the original 2.6 MiB artifact reference (artifact ID 12084598208, run 38990505207), but this executor cannot materialize it: the proxied file download returns 403 and an approved direct read fails DNS. Exact trace geometry/text and the reviewer's cold-query timing excerpt have been requested. This action is blocked by transport, not denied by automatic approval review. Continue independent fixes/checks while awaiting that evidence; do not report the mobile issue resolved from a local rerun.

A temporary CI investigation step uses GitHub's existing ephemeral token with read-only Actions access to download that same repository artifact, then the already installed Playwright trace CLI to replay before/after snapshots at 390px and print bounded geometry. It provisions no persistent credential and makes no source/provider request. The step, script and added read permission must be removed after the evidence is recovered; they are an interim diagnostic, not a permanent dependency on an expiring artifact.

## Validation and release status

Focused catalog and cold-search red/green results are above. Combined full validation is in progress; record the complete observed results and terminal CI in the separate draft before handoff. Preserve earlier reports as historical evidence. No article/content expansion, merge, deployment, credential/account/resource, migration/dependency/framework, paid/model/provider call, live fetching/indexing, public intake, tracking/ads or license choice. Existing rights, production identity/distribution and monetary-enforcement gates remain. Rollback reverts/discards this successor to preserved PR25, without a schema/resource rollback or rewriting sealed artifacts.
