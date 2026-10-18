# Proposed consumer requirements

- Given retained raw source bytes and a request key, reconstruct and verify the actual charged original-200 D1 receipt, re-extract under the compiled profile, and retain raw/extracted hashes and byte spans. Do not accept candidate-nominated receipt metadata or origin roots.
- Given the agreed quality-source structure, validate its original bytes, source/URL, profile, raw hash, extracted hash/text/spans and unknown lineage. Reject fixture-like extracted-text substitution, origin assertions and any mismatch.
- Given a trusted acquisition-to-quality port, perform this verification without another request or charge. It returns unknown-lineage quality inputs; the actual gate owns denial and its separate trusted semantic/original-provenance verifier.
- Given an old retained known outcome, an explicit trusted historical-integrity context can verify original bytes/receipts after 24 hours or clock rollback. Default/new-source verification retains freshness checks. Invalid timestamp/hash/source/reservation/length still rejects, and no packet field can enable historical mode.
- Given a leading raw UTF-8 BOM, reject before TextDecoder changes the string’s byte origin. Pure and actual native regressions must preserve that boundary.

No live DOM/provider compatibility, semantic correctness, source independence, canonical publication or review approval is established by adapter helper tests alone.
