# Independent continuation — stopped on failure

Exact source `912c75fddc54f223f5d2997596b9cc224ad4b830`, tree `3dabf8729636ccec3a85b0f162e7d2f6cbfd4f3e`, clean before/after; recovery ancestry retained. No application/test patches, deployment, cloud writes, credential or security changes.

Original run remains failed. Its 17 completed steps are historical evidence only. The durable original list and four published evidence hashes from `f640cc7ee3fb278502816e0a2b0c844095bebe0c` were verified separately without checking out that evidence commit.

Independent hosted command: `node --test --test-concurrency=1 tests/hosted/*.test.mjs`. Passed 19/19, no cancellations, 15.37 seconds. Assertions/test deadlines unchanged.

First of 41 remaining commands: `npm run test:release`. Failed after 33.89 seconds: 40 passed, 1 failed, no cancellations. Failure: `tests/release/legacy-baseline.test.mjs:60`, fixture build raised `ENOTEMPTY` removing `.git/release-git-fixture-g9Gw6g/node_modules/.vite/deps`. The failed fixture and six peer fixtures symlink the same repository node_modules. Default file concurrency allows their builds to overlap; no Vite cache override exists. Shared-cache interference is supported, but the exact competing writer was not traced. No rerun, source patch, journal reset, or assertion/deadline change was made. The remaining 40 commands were not started.

Every owned command ran beneath the existing Python subreaper supervisor; receipts were written/fsynced immediately after completion. The supervisor completed process-group cleanup and adopted-child reaping. The two aggregate observations in this clean environment both had 14 processes and 2 zombies; the first was after setup, so these are not a proven pre-run baseline. No original environment or denied original process inspection was accessed.

The frozen module manifest hash matches `bb6663fabb4254766eec456d76dcc8833e68f3eda0e08c0814de56cc2b4fe7eb`. Frozen package bytes were not available. The prerequisite ordinary build matches 55/80 static module-source hashes, differs or is missing on 25, and is not the frozen package. No byte-identity claim or successful qualification receipt is made.

Setup used Node 24.19.0/npm 11.9.0 and locked dependencies; Chromium is 154.0.8037.57. The first dependency install omitted configured proxy variables and encountered DNS failures; it was stopped with its record retained. Setup then succeeded using the existing environment/registry. The required ordinary build passed separately as prerequisite evidence, not a replacement for any historical step.

See terminal-summary.json, per-command JSON/logs, release-failure-diagnosis.json, reconstructed-static-comparison.json and original/ for complete evidence. No further test execution is pending.
