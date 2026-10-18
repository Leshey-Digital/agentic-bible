# Proposed delta

- `/history/`, `/history/tool-use/<event>/` and `/review/` are static, noindex and outside discovery/search. History is newest first, attributes the maintenance bot, retains writer commit/revision/source hashes and distinguishes technical integrity from factual approval.
- Per-revision pages compare body text with labelled added/removed/context lines and escaped complete Markdown. They remain usable without JavaScript, on narrow screens, by keyboard and with reduced motion.
- Explicit controlled history builds use pinned Git authority; ordinary builds do not invent revisions. Synthetic child publisher snapshots retain their existing history materialization.
- Authenticated `/admin/maintenance/` and `/api/admin/maintenance/review` use signed admin assertions, exact origin/CSRF/request marker, bounded JSON and no-store/noindex/CSP headers. Missing identity, D1 or compiled catalog authority leaves mutation closed.
- Runtime catalog bytes must match their Worker-compiled hash. A new decision must pin the current receipt/catalog and exact audit version. Atomic single-row D1 admission rejects stale/concurrent losers and total/per-receipt capacity exhaustion.
- Exact request replay requires the original owner and input; restart and a newer build return the original result without a second audit or article write. Historical decisions remain visible but cannot authorize new actions on an old receipt. Corrupt audit rows stop reads/replays.
- Decisions `reviewed`, `follow-up` and `revert-requested` are append-only human follow-up. They do not gate valid automatic publication, remove original flags or certify factual correctness. Notes/reviewer references stay behind authenticated APIs.
- Revert requests require a retained earlier writer receipt. The current implementation explicitly reports `canonicalRevertSupported:false` and `articleChanged:false`; a real revert, notification delivery and production authority are not implemented.
