# Added requirements

- Given the shipped Worker has absent or malformed optional policy, ingress HMAC or vault bindings, contribution/settings routes remain closed and status does not claim readiness.
- Given signed admin trust, D1, a valid moderation policy and a valid HMAC key, the shipped Worker may mount the existing contribution workflow; it stores only the keyed rate digest and fixed aggregate outcomes in addition to the existing submission records.
- Given D1, the same validated signed trust, a valid key ID and a 32-byte vault encryption key, the shipped Worker may mount the existing encrypted write-only integration settings contract. Jev status remains `unverified`; a Jev test request remains unsupported and sends no provider request.
- Given an intake POST, record only one fixed outcome enum in a UTC-day aggregate, capped at one million, and retain/report the latest fourteen UTC days. Do not persist IP, user agent, request key, email, submission content, source URL, token, or signed identity in abuse counters.
- Given local synthetic trust and controlled local D1 at the actual Worker entrypoint, tests may prove the submit/review/status and masked settings behavior but may not assert live provider connectivity.

# Unchanged requirements and explicit limits

No runtime binding is provisioned and all hosted authority remains closed until an operator supplies reviewed values and deploys through a separately authorized process. The aggregate is abuse visibility, not currency spending enforcement or a hosted readiness check. Physical pruning occurs on a counter write; the authenticated read API omits older rows. No scheduler or live provider call is added.
