# Charged source receipt and original body collection

This local successor of maintenance `e2116d2b8b33014d0299e59a6f1b075d342ac1d7` connects captured response bytes to the existing budgeted fake producer. Original repository articles, community-correction approvals, canonical GitHub source and the disabled release path stay separate. Corrected admin `80c6148c29a7a3013567296104653b175931662e` is preserved outside this branch.

## What is connected

`collectMaintenanceSource` is an explicit trusted-code Node coordinator. It requires `enabled: true` and a supplied `controlled-source-fixture` transport; there is no default fetch, shipped route, schedule, credential or live binding. The label describes trusted test wiring, not an authentication boundary. Callers provide a fixed registry source ID, citation ID and UUID key. They cannot select an arbitrary URL, request headers, budget or filesystem path.

The coordinator reuses `HttpObservationStore` and the existing Workers-compatible HTTP validation library. Actual local workerd/D1 charges precede transport invocation. The coordinator itself runs in Node with an injected controlled response port; this is not a shipped Workers entrypoint, native live-fetch verification or a DNS/TLS compatibility claim. Existing HTTP quotas remain twenty reserved attempts/day, four active leases, one active lease/source, three maximum attempts/job and 128 retained jobs. Collection invokes at most one attempt per key and has no retry loop; failed, ambiguous and 304-only collection keys are retained and never redispatched automatically.

The body profile is deliberately the existing producer's: nonempty original UTF-8 `text/plain`, at most 2,048 accepted bytes, without HTML/unsafe control characters. No summarizing, truncating, decoding of HTML entities or HTML-to-text transformation occurs. The shared HTTP validator still checks exact allowlisted URL, redirects, headers, validators, encoding, declared length, hash and the two-second deadline. Acceptance bounds do not promise platform/wire buffering limits. Source text is untrusted data, never executable instructions.

## Durable evidence and bounded recovery

Migration `0012_maintenance_source_collections.sql` adds one table to existing local D1. Sixteen immutable request/source/citation/root identities are retained, without eviction or refund. Each owns at most a 2-KiB final body and 2-KiB partial file, with no more than 32 body-directory entries. The private named store is under the actual Git directory; only regular bounded files are read with `O_NOFOLLOW`, and symlink/unknown entries fail closed. Writes use an exclusive partial file, fsync and a non-overwriting hard link before removing the partial. Active hostile mutation of ancestor directories by another local process is outside this trusted local-store boundary.

The ordering is reserve HTTP authority → validate/capture body → durable immutable body → durable prepared lease/result journal → fenced HTTP completion → verify actual charged receipt/hash/length → mark collection ready. A returned evidence entry identifies both the captured file and real successful original-200 receipt. The shared bridge verifier now explicitly accepts an evidence-only object; its validation behavior and existing callers are unchanged.

Prepared journals can resume before or after known HTTP completion without another fetch. The actual HTTP lease, source revision and charge must still validate. A pre-journal crash, orphan/partial body, corrupt journal, missing/tampered file, expired lease or uncertain accounting cannot be repaired by refetching or accepting caller-supplied hashes. The same key stops conservatively. No reset/retention/recovery endpoint exists; long-running unattended operation needs a reviewed archive and operator recovery policy.

A successful 304 observation records monitoring metadata but cannot produce a newly captured original body. Collection stops with `collection_304_requires_original_200`; it does not copy old bytes under a new successful-200 receipt or refresh their source date. Existing valid full-200 evidence may still be used independently within the producer's unchanged 24-hour freshness policy. General 304 revalidation provenance is a future contract.

## Reproduction and automatic publication

Use Node 24.19.0/npm 11.9.0 and existing locked dependencies:

```sh
npm run test:maintenance-sources
CI=1 PLAYWRIGHT_BROWSERS_PATH=.git/playwright npx --no-install playwright test --config playwright.maintenance-collection.config.ts
npm run maintenance:collect:status
npm run maintenance:collect:demo
npm run maintenance:collect:demo
npm run maintenance:collect:local
```

The explicit demo returns controlled original fixture bodies through the HTTP port, captures them in `maintenance-source-collection-demo/bodies`, builds evidence from those files/receipts and feeds it directly into the deterministic fake producer. The producer automatically builds an isolated full Astro/Pagefind wiki and adds human follow-up flags afterward. There is no universal human article preapproval. The second command invocation replays the same snapshot without another source/provider request. The read-only loopback preview is port 8799. Source/package changes stop stale demo pins rather than resetting budgets or silently rebasing. Automated tests use separate disposable owned store names and preserve interactive editorial data.

The native end-to-end test uses newly authored controlled paragraphs whose hashes differ from the supplied packet's body hashes. It proves the producer reads collected files rather than the previous fixture paths, serves the actual twenty-entry wiki/history/review output, and replays after D1 restart without new source or fake-provider calls. Other focused tests cover admission, MIME/UTF-8/size/unsafe data, 304, concurrency, quota/capacity, file retention, interruption, expiry, tamper, cancellation and a D1 response lost after actual HTTP completion commit.

## Remaining connections

No live source discovery/scheduler, real HTTP compatibility/normalization, source authenticity or semantic factual verifier is implemented. No real provider, tokenizer/rate card, approved numeric currency allocation, canonical GitHub maintenance writer, hosted review notification or automatic release integration is configured. These remain distinct implementation/review/setup tasks. Real spend stays zero; request and synthetic cost counters are not real currency enforcement. No remote write, deployment, secret, paid provider call, indexing, advertising or license change occurs.

Rollback reverts the collector code while retaining/exporting its ledger and body files, especially ambiguous operations. Never reset shared or interactive databases to remove this additive slice. Independent acceptance and exact-head CI remain unclaimed.
