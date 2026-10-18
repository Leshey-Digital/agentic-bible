# Proposed delta

- An explicit trusted fixture-only canonical-base port supplies an owned repository and exact source commit; data and receipt authority come from strict Git reconstruction.
- New generation checks the current fixed branch and code, accounts for the exact untrusted canonical Markdown in provider input, and fingerprints the canonical receipt separately from private publisher references.
- A writer candidate uses that bound receipt as its canonical previous revision and its source commit as expected head. A changed base requires a fresh event; historical replay retains the original pin.
- The strict reader verifies new optional canonical-base lineage against the immediate previous receipt and parent Markdown without weakening old record profiles.
- Existing build/release mechanisms consume the resulting exact Git head; no second build pipeline, store, schedule, route or live authority is added.
