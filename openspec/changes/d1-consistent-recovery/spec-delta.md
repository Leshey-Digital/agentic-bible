# Spec delta: consistent D1 recovery

## Added requirements

- D1 backup captures the ordinary schema inventory and every supported table's columns and rows at one transactional batch boundary. Schema drift, unsupported data, or any configured bound overflow fails closed.
- The artifact carries a versioned inventory and integrity digest. Integrity validation detects truncation and accidental changes but does not authenticate the source.
- Restore requires explicit schema authorization and a fresh empty D1 database. All schema and data writes occur in one transaction so any failure leaves the destination unchanged.
- Recovery supports schema objects, ordinary typed values, BLOBs, views, indexes, triggers, foreign-key-ordered rows and AUTOINCREMENT state within documented application caps.

## Acceptance scenarios

- Given tables with related rows and concurrent atomic writers, when capture runs, then all rows represent one D1 transaction boundary, never a partial writer transaction.
- Given a valid artifact and a fresh database, when schema is explicitly authorized and restore succeeds, then schemas, typed values and data survive database restart.
- Given truncated, modified, incomplete, oversized, unsupported, unauthenticated, or unauthorized input, when restore is attempted, then it fails without changing the destination.
- Given a restore statement failure after DDL or earlier row statements, when D1 rolls back its batch, then no partial schema/data remains.
- Given a populated destination, when restore is requested, then it fails without overwriting that destination.

## Explicit limits

The export has bounded table, row, byte and statement ceilings; unsupported virtual tables, unsafe 64-bit numeric values, and cyclic foreign-key graphs fail closed. The integrity digest is not a signature or MAC. The caller remains responsible for authenticated encryption, source authorization, destination selection, retention and backup scheduling.
