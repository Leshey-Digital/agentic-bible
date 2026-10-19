# Owner-bound Jev runtime composition

## Problem and outcome

The protected Jev evaluation route exists, but the shipped Worker does not resolve the encrypted `typesafe-jev` record or assemble the charged dispatch port. Complete that path so only the signed administrator who stored the credential can use it, and only when the server has an explicit supported model, conservative token bounds and owner-supplied currency policy.

## Scope and non-goals

Add a vault-only owner-matched credential resolver, pass the verified owner reference through the protected route, and compose `createJevDispatchPort` from validated server bindings. Keep missing or invalid settings closed. Add tests using synthetic credentials, disposable D1 and fake transport. Do not configure real credentials, choose a live spending allocation, call Typesafe, deploy, provision services, connect article writing/publication, or change the 20-article release gate. The independent canonical-writer review remains incomplete.

## Dependencies, costs and risks

Live use depends on the signed identity configuration, D1 migrations through the existing Jev vault and maintenance currency schemas, AES-GCM vault-key bindings, an owner-entered encrypted Jev credential, a pinned Jev model, owner-approved currency caps/rate card and a valid policy rotation. The runtime accounting ledger is not an account-wide billing guarantee. Synthetic tests do not prove provider connectivity or billing.

## Decisions needed

The owner must approve actual per-run/day/month currency caps and populate the runtime policy; no numeric live allocation is selected here. The owner must deploy this code and complete staging identity/D1/vault setup in a separately authorized activation.
