# Added requirements

## Unmounted write-only integration boundary

- Given an admin integration request, verify existing configured signed admin authority and exact origin/CSRF controls. Unsigned caller roles or local fixture identities cannot grant access.
- Given configuration or rotation, accept only the exact command fields for the fixed `github-content` integration, bounded bytes/time and a write-only secret input. Reject unknown fields and unsupported targets without echoing input.
- Given returned status or errors, expose only explicit allowlisted fields, constant mask, bounded redacted audit and fixed error codes. Never return secret bytes, suffixes/hashes, raw provider text or assertions.
- Given a secret storage adapter, require serialized atomic replacement/metadata/audit. Supply no persistent implementation, route or live binding in this change.

## Rotation, ownership and replay

- Given a second signed admin, deny another owner's status, rotation and test commands.
- Given initial configuration, require no record/revision zero. Given rotation, require an existing owned current revision.
- Given concurrent rotations, only one current-revision command commits; storage failure rolls back secret and metadata together.
- Given any accepted request reference reused with identical or changed input, reject replay without replacing a secret or dispatching a test.
- Given exhausted finite audit/reference budgets, fail closed without evicting history.

## Bounded tests

- Given a connection test, atomically reserve its revision/reference, lifetime budget and audit capacity before invoking the trusted scoped adapter.
- Given an adapter exception, unknown value or excessive wait, return a bounded unavailable/timeout enum with no raw error/result data; abort on the fixed deadline.
- Given rotation while a test is pending, reject its stale completion without changing new-revision status.
- Given interruption or failed completion, preserve pending reservation/budget and reject redispatch through replay.
- Given a saved credential, configuration status/mask remains independent of its bytes and connection success.

# Unchanged requirements

Existing local non-secret analytics ID settings, denied consent, disabled ads, publication policy, signed admin trust and release safeguards remain unchanged. Integration credentials are not accepted in analytics forms. No real secret/provider, identity provisioning or hosted readiness is established by synthetic contract tests.
