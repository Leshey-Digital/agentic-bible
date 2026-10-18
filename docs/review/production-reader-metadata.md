# Reader metadata preparation

Status: implementation candidate on `feat/production-reader-metadata`; implementation checkpoint `9346d24e395cf7e5553c505cdb85c833733ecc1f`; independent review and release remain pending. The branch preserves the parent reader work and normally merges the shared metadata hook plus its corrective same-origin image validator from `prep/production-foundation-20261018`.

The reader distinguishes `verified` source-check dates from actual Git commit dates for the article Markdown file. Commit lineage is read at the build's pinned source commit, with the recorded commit hash and subject; isolated builds without usable history show unknown. This avoids substituting check/build/deploy dates for a content-change date.

The twenty entries received deep reading across external and internal review, while claim verification was sampled. The reader labels human editorial certification as pending unless a specific real review record exists. Maintenance publication, restoration, and correction receipts remain separate records and do not certify all article claims.

The article citation stays visible as text. Copy controls are enabled only when JavaScript runs; clipboard errors leave the text available for manual selection. Page titles/descriptions and social preview metadata use the page's actual content. Production History is canonical, indexable, and in the sitemap only under explicit production mode. Staging and synthetic History output is noindex and has no canonical or social URL. Nested History routes remain noindex.

Validation on the exact final code head: `npm run check` passed (161 files, 0 diagnostics); `npm run build` passed and indexed all 20 articles; `npm run test:docs` passed (312 Markdown files, 375 local links); `npm run test:seo` passed (8 tests); `npm run test:seo:build` passed (production, staging, synthetic and mixed build/served probes); `node --test tests/reader-metadata/revision.test.mjs` passed (2 tests); `node --test tests/social-metadata/image.test.mjs` passed (1 test); and `npm run test:browser -- tests/browser/metadata-readiness.spec.ts` passed (4 desktop/mobile cases). Browser coverage includes successful and denied clipboard writes, keyboard activation, visible no-JavaScript citation text, narrow/mobile overflow, and page-specific preview metadata.

The full `npm run validate`, the entire browser suite, `staging:check`, CI, publication, and deployment were not run. This candidate does not configure credentials, tracking, deployment, paid calls, or persistent services.
