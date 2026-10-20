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

## Confirmed event correlation

A subsequent read-only POST /graphql query to firewallEventsAdaptive succeeded HTTP200 with no errors. It was restricted to this zone, hostname agenticbible.si, UTC window2026-10-20T16:41:20Z–16:41:40Z, userAgent Python-urllib/3.12, and the11 supplied verifier paths; limit30. Requested fields were only action,path,datetime,source,userAgent; no client IP, query string, cookies, or customer records were requested.

Ten matching events were returned, all action=block,source=bic,userAgent=Python-urllib/3.12:
- 16:41:28Z: /articles/model-context-protocol/, /articles/tool-use/, /articles/prompt-injection/, /search/
- 16:41:29Z: /api/runtime/status, /release-source.json, /sitemap.xml, /api/contributions, /admin/, /robots.txt

This confirms Browser Integrity Check attribution for those ten matching verifier requests. /history/ was not present in the adaptive result; its individual event remains unconfirmed. No missing-event conclusion or universal completeness claim is made. The actual event UA confirms the verifier's previously inferred default UA for these ten requests. Local file-write timestamps remain distinct from server timestamps. Successful homepage Ray a4d977e09f7fcc1a-ORD is not a denied-request identifier.

Supported read contract: https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-firewall-events/

Diagnosis is resolved for ten requests without changing settings or repeating blocked traffic. No application defect is established by these security blocks. Full ordinary-browser reader acceptance is still outstanding; no client-identity substitution or bypass was performed. No user security-setting action is required merely to explain these denials.
