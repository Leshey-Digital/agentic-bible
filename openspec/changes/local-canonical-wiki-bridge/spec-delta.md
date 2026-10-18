# Added bridge requirements

- Only tool-use, complete supplied-local-fixture revisions, exact original Markdown hash, expected publisher reference/base revision and expected site parent. No silent retry rebase.
- 2–3 regular original source files, at most 32 KiB each; strict envelope and aggregate bounds. Every citation maps to an exact fixed allowlisted ID/URL and successful non-304 receipt/reservation with matching byte/hash evidence. Failed/missing/unaccounted records reject before publication.
- Preserve D1 receipts/charges read-only. Durable journal and immutable publisher/site pins support restart and explicit article-accepted/site-pending state. Atomic full-site pointer commits only validated inventory; no sealed orphan is served.
- Full Astro canonical tool-use/navigation/topics/catalog plus pinned history/flags and Pagefind activate/rollback together in an isolated local snapshot. Other articles remain. Preserve accepted keys/history and original Markdown/dist/interactive data.
- Test rejection, zero bridge source fetches, actual process death, replay, expected-parent conflicts and rollback. Local synthetic integrity only, not factual/authenticity verification or live deployment.
