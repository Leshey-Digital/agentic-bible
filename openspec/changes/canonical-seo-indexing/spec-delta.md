# Discovery requirements

- Explicit canonical build origin, HTTPS and fixed project domain only; no implicit production selection. Fail invalid modes/origins. Default staging and local synthetic builds remain noindex.
- Exact public article route canonicals, sitemap from actual eligible collection entries and metadata-only Article structured data. Do not invent authors, publication/modification timestamps or images from source-check dates. Exclude synthetic and private routes from discovery artifacts.
- robots.txt crawl policy, per-page noindex and response headers remain distinct controls; robots is not an authentication boundary. Preserve private Worker no-store/noindex and staging security headers.
- Deterministic bounded URL/revision manifest feeds an idempotent durable SQL outbox. Disabled/missing/unsupported configuration makes zero submissions and no queue effects. Explicit capability-gated processing has bounded reservations, attempts and immutable accepted acknowledgments; no automatic retry after uncertain outcome.
- Verify canonical/staging/synthetic builds, private URL exclusion, structured-data escaping, actual SQL persistence/concurrency/replay/failure, existing reading/editorial/bridge regressions and no external submissions.
