# Requirement changes

## Changed: published collection suggestions

The local synthetic contribution form and server accept correction/source suggestions for every ID in the canonical compiled reading inventory. Unknown, unpublished and synthetic-only IDs outside that inventory are rejected. The form uses the same collection and fails its build on missing/extra/duplicate IDs. Neither requests, environment fields nor fetched assets can nominate the authoritative inventory.

Acceptance scenarios:
- All twenty current canonical IDs submit successfully to the existing inbox with `new` status and one initial audit event; unchanged replay adds neither a record nor audit.
- All twenty selector choices match source-catalog and actual canonical article files; a newly supported article selection survives draft recovery/reload.
- Missing, duplicate, unknown or malformed catalogs fail validation; a forged catalog asset or request field cannot admit an unknown ID.
- A populated original store upgrades atomically, retaining exact submissions, audit, correction references, sessions and rate counters, unique keys, defaults and foreign keys. A late fault rolls back the complete migration; reopen/retry preserves existing receipts.
- Same-origin, UUID, plain text/URL, honeypot, size, rate, capacity, role/CSRF, stale moderation and replay boundaries remain in force. Ordinary dispositions still do not publish.
- Hosted/static forms remain disabled and hosted submissions fail closed. Submitted URLs are not fetched. No article, remote resource or deployment configuration changes.
