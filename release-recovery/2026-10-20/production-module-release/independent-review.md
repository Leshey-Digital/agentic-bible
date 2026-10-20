# Independent module-serving review

Inspected candidate SHA-256: `985cb80ecc4b413aae39f6ad560e896d2cdd704badfdc8a9eaa2144de36e789a`.
Content candidate preserved: `765e1b85eadd8c744839e1288ad720129685aa68b6a696e4102ee87b6eab1fb1`.

Verified exact hashes/lengths of all82 modules (Worker plus81 public data files), config SHA and each data file against frozen content inventory. Original _headers is compiled into matching rules; it is not exposed as an asset. No source-content mutation was found. Binding-free configuration disables previews/observability and sets10ms CPU limit.

Source review found no blocking path traversal, open redirect, external request, write endpoint, or secret exposure defect. Exact own-key lookup serves only manifest paths. Encoded slash/backslash/NUL/control sequences fail closed. Redirects stay same-origin, preserve query and canonicalize slash/index paths. Public canonical/indexing headers and private noindex rules are preserved;404s additionally carry noindex. Non-GET/HEAD requests get405 with Allow. Conditional ETags and byte ranges use frozen bytes; no runtime D1/admin/provider integration exists.

Independent direct makeServer probes passed: same-origin canonical redirects; encoded-path rejection; inaccessible _headers/__proto__; closed API/admin writes; GET/HEAD;304; exact Pagefind binary range; public versus private robots headers. No external requests performed by these probes.

Observed native parity test's initial final assertion failed because it searched for nonexistent '.wasm' extension and requested '/undefined'. Actual Pagefind binary is 'pagefind/wasm.en.pagefind' with octet-stream type. This is a test-path defect, not evidence of content mismatch: preceding all81 native content checks had passed. Parent owns correcting that assertion and retained initial failure.

Serving-layer code is accepted in this bounded review, subject to final actual native/browser evidence and separate upload/activation review. Not a production-serving claim. Module-served requests invoke Worker billing/quota rather than Static Assets-free serving;10ms CPU is not a monthly cost guarantee. No new plan, credential, paid model call, secret binding, staging change or canonical write is required by this artifact.

## Non-activating upload review

Accepted for one non-activating upload after operator fresh-main confirmation:
- Operation `febe70aa-4040-476e-9b13-f7a554599e3e`.
- Capsule SHA-256 `cbe226a41d0f99e7fcfae9fd9ce39d6103236be6a07b6421b4f9f68d8f8c35a0`,783435 bytes.
- Payload SHA-256 `0d2c9550a72062c4074a1c9461724ed0e4705995e1d54d8e9a5e510d135faf56`.

Checks pin account, Worker893644f8a086435a82644c15e59fa05e/name, null deployed_on, empty versions/deployments,82 modules, no assets/bindings and deploy:false. Single POST, no internal retry, no activation/hostname request. It creates a distinct module candidate and preserves failed Assets attempts. Recommend bounded structural version response instead of raw provider result for future hardening; no concrete secret exposure found for this binding-free empty target. Activation requires separate reviewed version/config and checks.

Observed native corrected parity4/4 passed, including81 content responses and repeated actual Pagefind binaries. Production-equivalent browser4/4 passed desktop/mobile. Retained browser external-request assertion is hardcoded to localhost8787 while this layer runs8790; its failure must be replaced with equivalent8790 assertion, not treated as external traffic. One desktop aggregate final-six journey timeout remains retained; it is not a diagnosed content defect.
