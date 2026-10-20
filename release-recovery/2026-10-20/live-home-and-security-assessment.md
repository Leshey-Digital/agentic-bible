# Live homepage and security-filter assessment

## Publication and verified homepage

Existing version 28c2c556-ab43-482a-98e7-7d2aa8d6965c is active at100% under deployment e046cf4a-6f57-404d-a50a-504788058ee5. Apex attachment88f7769106b0a002f68aead83661babe51002aff is enabled for agentic-bible-production. Staging deployment548f69ec-060d-4c85-ba73-a6fc9ca06bbe/version5d532da5-b15c-4e64-8ae7-634f69831dcb remains unchanged. This supersedes the earlier forensic-hold status in README; those historical observations remain valid at their recorded time.

Parent relayed the approved apex verifier's actual homepage observation at2026-10-20T16:41:07Z: HTTP200;20,901bytes; title The library · Agentic Bible; canonical https://agenticbible.si/; index,follow;20articlelinks; CSP/security headers. Body SHA-256 cd485ccc1b0990c86b6bfc7b8dc5ffa8f802f1dae748586ed2b2389fa3c4367d. Local frozen index.html hash independently rechecked at16:43:42Z matches exactly. This writer did not issue the live HTTP request: its network policy excludes apex.

Subsequent Python HTTPS requests for articles/search/history/robots/sitemap/status returned HTTP403 with body error code:1010; verifier stopped. These observations do not establish a Worker application defect or full reader-journey acceptance. No new requests to the denied endpoint were issued here.

## Read-only diagnosis

Cloudflare GET /zones/95f1a8a37b77cd16aa4b418494d2f69e/settings returned HTTP200: browser_check=on,security_level=medium,challenge_ttl=1800,privacy_pass=on. No settings changed.

Official documentation defines1010 as rejection based on browser signature and refers to Browser Integrity Check:
https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1010/
https://developers.cloudflare.com/waf/tools/browser-integrity-check/

Inference: reported Python-client1010 is consistent with the enabled Browser Integrity Check. Actual matched-event attribution remains unverified; do not assert a particular rule/event or say all human browsers work. Homepage200 proves one successful public request, not full end-to-end acceptance.

Missing evidence: retained CF-Ray response IDs and precise UTC times for denied requests, relayed through parent from verifier task01a159a2-4c2d-73bc-878c-b9f54e0a40c5. No fresh request is needed to recover existing headers. With these identifiers, inspect only matching security events; if connector lacks event access, the zone owner can inspect Security Events in Cloudflare dashboard by Ray ID/time and report the matching service/action. Do not disable Browser Integrity Check or add a bypass merely to make acceptance pass. Any necessary setting change needs a separate concrete decision after attribution.

No credentials, client identities, IPs, security settings, tests, application code, or version changed during diagnosis. No rollback triggered: no critical application failure established. Full live article/search/history/robots/closed-write acceptance remains incomplete.
