# Canonical discovery and offline indexing outbox

This separate branch starts from immutable PR17 `6f6fbd69bdaab9107f0eb88955d8da8bd1f3450d`. Its [CI run](https://github.com/Leshey-Digital/agentic-bible/actions/runs/38968747632) passed every step; independent review subsequently requested history/capture fixes. The SEO task exposed a build-isolation defect addressed first in [PR18](https://github.com/Leshey-Digital/agentic-bible/pull/18), then review findings were prioritized in [PR19](https://github.com/Leshey-Digital/agentic-bible/pull/19). This independent SEO delta preserves those heads; their acceptance/composition is required before release. It does not declare PR17 accepted or silently absorb the fixes.

## Build policy

Default `npm run build` remains staging: origin `https://staging.agenticbible.si`, noindex/nofollow in HTML and global asset headers, no sitemap, empty indexing manifest. Public reading routes use staging self-canonicals. Search, contribution, admin/API, error, history/review, snapshots and fixture paths receive no public canonical, sitemap entry or structured data. Existing private Worker no-store/noindex and access controls remain unchanged.

On the combined successor, canonical output requires **both** `AGENTIC_BIBLE_DISCOVERY_MODE=production` and `AGENTIC_BIBLE_CANONICAL_ORIGIN=https://agenticbible.si`, as specified by the user. The old PR20 `canonical` selector and www origin now reject, as do paths, ports, credentials, query strings, staging origins and arbitrary hosts. The artifact manifest still names eligible production output `canonical`. Ownership, deployment and release prerequisites remain unexercised. `AGENTIC_BIBLE_LOCAL_WIKI_BUILD=1` always overrides production mode with a synthetic/noindex build. The independently preserved PR20 contract describes its earlier two-origin proposal; [composition](wiki-seo-integration.md) records this refinement.

Canonical builds produce exact slash-normalized article self-canonicals, index/follow metadata on known public pages, a sitemap covering eligible articles and the six library/about/topic pages, and accurate Article (`TechArticle`) JSON-LD. Structured data uses visible title, description, topic and cited source URLs. It invents no author identity, publisher, image, license, publication/modification date or review approval. The existing `verified` field is a source-check date, not `dateModified`. JSON-LD escapes markup delimiters and cannot close its inert script element. The original article files remain unchanged.

The public article collection drives both sitemap eligibility and `indexing-manifest.json`. Local supplied-publication metadata, demonstration authors/statuses, unknown article IDs and synthetic builds are excluded. A canonical build containing a synthetic article leaves that article noindex and omits its canonical, structured data, sitemap entry and indexing entry. Current manifest revisions hash the actual body and metadata. The manifest contains only eligible canonical article URLs and content hashes; no private data or credentials.

`robots.txt` permits crawling so engines can read noindex. It names the sitemap only in canonical mode. Crawl permission, index permission and authentication are distinct: robots/noindex do not protect confidential data. Private routes retain authentication/noindex independently. Google warns that robots disallow can prevent an engine from seeing noindex; this replaces the old contradictory blanket staging disallow plus noindex pattern. Canonical `_headers` retain security policy and set noindex on private/search/contribution/error/history/snapshot/fixture/data routes, while public canonical pages have no blanket noindex header. `staging:check` and `staging:local` refuse canonical/synthetic discovery artifacts before Wrangler runs.

## Disabled outbox

Additive migration `0006_indexing_outbox.sql` uses the existing SQL/D1 abstraction; no new service, binding or remote database is created. It adds bounded enqueue receipts and notifications. No existing fixture/source/publication table is reused as proof of a canonical release. The build writes only a candidate manifest; it does not enqueue or submit on page views, builds, publication or a schedule.

`enqueueIndexing(db, manifest, eventKey, config)` defaults to disabled and has zero SQL/provider effects when disabled or unconfigured. Explicit configuration must name IndexNow, the exact canonical origin and an ownership-verification declaration. Staging/synthetic/empty manifests and unsupported providers are ineligible. The declaration is not an ownership proof. Actual ownership verification and supported provider integration remain release setup work. Google Indexing API is not supported for these encyclopedia articles.

The operator supplies an activation/event key: exact replay returns the original receipt/notification IDs; changed reuse conflicts. Different activation keys can notify the same content after a later rollback. Receipts and up to three associated article notifications commit in one D1 batch; concurrent replay deduplicates. Capacity is 32 lifetime events/96 notifications with no automatic eviction of accepted keys. This is a local capacity bound, not a currency cap or an assertion that candidate URLs are deployed.

`deliverIndexing` also defaults to disabled and requires an injected, matching IndexNow capability with explicit article-update support and ownership declaration. **No live HTTP provider transport is registered or shipped**, and the CLI has no delivery action. Controlled tests inject a callback; no external submission is made. A future reviewed integration must verify ownership/support and honor cancellation. Atomic claims prevent concurrent senders from claiming the same pending notification. An adapter gets a stable notification ID and a two-second AbortSignal deadline. Accepted 200/202 acknowledgments are retained and replay without sending again; `indexed` remains `unknown`. A 202 does not prove key validation. Neither acknowledgment proves crawling or indexing.

Thrown/timeout/storage-uncertain outcomes remain uncertain/inflight and never automatically redispatch. Restart retains this state. Explicit retry requires the current attempt number after the operator has stopped the previous sender; it is capped at three attempts and can deliver at least once after uncertainty. It cannot promise exactly-once HTTP delivery. Late responses cannot replace a newer attempt's token. There is no live cron, paid call, credential field, account setup or provider connection.

## Reproduce

```sh
npm run validate
npm run test:browser
npm run test:wiki-bridge:browser
npm run staging:check
npm run indexing:queue
npm run indexing:status
```

The last two commands report disabled and create no outbox. `test:seo:build` builds canonical, staging, synthetic and mixed-content outputs in private temporary projects without altering normal dist; it is included in validate. `test:seo` exercises policy/schema and actual native workerd/D1 outbox migration, atomicity, concurrency, restarts, faults, deadlines and capacity using controlled callbacks. Browser suites run sequentially. No canonical artifact is deployed or submitted.

For explicit **offline-only** candidate queue inspection, `indexing:queue` accepts `--enable-offline-queue --manifest <bounded-file> --event <activation-key> --origin <explicit-project-origin> --ownership-verified`. `indexing:status -- --enable-offline-queue` inspects its owned actual-Git-directory SQLite store `indexing-outbox-local`. It never reads/writes interactive D1 state, stores an ownership key or submits URLs. No pending notification implies a URL was deployed or indexed.

## Primary guidance checked

- [Google canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) and [sitemap construction](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap): canonical public URLs, coherent signals; submission is not an indexing guarantee.
- [Google noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing): crawlers need access to observe the rule.
- [Google Article markup](https://developers.google.com/search/docs/appearance/structured-data/article) and [Schema.org TechArticle](https://schema.org/TechArticle): only applicable truthful fields; no invented author/date/image. Local syntax/schema tests do not certify rich-result eligibility.
- [IndexNow protocol](https://www.indexnow.org/documentation): supported engines, ownership/key setup and receipt semantics. No claim that IndexNow submits to Google.
- [Google Indexing API eligibility](https://developers.google.com/search/apis/indexing-api/v3/quickstart): job postings or eligible livestream video, not ordinary wiki articles.

Production origin/ownership, licensed publishable content, trusted activation-to-outbox wiring, provider/key setup, remote distribution, authenticated operations, quotas/retention/alerts and actual indexing/visibility measurement remain gaps. This draft adds no live analytics, advertising, accounts, credentials, deployment or license choice. Code rollback is returning to PR17 and leaving additive outbox tables/private offline stores unused, retaining accepted receipts. [Verification evidence](review/canonical-seo-indexing.md) records exact results and review status.
