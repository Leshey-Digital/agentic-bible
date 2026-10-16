import type { EditorialEnv, EditorialStore, Session } from './contracts.ts';
import { digest } from './validation.ts';

export const localOrigin = 'http://127.0.0.1:8788';
const cookieName = 'ab_local_editorial';
export function localMode(request: Request, env: EditorialEnv): boolean {
  // A flag alone never enables fixtures at a remote hostname, even if this local config is accidentally uploaded.
  return env.LOCAL_EDITORIAL_MODE === 'synthetic-only' && new URL(request.url).origin === localOrigin;
}
export function sameOrigin(request: Request): boolean {
  return request.headers.get('origin') === new URL(request.url).origin && request.headers.get('sec-fetch-site') !== 'cross-site';
}
export function sessionCookie(token: string, clear = false) {
  // Deliberately restricted to HTTP loopback fixtures. A real deployment must use a verified IdP and Secure cookies.
  return `${cookieName}=${clear ? '' : token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${clear ? '0' : '1200'}`;
}
function cookieToken(request: Request) {
  const values = request.headers.get('cookie')?.split(';').map(value => value.trim()).filter(value => value.startsWith(`${cookieName}=`));
  if (!values || values.length !== 1) return null;
  const token = values[0].slice(cookieName.length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export async function currentSession(request: Request, store: EditorialStore, now = Date.now()): Promise<Session | null> {
  const token = cookieToken(request);
  return token ? store.session(await digest(token), now) : null;
}
export async function localSession(identity: string, store: EditorialStore) {
  if (identity !== 'local-editor' && identity !== 'local-reader') return null;
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const session: Session = {
    tokenHash: await digest(token), identity, role: identity === 'local-editor' ? 'admin' : 'reader',
    csrf: crypto.randomUUID(), expiresAt: Date.now() + 1_200_000,
  };
  await store.createSession(session);
  return { cookie: sessionCookie(token), session };
}
