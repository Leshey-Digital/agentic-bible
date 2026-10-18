# Hosted integration settings API boundary

This successor starts from reviewed integration contract checkpoint `b974c4c20621d7d869fc7a6cf15f4dc8bf89344a`. It adds an exact API route to the hosted Worker while preserving the existing [signed, write-only integration contract](admin-integration-contracts.md) byte-for-byte. It supplies no persistent vault, production adapter, UI, credential, identity provisioning, provider call or deployment.

`/api/admin/settings/integrations/github-content` accepts GET and POST only, on the exact existing hosted staging origin and without a query. Other methods return 405 with `Allow: GET, POST`. Wrong origins return 403; queries return 400. Trailing/sibling paths remain closed. A safe one-pass pathname decode is used only to reject aliases whose decoded path is `/api/admin/settings` or starts with `/api/admin/settings/`, including encoded API prefixes and slashes. Decoded aliases never dispatch the contract or static assets. Malformed encodings are caught without diagnostics and retain existing route behavior; ordinary encoded asset paths remain unaffected. POST JSON and all actual byte/deadline/field/authority checks remain owned by the existing contract. There is no accepted path alias or new CORS permission.

`createHostedRuntime` accepts an optional typed `Ports.integrationSettings` object containing the existing `IntegrationAdapters` interface. Only trusted server code can pass it. The route constructs and delegates to `createIntegrationSettingsContract`, which directly verifies pinned RS256 assertions with the existing verifier and enforces origin/custom-header, expiry, ownership, replay, revision, input, mask, audit and connection-budget controls. The unrelated legacy `Ports.verifyAdmin` callback cannot authorize this route. Neither local fixture `Session` nor a caller's role/boolean/cookie/header becomes hosted identity.

The shipped default entrypoint and `configuredPorts` **never construct integration adapters**. `RuntimeEnv` is unchanged. Valid `HOSTED_ADMIN_TRUST`, real/local D1 bindings, `GITHUB_CONTENT_TOKEN`, local flags, lookalike environment properties and request payloads cannot open this route: valid GET/POST requests receive `503 integration_settings_unconfigured`. The existing GitHub token transport and correction ports retain their prior behavior. There is no inference from a pre-existing token to a new vault or connection tester.

All route responses retain no-store/noindex, MIME sniffing protection, same-origin referrer policy and the hosted CSP. Successful delegated responses preserve the existing constant mask, status-only projection and value-free audit; errors contain fixed codes. No new runtime readiness claim or public configuration projection is added. Existing local analytics ID settings, denied consent, advertising and static reading/search remain unchanged.

## Controlled native verification

`npm run test:hosted-integration-settings` bundles the actual hosted Worker and runs actual local workerd using Miniflare. A separate test-only wrapper explicitly supplies disposable in-memory adapters and generated public signing trust through trusted server code; no deployment configuration references it. Its signature inputs are generated locally and no private key/assertion/secret is logged or committed. All credentials are invented disposable strings. The storage has no process persistence or encryption claim.

The native suite verifies default closure despite plausible existing configuration, exact-path/method/origin behavior, zero asset dispatch for the settings namespace and zero outbound dispatch, real signature and claim/CSRF rejection, ignored forged legacy authority, owner isolation, configure/rotate/status, stale revision/replay, strict fields/body limits and redacted connection results/exceptions. Ordinary asset cases separately confirm their existing dispatch remains available. Existing contract tests retain expiry microtask, budgets, deadline, rollback, pending reservation and stale-completion coverage; retained hosted identity/settings tests remain separate regression evidence. Native runtime tests do not establish live gateway membership, provider permissions, persistent storage or hosted readiness.

The existing delayed-reservation/rotation limitation remains: the core rejects stale completion, but a storage response delayed across rotation can still nominate the old revision to the adapter. A future trusted adapter must serialize current-revision validation with credential resolution and the start of scoped external work, refuse changed revisions and bound/abort transport. This route does not close that production-adapter requirement or enable any external work.

## Remaining setup and rollback

Persistent atomic storage, encryption/key management, durable restart/replay proofs, retention/recovery, owner transfer, provider-side key issuance/revocation, transport logging exclusion and scoped connection implementation require separate design/review and specific setup authority. Public contributions, analytics collection, account/security changes and release remain outside this change.

Rollback reverts this successor's hosted route/typed optional port/tests/docs/npm command. The prior contract remains reusable and unmounted, existing runtime routes remain available, and no production storage/resource exists to migrate. The reviewed base, article/identity/contract/measurement/configuration/release blobs, lockfile and deployment configurations are preserved. [Change proposal](../openspec/changes/hosted-integration-settings-boundary/proposal.md).

## Exact review and verification record (2026-10-18)

Independently accepted runtime/test checkpoint: `b74ff7790b652f2fa4ab0ce820d1b31832197f7f`, from base `b974c4c20621d7d869fc7a6cf15f4dc8bf89344a`. Review accepted the bounded implementation with no new actionable findings after the encoded-prefix correction: six direct probes and seven encoded namespace variants confirmed rejection without asset/adapter dispatch. Review did not claim a vault or production transport. The final evidence update changes documentation only; runtime, tests and package scripts remain identical to that accepted and tested checkpoint.

| Check at accepted runtime checkpoint | Actual result |
|---|---|
| Combined contract/native/settings/existing hosted configuration | 44/44 passed: 18 contract, 6 native workerd, 19 settings, 1 configuration |
| `npm run validate` | Passed; 301 reported passes across 26 Node test commands, with zero reported failures/cancellations; Astro check/build and twenty-article search build included |
| `npm run staging:check` and `npm run runtime:check` | Both local dry runs passed; no deployment |
| `npm run test:browser` | 74/74 passed on desktop/mobile |
| `npm run test:hosted-admin:browser` | 16/16 passed on desktop/mobile, sequentially after reading browsers |
| Browser runtime | Local Chromium `154.0.8037.57`; no claim of pinned CI Chromium 156 execution |
| Protected blobs against reviewed base | Unchanged: articles, integration contract, identity, existing configuration/settings/release source, migrations, lockfile and deployment configurations |

The original runtime `d50d7abbd0fd83ca7a372cdf713792606f5995b0` passed its initial five native cases, then review identified encoded API prefixes falling through to the static binding. The added regression reproduced that defect (four passed/one expected failure). Its initial full validation was deliberately superseded by SIGTERM to owned process group `56516` while wiki-bridge tests ran; the log explicitly records interruption and three cancelled tests, not a completed qualification result. The corrected checkpoint's complete passing validation above replaces that interrupted attempt; no unrelated failure cause is inferred.

Per-check logs, exact source pin, exit codes, durations and independent review evidence are retained locally in `.git/hosted-integration-settings-checks/`; interrupted/red evidence is separate in `.git/hosted-integration-settings-checks-d50d7ab-interrupted/`. Final documentation validation and whitespace/source-equality checks accompany the documentation-only evidence commit. No full release qualification, alternate/pinned browser run, live setup/provider call, deployment, push, PR or main change was performed. API-only scope adds no new UI/browser journey; the retained browser regressions above exercise existing behavior.
