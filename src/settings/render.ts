import type { EditorialEnv } from '../editorial/contracts.ts';
import { localMode } from '../editorial/auth.ts';
import { escape } from '../editorial/views.ts';
import { SettingsStore } from './store.ts';
import type { Settings } from './contracts.ts';

// Explicit reading routes only. Forms, search, private pages, errors, assets and query strings are excluded.
export function eligible(request: Request): boolean {
  const url = new URL(request.url);
  return request.method === 'GET' && !url.search && request.headers.get('DNT') !== '1' && request.headers.get('Sec-GPC') !== '1' &&
    /^(?:\/|\/about\/|\/articles\/(?:ai-agent|tool-use|model-context-protocol)\/|\/topics\/(?:foundations\/|capabilities\/|protocols\/)?$)$/.test(url.pathname);
}
export function policy(settings: Settings) {
  const providers: {provider:string;identifiers:string[];status:'not-connected'}[] = [];
  if (settings.google.values.enabled) providers.push({provider:'google',identifiers:[...new Set([settings.google.values.tagId,settings.google.values.ga4Id].filter(Boolean))],status:'not-connected'});
  if (settings.clarity.values.enabled) providers.push({provider:'clarity',identifiers:[settings.clarity.values.projectId],status:'not-connected'});
  return {schemaVersion:1,mode:'local-inert-preview',trackingEnabled:false,consent:{analytics:'denied',advertising:'denied'},adsEnabled:false,providers};
}
export async function publicSettingsPreview(request: Request, env: EditorialEnv): Promise<Response> {
  const response = await env.ASSETS.fetch(request);
  if (!localMode(request,env) || !env.EDITORIAL_DB || !eligible(request) || response.status !== 200 || !response.headers.get('Content-Type')?.startsWith('text/html')) return response;
  let settings: Settings;
  try { settings = await new SettingsStore(env.EDITORIAL_DB).read(); }
  catch { return response; } // Missing/corrupt local settings never cause tracking or break reading.
  if (!settings.privacy.values.previewEnabled) return response;
  const text = await response.text();
  const template = `<template id="measurement-policy">${escape(JSON.stringify(policy(settings)))}</template>`;
  const headers = new Headers(response.headers);
  headers.set('Cache-Control','private, no-store'); headers.delete('Content-Length'); headers.delete('ETag');
  return new Response(text.replace('</head>',`${template}</head>`),{status:response.status,headers});
}
