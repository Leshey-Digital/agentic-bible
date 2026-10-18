# Review-build storage monitor correction

This successor preserves PR45 `b280d5b9ca38d4f617f6601c8c42fcb641b67466`. Independent review passed the currency dispatch correction's six probes and all thirteen currency cases, then reproduced a separate storage-monitor defect. No monetary, provider, source-authority, public UI or release code changes here.

## Concrete mechanism

The owned review-build monitor walks directories every 100 milliseconds. A live Astro cache entry can disappear after directory enumeration and before `lstat`, as happens during temporary-file renames. Previously any exception in that scan killed the child with `SIGKILL`. The catch kept the generic build-failed reason, so a valid build consumed an attempt after canonical publication and left review ingestion pending without a useful cause record.

The regression creates a real one-byte file inside the owned `.astro` directory and removes it precisely after enumeration, before the real `lstat`. It injects no error code or malformed article. The old monitor kills the child; the corrected monitor tolerates the absent enumerated descendant and the actual Astro/Pagefind build and signed review complete. An actual D1 restart/exact replay adds no provider call, Git mutation or review activation.

## Narrow tolerance and unchanged limits

Only the **live stage scan** tolerates an enumerated descendant disappearing with `ENOENT`, either at `lstat` or directory enumeration. Root checks and preflight/canonical/source scans remain strict. Other filesystem errors and directory type replacement remain fatal. Symlinks, non-regular files, present-file counts and actual sizes keep their previous guards. No broad catch converts errors into success.

The 45-second build deadline, 100-millisecond scan cadence, 64MiB stage, 192MiB store, 32MiB source repository, 8,192-file walk, three build attempts and sixteen pipeline attempts are unchanged. The first observed stop reason is latched; a later timer/exit cannot erase it or turn an observed breach into success.

Seven actual shared workerd/D1 and owned-Git cases cover benign churn and restart/replay, a sparse byte-cap breach, an existing-file-count breach, a cache symlink, a diagnostic-path symlink, a directory replaced with a file and disappearance of the stage root. Genuine hazards still kill the owned child, leave the journal at canonical/review-pending and retain one settled provider charge and one canonical mutation. No automatic retry, refund, budget reset or new charge is added.

## Bounded structural diagnostics

Each finished attempt retains at most 2KiB of structural JSON: stop category/reason, allowlisted filesystem code, child exit/signal, elapsed time and bounded stderr-byte counters. Raw messages, paths, stacks, source text, URLs and stderr bodies are not retained. Unexpected scan failures use `pipeline_review_monitor_failed`; capacity, unsafe-store and deadline reasons remain explicit.

The record lives at `build-diagnostics.json` inside the owned attempt folder. Parent directories must still be regular directories. Exclusive/no-follow creation never overwrites an existing file or follows a diagnostic symlink, and missing directories are not recreated. If safe persistence is unavailable, the bounded immutable record is attached to the returned error instead. Diagnostic-write failure cannot replace the original stop or authorize success.

## Historical evidence and separate cache finding

The old PR44 and PR45 full-run failures discarded their original scan/child diagnostics. The real disappearance schedule reproduces the same generic failure and safe pending state, but the exact historical events cannot now be assigned conclusively to this race. Earlier failed runs remain failed evidence; isolated passes do not erase them.

Investigation also reproduced an independent shared Astro content-cache rename collision. Its separate local cache-isolation checkpoint is `6b140131281a780f5e069a5c73c5b54f6f449b27`, branch `fix/review-build-cache-isolation`. It is **not included** in this monitor successor and has no independent acceptance or publication claim. Do not conflate the two reproduced defects or claim every generic build error has been eliminated.

## Reproduce and scope

`npm run test:maintenance-review-monitor` runs the seven controlled cases and writes the structured proof retained by the existing CI evidence glob. It is part of `npm run validate`. The test-only child shim waits for the monitor boundary and then executes the actual owned review script; it does not extend the production deadline or replace real Astro/Pagefind work. Final local/CI results are reported for the exact checkpoint in the handoff.

All real execution stays disabled. No credential, paid call, remote migration, article mutation, indexing, merge or deployment. Original twenty article acceptance and bytes remain intact. Rollback stops the runner and retains charges, canonical receipts, failed stages and diagnostics; never reset an uncertain operation to manufacture a fresh budget.
