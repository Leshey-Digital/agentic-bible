export const articleIds = ['ai-agent', 'tool-use', 'model-context-protocol'] as const;
export const dispositions = ['new', 'follow-up', 'resolved', 'dismissed'] as const;
export type Disposition = typeof dispositions[number];
export type SubmissionInput = {
  requestKey: string;
  articleId: typeof articleIds[number];
  kind: 'correction' | 'source';
  message: string;
  sourceUrl: string;
  website: string;
};
export type Submission = Omit<SubmissionInput, 'website' | 'requestKey'> & {
  id: string; status: Disposition; tags: string[]; version: number; createdAt: number; updatedAt: number;
};
export type AuditEntry = { id: string; actor: string; action: string; status: string; tags: string[]; createdAt: number };
export type Session = { tokenHash: string; identity: string; role: 'admin' | 'reader'; csrf: string; expiresAt: number };
export type Change = { status: Disposition; tags: string[]; version: number };
export interface EditorialStore {
  submit(input: SubmissionInput, clientHash: string, now: number): Promise<{ id: string; duplicate: boolean }>;
  list(status: Disposition, before?: string): Promise<{ items: Submission[]; next: string | null }>;
  get(id: string): Promise<Submission | null>;
  audit(id: string): Promise<AuditEntry[]>;
  update(id: string, change: Change, actor: string, now: number): Promise<boolean>;
  createSession(session: Session): Promise<void>;
  session(tokenHash: string, now: number): Promise<Session | null>;
  removeSession(tokenHash: string): Promise<void>;
}
export interface SqlStatement {
  bind(...values: (string | number | null)[]): SqlStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface SqlDatabase {
  prepare(sql: string): SqlStatement;
  batch(statements: SqlStatement[]): Promise<{ meta: { changes: number } }[]>;
}
export interface EditorialEnv {
  EDITORIAL_DB?: SqlDatabase;
  LOCAL_EDITORIAL_MODE?: string;
  LOCAL_CORRECTIONS_MODE?: string;
  ASSETS: { fetch(request: Request): Promise<Response> };
}
