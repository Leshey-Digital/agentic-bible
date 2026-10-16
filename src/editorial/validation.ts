import { articleIds, dispositions, type SubmissionInput, type Change } from './contracts.ts';

export class InputError extends Error {
  fields: Record<string, string>;
  status: number;
  constructor(fields: Record<string, string>, status = 422) { super('Check the highlighted fields.'); this.fields = fields; this.status = status; }
}
export class RateLimitError extends Error {}
export class ReplayConflictError extends Error {}
export class CapacityError extends Error {}
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown) => typeof value === 'string' ? value.normalize('NFC').trim() : '';

export function validateSource(value: unknown): string {
  const raw = text(value);
  if (!raw) return '';
  if (raw.length > 500) throw new Error('Use a source URL under 500 characters.');
  const url = new URL(raw);
  const host = url.hostname.toLowerCase().replace(/\.+$/, '');
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !host.includes('.') ||
      host.includes(':') || /^[\d.]+$/.test(host) || /(^|\.)(localhost|local|internal|test|invalid|lan|corp|home|arpa)$/.test(host) ||
      /[\u0000-\u0020]/.test(raw)) throw new Error('Use a public HTTPS source URL without credentials or a custom port.');
  url.hostname = host;
  return url.href;
}

export function submissionInput(value: unknown): SubmissionInput {
  if (!isRecord(value)) throw new InputError({ form: 'Send a submission object.' });
  const fields: Record<string, string> = {};
  const articleId = text(value.articleId);
  const kind = text(value.kind);
  const message = text(value.message);
  const requestKey = text(value.requestKey);
  if (!(articleIds as readonly string[]).includes(articleId)) fields.articleId = 'Choose an article in this collection.';
  if (!['correction', 'source'].includes(kind)) fields.kind = 'Choose correction or source.';
  if (message.length < 20 || message.length > 2000) fields.message = 'Use 20–2,000 characters and describe the evidence.';
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(message)) fields.message = 'Remove control characters.';
  // Intake is plain text, not an executable/HTML submission channel.
  if (/<\s*\/?[a-z!][^>]*>/i.test(message)) fields.message = 'Use plain text, without HTML or executable markup.';
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(requestKey)) fields.requestKey = 'Reload the form to create a valid request reference.';
  if (typeof value.sourceUrl !== 'string') fields.sourceUrl = 'Use a source URL as text, or leave it empty.';
  let sourceUrl = '';
  try { sourceUrl = validateSource(value.sourceUrl); } catch { fields.sourceUrl = 'Use a public HTTPS URL without credentials, a private host or a custom port.'; }
  if (kind === 'source' && !sourceUrl) fields.sourceUrl = 'Include the primary source URL.';
  if (Object.keys(fields).length) throw new InputError(fields);
  return { articleId, kind, message, requestKey, sourceUrl, website: text(value.website) } as SubmissionInput;
}

export function changeInput(value: unknown): Change {
  if (!isRecord(value)) throw new InputError({ form: 'Send an update object.' });
  const status = text(value.status);
  const tags = [...new Set(text(value.tags).split(',').map(tag => tag.trim()).filter(Boolean))];
  const version = typeof value.version === 'number' ? value.version : typeof value.version === 'string' && /^[1-9]\d*$/.test(value.version) ? Number(value.version) : NaN;
  const fields: Record<string, string> = {};
  if (typeof value.tags !== 'string') fields.tags = 'Enter tags as comma-separated text.';
  if (!(dispositions as readonly string[]).includes(status)) fields.status = 'Choose a valid disposition.';
  if (!Number.isSafeInteger(version) || version < 1) fields.version = 'Reload this item before updating.';
  if (tags.length > 8 || tags.some(tag => tag.length > 30 || !/^[\p{L}\p{N} -]+$/u.test(tag))) fields.tags = 'Use up to eight tags, each 1–30 letters, numbers, spaces or hyphens.';
  if (Object.keys(fields).length) throw new InputError(fields);
  return { status, tags, version } as Change;
}

export async function readLimitedText(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) throw new InputError({ form: 'The request is empty.' }, 400);
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 8192) { await reader.cancel(); throw new InputError({ form: 'The request exceeds 8 KiB.' }, 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new InputError({ form: 'Send valid UTF-8 text.' }, 400); }
}

export async function readJson(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new InputError({ form: 'Use application/json.' }, 415);
  const text = await readLimitedText(request);
  try { return JSON.parse(text); }
  catch { throw new InputError({ form: 'Send valid UTF-8 JSON.' }, 400); }
}

export async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
