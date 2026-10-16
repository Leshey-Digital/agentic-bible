import { DatabaseSync } from 'node:sqlite';
import type { SqlDatabase, SqlStatement } from '../../src/editorial/contracts.ts';
import { readFileSync } from 'node:fs';

export class SqliteD1 implements SqlDatabase {
  raw: DatabaseSync;
  constructor(path = ':memory:', initialize = true) {
    this.raw = new DatabaseSync(path);
    this.raw.exec('PRAGMA foreign_keys = ON');
    if (initialize) this.raw.exec(readFileSync(new URL('../../migrations/0001_editorial.sql', import.meta.url), 'utf8'));
  }
  prepare(sql: string): SqlStatement {
    const make = (values: (string | number | null)[]): SqlStatement => ({
      bind: (...next) => make(next),
      first: async <T>() => (this.raw.prepare(sql).get(...values) as T | undefined) ?? null,
      all: async <T>() => ({ results: this.raw.prepare(sql).all(...values) as T[] }),
      run: async () => ({ meta: { changes: Number(this.raw.prepare(sql).run(...values).changes) } }),
    });
    return make([]);
  }
  async batch(statements: SqlStatement[]) {
    this.raw.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.raw.exec('COMMIT');
      return results;
    } catch (error) { this.raw.exec('ROLLBACK'); throw error; }
  }
}
