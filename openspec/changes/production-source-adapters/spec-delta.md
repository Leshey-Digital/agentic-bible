# Proposed bounded adapter requirements

- Given trusted opt-in code with a registered source ID and UUID, reserve existing D1 HTTP authority before one native Workers fetch. Preserve all existing exact URL, redirect, encoding, body, deadline, lease, concurrency, request and retention limits.
- Given a supported HTML response, retain original bytes/SHA-256 and separately return bounded normalized text/SHA-256 with exact original UTF-8 text-run spans. Require compiled source, profile, canonical URL, title and unique main markers; reject unsupported or ambiguous profiles without eligible evidence.
- Given JSON, another official source without a compiled profile, a contributed URL, a cross-origin redirect or a size/deadline/budget/identity failure, fail closed. Do not guess endpoint formats or silently truncate evidence.
- Given a returned packet, independently recompute raw hash, extraction, evidence hash and spans, then verify the actual D1 successful original-200 receipt, reservation, source, byte length, timestamp and immutable request binding. A 304 or extracted-text hash cannot substitute for the original-body receipt.
- Given an attempted lineage/profile override, reject it. Compiled publisher groups do not prove independence; original lineage remains unknown and no semantic verifier is configured. Capture/extraction alone cannot authorize publication.
- Given a repeated or uncertain acquisition key, stop without another fetch. A retained packet can be reverified against persistent D1 after restart; loss of raw bytes is not repaired by fabricating evidence or refetching under the same key.
- Verify pure extraction/tamper cases and actual native Worker/D1 controlled HTTP behavior without app routes, fixed browser ports, paid/model calls or remote state changes.

These proposed requirements do not establish live HTML compatibility, source authenticity, factual support, reviewed original provenance, a production provider path or release readiness.
