# Inherited reviewer fixes on the correction successor

PR28 `1cb4d1ed56e46acffe82240b9cbe6cd7df139ab3` and the first correction composition `5cafc71764ce89c215282dd68028ca8966bede3e` remain preserved. This follow-up updates PR29 with test orchestration/environment fixes while retaining the full correction workflow. [Proposal](../../openspec/changes/seo-cli-and-page-audits/proposal.md), [measured proof](seo-cli-and-page-audits.json), [correction handoff](reviewed-community-corrections.md).

## Actual SEO CLI isolation

The SEO preview had an explicit child environment that omitted `CLOUDFLARE_CF_FETCH_ENABLED`. The preview and regression now share an environment setting it to `false`. The helper also uses supported `WRANGLER_HIDE_BANNER=true` to avoid the banner's independent npm package-update lookup; it does not suppress application assertions or diagnostic errors.

The regression starts the actual pinned Wrangler CLI wrapper and CLI child, not just a Miniflare factory. Each case uses a genuinely missing metadata-cache path, separate owned config/cache/state and controlled static assets. A preload blocks external Undici dispatches while allowing loopback and records bounded categories/counts, never URLs/query strings or payloads. Both Node processes are observed; startup/response/shutdown and diagnostic sizes are bounded. The positive control omits only the metadata flag. Locally it attempts two blocked metadata GETs; the isolated preview attempts zero. Both return static HTTP 200, with no other external dispatch attempts. These are attempts stopped before external networking, not live provider calls or a whole-host firewall claim.

## Complete page coverage and browser versions

Independent review timed out inside a single 24-page/30-second aggregate axe case, without establishing an accessibility violation. The same 24 pages now have independent named tests for each existing desktop/mobile project. Axe WCAG 2 A/AA and 2.1 AA tags, empty-violations assertion, viewport check and 30-second per-test boundary are unchanged. The fixed workload is 24 pages per project, two workers for the full suite and zero retries. No CSS, public content or application runtime change is involved.

On existing Chromium 154.0.8037.57, `CI=1 npm run test:browser` passed all 68 cases; all 24 page audits completed for each project. `CI=1 npm run test:browser -- --grep 'automated accessibility and viewport' --workers=1` passed all 48 named page cases. The proof lists every completed path for both runs. Runtime version is logged and attached to each project's root-page audit. These are Chromium desktop/mobile emulation and partial automated accessibility checks, not Safari/device or full accessibility certification.

The lock pins Playwright 1.64.1 and its CI Chromium revision 1248 (156.0.8078.4). CI version/output is verified separately on the new exact head and recorded in PR29. Prior passing Chromium 156 CI does not erase the independent Chromium 154 aggregate timeout. No timeout or retry threshold was raised.

## Validation and unchanged application

Full validation passed 129 tests with zero failures/cancellations; the SEO build suite now includes the actual CLI regression. The final CLI check and staging dry run also passed. Captured application source hash is unchanged, and all 75 ordinary public build files are byte-identical before/after this test-only follow-up. All twenty article Markdown files, lockfile, correction authority/recovery and production-authentication gap remain unchanged. Retained browser/restart suites passed on that unchanged application source; new-head CI reruns the complete candidate. Its browser count becomes 101 because the two aggregate audits are replaced by 48 individually reported page cases, not because the page scope grew.

The initial correction head passed CI run 39002291534, attempt 1 (128 validation tests/55 browser cases). Current-head publication and terminal CI are in PR29; independent review remains required. Earlier socket/search/composition failures are not all declared explained. No PR/main merge, deployment, secrets, paid calls, live indexing, license or resource change occurred. Rollback this test follow-up to the preserved correction head; preserve local stores and interactive data.
