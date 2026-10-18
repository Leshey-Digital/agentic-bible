# Verified source consumer for quality integration

This separate successor preserves source-adapter `b02959b7799f79c7d72a887a5646f0f4509ac4a4` from production-preparation base `129a292067b9112522e7f24f733862d249290513`. The original adapter branch remains frozen. Independent review reproduced leading UTF-8 BOM removal by TextDecoder, shifting raw byte spans by three bytes. Isolated correction `35d10d73012a94a78f7ccda8f023113fb55d16b8` checks raw `EF BB BF` before decoding; its six pure/native tests pass. The original red evidence remains at `/tmp/production-source-adapter-review/bom-span-red.json`. Re-review acceptance is not asserted here.

## Actual exports and ownership

The quality workstream agreed these concrete interfaces before edits:

- `verifyAcquiredSourceReference({source, requestKey}, context)` in `src/maintenance-adapters/acquisition.ts` revalidates raw/extracted content and reconstructs exact receipt metadata from actual D1. It avoids duplicating trusted SQL in a consumer and cannot mint authority from a candidate-supplied receipt.
- `createAcquiredQualitySourcePort(context)` in `quality-source.ts` returns an async port accepting `{citationId, source, requestKey}`. It calls the reference verifier and returns the agreed quality input below.
- `validateQualitySourceExtraction(value)` independently re-extracts original bytes and validates the agreed quality input’s exact source/URL/raw/profile/extracted identity, text, spans and unknown lineage. It is pure with respect to network/storage and does not replace receipt verification.

```text
{
  citationId, sourceId, url, bodyHash: rawSHA256, bytes: Uint8Array,
  extraction: { profileId, rawHash, extractedHash, text, spans },
  lineage: { originIds: [], provenance: "unknown" }
}
```

The actual Node quality consumer may copy Uint8Array to Buffer without changing bytes/hash. Candidate origin labels are rejected, not trusted. The compiled publisher group never becomes an independent original root. The quality owner is implementing separate Evidence2 references retaining owned raw files, original D1 receipt keys, profile and extracted hash. That owner also controls generic coordinator/gate/canonical changes, unknown-lineage denial and trusted raw/profile-bound semantic/original-provenance attestations. These helpers do not edit legacy Evidence1 or configure a semantic verifier. The actual composed publication test must be reported by that workstream; a source-port test is not canonical publication evidence.

## Freshness versus historical integrity

Both receipt-verification functions and the port constructor accept a trusted-code context `{db, clock?, historicalReplay?}`. Default verification enforces nonfuture, at-most-24-hour source observations. Fresh acquisition retains that guard with no historical option.

For cached immutable known outcomes only, a trusted consumer may use `historicalReplay: true` to skip age/future freshness admission. This still requires a valid bounded timestamp, exact recomputed original body/hash/profile/extraction, successful D1 job/reservation/source/length/token, and immutable receipt metadata where supplied. No source/quality packet can enable historical mode. It makes retained receipts inspectable; it does not admit new work. The producer must independently apply its freshness/policy checks before uncompleted or new generation. No request, charge, provider call or write occurs during integrity verification.

## Checks and remaining limits

The frozen first checkpoint passed five adapter tests, two retained native HTTP tests, thirteen retained Node HTTP tests, documentation links, Astro (162 files, zero diagnostics), twenty-page Astro/Pagefind build and nine static tests. A first Node HTTP invocation before the required catalog build failed only because `dist/source-catalog.json` did not exist; the correctly ordered rerun passed 13/13. Private logs and blocker metadata remain in its clone’s `.git/production-source-adapters-evidence`.

The isolated BOM checkpoint passed six adapter tests, including native rejection without accepted evidence, last-good mutation or same-key refetch. This successor adds raw-to-quality validation/substitution tests and extends the actual native capture/D1-restart test through the concrete source port. Default stale/future sources deny; explicit historical integrity passes without new dispatch or charge; caller replay flags and tampered raw evidence still reject.

Passed for helper code checkpoint `8c09775509d037ba2e220014f5a70254e6d3b9c1`:

- `node --test tests/maintenance-adapters/*.test.mjs`: 8/8 passed, including actual native acquisition, persistent D1 restart and Node quality-source consumption.
- `npm run test:docs`: 324 Markdown files and 382 relative links, no missing targets/conflicts.
- `npm run check`: 163 files, zero errors, warnings or hints.
- `npm run build`: twenty article pages indexed by Pagefind.
- `npm test`: 9/9 generated static checks passed.
- `git diff --check`: passed. No existing maintenance/HTTP/provider/gate, article, package, lockfile or deployment configuration changes.

The final documentation checkpoint and exact source-build pin are supplied in the handoff; private logs are under `.git/production-source-quality-evidence`. Full combined validation, browser suites, deployment dry runs and the actual composed quality/canonical journey were not run by this component. The quality owner/parent coordinates those checks. Retained HTTP suites above were run on the frozen first component, not represented as new exact-head successor runs.

Live raw DOM, practical page-size/deadline compatibility and actual source authenticity remain unverified after the [recorded proxy tunnel 403](production-source-adapters.md). No alternate proxy, transport or User-Agent retry occurred. Profiles remain strict proposed format contracts tested with original controlled HTML; JSON has no guessed live profile. No live provider/Jev call, prose-generation assumption, credential, paid call, remote migration/write, configuration, browser port, deployment or push is performed. Full combined qualification and the actual gate/canonical journey remain with the parent/quality owner. Rollback reverts these helpers and retains the isolated BOM fix and existing charged receipts.
