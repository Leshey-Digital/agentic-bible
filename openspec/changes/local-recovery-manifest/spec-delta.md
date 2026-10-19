# Spec delta: offline recovery bundle

## Added requirements

- A local recovery bundle records a schema version, source commit, capture timestamp, sorted complete path inventory, file sizes and SHA-256 digests.
- Capture rejects symbolic links, special files, empty trees, more than 4,096 files, and more than 64 MiB of file content.
- Capture traverses held directory descriptors without following symlinks, opens regular files without following a final-component symlink, verifies opened identities, reads within the remaining byte budget, and rejects files that change during capture. Platforms without the required descriptor traversal fail closed.
- Restore verifies exact inventory membership and every file's decoded size and digest before writing. It rejects absolute, empty, dot, parent, backslash and overlong paths.
- Restore creates only a previously nonexistent destination. A failed write removes only the destination created by that invocation.

## Acceptance scenarios

- Given a captured tree within bounds, when restored to a new destination, then every path and byte is identical and the receipt reports the source commit and counts.
- Given an omitted, extra, altered or path-traversing entry, when restore is requested, then validation fails before the destination is created.
- Given a symlink, special file, over-capacity tree or existing destination, when capture or restore runs, then it stops without following links or overwriting existing data.

## Explicit limits

This requirement does not provide encryption, offsite retention, scheduling, D1/SQLite backup, release deployment, production activation or a guarantee of recovery time/data loss objectives.
