# Production preparation handoff at `ce85a99`

Date: 2026-10-19. This is a preparation record, not a deployment approval.

## Exact source and candidate

- Repository: `Leshey-Digital/agentic-bible`
- Preparation branch: `prep/production-foundation-20261018`
- Source commit: `ce85a9938428dc60a8da01e4d6b15d43492aeb92` (remote branch matched during this task)
- Commit scope: six browser-test files only; no application/runtime change.
- Worktree was clean before the exact-head build.
- `npm run build` passed: 31 routes and 20 Pagefind article documents.
- `npm run release:prepare` passed in dry-run mode and produced 82 assets. Candidate digest: `9bfe13235cbccbfb95b9ae008777021dd2772e0a3a4cbeaea79bde284ccdd9f6`; build ID: `61f41380e60be638985acd564ea1f77e424dd00796454746c0017348df0c194c`; source tree: `36b7574f6a5f7460d8e9f337710a39907d42c499`.
- The candidate names `agentic-bible-staging` / `https://staging.agenticbible.si`, records `dryRun: true`, and records `deployed: false`. No Cloudflare deployment, route, domain, production setting, credential or account change was performed.
- Staging protection is present in the candidate: `_headers` adds `X-Robots-Tag: noindex, nofollow`, and the staging `indexing-manifest.json` has no submission entries. This is artifact inspection only; there was no live-serving check in this task.

## Exact-head browser verification

The five repaired browser suites were rerun sequentially on the committed tree. Their complete logs and hashes are in the external evidence archive.

| Command | Result |
| --- | --- |
| `npm run test:browser` | Passed, 92/92 desktop and mobile tests |
| `npm run test:wiki-bridge:browser` | Passed, 4/4 |
| `npm run test:wiki-seo:browser` | Passed, 1/1 |
| `npm run test:maintenance-history:browser` | Passed, 12/12 |
| `npm run test:maintenance-restore:browser` | Passed, 2/2 |

An independent review limited to those six test-file diffs recommended approval. It confirmed the changes retain the security, accounting, source-fetch and state-integrity assertions; the bridge test now distinguishes a rejected legacy replay from an exact command replay. No writer or application implementation was in that review scope.

## Qualification boundary

There is **no aggregate qualification receipt for `ce85a99`**. The prior aggregate attempt at `8f711cc8cd90630ec32acca180453f1e32bc08df` stopped inside `validate` at the repository's 1,500,000 ms child timeout while `test:production-hosted` was still running. Its log shows nine cases complete at interruption. It was a runner timeout, not a demonstrated test assertion failure. The separate evidence records all 38 `validate` constituents passing at `8f711cc`, plus the post-validation steps other than the five browser failures repaired above. Those historical passes are not relabeled as an exact-head aggregate receipt.

The five repaired browser commands now pass on `ce85a99`, and the exact-head build/candidate preparation pass. A complete aggregate run was deliberately not repeated because the known serial `validate` timeout cannot produce a receipt under its fixed limit and the parent release evidence already retains the independent suite logs. A later qualification must use a reviewed runner change or a receipt-producing route that preserves all checks, source identity, logs and failure history. Do not claim this candidate is fully qualified until that succeeds.

## Remaining work: implementation and owner setup

| Area | Implemented evidence | Remaining before production activation |
| --- | --- | --- |
| Reader, search and sharing | Static Astro reader, 20-article Pagefind build, page metadata, revision/history views and repaired browser coverage. | Complete exact-head qualification; confirm source/licensing and release history; verify production-origin canonical, social and no-index behavior after an authorized release. |
| Contributions and administration | Local/synthetic intake and inbox, signed-admin verification path, immutable review records and controlled desktop/mobile journey tests. | Production IdP/gateway, exact administrator membership, key rotation and recovery; real D1 binding/migrations; approved contribution terms, privacy, moderation and retention; owner-controlled editorial mailbox and delivery/escalation. Keep public intake closed until these are satisfied. |
| Source acquisition and provider | Bounded controlled source capture, receipts, change candidates, replay and stop-on-uncertainty checks. | Implement and review live source profiles, compatibility/authenticity and safe normalization; approve any scheduler and provider adapter. Owner must select the provider/source scope and provide authorization through a supported secret store. |
| Quality admission | Exact-candidate and evidence-bound admission receipts, immutable denial/replay controls, and automatic publication with post-publication review flags in controlled flows. | A trusted semantic evidence authority and factual-support policy are not established by fixtures, hashes or model confidence. Define hard rejection criteria, human escalation, and live quality authority before any factual automated publication. |
| Writer, revision and rollback | Local canonical writer/history/restoration tests and a controlled, create-only GitHub proposal adapter. | Complete independent writer continuity acceptance; configure least-privilege GitHub transport and required CI event behavior; integrate approved proposals into the release source; implement and verify authorized deployment and rollback. Existing local restore tests do not prove a hosted restore. |
| Backup and recovery | Append-only journals and conservative handling of uncertain operations in local controlled stores. | Select live D1/archive retention, backup cadence, restore testing, recovery ownership and recovery objectives. No cloud backup/restore is configured or proven. Preserve ambiguous journals; never reset them to permit retry. |
| Cost controls | Controlled reservation, usage reconciliation and stop behavior are tested without paid calls. | Approve provider/model/tokenizer/rate card and numeric per-run/day/month currency allocations; connect actual spend enforcement and alerts; verify hosting, storage, egress and provider costs. The $10 operating target alone is not an enforceable cap. |
| Analytics, consent and ads | Measurement and ad scripts remain disabled; settings validate provider IDs. | Choose owned properties, consent and retention policy, admin/private-route exclusions, and verify collection only after explicit activation approval. Keep ads/tracking off until their separate decision. |
| Indexing and production release | Staging/no-index controls and disabled indexing outbox are present; no-index controls remain in the exact-head candidate. | Verify production origin and discovery controls; select/authorize Search Console or other ownership and any submission; test actual served pages and headers after a separate exact-byte production release. A provider acknowledgment is not proof of indexing. |
| Deployment wiring | Exact-head static candidate preparation targets the staging Worker; this task performed no deployment. | Recheck target/account/resource state at release time; keep staging and production isolated; approve production trust/bindings, build and deploy path, retained-version rollback and HTTPS/asset/discovery verification. No paid add-ons, expanded OAuth scopes or production edits are approved here. |

## Evidence locations and recovery

The external archive `production-preparation-evidence/ce85a9938428dc60a8da01e4d6b15d43492aeb92/` contains the exact-head browser logs/results and dry-run candidate identity. `production-preparation-evidence/independent-qualification/` retains the earlier constituent manifest, aggregate-timeout log and failed browser attempts. These are distinct histories; do not overwrite the earlier failures or describe the two sets as one aggregate pass. The Library copy is an evidence convenience, not a new source of qualification authority.

Staging and production remain unchanged. The next engineering gate is a reviewed, evidence-preserving qualification-runner improvement or a successful aggregate receipt on the intended exact source head. Only then should owner setup decisions and a separately authorized production release be scheduled.
