# Contract

- GET /api/admin/drafts/attempt/{UUID} requires existing private inbox and fresh signed admin checks; no query/method exceptions.
- Lookup remains available without AI configuration/price validity, with no-store/noindex security headers. Unknown/nonregistered records return404; invalid IDs400.
- Ordinary page views do not inspect automatically. A labelled form explicitly requests one lookup; data renders as text, excludes raw provider output and reservation tokens, and cannot retry/reset a source attempt.
