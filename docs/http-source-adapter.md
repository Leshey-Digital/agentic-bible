# Local HTTP source adapter contract

Branch `feat/local-http-source-adapter`, based on immutable PR #10 `d0bfca47cd221b970b01ace838afb3f3bb9a5d32`. This adds a callable Node library, not a running source service or an article publisher. No Worker route, UI control, schedule, migration, binding, credentials, paid request or article publication is added. Existing source controls still use deterministic fixtures and are unchanged.

## API and fixed source registry

`createHttpSourcePass()` from `src/monitoring/http.ts` creates one explicit local pass. `check(sourceId, lastGood?, abortSignal?)` returns either `{ok:true, state, observation}` or `{ok:false, state, error}`. Defaults use real Node DNS and HTTPS; tests inject controlled resolver/fetch functions. Dependency injection is trusted developer/test wiring, never an API/contribution/config field. Callers cannot supply a URL, headers, limit, retry policy, proxy, credentials or TLS options through `check`.

Only these exact existing catalog source IDs/URLs are supported:

| ID | Official document |
|---|---|
| `s-82747c62f33e4f204a358a0f` | [Claude tool-use overview](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview) |
| `s-90f2bf11e4fb71c8f42ae128` | [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling) |
| `s-419540fd82a47b8d858d89e6` | [MCP security best practices](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices) |
| `s-937fae6437b3fc365812829a` | [MCP transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) |
| `s-bfba858067cc3eb54024f532` | [MCP tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) |
| `s-d4b8988f42afd69d3b72da14` | [MCP architecture](https://modelcontextprotocol.io/specification/2025-11-25/architecture) |

The registry is frozen in code and tests verify URL-derived IDs against the built catalog. The broader eight-source fixture catalog remains unchanged: the research-paper and engineering-blog URLs are not destinations in this documentation-only adapter. New hosts, paths, versions, representations or redirects need reviewed code changes. User-contributed URLs cannot enter this registry. Documentation reference pages were inspected separately; they are not live adapter connectivity tests or proof of current response size/validators.

## Connection and SSRF boundary

The default Node transport uses DNS lookup followed by a checked, pinned address. At most eight answers are accepted and every answer must be public. Empty/mixed/private/reserved answers fail before HTTPS. IPv4 private/link-local/loopback/metadata/shared/multicast/documentation/special ranges are rejected. IPv6 is restricted to global unicast with special/documentation/tunnel ranges excluded; mapped IPv4, NAT64, zone IDs, local/multicast and address-family mismatches are rejected. This is a conservative application policy, not a general-purpose Internet-address classification service.

The HTTPS lookup callback returns only the checked address, with the original official hostname, Host/SNI and certificate verification intact. A fresh private Agent disables proxies, connection pooling and TLS session reuse; no second DNS resolution/fallback occurs. Connected-peer identity is checked against the pin. Outbound headers are allowlisted and capped at 1 KiB; Host/Authorization/Cookie/Proxy-Authorization are rejected. Response headers are capped at 8 KiB. No proxy/agent/TLS configuration comes from untrusted source data. [Node HTTPS documentation](https://nodejs.org/api/https.html) describes the underlying request/agent primitives; implementation and controlled transport tests use pinned project Node 24.19.0.

Redirects are never followed, including another allowlisted URL. Every 3xx other than an evidenced 304, a `redirected` response or an unexpected final URL fails closed. Native HTTPS does not implement redirects, authentication/cookie storage or retries. Source content remains untrusted bytes; HTML/JSON are not executable instructions.

## Bounds, validation and last-good metadata

- Four charged checks per factory/pass, reserved synchronously before DNS. Failed resolution/HTTP attempts consume slots. Each check makes at most one HTTPS GET; no automatic retry, recursive discovery or request fallback. A fifth concurrent check fails before resolution/connection.
- A two-second total timeout covers DNS, connection/headers, streamed body and hashing. Abort closes the native request/body. Uncooperative injected operations cannot produce a later successful result or a later dispatch after DNS resolves. An underlying OS DNS lookup may finish after cancellation, but cannot initiate a connection afterward. This is an event-loop timeout, not a real-time scheduling guarantee.
- Only 32 KiB accepted body per response. Oversized Content-Length rejects before reading; streaming overflow cancels immediately. Temporary transport/socket buffers may receive additional bytes before cancellation. No raw body is persisted, returned or logged. The small cap is conservative and may reject large official HTML pages; no live compatibility is claimed.
- Allow HTML, plain text or JSON, with no charset or one UTF-8 charset. Reject other MIME/parameters, compressed encodings, invalid/truncated length, empty body, malformed UTF-8 or malformed JSON. Request `Accept-Encoding: identity`; decompression is intentionally absent.
- ETag is preferred, otherwise canonical Last-Modified. Prior state has a matching source ID, explicit `mode:http`, a 64-hex SHA-256, validated validators and a checked timestamp. Unknown fields, fixture provenance or invalid state are rejected before network work. Inputs are copied before awaiting.
- A 304 requires a prior baseline and sent validator. It reuses the hash and validates any updated validators. A 200 hashes the bounded bytes and reports baseline/unchanged/changed without retaining text. Successful `checkedAt` is the observation-completion timestamp, not proof of factual verification or source publication time.
- Any DNS/HTTP/redirect/body/timeout error returns a sanitized code and unchanged validated last-good hash/validators/timestamp. Invalid input returns no last-good state. HTTP 408/429/5xx, network and abort failures are marked retryable for a future bounded caller, but this adapter never retries itself. Diagnostics/body/credentials do not appear in error messages.

The caller must obtain last-good metadata from trusted prior observations. Shape validation does not authenticate a supplied hash or validator; client-provided metadata must not become the trusted baseline through a future route.

## Integration differences and remaining limits

The existing fixture runner, batch journal, routes, publisher, schema and Wrangler configurations are unchanged. `HttpLastGood` is separate from fixture source rows; it carries `mode:http` and cannot be substituted into the existing `FixtureTransport` interface. Nothing calls `MonitorStore.complete`, creates a candidate, publishes a ledger revision, updates articles/search or changes verification dates. A hash difference alone is not evidence of a factual update.

The factory budget is process-local, not a durable daily or monetary cap. Trusted code can create another pass. Before any app/background integration, reserve global request/day work atomically, define retry/receipt semantics and keep HTTP provenance separate from fixture data. Review persistence/backup/last-good updates, source availability/content size, transport policy and production identity/operations. No schema is added to avoid prematurely mixing those provenances.

This implementation uses Node DNS/HTTPS and is not imported by the Worker. A future Cloudflare Worker integration needs an independently reviewed egress transport with equivalent resolution/address/redirect guarantees; do not replace the pin with an unchecked global fetch. Existing remote schedules and production paths remain disabled/fail-closed. A future local runner or explicit admin action is not implemented here. No real adapter DNS/HTTPS request, live TLS handshake, outside response corpus, provider credential or paid inference was used during verification.

Run `npm run test:http-sources` after `npm run build`; `npm run validate` includes it. Type checking includes the new test directory. Controlled tests exercise the actual policy/adapter/native transport options, including SSRF, pin/peer mismatch, redirects, header/type/validator/body rejection, 304, last-good preservation, concurrency and real timeout timers. They do not certify official-site connectivity, live TLS certificates or Worker deployment readiness.

Rollback the new files/script/docs to PR10; no migration/data/resource rollback is required. Preserve `.wrangler/editorial`. This branch is a local checkpoint for independent review before publication; no push, merge or deployment is performed.
