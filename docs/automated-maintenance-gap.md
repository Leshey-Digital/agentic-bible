# Automated-maintenance gap audit

Audited frozen PR34 `697d546fc5b6560fe1c38e573584c855c86c13af`. Main remains `2ad330e06fcc4dd46a8fc95291ccc3cd1c597327`; the twenty-entry candidate is not merged/deployed.

| Stage | Existing software | Precise boundary |
|---|---|---|
| Discovery/source monitoring | Fixed allowlist in `src/monitoring/http-registry.ts`, bounded Node/Workers HTTP adapters and actual D1 receipts in `http-store.ts` | No recursive discovery, schedule or live app collector. Source bytes are supplied separately; monitoring admin controls use synthetic responses and publish metadata only. |
| Article proposal | `fixtures/wiki-bridge/packet.json` supplies an entire manually authored revision | No model port, provider reservation/token accounting, or producer from charged source bytes. This is the selected missing connection. |
| Source/technical validation | `src/wiki-bridge/contracts.ts` checks regular bounded original bytes against successful charged D1 receipts, citation URLs/hashes/lengths and existing publisher schema | Integrity/accounting is not factual truth, source authenticity or a semantic claim verifier. Arbitrary model prose cannot currently be admitted safely. |
| Automatic publication + flags | `WikiBridge.execute`, `PublicationStore.execute`, full isolated Astro/Pagefind/history/review build | A technically valid supplied revision publishes automatically to an explicitly synthetic local snapshot, then carries human follow-up flags. It does not change canonical repository Markdown or live assets. |
| Canonical GitHub update | `src/hosted/github.ts` creates a pinned draft for a verified, explicitly admin-approved community correction | No automated-maintenance authority/commit adapter. Reusing or forging community approval would violate the separate correction workflow. A draft PR is not automatic article publication. |
| Hosted build/release | PR33 commit-pinned CI artifact and explicitly manual, disabled staging release workflow | No automated article promotion/release chain or live resource setup. This task does not merge, dispatch a release or reinterpret manual release approval as article editorial preapproval. |

Selected bounded successor: charged source files/receipts → one budget-reserved deterministic extractive provider → strict source-linked proposal → existing automatic local wiki bridge → existing post-publication flag/history/search. Reuse current D1, publisher and builder. Add no service or generic agent framework. The fake provider and synthetic budget units must be explicit, never a live-model/spend/factual-validation claim.

Only exact, complete bounded source paragraphs with citation/hash/offset proof are admitted; model-created summaries, new URLs, instructions, approval metadata or unsupported claims fail closed. This deliberately narrow producer is not a general factual validator. Real source normalization/authenticity, a reviewed generative claim policy, real model/tokenizer/rates/currency caps, a default-closed automated GitHub authority/commit adapter and actual release integration remain software/setup gaps. No universal human prepublication gate is added. Community corrections retain explicit admin review.

No live source/model/GitHub write, paid call, secret, deployment, merge, indexing or license action is authorized by this audit. The approved roughly $5 baseline/$10 operating target is not a concrete provider allocation.

## Controlled body collection successor

The separate [source collection connection](maintenance-source-collection.md) now captures original bounded plain-text responses through the existing charged HTTP/D1 validator, persists immutable body/journal evidence and feeds it directly into the fake producer. This replaces the separation of manually supplied fixture paths for the explicit controlled demo/native journey. Live discovery, scheduling, HTML normalization/authenticity, real provider/currency allocation, canonical GitHub writer and hosted release/review connections remain absent. No new human article preapproval is introduced.
