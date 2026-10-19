# Added requirements

## Documented structured decisions

The server library SHALL encode the official TypeSafe System One API and accept only explicitly configured reviewed pinned Jev versions. It SHALL send only compiled advisory Noul questions and treat supplied content as untrusted data. Responses SHALL match the requested version, exact question IDs, finite probabilities in [0,1] and safe integer token usage. Answers SHALL NOT authorize article publication or claim factual verification.

Scenario: controlled transport receives the request and returns the documented valid Noul response. The caller receives typed advisory output and usage; connection status remains unverified.

## Fail-closed transport and monetary authority

Without enablement, a valid secret, a pinned model, transport and trusted charged-execution authority, evaluation SHALL dispatch zero transport requests. Request JSON and response streams SHALL have finite byte limits. Deadline and cancellation SHALL apply across authority, dispatch and body consumption. Redirects and non-200 responses SHALL fail without exposing raw bodies or exceptions. Each evaluation SHALL allow one transport attempt and no retry, even after a rate limit or ambiguous outcome.

Scenario: a charge authority denies admission, returns without dispatch, attempts a second dispatch, or stalls past the deadline. Evaluation fails, with zero or at most one dispatch as appropriate; late callbacks cannot dispatch after closure.

Scenario: the provider response is valid but settlement fails. Evaluation reports an uncertain charge outcome rather than success. The trusted ledger retains uncertainty; this module cannot release reservations.

## Capability honesty

Jev SHALL NOT be presented as a prose generator. Calling generation SHALL fail with `jev_text_generation_unsupported` and zero charge/transport invocation. Fixture success SHALL NOT be reported as a real provider connection. The required charged-execution dependency SHALL NOT itself be described as a working production currency ledger.
