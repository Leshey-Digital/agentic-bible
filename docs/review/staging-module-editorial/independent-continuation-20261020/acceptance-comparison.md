# Acceptance comparison: frozen module package versus independent continuation

## Pins and scope

Frozen manifest SHA256: `bb6663fabb4254766eec456d76dcc8833e68f3eda0e08c0814de56cc2b4fe7eb` (verified from the checked-in manifest). It declares:

- implementation `7c904201553cd6fe4b0f6b8cade6c7bf3a722f0c`, clean at original preparation;
- content `b81e2093e80cb8dc31b56fcb14f969dad124bdfa`;
- content candidate manifest `260142f11656ed643fbc2091479d47bef14f605331ce9bfbd89eeb3d74f933f9`;
- 81 modules: 363,274-byte ESModule `worker.js` plus 80 public Data modules;
- Worker SHA256 `4efc4f02390bff0ea07221a4878b23bb50dd32dfcd7769a4858267a96ea23e3c`;
- configuration SHA256 `ad6e0eedfd886e9b88858af7f0bbc1eae3ba7dbab221633b1414ebd351ca1735`;
- 1,649,190 uncompressed bytes and 527,235 deterministic concatenated gzip bytes.

The tested source `912c75fddc54f223f5d2997596b9cc224ad4b830` differs from the frozen implementation commit only in documentation/evidence and the OpenSpec task record. Runtime, builder, server, application and test sources are identical between those two commits. This is source lineage evidence, not proof of the preserved compiled Worker bytes.

## What is covered

| Portion | Evidence | Acceptance boundary |
| --- | --- | --- |
| Shared hosted router, signed identity, D1 authority, private/default-closed behavior, history, review and recovery source | Exact-source hosted 19/19; production-hosted checks; hosted/admin and maintenance browsers; retained native suites and targeted release-case recovery | Actual local runtime behavior is covered. This does not attest the frozen compiled Worker or real Access/D1 bindings. |
| Ordinary static reading/search/discovery | Exact-source native checks, 92 main browser cases, both dry runs and all remaining commands exercised | This is the ordinary standard ASSETS runtime. The module-server facade is not substituted into those commands. |
| Module composition wrapper, frozen public bytes/headers, immutable build-source note saving | Historical two focused composition tests and independent acceptance recorded in the original checked-in qualification.md | Those historical tests were not rerun in this continuation. They bind the original local acceptance; the package itself is absent here and must still be inspected. |
| Frozen static Data modules | 55 of 80 match ordinary reconstruction directly; all 25 differences classified below | Semantic/source provenance comparison is established; reconstructed bytes are not a byte-identical replacement package. |
| Frozen `_headers` input and generated header rules, module mapping, configuration and final Worker bundle | Source-level code is preserved; manifest pins are present | This continuation did not rehash preserved package Worker/config/Data files or inspect its exact generated module/header binding. |
| New standard release candidate | Exact source/tree, 82-asset inventory, dry run and final verifier; digest d1ca55f0…837fc | Separate artifact, not a replacement for or acceptance of the frozen module package. No successful original-runner receipt exists. |

## Exact reconstruction differences

[static-difference-classification.json](continuation/static-difference-classification.json) records every original/reconstructed hash and exact path. No frozen file was replaced.

Twenty files `articles/<id>/index.html` differ only in their two source-commit references. Substituting `912c75fddc54f223f5d2997596b9cc224ad4b830` with `b81e2093e80cb8dc31b56fcb14f969dad124bdfa` in memory reproduces each frozen SHA256 exactly. IDs: agent-budgets, agent-evaluation, agent-identity, agent-memory, agent-observability, agent-orchestration, agent-planning, agent-sandboxing, agent-to-agent-communication, ai-agent, computer-use-agents, context-engineering, durable-agent-execution, human-oversight, model-context-protocol, prompt-injection, retrieval-augmented-generation, structured-outputs, tool-permissions, tool-use. This exact hash match excludes additional article-content or timestamp differences for these files.

`release-source.json` differs only in commit/tree provenance; those two substitutions reproduce the frozen hash exactly.

Four Pagefind paths differ:

- `pagefind/index/en_708815b.pf_index` (reconstructed corresponding shard: `en_f3da604.pf_index`);
- `pagefind/index/en_a3d517c.pf_index` (reconstructed corresponding shard: `en_6764e2d.pf_index`);
- `pagefind/pagefind-entry.json`;
- `pagefind/pagefind.en_83825bc69a.pf_meta` (reconstructed corresponding metadata: `pagefind.en_1d3a6d6a3a.pf_meta`).

The retained recovery copies of the original Pagefind files match frozen module-manifest hashes. Decoding gzip/CBOR and mapping delta document IDs to immutable fragment IDs establishes identical metadata and all 1,551 indexed terms/postings/positions/field weights. Document ordering changes the derived shard/metadata names and entry pointer. Normalized digest: `4ca660eeb396ad0d9d101bd8af0f90e58a86c11505d4f60b79fe2c48c615f488`. Read-only comparison scripts and decoded evidence are retained. No content, timestamp or absolute source-path difference was detected; the provenance differences are Git identity references.

## Minimal read-only inspection still needed

On the saved environment holding the preserved frozen package (not this ordinary reconstruction):

1. Read the package manifest and rehash it to the exact `bb6663fa…fe7eb` pin. Reject absent/extra modules, unsafe paths, symlinks or unexpected file types. Confirm 81 modules, declared types, byte sizes and each SHA256, especially `worker.js` and all 80 Data modules.
2. Rehash the preserved configuration to `ad6e0eed…1735`; inspect target, origin, module paths/types, compatibility settings, named bindings and default-disabled private/public flags without reading or exporting secret values. Verify aggregate uncompressed size and the manifest's deterministic gzip measurement using the declared module order.
3. Read the preserved input manifest `260142f1…33f9` and its pinned input inventory. Confirm content commit b81e209 and article hashes, the 81 frozen static inputs including `_headers`, and their mapping into Data modules/header rules. Read the compiled Worker/module references to confirm the pinned immutable-source and maintenance-catalog binding, absent release.json semantics, and expected noindex header rules. Do not rebuild, normalize, overwrite or substitute the package.

Successful inspection would close package-byte custody/integrity, not convert historical/combined evidence into a successful original-runner receipt or establish live Access/editorial/deployment acceptance. Any mismatch stops package use. No full suite, source patch, upload or provider action is required for these read-only checks; deployment authorization and live preflight remain separate.
