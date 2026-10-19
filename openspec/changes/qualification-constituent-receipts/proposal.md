# Qualification constituent receipts

Split the local release runner's aggregate `validate` command into its exact serial constituent scripts. Bind their ordered inventory to the package manifest and qualification receipt so a successful record proves which checks ran and preserves their individual bounded logs.

## Motivation

An aggregate validation command concealed which constituent passed before a timeout and did not bind its contents to a qualification digest. Individual receipts make retries unnecessary and make the exact validation inventory reviewable.

## Compatibility

New qualifications use schema version 2 and pin the validation-manifest digest, check phase, and manifest index. Existing schema-version-1 qualification receipts remain verifiable under their original 20-command inventory.
