/**
 * Bounded, transaction-consistent D1 export and fresh-database restore.
 *
 * D1's batch API is the consistency boundary: the schema recheck, table
 * metadata, and every table read are statements in one transaction. A batch
 * failure aborts capture. Restore likewise creates schema and rows in a single
 * D1 batch, so a failure leaves the destination empty.
 */
const MAX_EXPORT_BYTES = 32 * 1024 * 1024;
const MAX_TABLES = 40;
const MAX_ROWS = 20_000;
const MAX_BATCH_STATEMENTS = 100;
const MAX_BINDS_PER_STATEMENT = 100;
const MAX_SQL_BYTES_PER_STATEMENT = 100_000;
const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;

type D1Value = null | string | number | ArrayBuffer | ArrayBufferView;
type D1Row = Record<string, unknown>;
type D1Result = { results?: D1Row[]; success?: boolean };
type D1Statement = { bind(...values: D1Value[]): D1Statement };
export interface RecoveryD1Database {
  prepare(sql: string): D1Statement & { all?(): Promise<D1Result>; run?(): Promise<D1Result> };
  batch(statements: D1Statement[]): Promise<D1Result[]>;
}

type SchemaObject = { type: 'table' | 'index' | 'trigger' | 'view'; name: string; table: string; sql: string };
type EncodedValue = { kind: 'null' } | { kind: 'string'; value: string } | { kind: 'number'; value: number } | { kind: 'blob'; value: string };
type TableData = { name: string; columns: string[]; references: string[]; rows: EncodedValue[][] };
type Payload = { schema: SchemaObject[]; tables: TableData[] };
type Manifest = { format: 'agentic-bible-d1-recovery'; schemaVersion: 1; sourceCommit: string; capturedAt: string; tableCount: number; rowCount: number; payloadSha256: string; payloadBytes: number };
type Envelope = { manifest: Manifest; payload: Payload };

const quoteIdent = (value: string) => `"${value.replaceAll('"', '""')}"`;
const quoteSqlString = (value: string) => `'${value.replaceAll("'", "''")}'`;
const tableMetadataSql = (name: string) => `SELECT cid,name,type,hidden,(SELECT group_concat("table",char(10)) FROM pragma_foreign_key_list(${quoteSqlString(name)})) AS ref_tables FROM pragma_table_xinfo(${quoteSqlString(name)})`;
const utf8 = new TextEncoder();
const base64 = (bytes: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};
const fromBase64 = (value: string) => {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error('d1_recovery_invalid_blob');
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};
async function sha256(value: string): Promise<string> {
  const bytes = utf8.encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('');
}
function rows(result: D1Result | undefined): D1Row[] {
  if (!result || result.success === false || !Array.isArray(result.results)) throw new Error('d1_recovery_query_failed');
  return result.results;
}
function schemaObjects(raw: D1Row[]): SchemaObject[] {
  const result: SchemaObject[] = [];
  for (const row of raw) {
    if (typeof row.type !== 'string' || typeof row.name !== 'string' || typeof row.tbl_name !== 'string' || typeof row.sql !== 'string') throw new Error('d1_recovery_schema_invalid');
    if (!['table', 'index', 'trigger', 'view'].includes(row.type)) continue;
    if (row.name.startsWith('sqlite_') || row.name.startsWith('_cf_')) continue;
    if (row.type === 'table' && /\bCREATE\s+VIRTUAL\s+TABLE\b/i.test(row.sql)) throw new Error('d1_recovery_virtual_table_unsupported');
    if (utf8.encode(row.sql).byteLength > MAX_SQL_BYTES_PER_STATEMENT) throw new Error('d1_recovery_sql_limit');
    result.push({ type: row.type as SchemaObject['type'], name: row.name, table: row.tbl_name, sql: row.sql });
  }
  result.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  const tableCount = result.filter((item) => item.type === 'table').length;
  if (tableCount === 0) throw new Error('d1_recovery_zero_tables');
  if (tableCount > MAX_TABLES) throw new Error('d1_recovery_table_limit');
  return result;
}
function encode(value: unknown): EncodedValue {
  if (value === null) return { kind: 'null' };
  if (typeof value === 'string') return { kind: 'string', value };
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) throw new Error('d1_recovery_integer_precision');
    return { kind: 'number', value };
  }
  // workerd's D1 JSON bridge represents BLOB result values as byte arrays.
  if (Array.isArray(value) && value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)) return { kind: 'blob', value: base64(Uint8Array.from(value)) };
  if (value instanceof ArrayBuffer) return { kind: 'blob', value: base64(new Uint8Array(value)) };
  if (ArrayBuffer.isView(value)) return { kind: 'blob', value: base64(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)) };
  throw new Error('d1_recovery_value_unsupported');
}
function decode(value: EncodedValue): D1Value {
  if (!value || typeof value !== 'object') throw new Error('d1_recovery_value_invalid');
  if (value.kind === 'null') return null;
  if (value.kind === 'string' && typeof value.value === 'string') return value.value;
  if (value.kind === 'number' && typeof value.value === 'number' && Number.isFinite(value.value) && (!Number.isInteger(value.value) || Number.isSafeInteger(value.value))) return value.value;
  if (value.kind === 'blob' && typeof value.value === 'string') return fromBase64(value.value).buffer;
  throw new Error('d1_recovery_value_invalid');
}
function restoreStatementCount(payload: Payload): number {
  const schemas = payload.schema.length;
  const inserts = payload.tables.filter((table) => table.name !== 'sqlite_sequence').reduce((count, table) => count + Math.ceil(table.rows.length / Math.max(1, Math.floor(MAX_BINDS_PER_STATEMENT / table.columns.length))), 0);
  const sequences = (payload.tables.find((table) => table.name === 'sqlite_sequence')?.rows.length ?? 0) * 2;
  return schemas + inserts + sequences + 6; // Atomic fresh-target and runtime column-inventory guards.
}

