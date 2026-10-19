# Specification delta

## Added requirements

- A staging release candidate MUST bind `EDITORIAL_DB` to the fixed approved staging D1 resource.
- A release upload MUST inherit exactly `HOSTED_ADMIN_TRUST`, `INTEGRATION_VAULT_KEY`, and `INTEGRATION_VAULT_KEY_ID` as secret-text bindings from the named Cloudflare Worker. It MUST use strict binding inheritance.
- Candidate artifacts and logs MUST NOT contain values for those bindings. The release path MUST reject missing, extra, or wrong-type external bindings without returning binding values.
- A successfully verified staging runtime MUST report hosted admin verification and integration settings configured, and Jev dispatch `not-mounted`/disabled.

## Unchanged requirements

- The account, Worker, staging origin, source/candidate/qualification pins, noindex policy, expected-active checks, durable receipts, and rollback behavior remain fixed.
- No provider calls, Jev policy, public intake, or canonical article writes are enabled by this change.
