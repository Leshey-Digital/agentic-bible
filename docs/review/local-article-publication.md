# Local article publication checkpoint

Based on accepted PR10 **`d0bfca47cd221b970b01ace838afb3f3bb9a5d32`** on separate branch `feat/local-article-publication`. [Pinned PR10 independent acceptance](pr10-integration-independent.md) and [row-hash evidence](pr10-integration-independent.json) are preserved durably. This is a tested local implementation checkpoint awaiting independent review, not production or release acceptance. No branch push, new PR, merge or deployment is included in this handoff.

## Actual result

The supplied original fixture becomes real escaped wiki-style HTML with citations and connected reading, a real Pagefind index, readable immutable prior text, post-publication flags and a deterministic reversible snapshot manifest. The CLI demo publishes two revisions automatically. Repeating it left the status bytes, active snapshot and sequence unchanged. Quality concerns do not preapprove or block technically valid articles. Malformed/unsafe content is rejected with explicit codes.

The actual demo's [manifest](local-publication-manifest.json) records release `a2f7019847195bd867910e4dc0b0e5b6379f7e595b153d14af7ebb0e708f1e98`, manifest SHA-256 `3d1058ce168552a26550a0219c94728dd9a8e0190629a274beb2e5a0315e01b8`, two operations and two retained content revisions. Runtime files remain isolated in the Git-directory `article-publication` store. [Desktop](local-publication-desktop.png) and [mobile](local-publication-mobile.png) screenshots show actual retained-revision HTML, not a mock. Mobile screenshot was visually inspected.

## Checks executed

- Full `npm run validate` passed: documentation links, zero diagnostics in 57 files, Astro/Pagefind build, 4 static + 9 editorial server + 23 monitoring + 19 settings + 3 migration-upgrade checks and the initial 10 publication tests.
- After adding the historical crosslink/rollback case, `npm run test:publication` passed all **11** tests. Coverage includes strict schema/citations/crosslinks/URL/HTML rejection and escaping, automatic quality flags, byte-identical independent manifests, event replay/conflict, stale bases, rollback and empty rollback, tampering, concurrency, capacity with a reserved terminal rollback, original Markdown preservation and read-only/Host/path boundaries.
- All interruption phases passed. Separate actual child processes were killed with SIGKILL after rendering, after sealing and after activation. OS mutex recovery and same-event retries preserved or confirmed exactly one complete publication; previously committed text remained readable.
- `npm run test:publication:browser` passed the real HTML/Pagefind/history/flags/rollback journey, including exact old/new token queries, old pinned snapshot consistency, citation and baseline crosslinks, empty restored search, mobile/desktop axe and overflow, no outside requests and no runtime errors.
- Existing actual Worker/D1 browser suite: **22 passed**. Full combined integration journey: **one passed**. Existing reading/search suite with one worker/90-second local bound: **16 passed**. Existing Worker restart harnesses were not rerun for this feature; their accepted PR10 evidence is recorded separately, and their runtime/migrations are byte-unchanged here.
- `npm run staging:check` passed: **53 assets, no bindings**, dry run only. A build scan found no fixture article/token/event IDs, publication Node modules or SQLite module marker in `dist`.
- CLI demo plus identical replay passed; status bytes remained identical at sequence two. Documentation/whitespace checks passed before commit.

Initial verification caught changing WASM bytes when using the Pagefind filesystem writer; pre-activation hash checks rejected those artifacts and preserved the prior snapshot. The builder now copies the complete `getFiles()` byte arrays into owned files before sealing. Initial browser attempts exposed Pagefind's metadata cache-bust request and subpath result prefix; both were corrected. Exact-content assertions use quoted terms because partial-word results can match a replacement article without the old token being present. Final unit and browser checks above passed without changing original reading content.

## Precise boundary and next step

See [contracts and operator steps](../local-article-publication.md). New publication stops before the final operation slot and reserves an artifact budget for terminal rollback; accepted event keys/history are never evicted. Limits remain a bounded local fixture design, not a production retention, currency cap or backup policy. Manifests detect corruption; they do not authenticate a hostile filesystem owner.

Monitoring transport/runner/store/routes, D1 migrations, original Markdown articles, shared styles, dependency lockfile and deployment bindings/configs match PR10 exactly. No source-monitoring HTTP-adapter file was edited. No real identity, credential, live cron, generation, provider request, paid call or public intake was enabled.

The remaining production gap is the trusted event/content outbox adapter into this Node publisher, authenticated admin flag dispositions, factual/source/license/PII validation, canonical whole-library HTML/search build integration, authorized artifact distribution/remote atomic release and restore, cross-host locking and numeric budget enforcement. Current monitoring still changes its metadata ledger; the separate local collection is not a canonical article release. Report this local tested commit for independent exact-head review before publishing a new PR.
