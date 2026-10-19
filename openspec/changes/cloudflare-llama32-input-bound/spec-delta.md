# Specification delta

## Added requirements

- For the pinned Cloudflare `@cf/meta/llama-3.2-1b-instruct` model, a pre-dispatch input reservation may use a UTF-8 byte-count upper bound plus one possible BOS token only when the request is explicitly raw (`raw: true`). The result must not exceed the documented 60,000-token context limit.
- The upper-bound helper must fail closed for absent raw-mode assurance, empty or malformed Unicode input, unsafe arithmetic, and an input reservation over the context limit. It must not estimate undocumented chat-template overhead.
- Given an uncertain provider tokenizer or request framing, paid dispatch remains blocked until the bound's assumptions are verified.

## Acceptance scenarios

- Given well-formed multilingual text and raw mode, reserve at most one token per UTF-8 byte plus one possible BOS token.
- Given default chat-template mode, reject bound construction before dispatch because a framing ceiling is undocumented.
- Given malformed input or a bound above 60,000 tokens, reject before dispatch.

## Explicitly unchanged

- The existing adapter and Worker remain unchanged and disabled by default. This utility alone does not establish hosted activation, price/budget approval, factual validation, or publication authorization.
