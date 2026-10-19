# Proposal: bounded D1 recovery export and restore

## Problem and outcome

The existing recovery helpers capture files and encrypt caller-supplied bytes, but they cannot capture mutable D1 schema and data. Add a versioned, bounded D1 artifact whose complete schema and table rows are captured in one D1 transaction and whose restore is atomic into a previously empty database.

## Scope

- Capture ordinary D1 tables, columns, rows, indexes, triggers, views, BLOB values, and SQLite AUTOINCREMENT high-water rows.
- Check schema stability within the transactional batch and fail closed on unsupported virtual tables, unsafe integer precision, excess size, row/table/statement limits, or schema drift.
- Validate payload inventory and digest before restoring to an empty D1 database in a single bounded batch.
- Require the caller to explicitly authorize the schema before executing SQL from the artifact. The SHA-256 digest detects accidental corruption; it is not authentication.
- Test using local Miniflare D1 only, including concurrent atomic writes, failed restore rollback and database restart.

## Non-goals and dependencies

- No provisioning, production binding, scheduler, R2 object, secret, remote D1 call, automatic retention, or deployment.
- No call to the alpha-only Workers `dump()` API. Cloudflare documents `wrangler d1 export` for SQL export; this implementation uses the Workers batch API for an application-controlled bounded artifact.
- The caller must authenticate or decrypt the artifact before invoking restore, then authorize schema SQL (for example, against an approved migration inventory). A content digest alone cannot establish provenance.
- Export/restore is limited to a 32 MiB artifact, 40 tables, 20,000 rows, 100 prepared statements per transaction, 100 bound values per query and 100,000 SQL bytes per statement. The statement count is a conservative application cap; Cloudflare documents the query binding and SQL-size limits, but not this batch-size ceiling.
- Virtual tables and cyclic foreign-key graphs are rejected where the application cannot safely reconstruct them through the documented Workers API.

## Risks and rollback

An artifact can contain personal/editorial records from D1. Do not commit it or log values. Encrypt and authenticate it at rest and restrict access. Restore never overwrites a populated database; failures in the D1 batch must leave a fresh destination unchanged. Rollback is to discard the new empty restore target; no live resource is created by this code.
