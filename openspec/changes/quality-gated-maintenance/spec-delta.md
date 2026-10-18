# Added requirements

- Version 2 quality-gated maintenance requires a configured trusted bounded semantic/evidence verifier; missing configuration stops before collection or provider dispatch.
- Before any publication, every manifest unit requires supported evidence and the verifier must affirm full semantic claim coverage, substantive content, authentic citations, safety, nonspam and a distinct canonical update. Unknowns deny.
- Assessments bind exact candidate, claim manifest and source bytes, plus trusted adapter identity/revision and policy. A changed candidate or source cannot reuse an event decision.
- Original-evidence lineage comes from trusted assessment of the bound source bytes. Syndicated copies and overlapping derived roots count as one lineage; domains do not count as independent sources.
- Terminal quality decisions are immutable and replayable. Unknown dispatch outcomes remain held with no automatic retry. Existing source/provider charges are never erased or refunded on denial.
- Automatic publication retains the existing post-publication flags and human review workflow. Quality audit does not itself create a human disposition.
- New canonical descriptors carry schema version 2 and the bound quality receipt; old records retain their exact format. Old readers reject new descriptors; a downgrade cannot rewrite records.

# Acceptance scenarios

Actual local workerd/D1 must exercise allow/deny, restart/replay, races, source/lineage/manifest binding and retained uncertainty. A controlled end-to-end run must collect sources, charge a proposal, deny unsupported content without publishing, and publish qualifying content through the existing owned Git/history/review path. No test may mutate repository article Markdown.
