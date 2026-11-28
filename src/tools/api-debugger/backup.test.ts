import { describe, expect, it } from 'vitest';
import type { CollectionNode } from './collection-tree';
import type { EnvStore } from './environments';
import {
  API_STUDIO_BACKUP_FORMAT,
  API_STUDIO_BACKUP_MAX_BYTES,
  API_STUDIO_BACKUP_VERSION,
  createApiStudioBackup,
  parseApiStudioBackup,
  planApiStudioRestore,
  previewApiStudioBackup,
  serializeApiStudioBackup,
} from './backup';

function tree(secret = 'env-secret-value'): CollectionNode {
  return {
    id: 'root',
    name: 'Workspace',
    scripts: { prerequest: `const token = "${secret}";` },
    items: [
      {
        id: 'folder-1',
        name: 'Authentication',
        scripts: { test: `pm.test("token", () => pm.expect("${secret}").to.exist);` },
        items: [
          {
            id: 'request-1',
            name: 'Login',
            request: {
              method: 'POST',
              url: `https://user:password@api.example.test/login?token=${secret}`,
              headers: [
                { name: 'Content-Type', value: 'application/json' },
                { name: 'Authorization', value: 'Bearer header-secret-value' },
                { name: 'X-Workspace-Key', value: secret },
              ],
              body: `{"token":"${secret}"}`,
            },
            assertions: [{ id: 'assert-1', enabled: true, type: 'json', target: '$.token', operator: 'exists', expected: '' }],
            scripts: { test: `pm.test("login", () => pm.expect("${secret}").to.exist);` },
          },
        ],
      },
    ],
  };
}

function envs(): EnvStore {
  return {
    active: 'Development',
    envs: {
      Development: { baseUrl: 'https://dev.example.test', token: 'env-secret-value' },
      Production: { baseUrl: 'https://api.example.test', token: 'prod-secret-value' },
    },
    global: { shared: 'global-value', token: 'global-secret-value' },
    collection: { collectionId: 'orders', token: 'collection-secret-value' },
    secrets: ['token'],
  };
}

