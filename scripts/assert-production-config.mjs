#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const projectOrigin = 'https://agenticbible.si';
const allowedTopLevel = ['environment', 'origin', 'discoveryMode', 'bindings', 'secrets', 'publicEnvironmentKeys', 'adminTrust', 'indexing'];
const allowedPublicEnvironmentKeys = new Set(['PUBLIC_AGENTIC_BIBLE_SOURCE_COMMIT']);
const fail = (code) => { throw new Error(code); };
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, expected, code) => {
  if (!record(value) || Object.keys(value).sort().join(',') !== [...expected].sort().join(',')) fail(code);
};
const nonempty = (value) => typeof value === 'string' && value.length > 0 && value === value.trim();
const placeholder = (value) => typeof value !== 'string' || /(?:^|[.@_-])(test|example|invalid|placeholder|localhost)(?:[.@_-]|$)/i.test(value) || /owner-subject-id|\.(?:test|example|invalid|localhost|local)$/i.test(value);

/**
 * Validate a secret-free production deployment descriptor. `secrets` contains
 * names and secret-store references only; secret values are never read here.
 */
export function validateProductionConfig(config) {
  exactKeys(config, allowedTopLevel, 'production_config_shape_invalid');
  if (config.environment !== 'production') fail('production_environment_required');
  if (config.discoveryMode !== 'production') fail('production_discovery_mode_required');
  if (config.origin !== projectOrigin) fail('production_origin_invalid');

  exactKeys(config.bindings, ['EDITORIAL_DB'], 'production_bindings_invalid');
  exactKeys(config.bindings.EDITORIAL_DB, ['type', 'name'], 'production_d1_binding_invalid');
  if (config.bindings.EDITORIAL_DB.type !== 'd1' || !nonempty(config.bindings.EDITORIAL_DB.name)) fail('production_d1_binding_invalid');

  if (!Array.isArray(config.secrets) || config.secrets.length !== 2 ||
      config.secrets.some((secret) => !record(secret)) ||
      config.secrets.map((secret) => secret.name).sort().join(',') !== 'GITHUB_CONTENT_TOKEN,HOSTED_ADMIN_TRUST' ||
      config.secrets.some((secret) => Object.keys(secret).sort().join(',') !== 'name,source' || secret.source !== 'cloudflare-secret')) {
    fail('production_server_secrets_invalid');
  }
  if (!Array.isArray(config.publicEnvironmentKeys) ||
      config.publicEnvironmentKeys.some((key) => typeof key !== 'string' || !allowedPublicEnvironmentKeys.has(key)) ||
      new Set(config.publicEnvironmentKeys).size !== config.publicEnvironmentKeys.length) {
    fail('production_secret_exposure_forbidden');
  }

  exactKeys(config.adminTrust, ['issuer', 'audience', 'assertionHeader', 'subjects', 'keyIds'], 'production_admin_trust_invalid');
  let issuer;
  try { issuer = new URL(config.adminTrust.issuer); } catch { fail('production_admin_trust_invalid'); }
  if (issuer.protocol !== 'https:' || issuer.username || issuer.password || issuer.search || issuer.hash || placeholder(issuer.hostname) ||
      !nonempty(config.adminTrust.audience) || placeholder(config.adminTrust.audience) || config.adminTrust.assertionHeader !== 'cf-access-jwt-assertion' ||
      !Array.isArray(config.adminTrust.subjects) || config.adminTrust.subjects.length < 1 || config.adminTrust.subjects.length > 8 ||
      config.adminTrust.subjects.some((subject) => !nonempty(subject) || placeholder(subject) || ['local-editor', 'local-reader', 'admin'].includes(subject.toLowerCase())) ||
      new Set(config.adminTrust.subjects).size !== config.adminTrust.subjects.length ||
      !Array.isArray(config.adminTrust.keyIds) || config.adminTrust.keyIds.length < 1 || config.adminTrust.keyIds.length > 2 ||
      config.adminTrust.keyIds.some((id) => typeof id !== 'string' || !/^[a-zA-Z0-9._-]{1,64}$/.test(id)) ||
      new Set(config.adminTrust.keyIds).size !== config.adminTrust.keyIds.length) fail('production_admin_trust_invalid');

  exactKeys(config.indexing, ['canonicalOrigin', 'publicIndexing', 'privateNoindex', 'previewNoindex', 'syntheticNoindex', 'outboxEnabled'], 'production_indexing_controls_invalid');
  if (config.indexing.canonicalOrigin !== projectOrigin || config.indexing.publicIndexing !== true ||
      config.indexing.privateNoindex !== true || config.indexing.previewNoindex !== true ||
      config.indexing.syntheticNoindex !== true || config.indexing.outboxEnabled !== false) {
    fail('production_indexing_controls_invalid');
  }
  return { ok: true, checks: ['production-origin', 'production-mode', 'admin-trust-identity', 'd1-binding', 'server-only-github-token', 'indexing-controls'] };
}

async function main() {
  const file = process.argv[2];
  if (!file || process.argv.length !== 3) {
    process.stderr.write('Usage: node scripts/assert-production-config.mjs <secret-free-production-descriptor.json>\n');
    process.exitCode = 2;
    return;
  }
  try {
    const config = JSON.parse(await readFile(file, 'utf8'));
    const result = validateProductionConfig(config);
    process.stdout.write(`Production configuration preflight passed (${result.checks.join(', ')}).\n`);
  } catch (error) {
    const code = error instanceof SyntaxError ? 'production_config_json_invalid' : error instanceof Error ? error.message : 'production_config_invalid';
    process.stderr.write(`Production configuration preflight failed: ${code}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
