# Accept the pinned pre-controller runtime schema

The legacy rollback baseline validator describes the newer Worker status response,
while the pinned active pre-controller Worker at source `b41a422881921638833f92b2361a70eb1647d01f`
emits a different, versioned JSON shape. A baseline created from its actual
response is therefore rejected, and rollback would reject it again.

## Outcome

Add a new baseline record schema that wraps an explicit runtime schema version
pinned to the known legacy source commit. Preserve and compare the exact
`b41a422` response fields. Do not synthesize newer integration or Jev status
fields. Bind the observed `release.json` response hash to the runtime's existing
`releaseManifestSha256` value and validate its build ID with the exact
historical source/tree/assets/target hash formula.

## Build identity evidence

The owner-observed runtime build ID starts with `4cb050e4`; the historical
source reconstruction produced `fbbea28d`. The candidate build ID formula
hashes the commit/tree, all generated static asset bytes, and fixed target; it
does not include a timestamp. The difference proves the reconstruction is not
the live byte inventory. Store only the build ID observed from the pinned old
runtime and require exact re-observation during rollback. Do not ask the owner
to capture the reconstructed 81-file inventory.

The baseline still requires the complete actual public asset set and SHA-256
inventory. Until its paths and bytes are obtained through an authorized public
read path matching the observed runtime, no usable baseline can be recorded.

## Scope and non-goals

Preserve the existing Cloudflare version, script ETag, exact bindings, original
100% deployment, expected-active guard, independent review pin, exclusive
writer, journal and truthful `legacy-baseline-restored` outcome. No deployment,
live write, credential read, staging GET, build qualification or owner task is
part of this change.
