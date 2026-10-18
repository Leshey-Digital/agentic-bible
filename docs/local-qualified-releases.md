# Saved-environment qualification and direct staging release

Founder decision, 2026-10-18: GitHub remains canonical source/history, while GitHub Actions is no longer the required build, test, artifact or release service. Start from merged main `fd44aeb5111145e12785a076fcc27dd323d6a193`. Automatic/manual Actions workflows are removed from executable workflow paths and retained as [historical validation](history/actions-validate.yml.txt), [historical release](history/actions-release-staging.yml.txt) and [entrypoint evidence](history/actions-release-workflow.mjs.txt). No Workers Builds integration is substituted. This replacement needs independent review before live use.

## Qualify exact source and bytes locally

Use pinned Node 24.19.0/npm 11.9.0 in the saved coding environment and `npm ci`, then `npm run release:qualify`. No cloud credential, GitHub environment, Actions variable, GitHub PAT or model/Jev key is required. The default output is a new private `.git/local-qualifications/<UUID>` directory; it never overwrites an earlier run.

The runner holds a native exclusive file lock, requires a clean exact Git source/tree before and after every command, and runs all twenty retained qualification commands sequentially: full validate, both Wrangler dry runs, every desktop/mobile browser suite, both native persistence checks, and final immutable candidate preparation. Existing application timeouts, retries, source/currency limits and assertions are unchanged. The overall local run is bounded at 45 minutes, validation at 25 minutes, other commands at five minutes, each log at 1MiB and the complete verified bundle at the existing 16MiB inventory bound. Failure stops immediately with retained logs and no successful qualification record. Failed output is never resumed/relabelled as a passing run.

Actual Node/npm/Chromium versions, source/tree, exact command order, exit status, log byte hashes and candidate digest are sealed in canonical `qualification.json` plus `qualification.sha256`. Saved Chromium 154 coverage stays distinct from historical Actions Chromium 156. Every complete asset, compiled Worker/config/runtime-manifest binding, noindex policy, twenty source article hashes and default-closed live port is still checked by the existing candidate code. Candidate bytes are not rebuilt during promotion or rollback.

An independent reviewer must inspect the exact source and qualification evidence, then provide the qualification digest, candidate digest and source commit **outside the bundle**. A checksum is integrity, not a signature or independent proof that an untrusted executor ran tests. Trust belongs to the controlled saved executor, independent review and owner-authorized operator. There is no self-approval field or skip-tests flag. Verify a retained bundle with:

```sh
npm run release:qualification:verify -- <bundle> <reviewed-qualification-digest> <reviewed-candidate-digest>
```

Keep the entire bundle, logs, controller journals and successful receipts for the agreed rollback window. These private local files are not a new hosted artifact service; loss of the workspace without a retained copy loses qualification/rollback evidence. Remote annotations can recover an ambiguous version selection but cannot recreate missing qualified bytes or independent review pins.

## Connector operator protocol

`release:execute` is disabled unless the local operator explicitly sets `RELEASE_OWNER_ENABLED=true`, `RELEASE_EXCLUSIVE_WRITER=true` and `RELEASE_CONFIRM=agentic-bible-staging`. These are local confirmations, not GitHub configuration or credentials. A reviewed bundle and three independently supplied pins are mandatory:

```sh
npm run release:execute -- <bundle> <qualification-digest> <candidate-digest> <source-SHA> <request-UUID> <expected-active-UUID-or-none> deploy
```

The saved process holds an OS `flock` across the operation; close/SIGKILL releases it without deleting stale PID files. Cloudflare Builds/manual/other deployment writers must still be excluded by the owner. The provider has no atomic global compare-and-swap; cooperating local locking and expected-version observations do not eliminate races from an external writer.

The controller emits a private pending connector request path/digest and waits up to two minutes for its bound response. Requests contain public candidate bytes or fixed-target control operations, never account credentials or asset JWTs. The trusted parent/operator validates the live process lease and request/code digest with `npm run release:bridge:request -- <request-path> <request-digest>`, reads the exact `codePath`, and calls the existing Agentic Bible connector's `execute` with account `c370be29e4065365de03bc8652da2cdc`. Revalidate immediately before execution; never service expired, dead-process or superseded requests. Write the sanitized result to the prescribed response file as `{nonce,requestDigest,result}`. Do not blindly execute requests from untrusted files or a PR; only the active independently reviewed release session is authority. No HTTP listener, new service or secret export is introduced.

