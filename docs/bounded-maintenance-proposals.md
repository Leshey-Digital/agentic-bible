# Budgeted local maintenance proposal connection

This successor preserves PR34 `697d546fc5b6560fe1c38e573584c855c86c13af`. The [gap audit](automated-maintenance-gap.md) distinguishes the selected missing producer from canonical GitHub automation. No independent acceptance, release or complete MVP is implied.

## Implemented boundary

`src/wiki-bridge/maintenance.ts` validates a strict synthetic tool-use packet, regular source bytes and successful charged HTTP receipts. It checks source freshness/profile, original Markdown, site/publisher parents and project bytes before reservation/dispatch. The provider receives source text explicitly labelled untrusted; no secret, executable instruction, tool, URL, identity or limit comes from that text.

Only the deterministic extractive fake and its synthetic tokenizer are supported. An exact output schema allows one complete source paragraph per supplied citation, matching its hash and UTF-16 offsets. Free summaries, new claims/URLs/instructions and invalid usage cannot publish. Fixed generated metadata labels the result synthetic. This is literal grounding, not semantic truth/authenticity or a general claim verifier. Real HTML normalization, real model adapters and a reviewed generative claim policy remain missing.

Technically valid packets automatically use the existing `WikiBridge`/`PublicationStore`, then carry `editorial-review` in the local follow-up queue. No human article preapproval is added. Community-correction approval metadata is ineligible. Repository Markdown stays canonical and unchanged: this is an isolated full Astro/Pagefind snapshot, not a GitHub commit, main merge or hosted release.

## Accounting and recovery

Migration `0010_maintenance_proposals.sql` adds a ledger in existing D1, without a remote resource/binding. One atomic insert checks capacity, concurrency, request periods and conservative cost sums before invocation. Unique owner/fingerprint guards correlate later writes. Losing callers never dispatch. States are calling, uncertain, failed, ready and complete; at most 16 retained rows, with no automatic eviction/refund.

The explicit demonstration policy uses **SIMULATED_MICRO_USD** and synthetic UTF-8-byte tokens, rates of one simulated unit/token, at most 8,192 input and 2,048 output tokens, 10,000 reserved units/run, 20,000/day, 60,000/month, two requests/day and six/month. Each event dispatches at most once. These are fake test units, not real tokenization/pricing, monetary enforcement or an approved provider allocation. The infrastructure/operating target does not activate paid work.

Sources are capped at 2,048 bytes each in the existing two/three-source profile, age 24 hours, provider response 4,096 bytes and invocation/body deadline two seconds. Actual fake usage must match the trusted counter and reservation. Full maximum cost stays charged for cap checks; actual simulated usage is recorded separately. The fake refuses output beyond the requested ceiling; rejected or late bodies are canceled. Missing policy/accounting, malformed/unsupported/misreported/oversized output and stale/tampered evidence fail closed. Timeout or unknown dispatch stays uncertain and blocks new generation; no retry/reset endpoint exists.

Save the validated response/packet before publication. Same-event replay verifies source/project/parent/output fingerprints, resumes the existing bridge, or returns its historical receipt without regeneration/reactivation. D1 and filesystem publication are not a distributed transaction. Pending outcomes stay explicit; source/package changes never silently rebase. Age limits can stop old replays; deliberate operator recovery/retention remains necessary.

## Reproduce without spend

Use Node 24.19.0/npm 11.9.0 and locked dependencies. `npm run test:maintenance` exercises actual local workerd/D1, controlled original HTTP bodies, reservation observed before invocation, complete automatic publication, rejected evidence/claims/usage, concurrency, request/cost periods, timeout, saved-proposal recovery and activation/completion interruption. `npm run test:maintenance:browser` consumes that native snapshot for desktop/mobile real Pagefind, twenty-entry browse, sources, history and post-publication flags. Reading/search invokes no model.

`maintenance:demo` is an explicit fake-only demonstration. `maintenance:status` reports no real provider/live writes. `maintenance:local` serves the existing read-only loopback wiki at `http://127.0.0.1:8798/`. Existing fixed demo pins can become stale after source/package changes; commands stop rather than resetting budgets. Automated tests use separately named owned stores and preserve interactive editorial data.

## Remaining MVP/live path

- Actual allowlisted discovery/scheduling, body capture/normalization and source-authenticity/content/factual policy.
- Reviewed real provider/model/tokenizer/transport, approved numerical currency caps, funding/stop/reconciliation and separately authorized secure credentials.
- Distinct automated GitHub maintenance authority and canonical commit adapter. Do not forge or repurpose community approval. Main has three entries; twenty-entry source remains unmerged.
- Hosted human flag/disposition and notification delivery; canonical source/build/release integration and real provider/rollback verification.
- Independent source/code/composition review, outstanding PR33 release and PR34 admin findings on separate successors, legal/privacy/licensing and resource prerequisites.

No real source/model/GitHub write, secret/account setup, new service/framework/dependency, deployment, merge, live indexing, ad activation or license choice. Rollback preserves the code baseline and deliberately retains/exports ledger/publisher metadata rather than resetting uncertain charges.
