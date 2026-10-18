# Tasks

- [x] Read repository instructions, product decisions/specification, existing History contracts, and frontend standard.
- [x] Coordinate the shared HistoryView/catalog-v2 shape and native fixture plan with production_quality.
- [x] Render history against the compiled article inventory with per-article current state and global ordering.
- [x] Move detail pages to `/history/{articleId}/{eventId}/`, preserving the existing Tool use path.
- [x] Generalize current review flags to all article targets and actual titles/routes.
- [x] Fail closed for unknown article targets; keep details noindex and avoid new canonical discovery.
- [x] Add zero-history output test and actual two-article native Git/D1 fixture acceptance using the production_quality generalized helper.
- [x] Run focused check/build/docs tests and inspect the diff; no browser port used.
- [ ] Independent review and exact-head release qualification (pending).

No catalog/maintenance implementation changes, deployment, push, or release.
