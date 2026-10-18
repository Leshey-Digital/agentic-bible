# Proposed delta

- Preserve main and the entire accepted PR42 stack as ancestors of one separate integration candidate.
- Preserve every accepted source blob except explicit integration documentation/instructions; all twenty articles and package-lock.json match both inputs byte for byte.
- Exclude the separate hosted pipeline and keep all live authority disabled.
- Retain existing strict record readers, canonical-base provenance, restoration/reload/duplicate-upload regressions, quotas and assertions unchanged.
- Treat PR41/older downgrade as unsupported once new canonical-base records exist; no history rewrite or implicit migration.
- Require complete exact-head local/CI composition checks and independent review before any separately authorized merge.
