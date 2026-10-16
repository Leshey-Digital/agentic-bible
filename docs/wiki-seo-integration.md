# Bridge and discovery composition

This new branch combines immutable PR19 `6066255556e1c7b6ec6fbf3f17915048e5eff6bf` and PR20 `76d32e80714b5ba8040e73150cab914e4a3f8bb8` in merge `59b65589b68fb7658ca0835bee6d4575bb2b7b53`, with those exact parents. PR18 `bf99ccc9bb8e5f3919de19fafd4461ab244bc63c` and PR17 `6f6fbd69bdaab9107f0eb88955d8da8bd1f3450d` remain ancestors. No existing branch head is rewritten. Source CI [PR19](https://github.com/Leshey-Digital/agentic-bible/actions/runs/38972601869) and [PR20](https://github.com/Leshey-Digital/agentic-bible/actions/runs/38973089751) passed every step. Independent reviews are in progress; source acceptance and composition acceptance remain separate. The user authorized preparing this qualified composition draft while those reviews proceed, with reviewer findings prioritized.

## Production selector and synthetic boundaries

Only `AGENTIC_BIBLE_DISCOVERY_MODE=production` with `AGENTIC_BIBLE_CANONICAL_ORIGIN=https://agenticbible.si` enables canonical production output. The output manifest calls this artifact kind `canonical`; that label does not prove a release or indexing. The old PR20 environment selector `canonical`, the www origin and arbitrary hosts now reject. Default builds remain staging at `https://staging.agenticbible.si`, globally noindex, empty candidate manifest and no sitemap. Production origin is now specified by the user; ownership, release setup and actual deployment are still unexercised.

`AGENTIC_BIBLE_LOCAL_WIKI_BUILD=1` always forces synthetic/noindex output. The bridge's private child uses that flag and does not inherit production discovery settings. Supplied demonstration articles have no public canonical/Article structured data, no sitemap entry and no indexing candidate. Entire synthetic snapshots have no sitemap and an empty candidate manifest. Private/admin/search/contribution/history/snapshot/data routes remain excluded/nonindexable; robots crawling permission does not replace authentication. Staging commands reject non-staging artifacts.

The complete supplied revision is still bound to actual successful charged local D1 source receipts. The reviewed source fixes preserve literal URL-shaped history, own and conservatively account crash captures, and isolate every build cwd/output. Local canonical reading paths, article/history/citations/flags and real Pagefind activate/replay/roll back together; integrity is not factual/source-authenticity proof. Production sitemap checks exercise the original eligible public articles, while supplied synthetic revisions remain excluded. No synthetic fixture is relabeled as production content merely to obtain positive sitemap output.

Indexing defaults disabled. Candidate metadata is separate from activation/distribution. No live provider transport, account, ownership key, credential, schedule or submission is configured. Provider acknowledgments never prove indexing. The additive SQL outbox and its existing bounded replay/uncertain-retry rules remain; no fixture observation is converted into a trusted public release.

## Reproduce

Use pinned Node/npm and dependencies, then run:

```sh
npm run validate
npm run test:wiki-seo:browser
npm run test:wiki-bridge:browser
npm run test:combined:browser
npm run test:publication:browser
npm run test:editorial:browser -- --workers=1 --timeout=90000
npm run test:integration:browser -- --workers=1 --timeout=90000
npm run test:browser -- --workers=1 --timeout=90000
npm run test:monitoring:worker
npm run test:settings:worker
npm run staging:check
```

Run browser/restart suites sequentially. Validate retains all source tests and generates isolated actual production/staging/synthetic/mixed outputs, including a private production sitemap/manifest proof used by the new composition journey. The new browser command explicitly sets the parent process to production mode; child-generated synthetic wiki artifacts must still stay noindex/out of sitemap/outbox. It uses its own `wiki-bridge-test-seo-composition` and `wiki-observations-test-seo-composition` stores in the actual Git directory. Original Markdown, ordinary dist during bridge operations and interactive state are inventoried/preserved. Nothing deploys or submits a URL.

See [composition evidence](review/wiki-seo-integration.md), [bridge review fixes](review/wiki-history-recovery.md) and [SEO contracts](canonical-seo-indexing.md). Earlier branch evidence is historical; this composition makes no independent acceptance claim. Rollback is returning code to a recorded source head and leaving private stores/additive tables unused with receipts retained. Local wiki rollback remains distinct from source-charge rollback or a production restore.

Release gaps remain: independent source/composition acceptance, licensed publishable content/contributor terms, production identity, authentic/factual evidence checks and generation, trusted activation/distribution-to-outbox integration, provider ownership/support setup, remote restore, actual indexing/visibility measurement and currency enforcement. No main merge, deployment, paid/provider/model call, credential, live cron/indexing, tracking/ad or license selection occurs.
