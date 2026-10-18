# Interrupted maintenance work: recovered checkpoint

Recovered on 2026-10-18 in `/workspace/agentic-bible-maintenance`, branch `feat/bounded-maintenance-proposals`, based on frozen PR34 `697d546fc5b6560fe1c38e573584c855c86c13af`. The interrupted uncommitted files survived; no file was discarded. The prior temporary type-check log did not survive, so no result is inferred from it.

Execution resumed successfully: Node 24.19.0, npm 11.9.0, existing locked dependencies. Fresh `npm run check` passes **119 files, zero errors/warnings/hints**; log is `maintenance-recovery-check.log` in the actual Git directory. No quota rejection occurred in this worker after environment startup. The separate independent reviewer previously stopped at a usage limit; **PR33 and PR34 have no independent acceptance claim**.

## Preserved implementation, not yet validated end to end

- `src/wiki-bridge/maintenance-provider.ts`: fake-only strict complete-paragraph proposal schema, bounded response/timeout, synthetic token accounting and finite simulated policy.
- `src/wiki-bridge/maintenance-budget.ts` and `migrations/0010_maintenance_proposals.sql`: atomic existing-D1 request/token/simulated-cost reservation; durable calling/uncertain/failed/ready/complete states.
- `src/wiki-bridge/maintenance.ts`: charged source-file/receipt validation and source/site pins before generation; validated packet persistence; existing automatic local publisher/bridge and review flags afterward.
- `scripts/maintenance-demo.mjs`: explicit deterministic local demo/status/read-only preview, without a real provider adapter or route.
- `docs/automated-maintenance-gap.md` and the three `openspec/changes/bounded-maintenance-proposals/` files: precise scope, policy and remaining gaps.

No maintenance unit/native/browser tests have yet run. No real or fake model invocation, demo publication, new migration execution, full validation, successor PR or successor CI is claimed by this recovery checkpoint. The new CLI is not yet registered in package scripts. Next: add actual-D1 concurrency/budget/failure/restart tests and deterministic source → provider → local article/search/history/review-flag coverage before integration/publication.

## Actual remaining MVP gaps

The selected producer connects only one missing local stage. Live discovery/scheduling and captured body normalization remain disconnected. A real model/approved tokenizer/rates/currency ledger and numerical provider allocation are absent. There is no automated canonical GitHub maintenance writer; the existing GitHub route requires explicit community-correction admin approval and must not be impersonated. Current automatic publication is an isolated synthetic full-site snapshot; human flags exist there, while a hosted review/disposition path and automatic canonical build/release remain separate. Provider authenticity/factual validation, production identity/D1 setup, legal/privacy/licensing and deployment prerequisites remain unresolved. Technically valid sourced articles still publish automatically with post-publication flags; no universal human editorial preapproval is added.

## Suggested parallel ownership (not worker assignments)

| Workstream | Independent files | Coordination boundary |
|---|---|---|
| Maintenance producer (this branch) | `src/wiki-bridge/maintenance*.ts`, `migrations/0010_maintenance_proposals.sql`, `scripts/maintenance-demo.mjs`, new `tests/maintenance*`, maintenance change/evidence docs | Preserve existing bridge/publisher/HTTP contracts. |
| Canonical GitHub maintenance writer | New `src/maintenance-github/`, `tests/maintenance-github/`, its own docs; reserve migration 0011 only if needed | Separate automated authority from reviewed community corrections; no actual GitHub writes enabled. Coordinate before editing `src/hosted/*`. |
| Source receipt/body collector | New `src/maintenance-sources/`, `tests/maintenance-sources/`, its own docs; migration 0012 only if needed | Reuse fixed allowlist and HTTP accounting; no live fetch/schedule enabled. Coordinate edits to existing HTTP adapters. |
| Hosted post-publication review flags | New `src/maintenance-review/`, `tests/maintenance-review/`, own docs; migration 0013 only if needed | Reuse existing identity/editorial contracts; no new identity or live binding. Coordinate admin route changes. |
| Independent PR33 review | Separate read-only worktree at `e924db11b32171ee28006aabe488c3615a54f583` | Do not edit frozen head; fixes require a successor. |
| Independent PR34 review | Separate read-only worktree at `697d546fc5b6560fe1c38e573584c855c86c13af` | Do not edit frozen head; preserve its screenshots/failure evidence. |

Keep `package.json`, lockfile, shared CI, README, AGENTS and shared migrations integration under one coordinator. These are proposals for disjoint worktrees, not permission to create services or spend. No deployment, merge, secret/account configuration, paid call or live indexing is authorized by the resumed speed request.
