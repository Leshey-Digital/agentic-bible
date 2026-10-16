# Measurement settings contracts

Status: local synthetic configuration foundation, not a working analytics integration. Branch stacks on immutable PR #5 at `9ac36c2e11dd8fb2316ddecb1e497cafafdfbd9a`. The separately reviewed contribution fix remains outside this branch. [Independent fix review](review/editorial-draft-recovery-independent.md) pins its own accepted head.

## Controls and validation

`/admin/settings/` provides independent forms for Google, Microsoft Clarity and privacy. Existing local editor/admin session, exact loopback origin and CSRF are mandatory. The local reader has no access. `/api/admin/settings` GET returns the validated admin state and latest 30 audit records; PATCH takes exactly `{group, values, version, requestKey}` and `X-CSRF-Token`. Unknown keys, missing values, wrong types and unsupported groups fail. Form POST requires exact allowed fields and rejects duplicate fields. Bodies remain bounded by the existing 8 KiB reader.

- `google`: `tagId` empty or `GT-`/`G-` plus 4–20 uppercase letters/digits; `ga4Id` empty or `G-` plus ten uppercase letters/digits; boolean `enabled`. At least one ID is required when selected. GTM containers and AW advertising IDs are intentionally unsupported.
- `clarity`: `projectId` empty or 4–20 lowercase letters/digits; boolean `enabled`. A selected provider requires an ID.
- `privacy`: boolean `previewEnabled`; `analyticsConsent` and `adConsent` must be `denied`; `respectDnt` must be true.
- `advertising`: `enabled` must be false. There is no activation control.

These are conservative application allowlists, not provider ownership/connection validation. Future provider formats need a reviewed validator update. Defaults: IDs empty, flags false, consent denied. Rejected values are not echoed in error responses, HTML, audit or logs; valid fields can be retained in HTML form recovery. Never enter credentials in identifier fields.

Provider references checked 2026-10-16: [Google tag setup](https://developers.google.com/tag-platform/gtagjs), [Microsoft Clarity setup](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-setup), [Clarity consent mode](https://learn.microsoft.com/en-us/clarity/setup-and-installation/consent-mode). No provider snippet is installed or invoked. Selecting an ID does not establish consent or data collection.

## Persistence and audit

Migration `0003_measurement_settings.sql` creates four settings rows and a separate audit table. Local interactive data remains `.wrangler/editorial`; automated tests use disposable `.git/editorial-browser-state` only. No remote binding/resource is created.

Per-section optimistic versions start at one. Settings and a value-free audit event commit atomically; stale revision returns 409. Independent provider saves do not conflict. Identical normalized request replay returns success without another event; changed reuse returns 409. Unchanged saves do not consume history. Audit records keep changed field names, local fixture actor, revision, timestamp, request reference and a normalized-payload SHA-256 fingerprint for replay, not submitted setting values. Atomic maximum 1,000 changes; manual archive design remains future work. Read latest 30. Failure rolls back both settings and audit. Missing/corrupt settings fail closed.

## Public behavior and privacy

No script loader or analytics SDK exists. Enabling flags never creates external requests, cookies, local identifiers, consent grants or ad activity. Provider credentials have no schema, form or public projection. Secure server-side write-only setup, scoped connection tests, identity and enforceable monetary budgets are explicitly unavailable.

Default public HTML is unchanged. An explicitly enabled **local-only inert policy preview** adds an escaped JSON `<template id="measurement-policy">` to GET responses for `/`, `/about/`, the three known articles and known topic routes. It contains selected non-secret provider IDs and fixed `trackingEnabled:false`, denied consent, `adsEnabled:false`, `not-connected` status. It cannot execute. No raw query, referrer, IP, session identity, audit record or request key is included. Responses are private/no-store. Nothing is fetched client-side.

Query-bearing URLs, DNT:1, Sec-GPC:1, search, contribution forms, admin/private/API paths, assets, HEAD and errors receive no template. Only the exact loopback synthetic environment can render it. Static staging config remains asset-only, unchanged and uninstrumented. Public static files never embed saved IDs. Local preview Worker routing alone is extended for eligible reading routes.

Actual collection needs separately reviewed identity, provider/account ownership, consent UI and revocation, privacy notice/retention, masking/PII controls, production origin/CSP, script adapter and integration evidence. No script acceptance or pretend key vault shortcuts are provided here. Ads require separate activation authority and implementation. AI/Google/Microsoft visibility metrics remain unavailable, not zero.
