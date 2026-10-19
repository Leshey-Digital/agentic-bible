import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionConfig } from '../../scripts/assert-production-config.mjs';

const valid = () => ({
  environment: 'production',
  origin: 'https://agenticbible.si',
  discoveryMode: 'production',
  bindings: { EDITORIAL_DB: { type: 'd1', name: 'agentic-bible-production' } },
  secrets: [
    { name: 'HOSTED_ADMIN_TRUST', source: 'cloudflare-secret' },
    { name: 'GITHUB_CONTENT_TOKEN', source: 'cloudflare-secret' },
  ],
  publicEnvironmentKeys: [],
  adminTrust: {
    issuer: 'https://auth.agenticbible.si/', audience: 'agentic-bible-admin',
    assertionHeader: 'cf-access-jwt-assertion', subjects: ['admin-principal-7f31a2'], keyIds: ['owner-key-2026'],
  },
  indexing: {
    canonicalOrigin: 'https://agenticbible.si', publicIndexing: true, privateNoindex: true,
    previewNoindex: true, syntheticNoindex: true, outboxEnabled: false,
  },
});

test('accepts a complete explicit production descriptor without needing secret values', () => {
  const result = validateProductionConfig(valid());
  assert.equal(result.ok, true);
  assert.ok(result.checks.includes('server-only-github-token'));
});

test('rejects absent, staging, malformed, or alternate production origin/mode', () => {
  for (const [field, value] of [
    ['origin', undefined], ['origin', 'https://www.agenticbible.si'], ['origin', 'https://agenticbible.si/'],
    ['origin', 'http://agenticbible.si'], ['discoveryMode', 'staging'], ['environment', 'staging'],
  ]) {
    const config = valid(); config[field] = value;
    assert.throws(() => validateProductionConfig(config));
  }
});

test('rejects missing or wrongly typed D1 binding', () => {
  for (const binding of [undefined, { type: 'kv', name: 'db' }, { type: 'd1', name: '' }, { type: 'd1', name: 'db', database_id: 'unsafe-extra' }]) {
    const config = valid(); config.bindings.EDITORIAL_DB = binding;
    assert.throws(() => validateProductionConfig(config), /production_(bindings|d1_binding)_invalid/);
  }
});

test('requires server-side admin trust and GitHub token references and rejects client exposure', () => {
  const config = valid(); config.secrets = [{ name: 'HOSTED_ADMIN_TRUST', source: 'cloudflare-secret' }];
  assert.throws(() => validateProductionConfig(config), /production_server_secrets_invalid/);
  const exposed = valid(); exposed.publicEnvironmentKeys = ['GITHUB_CONTENT_TOKEN'];
  assert.throws(() => validateProductionConfig(exposed), /production_secret_exposure_forbidden/);
  const unknown = valid(); unknown.publicEnvironmentKeys = ['PUBLIC_UNREVIEWED_SETTING'];
  assert.throws(() => validateProductionConfig(unknown), /production_secret_exposure_forbidden/);
  const malformed = valid(); malformed.publicEnvironmentKeys = [null];
  assert.throws(() => validateProductionConfig(malformed), /production_secret_exposure_forbidden/);
  const duplicate = valid(); duplicate.publicEnvironmentKeys = ['PUBLIC_AGENTIC_BIBLE_SOURCE_COMMIT', 'PUBLIC_AGENTIC_BIBLE_SOURCE_COMMIT'];
  assert.throws(() => validateProductionConfig(duplicate), /production_secret_exposure_forbidden/);
  const known = valid(); known.publicEnvironmentKeys = ['PUBLIC_AGENTIC_BIBLE_SOURCE_COMMIT'];
  assert.equal(validateProductionConfig(known).ok, true);
  const badSource = valid(); badSource.secrets[1].source = 'plain-text-var';
  assert.throws(() => validateProductionConfig(badSource), /production_server_secrets_invalid/);
});

test('rejects missing, local, wildcard-like, or malformed admin trust identity', () => {
  for (const mutate of [
    (c) => { c.adminTrust.subjects = []; },
    (c) => { c.adminTrust.subjects = ['local-editor']; },
    (c) => { c.adminTrust.issuer = 'http://identity.example.test'; },
    (c) => { c.adminTrust.issuer = 'https://identity.example.test'; },
    (c) => { c.adminTrust.audience = ''; },
    (c) => { c.adminTrust.audience = 'example-admin'; },
    (c) => { c.adminTrust.keyIds = []; },
    (c) => { c.adminTrust.subjects = ['owner', 'owner']; },
    (c) => { c.adminTrust.subjects = ['owner-subject-id']; },
  ]) {
    const config = valid(); mutate(config);
    assert.throws(() => validateProductionConfig(config), /production_admin_trust_invalid/);
  }
});

test('rejects unsafe production discovery and indexing controls', () => {
  for (const [field, value] of [
    ['publicIndexing', false], ['privateNoindex', false], ['previewNoindex', false],
    ['syntheticNoindex', false], ['outboxEnabled', true], ['canonicalOrigin', 'https://staging.agenticbible.si'],
  ]) {
    const config = valid(); config.indexing[field] = value;
    assert.throws(() => validateProductionConfig(config), /production_indexing_controls_invalid/);
  }
});