Large code files can be read in bounded chunks by orchestration tools and reassembled in memory, with exact length/SHA-256 checked before calling the connector. Do not print the asset payload into chat or truncate it. The generated upload capsule rejects a payload over the connector's tested 2MiB input envelope. The prior 82-asset sizing measurement is only a feasibility reference; every real candidate is measured independently.

The upload capsule verifies the canonical candidate digest and complete SHA-256 asset/module/config pins again in the connector execution. It creates a fixed-Worker assets session, follows only validated known buckets, forwards the short-lived upload JWT through native fetch, and supplies the completion JWT to JSON version creation with `deploy:false`. Both JWTs remain entirely within that one execution and are neither returned nor logged. `_headers` and optional `_redirects` are exact `text/plain` Worker modules, excluded from the asset manifest. Provider asset IDs use the official SDK example's truncated SHA-256 of base64 content plus extension; they remain distinct from the full SHA-256 release inventory. Raw binary files, including Pagefind WASM, travel as base64 without re-encoding compiled code.

Control capsules return only structural IDs, known release markers, traffic percentages and binding names/types, omitting JWTs, binding values and arbitrary annotation text. The saved controller retains bounded duplicate-version reconciliation, the original same-UUID request marker, expected-active and one-100%-version preflight, fresh canonical-main checks before upload/activation, full served-byte/noindex/runtime verification, historical replay, and fsync/atomic journal writes. Current main is read using credential-free `git ls-remote` from the saved environment; connector-native GitHub fetch returned 403 during assessment, while that normal Git read succeeded. This is not evidence that a Cloudflare credential is invalid.

If a connector call or response is lost, stop and inspect the journal/remote state. Retry only the identical reviewed candidate/request/expected-current plan. Never service an old pending request after beginning a successor session. A delayed remote effect is uncertain, not permission for a competing release or blind rollback. Version upload has no activation effect; only the controller's separate explicit deployment request can assign 100% traffic. Local promotion is default-disabled and this implementation task makes no live upload/deployment.

Rollback uses the retained prior qualified bundle, its independently reviewed pins and successful receipt, a new request UUID and the exact current active version:

```sh
npm run release:execute -- <prior-bundle> <prior-qualification-digest> <prior-candidate-digest> <prior-source-SHA> <new-request-UUID> <expected-active-UUID> rollback <prior-receipt-path>
```

It reuses the immutable old provider version/assets, without rebuilding current main or reverting canonical Git/accounting. Receipt qualification/digest/source/target/version pins must match. Old Actions-only receipts do not silently acquire local qualification authority. Keep historical receipts; importing an old scheme requires a separately reviewed migration. The current named Worker has no deployed baseline, so no known-good live rollback target is claimed.

## Feasibility, cost and remaining live checks

Read-only assessment verified the existing named Worker and disabled workers.dev/previews. Parent feasibility checks verified native fetch Authorization override, FormData/Blob/base64/WebCrypto and intact 2MiB input. The exposed `cloudflare.request` has no JWT-header override, so only native fetch carries session authorization. No actual asset/version/deployment writes have been tested. Parent observation found zero versions/deployments and no staging custom domain; hostname attachment and live protocol/serving validation remain prerequisites outside this implementation task.

[Cloudflare's direct-upload protocol](https://developers.cloudflare.com/workers/static-assets/direct-upload/) and [official SDK example](https://github.com/cloudflare/cloudflare-typescript/blob/main/examples/workers/script-with-assets-upload.ts) support this staged approach. Account authentication remains inside the existing connector. No new token, password, GitHub environment or account security setup is requested.

[Static asset requests/storage have no additional charge](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/); API/admin paths that invoke the Worker retain normal Workers usage billing. Existing routing sends public assets directly and invokes the Worker first only for API/admin paths. Saved-environment compute and actual account entitlements/costs are not represented as free or capped. [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/) has separate monthly minutes and paid overages; it is not selected or enabled. No live model/provider call, paid build service, resource purchase, credential/security change or production deployment is part of this change.
