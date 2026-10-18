# Added requirements

- A local synthetic correction/source submission persists across Worker restarts. Replayed requests and duplicate content return the same opaque reference without duplicate records.
- Invalid/oversized/cross-origin submissions never persist. Server code never fetches submitted URLs. A honeypot and atomic five-per-ten-minute rate limit bound intake.
- Admin records and mutations require an unexpired session with the admin role. Anonymous, reader, tampered, expired and logged-out sessions cannot read or mutate records. Local fixture sign-in works only in explicit local mode on the fixed loopback origin; outside it, no identity is granted.
- A disposition/tags update and audit entry commit together. Stale updates fail with a conflict; no silent overwrite or phantom audit event occurs.
- The form retains a synthetic draft on validation/network failure. The inbox handles empty, filtered, conflict and storage-error states and works at mobile widths with keyboard navigation.
- No public intake, real credentials, cloud resource or article-publication gate is enabled by this slice.
