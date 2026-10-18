# Proposed delta

- The native canonical writer fixture finishes synchronous owned Git initialization before opening its local D1 runtime.
- The writer continues to receive complete charged evidence and a completed local generation before invocation. The controlled Git baseline and expected-head behavior remain identical.
- A controlled synchronous delay during Git fixture construction must not age an already-open fixture D1 connection. Existing oversized-response, late-response and unrelated-edit assertions must still pass with that delay.
- Database exceptions remain failures. The fixture must not retry reads or writes, suppress exceptions, weaken assertions, or change application deadlines to obtain a passing result.
