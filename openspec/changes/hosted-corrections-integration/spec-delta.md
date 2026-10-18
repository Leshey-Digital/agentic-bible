# Proposed hosted connection requirements

Only a valid configured signed admin assertion may view protected notes or create/revoke immutable approvals and request a GitHub draft proposal. Verify signature, exact issuer/audience, key ID, allowed subject, bounded token lifetime and same-origin custom-header CSRF for writes. No fixture role/cookie can authorize. No credential or raw identity is returned to browser/logs.

Approval creation is idempotent for identical input and has no side effects on key conflicts; immutable payloads are bounded at four retained rows. Revocation is explicit and cannot silently revise a note. Source preview reserves a fixed daily request budget before any network work. Proposal retains PR30 request/lease/receipt limits and source/tree pins.

The shipped entrypoint must use these implementations when explicit trusted configuration/bindings are supplied and remain closed when absent/invalid. Prove actual native runtime and cryptographic verification, not test-only identity ports. Public intake stays disabled; admin-authored notes do not claim third-party consent or authorship. Draft creation is never represented as canonical publication.
