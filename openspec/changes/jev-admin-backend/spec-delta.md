# Added requirements

- Only fixed GitHub content and Typesafe Jev integration IDs may store credentials; mismatched route/body targets fail without writes.
- Each integration retains independent owned write-only credentials, revision, replay protection, audit and durable lock. Existing ciphertext and lock rows survive migration unchanged.
- Masked responses label connection evidence as controlled, provider or unverified. Evidence is trusted server composition, never a request field; absence defaults unverified. A successful adapter response alone is not proof of real provider connectivity.
- Jev setup reports no generation capability and no supported connection test. A direct Jev test POST fails before any reservation, credential read or dispatch.
- All shipped adapters remain unconfigured by default. Setup does not issue, revoke or activate provider credentials.

# Acceptance scenarios

Controlled local workerd/D1 tests preserve GitHub rows across an atomic upgrade, isolate Jev ownership/rotation/restart, reject cross-integration ciphertext substitution, and prove zero outbound calls for Jev checks. Existing signed identity, same-origin, replay, bounded ingress, budget and interrupted-lock regressions remain required.
