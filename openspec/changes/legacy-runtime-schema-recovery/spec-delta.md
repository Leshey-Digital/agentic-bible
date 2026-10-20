# Proposed release requirement changes

- A new pre-controller baseline record schema must identify the exact runtime
  schema version and its pinned legacy source commit.
- The runtime body must preserve the exact existing fields emitted by that
  source; validators must reject added, omitted, altered or source-mismatched
  fields and must not invent newer configuration flags.
- The observed `release.json` asset hash must equal the legacy runtime's
  `releaseManifestSha256`. The actual runtime-reported build ID is a captured
  observation and must be reverified byte-for-byte; it is not inferred from an
  unmatching local reconstruction.
- Legacy rollback remains distinct from candidate rollback and must retain the
  exact version/ETag/binding checks, expected-active guard, independent review
  pin, exclusive writer and journal semantics.
- A source reconstruction is not a complete live asset inventory unless its
  actual build identity matches the runtime and all observed public bytes.
