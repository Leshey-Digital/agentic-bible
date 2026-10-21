# Private disposition and tag history

The editorial inbox now provides a paginated timeline of recorded disposition/tag snapshots. Previously the detail screen silently showed only the latest thirty audit rows and omitted their tags. Editors can now load older events, distinguish recent from complete history, and reload after errors. Successful disposition/tag and reviewed-note saves refresh the timeline; audit errors do not undo or mislabel a confirmed save.

The new signed-admin GET `/api/admin/submissions/:id/audit` endpoint returns at most thirty events with a timestamp/ID cursor. It uses the existing submission/time/ID index, parameter-bound exact submission scope and deterministic ordering. It never mutates data or contacts providers. This new projection omits stored actor identity identifiers; the legacy detail endpoint and its audit projection are unchanged for compatibility. No audit event is invented, rewritten or deleted.

This is the roadmap's revision/audit-history capability, built on the qualified inbox triage checkpoint 6a7abd9. No schema, capacity, credentials, security settings, costs or runtime deployment change. PR56 and its prepared release remain frozen; the earlier live acceptance note and audit remain untouched. Article publication and GitHub draft behavior are unchanged.

Rollback removes the optional endpoint/controls and returns to the retained detail history. Existing data remains compatible. Local disposable Worker/D1/browser tests do not establish deployed or real-editor acceptance.

## Qualification

The combined new audit and retained inbox-triage suite passed 6/6. The final expanded audit suite passed 3/3, exercising all 64 events (63 share a timestamp) in 30/30/4 pages and a held older response after a confirmed save and failed refresh at 390/1280px. Existing assertions/deadlines were not weakened. Astro checked 198 files with zero errors/warnings/hints; documentation and whitespace checks passed. Independent source/test inspection accepted the implementation; reviewer did not independently execute tests. Full release qualification and live acceptance were not run.
