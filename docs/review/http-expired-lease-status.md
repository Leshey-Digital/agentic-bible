# HTTP expired-lease status correction

This focused branch starts directly from unchanged PR12 `b78751b4f4db09fcce4289052f7e163ac4be9c5b`. PR13 `d57e975253ba6d9ba3e48a2292611cfca14aa118` and the original publication/integration heads are preserved. The final exact fix commit is recorded in the draft PR/handoff and available with `git log -1 --format=%H`.

## Demonstrated defect and correction

A crashed HTTP attempt can leave a running job after its lease expires. Claim correctly abandons its reservation but cannot reserve another attempt if the daily count is already twenty. The old status response checked only the state label and returned busy/http_in_progress despite zero active leases. The new actual workerd/D1 regression failed against unchanged PR12 with actual busy versus expected blocked at the exact expiry boundary.

Status now requires a running lease whose expiry is strictly later than the trusted current time. The durable service passes its existing trusted clock to status reads; direct store callers retain a Date.now default with the existing safe-clock validation. Expired jobs that cannot be claimed report the existing blocked/http_not_due_or_budget response. Claim/completion SQL, reservations, budget values, retries, receipts, last-good state, URLs, deadlines, concurrency and storage bounds are unchanged. This status response does not promise admission or schedule a retry.

Only the local test entry accepts a deterministic test clock. That entry remains absent from app/deployment configuration. No new application endpoint or caller-controlled production clock exists.

## Actual Worker/D1 regression

The separate disposable `.git/http-status-worker-state` uses the real HTTP migration and native Worker service with controlled outbound responses:

- Reserve attempt one without dispatch, exhaust the synthetic daily counter, and observe busy immediately before the ten-second lease boundary with unchanged accounting.
- At exact expiry, report blocked, count zero active leases and abandon the original reservation without an extra fetch/reservation. Failed/interrupted byte counts remain NULL.
- Restart real workerd/D1 and repeat at expiry, just afterward and one millisecond before UTC-day rollover; daily used remains twenty, reservation count one, fetch count zero and last-good metadata unchanged.
- Explicit invocation exactly at the new UTC day reserves attempt two once. Its controlled 503 records the existing two-second backoff and failed reservation, retaining the previous day's abandoned charge.
- Restart and invoke before the due time; replay the original retry receipt with no extra fetch/reservation. At the exact due time, attempt three succeeds once; restart and replay success without dispatch. Total reservations three, outcomes abandoned/failed/succeeded, next-day used two and total fetches two.

The test does not sleep through real lease/day/backoff boundaries; the trusted clock is deterministic while persistence/restart/native service and outbound interception are real.

## Local validation and publication scope

- Red regression on unchanged PR12: reproduced busy/blocked mismatch.
- Green focused Worker/D1 regression: passed, then passed again inside full validate with the exact active-lease assertion.
- `npm run validate`: passed zero diagnostics in 61 files, docs/build/Pagefind and **73 tests**: 4 static, 9 editorial, 23 monitoring, 19 settings, 3 populated upgrades, 13 Node HTTP and 2 actual Worker/D1 tests (new focused case plus original comprehensive restart/fault/concurrency/capacity suite).
- `npm run staging:check`: passed, 53 static assets, no bindings, no deployment.
- Reading/browser/accessibility and final docs/whitespace/privacy inspection are recorded in the draft PR handoff after completion. Existing editorial/integration browser and legacy Worker restart suites are unchanged and run in exact-head CI; they are not claimed as separately rerun locally here.

Synthetic red/green/validate/dry-run/reading logs are local and ignored; they are not committed or uploaded as source content. Only code, tests and project contract/OpenSpec/evidence documentation belong in the draft. This file is the local pre-publication checkpoint; subsequent authorized push/PR and CI results are recorded in PR metadata rather than claimed in advance.

No remote resource, migration, schedule, secret, paid call, article publication or deployment changes. This remains a disconnected local callable HTTP library. Fixed-host native Workers DNS/TLS trust differs from Node address pinning; live source compatibility remains unverified. Request/storage bounds do not enforce monetary spending or the $10 target. Production identity, public intake and secure integration setup are not implemented by this correction.

Rollback reverts this focused commit. No schema/data migration or cloud rollback is needed; preserve shared/interactive D1 state and all existing charges/receipts. No store is reset except the explicitly disposable test directory. Independent exact-head integration review remains necessary; no merge/release approval is implied.
