# D1 recovery adapter

`src/recovery/d1.ts` exports `createD1RecoveryBackup`, `verifyD1RecoveryBackup` and `restoreD1RecoveryBackup`. It is a code adapter only; it creates no bindings, objects, schedules or remote calls.

Capture reads the D1 schema inventory, then uses one `D1Database.batch()` for a second schema check, table column metadata, every table's rows and (when present) `sqlite_sequence`. Cloudflare documents that `batch()` executes statements sequentially as a transaction and aborts the sequence on failure. A schema change between inventory and capture causes a failure. Export and restore are bounded by the adapter's 32 MiB, 40-table, 20,000-row and 100-statement limits; a 100-value parameter ceiling and 100,000-byte statement ceiling are also applied conservatively. The 100-statement ceiling is an application bound, not a claimed D1 platform limit.

The envelope's SHA-256 catches truncation and accidental modifications. It is unkeyed and does not establish authenticity. **Never restore an artifact from an untrusted source based only on `verifyD1RecoveryBackup`.** Before restore, authenticate/decrypt the bytes in a trusted outer layer and supply `authorizeSchema` to compare the DDL and table inventory with an approved schema or migration inventory. A transactional guard also checks that each created table's actual ordered columns exactly match the artifact's column list before inserting any rows. `restoreD1RecoveryBackup` requires a fresh empty D1 database and submits schema plus row inserts in one D1 batch; a failed batch must leave the new database unchanged. It never overwrites an existing database.

The adapter rejects virtual tables, cycles in foreign-key dependencies, unsupported values, unsafe integer precision, large DDL, and any export that exceeds its transaction/size bounds. If a database exceeds a bound, use Cloudflare's documented Wrangler export path or a separately reviewed recovery procedure; do not split this adapter's single-transaction export/restore into chunks and call it consistent or atomic.

Cloudflare references:

- [D1 import and export](https://developers.cloudflare.com/d1/best-practices/import-export-data/) documents Wrangler SQL export and notes that an export blocks other database requests.
- [D1 Workers API](https://developers.cloudflare.com/d1/worker-api/d1-database/) documents transactional, sequential `batch()` behavior, the alpha-only `dump()` limitation and D1 Sessions behavior.
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) documents per-query limits.
