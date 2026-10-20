# Private editorial integration evidence

Prepared source: `b81e2093e80cb8dc31b56fcb14f969dad124bdfa`.
This evidence/documentation successor changes no runtime or test bytes.

## Actual checks

- New private-inbox native tests: 3/3 passed, including complete controlled suggestion/review/draft/restart history with anonymous intake closed, exact opt-in, missing trust/D1/GitHub boundaries.
- Astro: 196 files, zero errors, warnings or hints.
- Static build and Pagefind: passed, 20 indexed articles.
- Static tests: 11/11 passed.
- Staging discovery assertion and Wrangler runtime dry run: passed; only ASSETS binding in prepared config. No upload, activation or startup measurement was performed.
- Broad serial hosted suite: 44/45 passed. Preserve the failure: model-context-protocol fixture initialization failed with `TypeError: fetch failed`, caused by `UND_ERR_SOCKET: other side closed` while applying disposable D1 migrations in fixture.mjs:15, before the workflow body. The failed child retained a workerd handle; SIGINT of that child let the suite finish. This is not a clean broad-suite pass. A later isolated unchanged article rerun is recorded below separately.
- Broad suite includes successful desktop/mobile draft navigation and review-history readback (four browser checks), all three new private-inbox tests, and retained trust/CSRF/race/capacity checks.
- Independent implementation review: no blocking findings for exact configuration/contracts hashes recorded in the integration document. Follow-up documentation review identified binding/main-pin/upload prerequisites; all are now explicit.
- PR54 exact-head workflow lookup returned no runs. Executable Actions remain absent by repository policy. No CI pass is claimed.

## Frozen preparation, not release qualification

Manifest SHA256: `260142f11656ed643fbc2091479d47bef14f605331ce9bfbd89eeb3d74f933f9`.
The adjacent candidate-manifest.json inventories 81 static files and three dry-run output files. Wrangler's "115 files" traversal count is not the frozen regular-file count.
Worker: 223077 bytes, gzip 53518 bytes (local deterministic gzip); SHA256 `efcee25c447fc4c68acf40e8efec8262e4a8233587a7ba87c3f2f239e63b7e00`.
Local frozen root: `/workspace/agentic-bible-editorial-integration/.git/private-editorial-candidate`.

The candidate contains no private-inbox opt-in or GitHub authority. It is an exact closed staging preparation, not the configured private-trial artifact. Full saved-environment release qualification, main-source agreement, reviewed target-binding support, supported asset transport, existing admin identity verification and GitHub authority remain prerequisites. No external staging/production test or qualification is inferred from local mocks. See ../../private-editorial-integration.md for inventory and rollback.

## Preservation and branch publication

Before publication, remote main/recovery/PR53/PR54 heads matched the ancestry table. Official Cloudflare Build trigger reads for production and staging each returned empty lists; no executable GitHub workflows exist. The source checkpoint is a non-production aggregate targeting recovery, not main. Original failed upload journals and deployed module receipts are untouched.

## Isolated unchanged article rerun

The complete existing all-articles.test.mjs ran alone with TAP reporting: 21/21 passed in 75.55 seconds, including MCP and all twenty article workflows. No code, test assertion or timeout changed between runs. The earlier initialization socket failure did not reproduce; its underlying cause remains unestablished, and the original broad 44/45 result remains a qualification limitation.
