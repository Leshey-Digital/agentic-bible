# Offline recovery bundle validation

The production handoff identifies a missing full-site backup and restore drill. Existing canonical maintenance restoration creates a reviewed article revision in Git; it does not provide a portable full-site backup or validate an archive before recovery.

Add a bounded local utility that captures a filesystem tree as a deterministic inventory of file paths, sizes and SHA-256 digests, with bytes encoded into a portable JSON-compatible bundle. Restore verifies the complete inventory and every digest before creating files, rejects unsafe paths/symlinks/special files, and only writes into a destination that does not already exist. It adds no service, credentials, D1 changes, scheduling or remote mutation.

This is a local recovery primitive and testable restore drill, not production backup retention, encryption, offsite storage, database backup, atomic publication, or proof of a live restore objective. Keep the existing append-only operational and canonical history intact.
