# Reject coerced publication topics

Independent review of PR11 head efeffed9467a9fa67125725d923d6d672cfd9555 demonstrated that a JSON array topic such as ["Foundations"] was coerced for enum comparison, then persisted and activated as an array. Require an actual string before checking the existing topic enum. Keep the stable invalid_topic reason and all valid publication/quality-flag behavior.

Branch locally from that exact head; keep PR11, PR10 and the HTTP branch unchanged. Regression coverage must prove malformed array/object/null/number/unexpected string input leaves the active pointer, complete artifact inventory/manifests, history and receipts unchanged. Verify a corrected event can reuse the rejected key. Inspect adjacent coercions; change no unrelated behavior without a demonstrated issue. No dependency, route, schema, runtime resource, paid call or publication change. Independent author recheck follows this local checkpoint; no push, PR, merge or deployment.
