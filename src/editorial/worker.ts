import type { EditorialEnv, EditorialStore, Disposition } from './contracts.ts';
import { dispositions } from './contracts.ts';
import { D1EditorialStore } from './store.ts';
import { localMode, sameOrigin, localSession, currentSession, sessionCookie } from './auth.ts';
import { InputError, RateLimitError, ReplayConflictError, CapacityError, submissionInput, changeInput, readJson, readLimitedText, digest } from './validation.ts';
import { signIn, messagePage, inbox, detail } from './views.ts';
import { monitoringRoutes } from '../monitoring/routes.ts';
import { settingsRoutes } from '../settings/routes.ts';
import { publicSettingsPreview } from '../settings/render.ts';

const uuid = /^[a-f0-9-]{36}$/;
const headers = {
  'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin', 'Vary': 'Cookie',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
};
const json = (data: unknown, status = 200, extra = {}) => Response.json(data, { status, headers: { ...headers, ...extra } });
const html = (body: string, status = 200, extra = {}) => new Response(body, { status, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8', ...extra } });
const redirect = (location: string, extra = {}) => new Response(null, { status: 303, headers: { ...headers, Location: location, ...extra } });
async function form(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/x-www-form-urlencoded') throw new InputError({ form: 'Use the supplied form.' }, 415);
  return Object.fromEntries(new URLSearchParams(await readLimitedText(request)));
}

export async function handle(request: Request, env: EditorialEnv): Promise<Response> {
  const url = new URL(request.url); const path = url.pathname;
  const admin = path === '/admin' || path.startsWith('/admin/');
  const api = path.startsWith('/api/');
  if (!admin && !api) return publicSettingsPreview(request,env);
  const isLocal = localMode(request, env);
  if (path === '/api/editorial/status' && request.method === 'GET') return json({ enabled: isLocal && !!env.EDITORIAL_DB, mode: 'local-synthetic-only', publicIntake: false });
  if (!isLocal) return admin ? html(messagePage('Admin access is not configured', 'Local fixture identities are unavailable here. A verified production identity provider is required.'), 503) : json({ error: 'Public intake and production admin access are not configured.' }, 503);
  if (!env.EDITORIAL_DB) return json({ error: 'Editorial storage is unavailable. Keep your draft and try again after local setup.' }, 503);
  const store: EditorialStore = new D1EditorialStore(env.EDITORIAL_DB);
  if (!['GET', 'HEAD'].includes(request.method) && !sameOrigin(request)) return json({ error: 'Use a same-origin request.' }, 403);

  if (path === '/api/submissions' && request.method === 'POST') {
    const input = submissionInput(await readJson(request));
    if (input.website) return json({ received: true }, 202); // Honeypot: do not retain payload or reveal detection.
    // Local synthetic-only policy uses a local hash namespace. No raw IP is stored.
    const clientHash = await digest(`local-fixture:${request.headers.get('CF-Connecting-IP') ?? '127.0.0.1'}`);
    const receipt = await store.submit(input, clientHash, Date.now());
    return json({ received: true, reference: receipt.id, duplicate: receipt.duplicate }, receipt.duplicate ? 200 : 201);
  }
  if (path === '/admin/sign-in/' || path === '/admin/sign-in') {
    if (request.method === 'GET') return html(signIn());
    if (request.method === 'POST') {
      const values = await form(request);
      const result = await localSession(values.identity, store);
      return result ? redirect('/admin/', { 'Set-Cookie': result.cookie }) : html(signIn('Choose one of the two local test identities.'), 422);
    }
    return json({ error: 'Method not allowed.' }, 405);
  }
  const session = await currentSession(request, store);
  if (!session) return admin ? redirect('/admin/sign-in/') : json({ error: 'Sign in with an admin identity.' }, 401);
  if (path === '/admin/sign-out/' && request.method === 'POST') {
    const values = await form(request);
    if (values.csrf !== session.csrf) return json({ error: 'Reload the form before signing out.' }, 403);
    await store.removeSession(session.tokenHash);
    return redirect('/admin/sign-in/', { 'Set-Cookie': sessionCookie('', true) });
  }
  if (session.role !== 'admin') return admin ? html(messagePage('Admin role required', 'This local reader identity cannot access editorial submissions.', session), 403) : json({ error: 'Admin role required.' }, 403);
  if (path === '/admin/settings' || path.startsWith('/admin/settings/') || path === '/api/admin/settings') return settingsRoutes(request,env,session);
  if (path === '/admin/sources' || path.startsWith('/admin/sources/') || path.startsWith('/api/admin/monitor/')) return monitoringRoutes(request, env, session);
  if (path === '/api/admin/session' && request.method === 'GET') return json({ identity: session.identity, role: session.role, csrf: session.csrf });
  if ((path === '/api/admin/submissions' || path === '/admin/' || path === '/admin') && request.method === 'GET') {
    const status = url.searchParams.get('status') ?? 'new';
    if (!(dispositions as readonly string[]).includes(status)) throw new InputError({ status: 'Choose an inbox filter.' }, 400);
    const result = await store.list(status as Disposition, url.searchParams.get('before') ?? undefined);
    return admin ? html(inbox(result.items, status as Disposition, result.next, session)) : json(result);
  }
  const match = /^\/(api\/admin\/submissions|admin\/items)\/([a-f0-9-]+)\/?$/.exec(path);
  if (match && uuid.test(match[2])) {
    const id = match[2]; const item = await store.get(id);
    if (!item) return admin ? html(messagePage('Suggestion not found', 'This reference is not in the local inbox.', session), 404) : json({ error: 'Suggestion not found.' }, 404);
    if (request.method === 'GET') {
      const audit = await store.audit(id);
      return admin ? html(detail(item, audit, session, url.searchParams.has('saved') ? 'Disposition saved. The audit history includes this update.' : '')) : json({ item, audit });
    }
    if ((admin && request.method === 'POST') || (api && request.method === 'PATCH')) {
      const values = admin ? await form(request) : await readJson(request);
      const record = values as Record<string, unknown>;
      if (typeof values !== 'object' || values === null || (admin ? record.csrf : request.headers.get('X-CSRF-Token')) !== session.csrf) return json({ error: 'Reload this item before saving.' }, 403);
      try {
        const change = changeInput(values);
        const updated = await store.update(id, change, session.identity, Date.now());
        if (!updated) {
          const current = (await store.get(id))!;
          return admin ? html(detail(current, await store.audit(id), session, 'Another update changed this item. Your entered tags are preserved below. Check the current revision before saving again.', { tags: String(record.tags ?? ''), status: String(record.status ?? '') }, true), 409) : json({ error: 'This revision changed. Reload before saving.' }, 409);
        }
        return admin ? redirect(`/admin/items/${id}/?saved=1`) : json({ updated: true });
      } catch (error) {
        if (admin && error instanceof InputError) return html(detail(item, await store.audit(id), session, Object.values(error.fields).join(' '), { tags: String(record.tags ?? ''), status: String(record.status ?? '') }, true), 422);
        throw error;
      }
    }
    return json({ error: 'Method not allowed.' }, 405);
  }
  return json({ error: 'Editorial route not found.' }, 404);
}

export default {
  async fetch(request: Request, env: EditorialEnv): Promise<Response> {
    try { return await handle(request, env); }
    catch (error) {
      if (error instanceof InputError) return json({ error: error.message, fields: error.fields }, error.status);
      if (error instanceof RateLimitError) return json({ error: 'Five suggestions per ten minutes are allowed in this local preview. Your draft is preserved; try again later.' }, 429, { 'Retry-After': '600' });
      if (error instanceof ReplayConflictError) return json({ error: 'This request reference belongs to different content. Start a new suggestion.' }, 409);
      if (error instanceof CapacityError) return json({ error: 'The local inbox has reached its 1,000-suggestion limit. Your draft is kept. Export/archive local records deliberately before reopening intake.' }, 503);
      // Do not leak SQL, payloads, source URLs, cookies or exception details into responses/logs.
      return new URL(request.url).pathname.startsWith('/admin') ? html(messagePage('Editorial storage is unavailable', 'No update was confirmed. Return to the inbox and retry after local storage is restored.'), 503) : json({ error: 'Could not save or load this record. Keep your draft and try again.' }, 503);
    }
  },
};
