# Proposed delta

- Saved approval operation state is keyed by approval ID and survives DOM row replacement.
- A list response captured before revocation cannot clear pending/confirmed revocation or reenable controls. Locally confirmed revocation remains monotonic during the page session.
- Proposal callbacks and cleanup act on the current keyed state and view. Superseded proposal results cannot replace newer revocation feedback.
- Reads started before an intervening mutation cannot claim the list is fresh or overwrite its operation status.
- Desktop/mobile regressions use the shipped Worker, actual D1 and controlled signed assertions/GitHub, without changing production authorization or release code.