/** Capture all ordinary D1 tables, indexes, triggers, and views at one D1 batch boundary. */
export async function createD1RecoveryBackup(db: RecoveryD1Database, sourceCommit: string, capturedAt = new Date().toISOString()): Promise<string> {
  if (!COMMIT.test(sourceCommit) || !Number.isFinite(Date.parse(capturedAt)) || new Date(capturedAt).toISOString() !== capturedAt) throw new Error('d1_recovery_metadata_invalid');
  const discovery = rows(await db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND sql IS NOT NULL ORDER BY type,name").all?.());
  const expected = schemaObjects(discovery);
  const tableObjects = expected.filter((item) => item.type === 'table');
  const schemaBytes = expected.reduce((size, item) => size + utf8.encode(item.sql).byteLength, 0);
  // Reserve enough for JSON's worst-case control-character escaping, typed
  // wrappers and keys before reading row values into the Worker.
  const dataBudget = Math.floor((MAX_EXPORT_BYTES - schemaBytes - 64 * 1024) / 8);
  if (dataBudget <= 0) throw new Error('d1_recovery_size_limit');
  const preliminaryMetadata = await db.batch(tableObjects.map((table) => db.prepare(tableMetadataSql(table.name))));
  const preliminary = tableObjects.map((table, i) => {
    const metadata = rows(preliminaryMetadata[i]);
    const columns = metadata.filter((column) => Number(column.hidden ?? 0) === 0).map((column) => column.name);
    if (!columns.length || columns.some((name) => typeof name !== 'string')) throw new Error('d1_recovery_columns_invalid');
    const references = [...new Set(metadata.flatMap((column) => typeof column.ref_tables === 'string' ? column.ref_tables.split('\n') : []))].sort();
    return { name: table.name, columns: columns as string[], references };
  });
  // sqlite_sequence carries the AUTOINCREMENT high-water mark, including deleted rows.
  const hasAutoincrement = tableObjects.some((item) => /\bAUTOINCREMENT\b/i.test(item.sql));
  const statements: D1Statement[] = [db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND sql IS NOT NULL ORDER BY type,name")];
  const maxRowsPerTable = Math.max(1, Math.min(Math.floor(MAX_ROWS / tableObjects.length), Math.floor(dataBudget / (tableObjects.length * Math.max(...preliminary.map((table) => table.columns.length)) * 48))));
  const maxBytesPerTable = Math.floor(dataBudget / tableObjects.length);
  for (const table of preliminary) {
    // Table-valued pragma functions are queryable inside D1 batches, unlike
    // direct PRAGMA statements which D1 rejects in its Workers API.
    statements.push(db.prepare(tableMetadataSql(table.name)));
    const sizes = table.columns.map((column) => `COALESCE(length(CAST(${quoteIdent(column)} AS BLOB)),0)`).join(' + ');
    const selected = table.columns.map((column, i) => `${quoteIdent(column)} AS ${quoteIdent(`c_${i}`)}`).join(',');
    const dataSql = `WITH stats AS (SELECT COUNT(*) AS row_count,COALESCE(SUM(${sizes}),0) AS total_bytes FROM ${quoteIdent(table.name)}) SELECT stats.row_count AS __ab_row_count,stats.total_bytes AS __ab_total_bytes,captured.* FROM stats LEFT JOIN (SELECT ${selected} FROM ${quoteIdent(table.name)}) AS captured ON stats.row_count <= ? AND stats.total_bytes <= ?`;
    if (utf8.encode(dataSql).byteLength > MAX_SQL_BYTES_PER_STATEMENT) throw new Error('d1_recovery_sql_limit');
    statements.push(db.prepare(dataSql).bind(maxRowsPerTable, maxBytesPerTable));
  }
  if (hasAutoincrement) statements.push(db.prepare('SELECT name,seq FROM sqlite_sequence ORDER BY name'));
  if (statements.length > MAX_BATCH_STATEMENTS) throw new Error('d1_recovery_statement_limit');
  const result = await db.batch(statements);
  const actual = schemaObjects(rows(result[0]));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('d1_recovery_schema_changed');
  const tables: TableData[] = [];
  let rowCount = 0;
  let index = 1;
  for (const table of tableObjects) {
    const metadata = rows(result[index++]);
    const columns = metadata.filter((column) => Number(column.hidden ?? 0) === 0).map((column) => column.name);
    if (columns.length === 0 || columns.some((name) => typeof name !== 'string')) throw new Error('d1_recovery_columns_invalid');
    const columnNames = columns as string[];
    const references = [...new Set(metadata.flatMap((column) => typeof column.ref_tables === 'string' ? column.ref_tables.split('\n') : []))].sort();
    const preflight = preliminary.find((item) => item.name === table.name)!;
    if (JSON.stringify(columnNames) !== JSON.stringify(preflight.columns) || JSON.stringify(references) !== JSON.stringify(preflight.references)) throw new Error('d1_recovery_schema_changed');
    const readRows = rows(result[index++]);
    const actualRows = Number(readRows[0]?.__ab_row_count), actualBytes = Number(readRows[0]?.__ab_total_bytes);
    if (!Number.isSafeInteger(actualRows) || actualRows < 0 || actualRows > maxRowsPerTable) throw new Error('d1_recovery_row_limit');
    if (!Number.isSafeInteger(actualBytes) || actualBytes < 0 || actualBytes > maxBytesPerTable) throw new Error('d1_recovery_size_limit');
    const dataRows = actualRows === 0 ? [] : readRows;
    if (dataRows.length !== actualRows) throw new Error('d1_recovery_inventory_mismatch');
    rowCount += actualRows;
    if (rowCount > MAX_ROWS) throw new Error('d1_recovery_row_limit');
    const encoded = dataRows.map((row) => columnNames.map((_, i) => encode(row[`c_${i}`])));
    tables.push({ name: table.name, columns: columnNames, references, rows: encoded });
  }
  if (hasAutoincrement) {
    const sequences = rows(result[index]);
    if (sequences.length) tables.push({ name: 'sqlite_sequence', columns: ['name', 'seq'], references: [], rows: sequences.map((row) => [encode(row.name), encode(row.seq)]) });
  }
  const payload: Payload = { schema: expected, tables };
  if (restoreStatementCount(payload) > MAX_BATCH_STATEMENTS) throw new Error('d1_recovery_statement_limit');
  const canonicalPayload = JSON.stringify(payload);
  const payloadBytes = utf8.encode(canonicalPayload).byteLength;
  if (payloadBytes > MAX_EXPORT_BYTES) throw new Error('d1_recovery_size_limit');
  const envelope: Envelope = { manifest: { format: 'agentic-bible-d1-recovery', schemaVersion: 1, sourceCommit, capturedAt, tableCount: tableObjects.length, rowCount, payloadSha256: await sha256(canonicalPayload), payloadBytes }, payload };
  const serialized = JSON.stringify(envelope);
  if (utf8.encode(serialized).byteLength > MAX_EXPORT_BYTES) throw new Error('d1_recovery_size_limit');
  return serialized;
}

async function verifyEnvelope(input: string | unknown): Promise<Envelope> {
  let serialized: string;
  if (typeof input === 'string') serialized = input;
  else {
    try { serialized = JSON.stringify(input); } catch { throw new Error('d1_recovery_invalid_export'); }
  }
  if (typeof serialized !== 'string' || utf8.encode(serialized).byteLength > MAX_EXPORT_BYTES) throw new Error('d1_recovery_size_limit');
  let value: unknown;
  try { value = JSON.parse(serialized); } catch { throw new Error('d1_recovery_invalid_export'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('d1_recovery_invalid_export');
  const envelope = value as Partial<Envelope>;
  const m = envelope.manifest;
  const p = envelope.payload;
  if (!m || m.format !== 'agentic-bible-d1-recovery' || m.schemaVersion !== 1 || !COMMIT.test(m.sourceCommit) || typeof m.capturedAt !== 'string' || !Number.isFinite(Date.parse(m.capturedAt)) || new Date(m.capturedAt).toISOString() !== m.capturedAt || !Number.isSafeInteger(m.tableCount) || !Number.isSafeInteger(m.rowCount) || !Number.isSafeInteger(m.payloadBytes) || !SHA256.test(m.payloadSha256) || !p || !Array.isArray(p.schema) || !Array.isArray(p.tables)) throw new Error('d1_recovery_invalid_export');
  const canonicalPayload = JSON.stringify(p);
  if (utf8.encode(canonicalPayload).byteLength !== m.payloadBytes || p.schema.length > MAX_TABLES * 4 || p.tables.length > MAX_TABLES + 1 || !Number.isSafeInteger(m.tableCount) || m.tableCount < 1 || m.tableCount > MAX_TABLES || !Number.isSafeInteger(m.rowCount) || m.rowCount > MAX_ROWS) throw new Error('d1_recovery_inventory_invalid');
  if (m.tableCount !== p.schema.filter((x) => x?.type === 'table').length || m.rowCount !== p.tables.filter((x) => x?.name !== 'sqlite_sequence').reduce((n, table) => n + (Array.isArray(table?.rows) ? table.rows.length : 0), 0)) throw new Error('d1_recovery_inventory_invalid');
  if (p.tables.length !== p.schema.filter((x) => x?.type === 'table').length + (p.tables.some((x) => x?.name === 'sqlite_sequence') ? 1 : 0)) throw new Error('d1_recovery_inventory_invalid');
  if (p.schema.some((item) => !item || !['table', 'index', 'trigger', 'view'].includes(item.type) || typeof item.name !== 'string' || typeof item.table !== 'string' || typeof item.sql !== 'string' || item.name.startsWith('sqlite_') || item.name.startsWith('_cf_') || utf8.encode(item.sql).byteLength > MAX_SQL_BYTES_PER_STATEMENT)) throw new Error('d1_recovery_schema_invalid');
  if (p.tables.some((table) => !table || typeof table.name !== 'string' || !Array.isArray(table.columns) || table.columns.length < 1 || table.columns.length > MAX_BINDS_PER_STATEMENT || table.columns.some((name) => typeof name !== 'string' || name.length === 0) || new Set(table.columns).size !== table.columns.length || !Array.isArray(table.references) || table.references.some((name) => typeof name !== 'string') || !Array.isArray(table.rows) || table.rows.some((row) => !Array.isArray(row) || row.length !== table.columns.length))) throw new Error('d1_recovery_table_invalid');
  const schemaTableNames = p.schema.filter((item) => item.type === 'table').map((item) => item.name).sort();
  const payloadTableNames = p.tables.filter((item) => item.name !== 'sqlite_sequence').map((item) => item.name).sort();
  if (new Set(schemaTableNames).size !== schemaTableNames.length || new Set(payloadTableNames).size !== payloadTableNames.length || JSON.stringify(schemaTableNames) !== JSON.stringify(payloadTableNames) || (p.tables.some((item) => item.name === 'sqlite_sequence') && !p.schema.some((item) => item.type === 'table' && /\bAUTOINCREMENT\b/i.test(item.sql)))) throw new Error('d1_recovery_inventory_invalid');
  const objectKeys = p.schema.map((item) => `${item.type}\n${item.name}`);
  if (new Set(objectKeys).size !== objectKeys.length || p.tables.some((table) => table.references.some((name) => !schemaTableNames.includes(name)))) throw new Error('d1_recovery_inventory_invalid');
  if (restoreStatementCount(p) > MAX_BATCH_STATEMENTS) throw new Error('d1_recovery_statement_limit');
  if (p.tables.some((table) => table.rows.some((row) => row.some((value) => { try { decode(value); return false; } catch { return true; } })))) throw new Error('d1_recovery_value_invalid');
  if (await sha256(canonicalPayload) !== m.payloadSha256) throw new Error('d1_recovery_digest_mismatch');
  return { manifest: m as Manifest, payload: p };
}

/** Restore atomically into a fresh D1 database. Existing schemas/data are never overwritten. */
export async function restoreD1RecoveryBackup(db: RecoveryD1Database, input: unknown, options: { authorizeSchema: (manifest: Manifest, schema: SchemaObject[], tables: TableData[]) => boolean | Promise<boolean> }) {
  const { manifest, payload } = await verifyEnvelope(input);
  if (typeof options?.authorizeSchema !== 'function' || await options.authorizeSchema(manifest, payload.schema, payload.tables) !== true) throw new Error('d1_recovery_schema_not_authorized');
  const existing = rows(await db.prepare("SELECT type,name FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all?.());
  if (existing.length !== 0) throw new Error('d1_recovery_destination_not_empty');
  const tableMap = new Map(payload.tables.map((table) => [table.name, table]));
  const objects = [...payload.schema].sort((a, b) => {
    const rank = (type: string) => type === 'table' ? 0 : type === 'view' ? 1 : type === 'index' ? 2 : 3;
    return rank(a.type) - rank(b.type) || a.name.localeCompare(b.name);
  });
  const statements: D1Statement[] = [];
  // Recheck emptiness inside the same transaction as restore. The separate
  // read below gives a useful early error, while this guard closes the race
  // where another writer creates an object between that read and this batch.
  const emptyGuardName = '__agentic_bible_d1_empty_guard';
  if (payload.schema.some((item) => item.name === emptyGuardName)) throw new Error('d1_recovery_reserved_table_name');
  statements.push(db.prepare(`CREATE TABLE ${quoteIdent(emptyGuardName)}(valid INTEGER NOT NULL CHECK(valid=1))`));
  statements.push(db.prepare(`INSERT INTO ${quoteIdent(emptyGuardName)}(valid) SELECT CASE WHEN EXISTS (SELECT 1 FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> ?) THEN 0 ELSE 1 END`).bind(emptyGuardName));
  statements.push(db.prepare(`DROP TABLE ${quoteIdent(emptyGuardName)}`));
  for (const object of objects.filter((item) => item.type === 'table')) statements.push(db.prepare(object.sql));
  const restoreTables = payload.tables.filter((table) => table.name !== 'sqlite_sequence');
  const guardName = '__agentic_bible_d1_restore_guard';
  if (restoreTables.some((table) => table.name === guardName)) throw new Error('d1_recovery_reserved_table_name');
  statements.push(db.prepare(`CREATE TABLE ${quoteIdent(guardName)}(valid INTEGER NOT NULL CHECK(valid=1))`));
  const columnChecks = restoreTables.map((table) => `(SELECT group_concat(name,char(10)) FROM (SELECT name FROM pragma_table_xinfo(${quoteSqlString(table.name)}) WHERE hidden=0 ORDER BY cid)) = ?`);
  statements.push(db.prepare(`INSERT INTO ${quoteIdent(guardName)}(valid) VALUES (${columnChecks.join(' AND ')})`).bind(...restoreTables.map((table) => table.columns.join('\n'))));
  statements.push(db.prepare(`DROP TABLE ${quoteIdent(guardName)}`));
  const remaining = new Map(payload.tables.filter((table) => table.name !== 'sqlite_sequence').map((table) => [table.name, table]));
  const dataTables: TableData[] = [];
  while (remaining.size) {
    const ready = [...remaining.values()].filter((table) => table.references.every((name) => !remaining.has(name))).sort((a, b) => a.name.localeCompare(b.name));
    if (!ready.length) throw new Error('d1_recovery_foreign_key_cycle');
    for (const table of ready) { dataTables.push(table); remaining.delete(table.name); }
  }
  for (const table of dataTables) {
    const columns = table.columns.map(quoteIdent).join(',');
    const bindsPerRow = table.columns.length;
    if (bindsPerRow < 1 || bindsPerRow > MAX_BINDS_PER_STATEMENT) throw new Error('d1_recovery_column_limit');
    const rowsPerStatement = Math.max(1, Math.floor(MAX_BINDS_PER_STATEMENT / bindsPerRow));
    for (let offset = 0; offset < table.rows.length; offset += rowsPerStatement) {
      const chunk = table.rows.slice(offset, offset + rowsPerStatement);
      const valuesSql = chunk.map(() => `(${table.columns.map(() => '?').join(',')})`).join(',');
      const bindings = chunk.flatMap((row) => row.map((value) => decode(value)));
      statements.push(db.prepare(`INSERT INTO ${quoteIdent(table.name)} (${columns}) VALUES ${valuesSql}`).bind(...bindings));
    }
  }
  const sequences = tableMap.get('sqlite_sequence');
  if (sequences) {
    for (const [name, sequence] of sequences.rows) {
      const [tableName, seq] = [decode(name), decode(sequence)];
      statements.push(db.prepare('UPDATE sqlite_sequence SET seq=MAX(seq,?) WHERE name=?').bind(seq, tableName));
      statements.push(db.prepare('INSERT INTO sqlite_sequence(name,seq) SELECT ?,? WHERE NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name=?)').bind(tableName, seq, tableName));
    }
  }
  for (const object of objects.filter((item) => item.type !== 'table')) statements.push(db.prepare(object.sql));
  if (statements.length > MAX_BATCH_STATEMENTS) throw new Error('d1_recovery_statement_limit');
  await db.batch(statements);
  return { sourceCommit: manifest.sourceCommit, capturedAt: manifest.capturedAt, tableCount: manifest.tableCount, rowCount: manifest.rowCount, restored: true };
}

/** Validate an artifact before passing its bytes to the existing encrypted R2 adapter. */
export async function verifyD1RecoveryBackup(input: unknown) {
  const { manifest } = await verifyEnvelope(input);
  return { ...manifest };
}
