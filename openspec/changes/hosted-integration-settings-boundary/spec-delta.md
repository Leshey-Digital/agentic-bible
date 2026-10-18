# Added requirements

- Given the exact hosted integration API path on the existing staging origin, accept GET/POST only with no query; reject wrong origins, queries and unsupported methods without invoking adapters or assets.
- Given a trailing/sibling path or a once-decoded alias recognized as `/api/admin/settings` or its descendants, preserve hosted API closure and never dispatch the integration contract or assets. Use decoding solely for rejection, never for delegation. Malformed encoding is caught without diagnostics; ordinary encoded assets retain existing behavior.
- Given explicitly injected trusted server-code integration adapters, delegate to the reviewed contract, preserving real pinned RS256 verification, origin/CSRF, expiry, ownership, replay, versions, body limits, masks, audit and bounded connection-test outcomes.
- Given only a forged legacy verifier port or local fixture session, do not grant integration access.
- Given the shipped default entrypoint, never infer integration storage or tester adapters from existing trust/D1/token, arbitrary environment flags/properties, request fields, headers or cookies. Valid GET/POST remain 503 unconfigured.
- Given any integration response, retain fixed safe error/status projections and hosted no-store/noindex/security headers with no credentials, assertions or provider exception text.

# Unchanged requirements and explicit limits

The reviewed integration contract, signed identity, non-secret local measurement settings, static delivery, correction/release behavior and default closed live authority remain unchanged. The optional port supplies no persistent implementation. Trusted adapters remain responsible for serialized current-revision validation and bounded external transport; core stale-completion checks alone do not prevent all stale external work. No live readiness is established.