describe('API Studio portable backup', () => {
  it('creates a versioned portable archive and redacts marked secrets and credential fields by default', () => {
    const backup = createApiStudioBackup(tree(), envs(), { exportedAt: '2026-11-27T00:00:00.000Z' });
    const serialized = serializeApiStudioBackup(backup);
    expect(backup.format).toBe(API_STUDIO_BACKUP_FORMAT);
    expect(backup.version).toBe(API_STUDIO_BACKUP_VERSION);
    expect(backup.exportedAt).toBe('2026-11-27T00:00:00.000Z');
    for (const secret of ['env-secret-value', 'prod-secret-value', 'global-secret-value', 'collection-secret-value', 'header-secret-value']) {
      expect(serialized).not.toContain(secret);
    }
    expect(backup.environments.envs.Development.token).toBe('');
    expect(backup.environments.envs.Production.token).toBe('');
    expect(backup.environments.global?.token).toBe('');
    expect(backup.environments.collection?.token).toBe('');
    expect(backup.environments.secrets).toEqual(['token']);
    const request = backup.collection.items[0];
    expect('items' in request).toBe(true);
    if ('items' in request) {
      const login = request.items[0];
      expect('request' in login).toBe(true);
      if ('request' in login) {
        expect(login.request.url).not.toContain('user:password@');
        expect(login.request.headers.some(header => header.name.toLowerCase() === 'authorization')).toBe(false);
        expect(login.request.body).toContain('[REDACTED]');
      }
    }
    expect(backup.security.secretsIncluded).toBe(false);
    expect(backup.security.removedCredentialHeaders).toBe(1);
    expect(backup.security.removedUrlCredentials).toBe(1);
    expect(backup.security.redactedValues).toBeGreaterThan(0);
  });

  it('supports explicit secret-inclusive export without silently changing source data', () => {
    const original = tree();
    const backup = createApiStudioBackup(original, envs(), { includeSecrets: true });
    const serialized = serializeApiStudioBackup(backup);
    expect(backup.security.secretsIncluded).toBe(true);
    expect(serialized).toContain('env-secret-value');
    expect(serialized).toContain('global-secret-value');
    expect(serialized).toContain('Authorization');
    expect(serialized).toContain('user:password@');
    expect(backup.environments.envs.Development.token).toBe('env-secret-value');
    expect(original.items[0]).toEqual(tree().items[0]);
  });

  it('round-trips the full nested collection, scripts, assertions, and all environment scopes', () => {
    const backup = createApiStudioBackup(tree(), envs(), { includeSecrets: true });
    const parsed = parseApiStudioBackup(serializeApiStudioBackup(backup));
    expect(parsed.collection).toEqual(backup.collection);
    expect(parsed.environments).toEqual(backup.environments);
    expect(parsed.security).toEqual(backup.security);
  });

  it('rejects malformed, oversized, unknown-version and unknown-field archives', () => {
    expect(() => parseApiStudioBackup('{')).toThrow('valid JSON');
    expect(() => parseApiStudioBackup(' '.repeat(API_STUDIO_BACKUP_MAX_BYTES + 1))).toThrow('too large');
    const backup = createApiStudioBackup(tree(), envs());
    expect(() => parseApiStudioBackup(JSON.stringify({ ...backup, version: 99 }))).toThrow('Unsupported');
    expect(() => parseApiStudioBackup(JSON.stringify({ ...backup, unexpected: true }))).toThrow('Unsupported field');
    expect(() => parseApiStudioBackup(JSON.stringify({ ...backup, collection: { ...backup.collection, mystery: true } }))).toThrow('Unsupported field');
  });

  it('rejects duplicate node IDs and invalid environment references instead of partially restoring', () => {
    const backup = createApiStudioBackup(tree(), envs());
    const duplicate = structuredClone(backup);
    const folder = duplicate.collection.items[0];
    if ('items' in folder) {
      folder.items[0].id = duplicate.collection.id;
    }
    expect(() => parseApiStudioBackup(JSON.stringify(duplicate))).toThrow('Duplicate collection node ID');
    const badEnv = structuredClone(backup);
    badEnv.environments.active = 'Missing';
    expect(() => parseApiStudioBackup(JSON.stringify(badEnv))).toThrow('active environment');
  });

  it('writes v2 OpenAPI provenance while continuing to restore v1 archives', () => {
    const metadata = {
      version: 1 as const,
      fileName: 'users.yaml',
      title: 'Users API',
      openApiVersion: '3.1.0',
      lastSyncedAt: '2026-11-28T12:00:00.000Z',
      specFingerprint: `sha256-${'a'.repeat(64)}`,
      operations: [{
        key: 'operationId:getUser',
        requestId: 'request-1',
        baseNameFingerprint: `sha256-${'b'.repeat(64)}`,
        baseRequestFingerprint: `sha256-${'c'.repeat(64)}`,
      }],
    };
    const source = { ...tree(), openApiSync: metadata };
    const v2 = createApiStudioBackup(source, envs(), { includeSecrets: true });
    expect(v2.version).toBe(2);
    const restoredV2 = parseApiStudioBackup(serializeApiStudioBackup(v2));
    expect(restoredV2.version).toBe(2);
    expect(restoredV2.collection.openApiSync).toEqual(metadata);

    const oldArchive = { ...createApiStudioBackup(tree(), envs(), { includeSecrets: true }), version: 1 as const };
    const restoredV1 = parseApiStudioBackup(JSON.stringify(oldArchive));
    expect(restoredV1.version).toBe(1);
    expect(restoredV1.collection.openApiSync).toBeUndefined();

    const invalidLegacy = { ...oldArchive, collection: source };
    expect(() => parseApiStudioBackup(JSON.stringify(invalidLegacy))).toThrow('Unsupported field');
  });

  it('previews conflicts and builds replace or merge plans without mutating current state', () => {
    const currentCollection: CollectionNode = {
      id: 'current-root',
      name: 'Current',
      items: [{
        id: 'request-1',
        name: 'Existing request',
        request: { method: 'GET', url: 'https://old.example.test', headers: [], body: '' },
      }],
    };
    const currentEnv: EnvStore = {
      active: 'Development',
      envs: { Development: { token: 'current-token', currentOnly: 'keep' } },
      global: { shared: 'current-shared' },
      secrets: [],
    };
    const backup = parseApiStudioBackup(serializeApiStudioBackup(createApiStudioBackup(tree(), envs(), { includeSecrets: true })));
    const preview = previewApiStudioBackup(backup, currentCollection, currentEnv);
    expect(preview.existingNodeConflicts).toContain('request-1');
    expect(preview.existingEnvironmentNames).toContain('Development');
    expect(preview.newEnvironmentNames).toContain('Production');
    expect(preview.secretValuesIncluded).toBe(true);

    const merge = planApiStudioRestore(currentCollection, currentEnv, backup, 'merge');
    expect(merge.environments.envs.Development.token).toBe('current-token');
    expect(merge.environments.envs.Development.currentOnly).toBe('keep');
    expect(merge.environments.envs.Production.token).toBe('prod-secret-value');
    expect(merge.environments.global?.shared).toBe('current-shared');
    expect(merge.collection.items.some(item => item.id === 'request-1')).toBe(true);
    expect(currentCollection.name).toBe('Current');
    expect(currentEnv.envs.Development.token).toBe('current-token');

    const replace = planApiStudioRestore(currentCollection, currentEnv, backup, 'replace');
    expect(replace.collection.name).toBe('Workspace');
    expect(replace.environments.envs.Development.token).toBe('env-secret-value');
  });
});
