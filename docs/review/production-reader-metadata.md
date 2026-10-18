# Reader metadata preparation

Status: implementation candidate on `feat/production-reader-metadata`; independent review and release remain pending.

The reader distinguishes `verified` source-check dates from actual Git commit dates for the article Markdown file. Commit lineage is read at the build's pinned source commit, with the recorded commit hash and subject; isolated builds without usable history show unknown. This avoids substituting check/build/deploy dates for a content-change date.

The twenty entries received deep reading across external and internal review, while claim verification was sampled. The reader labels human editorial certification as pending unless a specific real review record exists. Maintenance publication, restoration, and correction receipts remain separate records and do not certify all article claims.

The article citation stays visible as text. Copy controls are enabled only when JavaScript runs; clipboard errors leave the text available for manual selection. Page titles/descriptions and social preview metadata use the page's actual content. Production History discovery is intended to follow the explicit canonical SEO mode; staging and synthetic output remain noindex.

Validation results will be recorded here after the focused checks and build. This candidate does not configure credentials, tracking, deployment, paid calls, or persistent services.
