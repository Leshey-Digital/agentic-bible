# Proposed delta

- The read-side preparation is disabled by default and uses an explicit pinned local Git commit; it performs no network/provider/D1 mutation.
- Controlled record integrity is distinct from source authenticity, factual verification, private ledger validation and production approval.
- Reconstruct the exact historical writer receipt only after validating immutable record creation, commit parent/message, atomic file set and blob hashes. Detect modified history and conflicting/partial current pointers.
- Project bounded history and the active revision's post-publication review flags. Never turn review flags into article preapproval.
- Keep private accounting/reservation fields out of the projected view. Missing objects fail closed with Git lazy fetching disabled.
- Runtime/public pages, authenticated review decisions, notification and release activation remain absent until independently implemented/reviewed.
