# Production recovery evidence — 20 October 2026

This branch preserves existing operational work from source main 8a38252384c6fe6024a75b462ad95294a131100c. It does not merge or activate a release. Files copied here retain their original bytes. Original private files remain in the original executor. Scripts retain original `.git/production-launch` and `.git/production-module-release` working paths; this is an archival snapshot, not a newly integrated release controller. Do not execute upload scripts as a recovery check.

## Exact artifact

Module candidate SHA-256: 985cb80ecc4b413aae39f6ad560e896d2cdd704badfdc8a9eaa2144de36e789a.
Upload capsule SHA-256: cbe226a41d0f99e7fcfae9fd9ce39d6103236be6a07b6421b4f9f68d8f8c35a0.
Frozen source-content candidate SHA-256: 765e1b85eadd8c744839e1288ad720129685aa68b6a696e4102ee87b6eab1fb1.
82 original frozen files = 81 public files plus `_headers`. The 81 public files are byte-identical data modules. `_headers` is parsed into equivalent header rules in worker.js, not publicly served. The resulting version has 82 modules: 81 data modules and worker.js. Uncompressed module size 1,324,414 bytes; concatenated gzip size 438,830 bytes. Capsule size 783,435 bytes. Full original and module manifests are included.

## Resolved pending upload

Distinct module operation febe70aa-4040-476e-9b13-f7a554599e3e returned HTTP 200 on the original pending call; no duplicate submission. Version 28c2c556-ab43-482a-98e7-7d2aa8d6965c was created at 2026-10-20T16:31:40.456192Z, startup time 3 ms, cpu_ms 10, deploy:false. Upload-result.json is the original sanitized response. The original operation.json retains its historical pending marker unchanged; this receipt resolves it. Platform approval-delivery internals are unavailable. The user reported approving; successful provider execution is established.

Read-only provider reconciliation after completion confirmed zero production deployments, no attached domains, deployed_on null, and workers.dev/previews disabled. Parent independently confirmed the version and candidate annotation. No activation followed.

## Retained qualification and failures

Native corrected parity 4/4; production browser equivalents 4/4; corrected-localhost network browser checks 2/2; upload-capsule mocks 2/2; Wrangler dry-run passed. Independent bounded source review is preserved. Historical parity failure used a nonexistent .wasm path; actual binary is wasm.en.pagefind. Historical browser network checks hardcoded port8787 while this runtime used8790. Original logs remain. Two final-six-topic browser journeys hit the overall 30-second test deadline at different late steps. Their trace files remain private locally; no raw traces or browser storage are published here. Focused unchanged rerun results are recorded separately.

## Forensic boundaries and remaining constraints

No new implementation/test changes, upload, activation, credentials, paid AI, public submissions, or canonical writes are authorized during the current forensic freeze. Existing code/tests are preserved without modification. The uploaded version is not a live production site.

Cloudflare account-subscription read returned HTTP403 code10000: OAuth cannot access this billing endpoint, which requires Billing Read or Write token permission. No credential or permission expansion was performed. Actual subscription/allowance is therefore unverified. Script usage_model fields are not billing-plan proof. Module-served requests invoke Workers; cpu_ms10 is a per-request limit, not a monthly spend cap. The documented $10 operating target is not enforceable as a hard cap here. No plan/payment/upgrade change was made.

Push-trigger preflight: tracked branch has no executable GitHub Actions workflows; Cloudflare shows no build triggers for Agentic Bible production/staging, no account Pages projects, and other Workers' build triggers reference other repositories. GitHub hook/workflow API reads were Forbidden, so unrelated third-party repository hooks could not be independently excluded. No detected deploy-on-push path exists for this recovery branch.

First-deployment rollback: there is no previously active production version to roll back to. Before public attachment, record the empty domain/route state. If first publication must be withdrawn, remove only the new production custom-domain attachment to restore the prior unpublished exposure, preserving Worker/version and staging. This requires the exact domain ID observed when attaching; no guessed deletion. For later releases, retain this version and use Cloudflare native version deployment rollback. No rollback or domain mutation is performed by this archive.

## Sanitization

Only known public frozen assets, existing source/config/tests, sanitized logs/journals, and bounded review evidence are included. No environment files, runtime cache, browser trace archive, token value, credential, or new credential is included. Session diagnostic metadata contains only safe claim shapes/timestamps and a provider trace ID, not the token. Source code references runtime credentials symbolically. Pattern scan for private keys, GitHub tokens, JWT values, and literal bearer credentials found no matches. preserved-file-hashes.json records exact copied-file digests.
