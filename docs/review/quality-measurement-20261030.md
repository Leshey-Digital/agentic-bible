# Reader quality and measurement recovery — 30 October 2026

This is local implementation and read-only provider evidence. Nothing in this checkpoint was published or deployed. The founding scope remains the sourced, interconnected encyclopedia with contributions, revision history, bounded automatic creation/maintenance and post-publication editorial follow-up in [the product specification](../../openspec/specs/product.md) and [roadmap](../roadmap.md). It is not complete.

## What is actually deployed

Official Agentic Bible connector reads on October 30 returned complete inventories: 14 staging versions and two production versions. Production is still `7eccb256-0659-43c4-b2e6-5f54ac652824`, deployment `76e27d35-fe4a-4d9f-ba16-3db019f4340d`, 100%, activated October 22. Its annotation pins source `cd762a6d87e9abda2cb4a04f112d1ac439c61b2c`. Its configuration has no D1, AI, credential or other bindings. Staging is still `a70ede39-1221-4a8a-983b-1ca66672bf69`, deployment `6593f4e8-aec8-4d4c-a738-f6b02f64769a`, 100%, October 25.

[PR60](https://github.com/Leshey-Digital/agentic-bible/pull/60) remains open, draft and unmerged: head `061359cc443da097e5472bac2914ac81e3f91fd0`, base `integration/editorial-recovery-reader-20261024` at `8fed63be0cee5d28525d639dc692708c6b393f4a`. No version for that release is recorded. Its qualified packages and original operation `b902c48c-767e-4515-bdb9-d1ae39572a87` / cell 8 remain untouched. Absence of a new version does not settle the original platform call's ability to execute later. No retry was made.

The executor policy permits staging but does not list the production apex. No direct production HTTP request, alternate transport, denied Python client request or denied source fetch was attempted. Current production assessment uses the actual deployed immutable modules from Cloudflare, not a newly claimed ordinary-browser acceptance. HTTP status, edge injection, redirects and external-link reachability still need permitted live-browser verification.

## Specific content findings and corrected candidates

This is a deep review of two representative deployed entries, plus inventory checks across the twenty source articles. It does not certify all twenty articles or every external link. Both sampled deployed articles have legitimate primary citations; the finding is weak explanatory usefulness and repeated process caveats, not a demonstrated fabricated claim.

| Deployed entry | Concrete weakness | Local correction |
| --- | --- | --- |
| AI agent | Repeated library/citation-repair example and project pipeline status; no complete action/observation trace or concrete diagnostic sequence | [Rewritten candidate](../../src/content/articles/ai-agent.md): five-step original failing-test repair, agent/workflow/retrieval distinctions and task-specific evaluation questions |
| Agent orchestration | Names patterns but spends much of the entry on a hypothetical encyclopedia handoff and repeated authority cautions; little help comparing arrangements | [Rewritten candidate](../../src/content/articles/agent-orchestration.md): five-pattern work/check comparison, revision-bound original JSON handoff, partial-result and failure diagnosis |

Deployed AI-agent HTML module SHA-256: `934e15cfa2f620ac158110084092e8db32c5f3f03a9c623da6bef75c256ee7ed`. Orchestration: `1df755827793d55302fc048768f438ff2726d1c5b0f0c94cd6dff3459fe24680`. These are provider-retained HTML bytes, not new HTTP response hashes.

Primary sources consulted on October 30: [Anthropic architectural guidance](https://www.anthropic.com/research/building-effective-agents), [Claude tool boundaries](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview), [ReAct v3](https://arxiv.org/html/2210.03629v3), [LangGraph patterns](https://docs.langchain.com/oss/python/langgraph/workflows-agents). Original examples are labelled synthetic; no vendor wire format, benchmark result or deployed capability is invented. Working-draft and pending human-certification labels remain. Only these two articles change; the other eighteen remain byte-identical to the preserved base.

The initial four-column trace technically passed overflow checks but was cramped at 390px. Screenshot inspection prompted a semantic numbered sequence. The shorter orchestration table uses scoped existing reading styles. Final 390px/1440px screenshots were inspected and show no page overflow; existing brand and navigation are unchanged.

## Tracking: absence verified, not assumed

All 31 HTML pages in the current production module inventory were inspected: no Google tag, GA, Clarity, Cloudflare beacon, measurement-policy template or first-party measurement endpoint marker. The authorized account Web Analytics inventory returned two sites, neither for `agenticbible.si`; no site or rule was created. This does not assert that Cloudflare has no ordinary request/security analytics. Those are not a substitute for a measured search or contribution funnel.

Existing [settings](../measurement-settings-contracts.md) validate non-secret Google/Clarity IDs and emit only an inert local template. They do not install an SDK or collect anything. There is no actual traffic baseline, search-use/no-result rate, contribution funnel or reader-error dashboard here. Those signals are **not configured/unavailable**, not measured zero.

### Implemented measurement preparation

- Existing search/contribution scripts now call a default-no-op recorder with finite categories: completed search result bucket, keyword-expansion attempt, selected canonical article, contribution open/closed/saved/duplicate/rejected/unconfirmed, and reader error component.
- A separately installed recorder can count page views and generic browser errors. **No application caller installs it.** The only installation is in controlled tests; neither URL parameters, provider settings nor window globals activate it.
- Explicit enablement, current consent, exact approved origin, no DNT/GPC opt-out and known public route are required for every event. Admin/API/unknown/staging paths fail closed. Raw query/hash-bearing path arguments are rejected; hooks supply pathname only.
- Output contains only schema, UTC day, canonical page and finite signal fields. No raw search, proposal text/URL, error message/stack, IP, referrer, session ID, credential, submission/approval/request reference or persistent visitor ID is accepted. Unknown fields and coercible enum objects are rejected.
- Maximum 32 admitted events per page. Synchronous sink error or an unsupported asynchronous outcome stops admission without retry and retains the allowance. The disposable local aggregate preview has 128 cells and 10,000 counts per cell, never evicts to admit a new cell, and stores no per-event timeline. It counts events, not people; client-clock/day and capped/drop/blocker limitations must be reported.
- Known closed-intake status is distinct from malformed/unavailable status. Saved/duplicate counts require the existing received/reference/duplicate receipt contract and matching 200/201 status.202, malformed success and 5xx remain unconfirmed; no reference or payload enters analytics. Existing contribution UI, save/retry authority and backend behavior are preserved.

No collector, remote persistence, dataset, beacon, external SDK, retention setting or consent UI was activated. This is tested instrumentation and a disposable local sink, **not working production tracking**. A real transport must separately handle acknowledgment/uncertainty and preserve these projections. Prefer existing Cloudflare infrastructure; do not introduce a paid analytics service or repurpose connector credentials.

## MVP journeys still missing or limited

| Journey | Current state and precise gap |
| --- | --- |
| Read, browse, search, inspect citations | Twenty entries deployed; current local 94-case desktop/mobile regression passes. This is not fresh live HTTP acceptance. Content quality review remains incomplete beyond sampled entries. |
| Correct an article | Public intake is closed. PR60 contains clearer contextual options but is not deployed. Terms, privacy/licensing and moderation decisions still block opening intake. |
| Inspect revisions | Per-article Git history is linked. Deployed global history says no maintenance revisions; no generated revision is implied. It is not an operating automatic maintenance history. |
| Private review and saved note | Earlier authenticated staging acceptance remains valid historical evidence. Current staging has enabled private inbox, D1 and inherited trust/vault bindings. No new login, note write or acceptance rerun occurred. Production has none of these bindings. |
| Source to generated draft | Prior denied fetches/failed receipts remain preserved. Current staging's trusted currency price deadline is `1792778108979` at `currency.price.validUntil`, expired October 23. No inference, renewal or ledger reset occurred. |
| GitHub draft and canonical publication | PR60's controlled workflow is reviewed, not active with runtime GitHub authority. No GitHub token/source binding was observed; vault values were not inspected. Live authority/source alignment must be established, not inferred from connector access. Automatic publication/revert remains controlled-test evidence, not a deployed engine. |
| Measure readership/search/contributions/errors | No production client instrumentation or Web Analytics site for this hostname. New local adapter is disabled; durable transport and privacy decisions are still required. |
| Search-engine indexing | Crawlable metadata is earlier release evidence; no new Search Console property, verification TXT, indexing submission or ranking claim. |

## Verification and review

Runtime/measurement implementation `12b903e` passed the existing 94-case desktop/mobile browser suite (Chromium 154.0.8037.57, 1.7 minutes), covering all 20 articles, real Pagefind, no-JS fallbacks, keyboard, axe, narrow/tablet/desktop, closed intake and no external requests. Final article/layout runtime source is `11af72acfc0b966090e2686e9652875ffc5c6e4a`; only two article bodies and scoped table CSS changed afterward. Its build indexes 20 pages, and the affected article desktop/mobile accessibility/viewport checks pass 4/4. The static catalog expectation correction is independently reviewed at `c937a4b`:51→50 distinct URLs solely because AI agent now shares the already-present pinned ReAct v3 record. Twenty articles, every citation ID/count, the 18 final-six evidence checks and all other guards remain; two rendered pinned-link assertions were added.

Additional observed results: static suite 11/11; measurement contracts/browser 11/11 including the final capacity checks; source revision 3/3; inert article examples 5/5; type check 209 files, zero errors/warnings/hints; documentation validation; staging asset-only dry run. Final capacity result and exact source checkpoint are in [the evidence summary](quality-measurement-20261030.json). No full release qualification or production-target package is claimed for this new branch.

Independent Sol6.1 source review found and then accepted corrections for primitive enum validation, honest contribution outcomes, asynchronous sink uncertainty and the distinction between a revision field and enforced comparison. It accepted exact 11af72a's final content/layout delta and the exact source-count expectation change. The reviewer did no tests, network or provider calls; root's browser/source-fetch evidence remains separate.

Failures retained in the execution record: initial check/build rejected uncommitted article changes with `release_source_article_changed` (resolved by committing; guard unchanged); coercible enum regression reproduced before correction; original static assertion51 failed after the pinned-source deduplication; a new browser assertion used unsupported `isDisabled` semantics on a fieldset (corrected to actual fieldset.disabled plus descendant disabled state). None was relabelled as an original passing run. No application timeout/assertion bound was raised.

## Exact remaining live prerequisites

1. Resolve the original platform upload/approval state through its supported UI or platform receipt. Do not replay cell 8 or infer terminal non-execution from an empty version search.
2. Review/qualify the chosen new article/instrumentation source for its actual target and obtain applicable release authority. This branch is not one of PR60's frozen packages. Permitted ordinary-browser live checks are needed; this executor has no apex egress grant.
3. For tracking, approve collection purpose, notice/consent/revocation, retention/access and the exact existing-infrastructure destination. Then implement and qualify its transport. Do not enable the dormant test recorder or present its in-memory preview as production metrics.
4. For a real engine run, resolve the retained source-denial/access prerequisite, verify runtime authority and current usage baseline, and specifically renew a bounded inference policy within the unchanged $20 additional monthly ceiling. No new credentials, grants or spending are implied here.
5. Keep public intake, credential provisioning and canonical publication authority separate. Preserve the earlier synthetic note forbidding a draft and all failed receipts, counters, rollback versions and source pins.

Rollback for this source-only work is returning to061359; no data/schema/provider state changed. The preserved live rollback identities and frozen release artifacts remain available. No merge, PR approval, remote push, deployment, source retry, credential/security/privacy change, AI call or real data write occurred in this assignment.
