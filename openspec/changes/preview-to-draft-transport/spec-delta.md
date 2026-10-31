# Added inspected-review draft transition

- Configured private module composition retains the immutable build preview source without replacing the proposal transport's remote source/current-main checks.
- Only an explicit click from a current displayed preview may submit its saved approval ID to the existing signed same-origin proposal endpoint. Hidden/unavailable capability never supplies credentials or enables provider ports.
- Match receipt schema, approval, article/path, base commit, resulting Markdown hash, deterministic branch, head shape and repository PR URL before displaying confirmation or a link.
- Double submission is blocked while a request is pending. Unknown outcomes remain keyed by approval across history reloads; explicit reconciliation reuses the same approval, with no automatic retry. A recorded result disables repeat creation.
- Changed selection/history/review cannot receive an older completed result. Preserve newer unsaved notes. Display conflict/unavailable/unknown states honestly; do not assert publication or remote current status.
- Existing server checks must reject stale canonical bases, foreign deterministic branches and revoked reviews without overwriting canonical content. Interrupted provider responses reconcile to one draft; recorded replay makes no provider request.
- Publication and restoration remain separate existing workflows. Controlled tests must distinguish their local acceptance from a live content release or inference.
