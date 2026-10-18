# Hosted MVP implementation handoff

Observed 2026-10-18. This is an operational continuation record, not a reduction of the [product specification](../openspec/specs/product.md), [founder decisions](decisions.md) or [accepted roadmap](roadmap.md). The goal remains a living encyclopedia with automatic technically valid article publication, post-publication human review, contributions, revision history and secure admin configuration.

## Verified hosted baseline

| Item | Exact observation |
|---|---|
| Source/main | `b41a422881921638833f92b2361a70eb1647d01f`, tree `d6d026bb942a80195152b9f87225a00dd94aba0c` |
| Staging | `https://staging.agenticbible.si`, Worker `agentic-bible-staging` |
| Version / deployment | `7bffcc8d-174b-4543-8a5a-a2f5449366f2` / `ad45d232-a422-420a-83fb-9f26bdb2451e`, 100% traffic |
| Qualification | `5c027392517f1a6a278bf820a2f340b510d296388fefa88ed33f91a6717173ac`; 20 retained command logs verified, not rerun during deployment |
| Candidate | `f0e549e75be4929e13704301c2a5590f0364a95dac4dde5980328af1e12933bf` |
| Worker | SHA256 `c3d90df230d7879ddf137e555bbb29aa42cd8e5fd7271b37ad09c13bb7608a77`, 81,539 bytes; exact configuration and `--no-bundle` preserved |
| Serving | HTTPS, all 81 public asset hashes, key pages, compiled release-manifest identity, noindex/security headers and closed admin/write policy passed |
| Bindings / secrets / cron | Only `ASSETS`; no secret bindings; no schedules. Workers.dev/previews disabled. Production untouched. |

