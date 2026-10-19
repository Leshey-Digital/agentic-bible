# Production configuration preflight

Add a local, read-only guard for the production deployment descriptor. It verifies the explicit production origin and discovery mode, required hosted admin trust identity, D1 binding, server-only GitHub token reference, and public/private/preview indexing safeguards before any future production release work.

The guard accepts a secret-free JSON descriptor. It never reads or provisions credentials, creates remote resources, submits indexing requests, or deploys. The owner must supply the exact identity, D1 resource and secret-store references through their approved setup process; tests use synthetic values only.

Rollback: remove the standalone guard and its tests/spec record. It has no persistent state or external effects.
