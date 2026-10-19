# Bounded TypeSafe Jev decision transport

## Problem and outcome

The selected funded TypeSafe Jev product has a documented structured-decision API, but it cannot produce article paragraphs. Add actual documented request/response handling for one compiled advisory Noul question, with injected transport and charged-execution authority. Keep generation explicitly unsupported. No application route, scheduled work, live request or credentials are enabled.

Official sources read on 2026-10-19:

- [API reference](https://docs.typesafe.ai/api): `POST https://api.typesafe.ai/v1/systemone`, Bearer authorization, JSON `model`, `state` and `questions`; Noul replies and token usage.
- [Models](https://docs.typesafe.ai/models): explicit `jev-1.13.0` and `jev-1.14.0` versions. Aliases can change, so this adapter accepts only these pinned versions.
- [Introducing System One Models and Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev): decisions/probabilities rather than generated strings.
- [Jev with coding agents](https://docs.typesafe.ai/introduction/coding-agents): explicitly no text/code generation or conversation.

## Scope and alternatives

`src/maintenance-adapters/jev.ts` supplies a standalone transport library. Its fixed question asks whether untrusted content warrants editorial attention. The answer is advisory; it supplies no factual, source-independence, quality or publication authority. `generate()` always reports `jev_text_generation_unsupported` without invoking either dependency. There is no invented prose endpoint and no adaptation of the deterministic extractive fake into a real generator.

Requests have a 16 KiB UTF-8 JSON limit. Responses have a 4 KiB streamed limit and exact Noul/model/usage validation. The total operation, including admission and settlement, has a maximum two-second deadline, optional earlier cancellation, redirect rejection and one transport attempt. Provider bodies and exception messages are never returned. A valid response does not establish billing settlement or real provider connectivity. The connection status stays `unverified`, including successful fixture tests.

## Dependencies, cost and remaining decisions

There is no default fetch, API key, model, enablement or charge authority. Trusted server composition must inject both transport and `JevChargedExecution`; a browser flag or boolean budget claim cannot substitute. The authority receives exact request JSON/hash and the pinned provider/model. It must atomically reserve approved maximum currency cost, revalidate durable policy immediately before calling the single-use callback, settle its validated usage, and retain uncertain reservations. The adapter bounds/cancels execution but cannot undo a dispatched charge. Automatic retries are forbidden.

This is a required enforcement port, not a concrete Jev currency-ledger implementation. The existing maintenance currency helper is fake-provider-specific, requires a nonzero output price and uses synthetic tokenization; attaching it unchanged would falsely claim real enforcement. Official Jev prices free output, but no price or tokenization assumption is installed here. Owner-approved finite run/day/month caps, current price validity, maximum input reservation calculation, trusted durable accounting, secret custody and production executor remain required before enabling this transport.

Article generation additionally needs a selected prose-capable product, its official endpoint and authentication contract, request/output schema, tokenizer/usage contract, prices and budget policy. Jev documentation cannot supply these facts because it documents a different capability. No alternative provider is chosen by this change.

Risks include provider/schema changes, inaccurate model judgments, transport implementations ignoring abort/redirect policy, and uncertain billing after dispatch. Trusted composition and independent review remain required. Rolling back removes this standalone module and tests; no schema, resource, routes, content or deployed state changes.
