# GitHub proposal runtime handoff

Separate branch `feat/github-content-proposal-runtime` starts at frozen PR29 `0579936052e8ec15baf4f779e02cd10c22b1c615`. [File-level hosted gap report](../hosted-runtime-gap.md), [adapter/runtime contract](../github-content-proposals.md), [change proposal](../../openspec/changes/github-content-proposal-runtime/proposal.md).

## Result

Static reading/search is already portable to Workers Static Assets. Production editorial identity/intake is deliberately closed, and canonical correction/publication/history/rollback remains Node/filesystem-only. Remote main was verified at `2ad330e06fcc4dd46a8fc95291ccc3cd1c597327` with three articles, while the tested twenty-entry application is in feature ancestry. Source history references and accepted release integration/build/deployment still need production work. The local correction path cannot currently change a hosted canonical article.

The new adapter fits GitHub → build → Static Assets without selecting a new canonical store or service. Pure Workers code plus a bounded D1 outbox verifies one trusted approved tool-use note against pinned Git source and creates a Git tree, single-parent commit, create-only branch and draft PR. It never updates main, overwrites refs, merges, deploys or reports a published article. Trusted authority is re-read around visible effects and receipt completion. Ambiguous effects/revocation remain pending; a draft may require deliberate closure. Unreferenced Git objects can remain after uncertain object creation, within the finite request allowance.

The separate staging config serves normal reads assets-first and uses Worker routing for API/admin paths. Its default entrypoint has no admin verifier, approval producer, GitHub transport, D1 UUID or release attestation. Fixture flags/cookies/headers cannot enable it. Real authentication/CSRF, immutable production approval generation, D1 resource/migration, least-privilege GitHub authorization, CI event/release protection and authorized deployment/rollback remain explicit gaps. These are not simulated as configured.

## Verification

Seven focused checks passed; six exercise actual workerd/D1 with controlled GitHub REST and one verifies the shipped closed/default handler. Coverage includes source/tree/parent pins, changed/revoked authority, foreign branches, lost tree/commit/ref/PR responses, actual D1 completion faults, restart, concurrency, row/request ceilings, redirects, oversized responses and native fetch deadline. The default entrypoint is tested with forged roles/local cookies and no write authority.

An approved controlled Markdown proposal is applied to an isolated candidate source copy, actually built with Astro and indexed with Pagefind for twenty entries, then served through actual local Wrangler/Static Assets. Desktop/mobile tests verify note reading/search, original code and attribution, ordinary collection/search, noindex, closed intake/auth and absence of external browser requests. Generated content receives automated accessibility/viewport checks. This is not a build/deployment of remote main; controlled proposal URLs/receipts are fixtures, not live GitHub creations.

Full validation passed 136 tests with zero failures/cancellations. Astro checked 102 files with zero diagnostics. All 103 browser cases and both native restart checks passed. Both dry runs passed with 107 assets: the original static target has no bindings; the runtime candidate has only ASSETS, with no D1 resource/credential setup. Publication/exact head and terminal CI are recorded in the draft PR and command/proof files. PR29 remains frozen; independent review findings take priority. No test result here authorizes release or proves production identity, legal rights, live GitHub writes or hosting.

Evidence: [commands and inspected main](github-runtime-validation.json), [controlled GitHub/workerd/D1 receipt](github-content-proposal-controlled.json), [actual projected-source build](github-content-projection-build.json), [desktop runtime](github-runtime-browser-desktop.json), [mobile runtime](github-runtime-browser-mobile.json).

## Remaining gates and rollback

The concrete next connection is a real verified approval/identity producer plus authorized GitHub transport, followed by accepted source integration and an approved release/build/deploy path. No architecture switch to mutable D1 content, R2/KV serving, new database provider, service account or model framework is made. Before real use, review retention after the four-row outbox limit, software versus monetary controls, revoked/dangling draft handling, release-source history pins and deployed rollback.

Rollback closes this draft and returns to PR29. Migration 0008 is additive; preserve/export local outbox data and interactive `.wrangler/editorial` deliberately. This task performs no main/PR merge, live deployment, credential setup, paid call, live indexing, license change or cloud resource provisioning.