The sanitized [retained evidence package](https://chatgpt.com/api/library/files/libfile_6ff858001ff48191907f2ce4d2061ba5/download), Library ID `libfile_6ff858001ff48191907f2ce4d2061ba5`, includes the byte-identical qualified archive, exact-source snapshots, configuration-name checks and manual Wrangler operation/serving evidence. Package SHA256: `39e114742c53651b38415a5bfc5b702dc6c7d277a8d95b294a009fdc805c6f07`. It contains no operator credentials or login logs. This first deployment has no prior live rollback target.

The original exhausted connector journal remains in the prior release task; it was unavailable in the fresh deployment environment. Its parent-reported two failed uploads/no version were retained as history, never reset or represented as successful. The new owner-approved candidate used a separate explicitly labelled manual Wrangler operation. Do not fabricate a controller receipt or erase earlier failure evidence.

## Hosted capability versus local implementation

| Area | Hosted now | Existing implementation and remaining work |
|---|---|---|
| Reading | Twenty sourced articles, three clusters, citations, related links and complete Pagefind assets. | Retained browser qualification covers interaction; no new hosted browser journey was run during acceptance. Twenty original articles retain their previously reported source-review acceptance. |
| Contributions | Disabled form; no hosted submit/inbox flow. | Deployed intake code has three-article coverage. Local successor expands coverage only; identity, isolated storage, terms/privacy/abuse and activation remain separate. |
| Revision history | Commit-pinned GitHub links; maintenance catalog disabled and empty. | Verified controlled Git revisions, diff/history builds, audit and explicit restoration exist. Live writer profiles, release ingestion and authenticated review must be connected. |
| Admin review | `/admin/` returns `503 maintenance_review_unconfigured`. | Existing signed assertion verifier and bounded review/approval APIs require approved trust, D1 and compiled history catalog. Correction-note draft proposals additionally need scoped GitHub transport. A draft PR is not canonical publication; review dispositions do not mutate article text. |
| Admin configuration | Settings routes return 503. No integration credentials are bound. | Validated non-secret ID forms and independent tags work only in the local editorial flow. Secure integration-setting contracts are a local successor; no persistent vault or live connection is implied. |
| Article automation | No live source/provider/job/canonical write path. | Coordinator, recovery, USD reservations, canonical writer, restoration and build/review ingestion are controlled-local-tested. Current pipeline requires fixture ports, fake extraction and existing `tool-use.md`; real generation, general updates and new articles need live implementations. |
| Discovery / operations | Staging is deliberately noindex. No live analytics, notification or budget-stop monitoring established. | Production discovery/ownership, privacy-aware Google/Microsoft/AI visibility, editorial delivery, backups, retention and real billed-usage contracts remain launch work. Ads stay off. |

Read-only `/api/runtime/status` reported `publicIntake:false`, `adminVerifierConfigured:false`, `adminApprovalsConfigured:false`, `gitHubProposalsConfigured:false`, `hostedCanonicalWrites:false` and `localFixtureIdentity:false`. The Worker has no `EDITORIAL_DB`, `HOSTED_ADMIN_TRUST` or `GITHUB_CONTENT_TOKEN` binding. This is a Worker-specific observation, not a statement that the account has no such resources elsewhere. Operator OAuth never confers application identity.

## Authorized local successors

The owner requests recoverable, separate branches from the exact deployed main. Public intake and all live account/resource/security/credential/provider/deployment changes remain outside these branches.

| Branch | Scope | Exact checkpoint / review |
|---|---|---|
| `feat/published-contribution-intake` | Reuse canonical published inventory for all twenty article choices and server admission; reject unknown/unpublished IDs; preserve abuse, moderation, replay and local-only gates. Add local migration `0017` to remove the historical three-ID SQL constraint without changing old migrations. | Implementation `545eaa7afaa1fc4d1b50248f558ae0feb0a7b205`; 13 focused tests passed, including native D1 populated upgrade/rollback/restart/all-twenty submissions. Full validation and independent review are running; no remote migration. |
| `feat/admin-integration-contracts` | Unmounted authenticated write-only secret commands, safe status, explicit rotation and bounded connection-test contracts with synthetic local adapters. | Implementation `9d38eea50b8da486b43895ee8fc12cc6f33462cd`; 16 focused tests, 19 retained settings tests, eight static tests and actual build passed. Astro reports zero errors/warnings and one suggestion hint. Independent review is running; no actual credential persistence, routes or live wiring. |

Each implementation has its own OpenSpec change record and independent exact-head review. Source commits, passed/failed/not-run checks and findings belong in this table once available. No merge, remote publication or deployment is inferred from a local commit. Do not change the released archive to package a successor.

## Next work and stopping boundaries

1. Finish and independently review the two bounded local branches. Reuse the existing canonical article inventory and signed-admin verifier; do not introduce another authorization source, unsigned role headers, fixture identity on a real origin or a second editorial model. Keep the exact package lock, original article bytes and live configuration unchanged.
2. After a specific owner configuration decision, establish isolated D1 and real verified admin trust/membership/key rotation. Prove unauthorized/CSRF denial, private audit, migration/restart/recovery. Existing correction notes need migrations through `0009`; review/restoration through `0013`/`0014`; pipeline/currency through `0016`, retaining both distinct `0003` migrations. Never silently apply them remotely.
3. Port intake, tags and non-secret settings onto hosted identity and prove all twenty articles. Resolve license/contributor terms, privacy/retention and abuse policy before enabling public submissions. Implement secure persistence/rotation and masked integration setup separately from the local contract; configure and test `editorial@agenticbible.si` delivery only when authorized.
4. Extend the existing coordinator with trusted live source extraction, a real structured generation adapter, general updates and genuinely new articles. Select a compatible trusted executor for the current Node/files/Git/build work; adding a Worker cron alone cannot execute it. Define finite provider/model run/day/month allocations and all billed dimensions before paid dispatch. The USD ledger is not an infrastructure invoice cap; unknown charges stay reserved.
5. Connect canonical writes/history to saved-environment qualification and exact-byte activation with expected-head/current-version checks, one deployment writer, durable recovery and retained rollback. Approve live receipt profiles and unattended execution explicitly. Do not substitute GitHub Actions/Workers Builds, relabel fixture receipts, reset history or impose universal human editorial preapproval on ordinary valid publication. Explicit restoration approval remains a distinct operation.
6. Prove the complete hosted source-change → charged generation → canonical revision → article/search/history → human follow-up flow, new-article creation, interrupted recovery and explicit restoration. Then finish authorized production discovery/measurement, backups, monitoring and deliberate capacity/retention procedures. Never delete stores to evade held charges, expiry or finite record limits.

No missing live credential prevents the authorized local implementation/test work. Ask only for the exact consequential configuration action when that next step is concrete and ready for review. Rollback of these undeployed branches is to retain their checkpoints/evidence and return to deployed `b41a422`; no remote rollback is needed for local-only work.
