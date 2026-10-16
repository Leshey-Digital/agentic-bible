# Local combined candidate

`feat/local-mvp-combined-candidate` combines exact feature histories for independent review. It is not a release or a claim that source changes generate articles. No existing source branch is advanced, rebased or force-pushed.

| Source | Exact head | Review status when prepared |
|---|---|---|
| PR10 integration base | `d0bfca47cd221b970b01ace838afb3f3bb9a5d32` | Independently accepted; durable review artifact retained. |
| PR12 HTTP observation library | `b78751b4f4db09fcce4289052f7e163ac4be9c5b` | Independently accepted within disconnected local-library scope. Nonblocking P3: expired budget-blocked jobs can misleadingly report in progress; no extra fetch occurs. |
| PR11 supplied article publisher | `efeffed9467a9fa67125725d923d6d672cfd9555` | Independent behavior review found the topic-type P2 addressed by PR13. |
| PR13 topic schema fix | `d57e975253ba6d9ba3e48a2292611cfca14aa118` | Independent source/test patch recheck accepted. Full six-file/documentation review remains pending; no full-commit acceptance is claimed. |

The merge base of HTTP and publisher histories is PR10. Local merge `1a1c6a878412672aa431b9f77b0f028bfb4b0483` has exact parents PR12 and PR13, retaining the original PR11 and Node adapter commits as ancestors. Three merge conflicts were limited to agent instructions, README sections and package scripts; both feature contracts and all commands were preserved. No runtime transport/publisher implementation was reconciled by hand. The final candidate commit is recorded in its handoff/PR and remains subject to independent combined review.

## Current behavior and the missing bridge

| Component | Input | Durable/output boundary |
|---|---|---|
| HTTP collector | One of six static official documentation IDs, explicit command key, controlled transport in tests | D1 HTTP-only request reservations, validators and last-good hash/time. No source text retained; no publication event or article revision emitted. |
| Supplied-content publisher | An explicit original cited structured event with `supplied-local-fixture` provenance | Isolated Git-directory immutable revisions, real HTML/Pagefind/history/flags, receipts and atomic activation/rollback. No HTTP observation input or generated text. |

There is **no trusted source-event/content bridge** between these components. Existing application source controls still run fixtures. A collector hash change cannot populate the publisher's schema, produce factual claims or select article text. The publisher does not accept `mode:http` metadata as evidence, and a matching citation URL in a supplied fixture does not establish an authenticated relationship to an observation.

An automatic bridge needs a separately reviewed durable event/outbox contract binding source ID, URL, observed hash/version/time and relevant evidence to a supplied/generated revision, with stable event keys, authorized ingestion, provenance validation and technical/content policy. It must define cross-store recovery/acknowledgment between D1 and the filesystem publisher; no atomic cross-store transaction currently exists. Content acquisition/rights, factual/citation validation, model selection and enforceable paid-job currency accounting remain absent. The current collector deliberately retains no body, and the current publisher only labels supplied fixtures. No source-to-generated-article capability is implemented or inferred here.

The new combined browser journey is **test orchestration only**: it collects controlled synthetic observations, then explicitly supplies independent original fixture events. It asserts no publisher activation/candidate creation after source collection, failed-topic rejection, actual HTML/search/history/flags, collector restart/conditional requests, publication reopen/replay and rollback. Collector state survives publication rollback; older replayed receipts cannot rewind either subsystem. [Example orchestration evidence](review/combined-journey-evidence.json) records hashes and separate receipts with `automaticBridge:false`; it is not a production provenance attestation.

## Validation and isolation

Run `npm run validate` after installing the pinned dependencies, then run these suites sequentially:

```sh
npm run test:combined:browser
npm run test:publication:browser
npm run test:editorial:browser -- --workers=1 --timeout=90000
npm run test:integration:browser -- --workers=1 --timeout=90000
npm run test:monitoring:worker
npm run test:settings:worker
npm run test:browser -- --workers=1 --timeout=90000
npm run staging:check
```

Validation retains 4 static, 9 editorial, 23 monitoring, 19 settings, 3 populated migration upgrades, 13 Node HTTP, 1 actual local workerd/D1 HTTP and 12 publication tests. The combined browser owns disposable `combined-http-publication-browser` D1 and `article-publication-combined-browser` stores in the actual Git directory; its loopback preview uses an ephemeral port. Test-only collector routes are bundled from the existing HTTP harness and never enter the app Worker. No Internet requests are used by the combined test. Existing browser/restart harnesses retain their own isolated directories. Preserve `.wrangler/editorial`; do not run a default-state migration merely to validate this candidate.

The migration inventory is unchanged from PR12: 0001 editorial, 0002 source monitoring, both distinct 0003 measurement/batch files, 0004 settings receipts and additive 0005 HTTP observations. The publisher adds no D1 schema. Original Markdown, app Worker/editorial/settings/fixture runtime, deployment configurations, shared styles and dependency lockfile are unchanged. Expanded type coverage includes both publisher test folders and the new combined test; one previously unused test import was removed without changing its assertions or runtime code.

See [combined verification evidence](review/local-mvp-combined-candidate.md), [HTTP limitations](http-worker-persistence.md) and [publisher boundaries](local-article-publication.md).

## Remaining limits and review gates

Workers native fetch still relies on platform DNS/TLS and cannot claim Node-equivalent DNS pinning/peer checks. Live official-page TLS/size/validator compatibility remains unverified; the earlier bounded manual reads failed before an upstream response. All adapter limits remain unchanged. Request/day/concurrency limits and bounded fixture stores are not monetary enforcement. No provider, live source schedule, credential, public intake, tracking or advertising is enabled.

The local publisher still does not update canonical article Markdown, the global Astro/Pagefind library or a live wiki release. Production needs authenticated event/admin workflows, source/content/license/PII checks, canonical full-site artifact generation, trusted distribution, remote release/backup/restore, cross-host coordination and currency controls. No inference or paid service is connected.

PR13's pending full documentation review and independent exact-head combined review are distinct gates. Green source CI or patch-level acceptance does not grant combined acceptance or release approval. This candidate may be published as a qualified draft under existing project publication authority; no main merge, deployment, remote migration, live cron or paid call is part of this work.

Rollback is returning code to PR10 or a recorded source head, leaving isolated test/publication stores unused. Additive HTTP tables can remain unused; preserve/export shared state before any deliberate schema rollback. Publication rollback only changes its isolated article/search state and retains history/receipts. It must not be presented as collector rollback or a live-site restore procedure.
