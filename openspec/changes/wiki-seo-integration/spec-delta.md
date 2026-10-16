# Composition requirements

- Preserve exact reviewed source heads as ancestors. Record their review state separately from composition validation/acceptance.
- Only `AGENTIC_BIBLE_DISCOVERY_MODE=production` plus explicit `AGENTIC_BIBLE_CANONICAL_ORIGIN=https://agenticbible.si` selects canonical production output. Reject the legacy canonical selector and www/arbitrary origins. Synthetic builds override production mode.
- Bound successful charged original evidence to the supplied article; activate canonical route, readable faithful history, citations, flags and full-library Pagefind atomically. Preserve receipts/charges through replay/restart/rollback.
- Production baseline sitemap covers all eligible public articles; staging, private and synthetic article/snapshot URLs never enter sitemap/indexing candidates. Test actual full-build/browser and Static Assets behavior, not only helper mocks.
- Indexing remains disabled by default with no registered live provider transport, credential, schedule or submission. Preserve all original Markdown/interactive data and earlier PR heads.
