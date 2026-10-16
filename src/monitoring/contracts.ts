import type { CatalogSource } from './catalog.ts';
export const scenarios = ['baseline','change','unchanged','not-modified','transient','timeout','redirect','malformed'] as const;
export type Scenario = typeof scenarios[number];
export const limits = Object.freeze({ perRun: 4, attempts: 3, dailyAttempts: 20, responseBytes: 32768, timeoutMs: 2000, leaseMs: 10000, jobs: 500, events: 1000 });
export interface SourceState extends CatalogSource { hash: string | null; etag: string | null; lastModified: string | null; checkedAt: number; version: number; }
export interface Job { id: string; sourceId: string; scenario: Scenario; state: string; attempts: number; dueAt: number; leaseToken: string | null; leaseUntil: number | null; result: string | null; error: string | null; }
export interface Lease { job: Job; source: SourceState; token: string; }
export interface Observation { kind: 'baseline'|'changed'|'unchanged'|'not-modified'; hash: string; etag: string | null; lastModified: string | null; bytes: number; }
export interface SourceEvent { id: string; sourceId: string; sourceVersion: number; oldHash: string; newHash: string; observedAt: number; }
export interface CandidatePayload { kind: 'source-observation'; scope: 'local-fixture-ledger'; articleId: string; evidence: { eventId: string; sourceId: string; sourceUrl: string; oldHash: string; newHash: string }[]; note: string; }
export interface Candidate { id: string; eventId: string; articleId: string; payload: string; state: string; reviewFlag: string; reason: string | null; version: number; createdAt: number; }
export interface Head { articleId: string; currentRevision: string | null; version: number; }
export interface FixtureTransport { mode: 'fixture'; fetch(url: string, options: { headers: Headers; redirect: 'manual'; signal: AbortSignal; scenario: Scenario; attempt: number }): Promise<Response>; }
export class MonitorError extends Error {
  code: string; retryable: boolean;
  constructor(code: string, retryable = false) { super(code); this.code = code; this.retryable = retryable; }
}
