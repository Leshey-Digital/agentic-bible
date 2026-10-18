# Bounded source acquisition and extraction

Prepared 2026-10-18 from production-preparation commit `129a292067b9112522e7f24f733862d249290513` on separate branch `feat/production-source-adapters`. Prior published content branch and reviewed source heads remain unchanged. This component owns only new `src/maintenance-adapters/*`, its tests and its change/review records. It changes no existing collector, HTTP, provider, quality, schema, package, configuration or article file.

## Callable boundary

`acquireMaintenanceSource({sourceId, requestKey}, {enabled: true, db, send?, clock?})` is a trusted-code opt-in callable in `src/maintenance-adapters/acquisition.ts`. Without explicit enablement it fails before accounting/network work. It uses the existing `HttpObservationStore` to reserve before the native Workers fetch, then the existing Workers HTTP validator for the six exact official URL registry and unchanged limits. Only two source IDs have compiled extraction profiles: MCP tools `s-bfba858067cc3eb54024f532` and OpenAI function calling `s-90f2bf11e4fb71c8f42ae128`. No application route or scheduler imports it. A supplied `send` is trusted test wiring, never a request field.

The result is a new in-memory contract, not legacy Evidence1:

```text
{
  source: {
    schemaVersion: 2, sourceId, url, profileId,
    raw: { bytes: Uint8Array, hash, contentType: "text/html" },
    evidence: { text, hash, spans: [{ startByte, endByte, text }] },
    lineage: { publisherGroup, originIds: [], provenance: "unknown" }
  },
  receipt: { requestKey, observedAt, reservationToken, day, attempt }
}
```

`extractMaintenanceSource(sourceId, rawBytes, contentType)` and `validateExtractedSource(packet.source)` in `extraction.ts` are pure with respect to network/storage. Validation copies original bytes, recomputes both hashes and every extraction/span, and checks the compiled identity rather than trusting candidate assertions. `verifyAcquiredSource(packet, {db, clock?})` additionally verifies the actual original-200 D1 job/reservation/source/hash/length, immutable receipt binding and at-most-24-hour observation age. It retains both raw and extracted hashes; there is no reinterpretation of an extracted hash as a charged original-body hash.

The quality workstream was given these exact exports and agreed to retain raw bytes/hash for semantic-source binding while using extracted text only as bounded input. These helpers do not configure a semantic verifier or bridge into the old fixture collector. Conversion from Uint8Array to Buffer at a trusted Node consumer is mechanical and grants no authority. Each current compiled profile explicitly retains unknown original lineage; the gate must deny publication absent separately trusted original provenance and semantic support. Publisher identity is not evidence of independent origins.

## Extraction and limits

The strict `strict-canonical-main-html-v1` profile requires an exact compiled document title, canonical URL and one main element. It extracts text runs within paragraphs/headings/lists and selected semantic block elements, excluding script/style/template/navigation/header/footer/sidebar/SVG/MathML descendants and comments. Entity decoding supports a small explicit named set and valid numeric references, normalizes whitespace, and retains the original raw byte interval for each output run. Revalidation applies the same transform to those original bytes. A span identifies transformed text’s location, not a claim’s truth or original research provenance.

This is deliberately a narrow HTML subset parser, not a general browser DOM parser. Malformed nesting, unsupported entities, ambiguous character references, missing/duplicate markers, title/canonical mismatch, depth/token excess and evidence overflow reject. No excerpt is silently truncated. JSON and plain-text bodies lack a profile and reject; no standalone JSON API is known in the existing exact URL list. The other four official IDs also reject before dispatch because no extraction profile is compiled for them.

Raw acceptance remains 32,768 bytes with the existing two-second HTTP deadline, 8-KiB response-header bound, strict encoding/MIME/declared-length checks and manual/no redirects. Extraction is bounded at 8,192 UTF-8 bytes, 256 spans, 64 element levels and 4,096 tokens. These are acceptance/allocation bounds, not guarantees about platform wire buffers, CPU costs or third-party page sizes. Native Workers routing trusts platform DNS/TLS; it does not acquire Node DNS pinning. See the [existing transport contract](../http-worker-persistence.md).

Existing D1 bounds remain twenty reserved requests/day, four active leases, one active lease/source, at most three attempts/job and 128 retained jobs. This adapter permits one initial attempt/key and does not automatically retry or resume a prior attempt. Repeated/failed/ambiguous keys stop without network dispatch, including after restart. A caller retaining a successful packet may reverify it against persistent D1. Raw bytes are not durably stored here; a crash/lost response after completion can lose the in-memory body, and this component offers no raw-body recovery or archive policy. Known original-200 packets retain their own age; 304 does not mint new evidence or refresh the packet’s source date.

## Primary format inspection blocker

Normal primary-page reads via the supported web tool on 2026-10-18 confirmed the [MCP tools title/content](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) and [OpenAI function-calling title/content](https://developers.openai.com/api/docs/guides/function-calling). Those normalized reads expose no raw DOM/size proof. The main/canonical expectations are an intentionally strict proposed profile, not observed live-format compatibility.

Exact blocked action: ordinary Python `urllib.request` HTTPS GET through the environment’s default proxy, manual redirect rejection, identity encoding, two-second timeout and at-most-32,769-byte inspection, targeting each of those two exact URLs. Both failed before origin with `URLError: Tunnel connection failed: 403 Forbidden`. No response body, hash, size, DOM marker, TLS compatibility or origin outcome was obtained. The proxy denied the route; this is not an approval-review rejection or an origin denial. The owner instructed no alternate proxy/transport/User-Agent retry; none was attempted. Live DOM and practical bound compatibility remain blocked/unverified.

## Verification and handoff

Focused commands use only already locked dependencies:

```sh
node --test tests/maintenance-adapters/*.test.mjs
npm run test:http-worker
npm run test:http-sources
npm run test:docs
npm run check
npm run build
npm test
```

The new native harness bundles a test-only entry and runs actual workerd/D1 with the default native fetch path and a controlled outbound service. All HTML/JSON bodies are small authored fixtures. It proves charge-before-dispatch, original bytes, recomputed extraction, receipt verification across D1 restart, no same-key refetch, lineage/receipt tamper rejection, canonical identity failure, cross-origin redirect rejection, malformed/unsupported JSON, declared/streamed body limits, encoding rejection, header/body deadlines, daily request-budget stop and missing accounting. Pure tests cover UTF-8 byte spans, entity handling, excluded markup, profile bounds and tampering. None proves live source compatibility or semantic accuracy.

The frozen first checkpoint’s actual results and separate consumer/BOM successor are recorded in the [quality-source handoff](production-source-quality-adapter.md). Private logs/short format-attempt metadata live under `.git/production-source-adapters-evidence` in the original clone. Full combined qualification and any browser/shared ports remain with the parent. No live provider/Jev call, credential, paid request, remote migration/write, framework installation, deployment or push is performed. No fixture is relabeled production. Rollback reverts this component while retaining existing HTTP ledger receipts; no existing table or source history is rewritten.
