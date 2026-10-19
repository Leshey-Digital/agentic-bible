# Cloudflare Llama 3.2 input-token upper bound

## Problem and outcome

The injected Workers AI prose adapter requires a pre-dispatch input-token upper bound. The model's Cloudflare page documents a 60,000-token context window and says `raw: false` applies a chat template, but does not publish the template's token overhead. Add a conservative byte-level bound for explicit raw-prompt calls and fail closed for chat-templated, malformed, empty, or over-context input.

The bound uses UTF-8 byte length plus one token for a possible beginning-of-sequence token. This is conservative for the published Llama 3 byte-level BPE tokenizer because BPE merges combine byte pieces and cannot increase their count. The function is safe only when the actual Workers AI request uses `raw: true` and the pinned model's tokenizer remains compatible with Meta's published tokenizer. This utility does not change the adapter request, enable Workers AI, or authorize provider calls.

## Scope and non-goals

- Add an injectable pure function and deterministic tests.
- Preserve fail-closed behavior when the caller cannot attest that raw mode is active.
- Do not infer or guess chat-template overhead.
- Do not change the Cloudflare adapter, runtime bindings, budgets, routes, model configuration, or Wrangler files.
- Do not make live or paid provider calls.

## Dependencies and risks

This relies on Cloudflare's documented raw-mode behavior and context window, and Meta's published Llama 3 tokenizer implementation. Cloudflare does not document the exact hosted tokenizer artifact/version or hidden prompt framing. The helper therefore rejects chat-template mode and remains unwired until a caller can set `raw: true` on the same request. If provider behavior or tokenizer identity changes, the bound needs renewed verification.

Evidence reviewed: [Cloudflare model/API page](https://developers.cloudflare.com/workers-ai/models/llama-3.2-1b-instruct/) names the model, documents 60,000 tokens, `raw: false` template behavior and the raw switch; [Meta's tokenizer implementation](https://github.com/meta-llama/llama-models/blob/main/models/llama3/tokenizer.py) uses tiktoken with a published BPE ranks file; [Meta's BPE loader](https://github.com/meta-llama/llama-models/blob/main/models/tokenizer_utils.py) loads byte-sequence ranks; [tiktoken's implementation](https://github.com/openai/tiktoken/blob/main/tiktoken/core.py) states that BPE operates on bytes. These establish the model-family bound, not Cloudflare's exact deployed tokenizer artifact or any non-raw template overhead.

## Decisions needed

No additional owner decision is needed for this local utility. Any later production activation still requires its separate approved bindings, price card, budget policy, and provider reconciliation.
