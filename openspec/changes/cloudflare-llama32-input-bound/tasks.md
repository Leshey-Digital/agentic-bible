# Tasks

- [x] Verify the official Cloudflare model identifier, raw-mode behavior, and context limit.
- [x] Verify Meta's published Llama 3 tokenizer uses tiktoken-style byte-level BPE.
- [x] Implement raw-only UTF-8-byte upper bound with one-token BOS allowance and fail-closed validation.
- [x] Add deterministic unit coverage for multilingual input, invalid text, missing raw-mode assurance, and context boundary.
- [ ] Wire only alongside an actual `raw: true` request in a separately reviewed adapter change; keep provider dispatch disabled until hosted setup and budget gates are complete.
- [ ] Reconcile first separately authorized provider usage with account-level usage before enabling ongoing work.
