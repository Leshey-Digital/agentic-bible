import type { EditorialStore, SqlDatabase, Submission, SubmissionInput, Change, Disposition, Session, AuditEntry } from './contracts.ts';
import { digest, InputError, RateLimitError, ReplayConflictError, CapacityError } from './validation.ts';

interface Row {
  id: string; article_id: Submission['articleId']; kind: Submission['kind']; message: string; source_url: string;
  status: Disposition; tags: string; version: number; created_at: number; updated_at: number;
}
const fromRow = (row: Row): Submission => ({
  id: row.id, articleId: row.article_id, kind: row.kind, message: row.message, sourceUrl: row.source_url,
  status: row.status, tags: JSON.parse(row.tags), version: row.version, createdAt: row.created_at, updatedAt: row.updated_at,
});

export class D1EditorialStore implements EditorialStore {
  private db: SqlDatabase;
  constructor(db: SqlDatabase) { this.db = db; }
  async submit(input: SubmissionInput, clientHash: string, now: number) {
    const fingerprint = await digest(JSON.stringify([clientHash, input.articleId, input.kind, input.message, input.sourceUrl]));
    const replay = await this.db.prepare('SELECT id, fingerprint FROM submissions WHERE request_key = ?').bind(input.requestKey).first<{ id: string; fingerprint: string }>();
    if (replay) {
      if (replay.fingerprint !== fingerprint) throw new ReplayConflictError();
      return { id: replay.id, duplicate: true };
    }
    const duplicate = await this.db.prepare('SELECT id FROM submissions WHERE fingerprint = ?').bind(fingerprint).first<{ id: string }>();
    if (duplicate) return { id: duplicate.id, duplicate: true };
    const id = crypto.randomUUID(); const eventId = crypto.randomUUID(); const window = Math.floor(now / 600_000);
    const result = await this.db.batch([
      this.db.prepare(`INSERT INTO rate_windows (client_hash, window, count) VALUES (?, ?, 1)
        ON CONFLICT(client_hash, window) DO UPDATE SET count = count + 1 WHERE count < 5`).bind(clientHash, window),
      // changes() belongs to the immediately preceding statement in this transaction.
      this.db.prepare(`INSERT INTO submissions
        (id, request_key, fingerprint, article_id, kind, message, source_url, last_event_id, created_at, updated_at)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() > 0 AND (SELECT COUNT(*) FROM submissions) < 1000 ON CONFLICT DO NOTHING`)
        .bind(id, input.requestKey, fingerprint, input.articleId, input.kind, input.message, input.sourceUrl, eventId, now, now),
      this.db.prepare(`INSERT INTO editorial_audit (id, submission_id, actor, action, status, tags, created_at)
        SELECT ?, id, 'local-submitter', 'submitted', status, tags, ? FROM submissions WHERE id = ? AND last_event_id = ?`)
        .bind(eventId, now, id, eventId),
      this.db.prepare('DELETE FROM rate_windows WHERE rowid IN (SELECT rowid FROM rate_windows WHERE window < ? LIMIT 100)').bind(window - 1),
      this.db.prepare('DELETE FROM local_sessions WHERE token_hash IN (SELECT token_hash FROM local_sessions WHERE expires_at < ? LIMIT 100)').bind(now),
    ]);
    const saved = await this.db.prepare('SELECT id, fingerprint FROM submissions WHERE request_key = ? OR fingerprint = ? LIMIT 1')
      .bind(input.requestKey, fingerprint).first<{ id: string; fingerprint: string }>();
    if (saved) {
      if (saved.fingerprint !== fingerprint) throw new ReplayConflictError();
      return { id: saved.id, duplicate: saved.id !== id };
    }
    if (result[0].meta.changes === 0) throw new RateLimitError();
    const count = await this.db.prepare('SELECT COUNT(*) AS count FROM submissions').first<{ count: number }>();
    if (count && count.count >= 1000) throw new CapacityError();
    throw new Error('The submission was not committed.');
  }

  async list(status: Disposition, before?: string) {
    let time = Number.MAX_SAFE_INTEGER; let id = 'zzzz';
    if (before) {
      const match = /^(\d{13})~([a-f0-9-]{36})$/.exec(before);
      if (!match) throw new InputError({ cursor: 'Use the next-page link from the inbox.' }, 400);
      time = Number(match[1]); id = match[2];
    }
    const result = await this.db.prepare(`SELECT * FROM submissions WHERE status = ?
      AND (created_at < ? OR (created_at = ? AND id < ?)) ORDER BY created_at DESC, id DESC LIMIT 21`)
      .bind(status, time, time, id).all<Row>();
    const items = result.results.slice(0, 20).map(fromRow); const last = items.at(-1);
    return { items, next: result.results.length > 20 && last ? `${last.createdAt}~${last.id}` : null };
  }
  async get(id: string) {
    const row = await this.db.prepare('SELECT * FROM submissions WHERE id = ?').bind(id).first<Row>();
    return row ? fromRow(row) : null;
  }
  async audit(id: string): Promise<AuditEntry[]> {
    const result = await this.db.prepare('SELECT * FROM editorial_audit WHERE submission_id = ? ORDER BY created_at DESC, id DESC LIMIT 30').bind(id)
      .all<{ id: string; actor: string; action: string; status: string; tags: string; created_at: number }>();
    return result.results.map(row => ({ id: row.id, actor: row.actor, action: row.action, status: row.status, tags: JSON.parse(row.tags), createdAt: row.created_at }));
  }
  async update(id: string, change: Change, actor: string, now: number) {
    const eventId = crypto.randomUUID();
    const result = await this.db.batch([
      this.db.prepare(`UPDATE submissions SET status = ?, tags = ?, version = version + 1, last_event_id = ?, updated_at = ? WHERE id = ? AND version = ?`)
        .bind(change.status, JSON.stringify(change.tags), eventId, now, id, change.version),
      this.db.prepare(`INSERT INTO editorial_audit (id, submission_id, actor, action, status, tags, created_at)
        SELECT ?, id, ?, 'review-updated', status, tags, ? FROM submissions WHERE id = ? AND last_event_id = ?`)
        .bind(eventId, actor, now, id, eventId),
    ]);
    return result[0].meta.changes === 1;
  }
  async createSession(session: Session) {
    await this.db.prepare('INSERT INTO local_sessions (token_hash, identity, role, csrf, expires_at) VALUES (?, ?, ?, ?, ?)')
      .bind(session.tokenHash, session.identity, session.role, session.csrf, session.expiresAt).run();
  }
  async session(tokenHash: string, now: number) {
    return this.db.prepare('SELECT token_hash AS tokenHash, identity, role, csrf, expires_at AS expiresAt FROM local_sessions WHERE token_hash = ? AND expires_at > ?')
      .bind(tokenHash, now).first<Session>();
  }
  async removeSession(tokenHash: string) { await this.db.prepare('DELETE FROM local_sessions WHERE token_hash = ?').bind(tokenHash).run(); }
}
