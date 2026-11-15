import { describe, expect, it } from 'vitest';
import { activeVars, addEnv, deleteEnv, emptyStore, envNames, exportableVars, isSecret, migrateEnv, removeEnvVar, removeScopeVar, renameEnv, scopeOf, scopeVars, setEnvVar, setScopeVar, setSecret } from './environments';

describe('migrateEnv (backward-compat, idempotent)', () => {
  it('flat legacy record → Default env, variables preserved', () => {
    const s = migrateEnv({ token: 'abc', host: 'x.test' });
    expect(s.active).toBe('Default');
    expect(activeVars(s)).toEqual({ token: 'abc', host: 'x.test' });
  });
  it('already-migrated store passes through (idempotent)', () => {
    const store = { active: 'prod', envs: { prod: { a: '1' }, dev: { a: '2' } } };
    expect(migrateEnv(store)).toEqual(store);
    expect(migrateEnv(migrateEnv(store))).toEqual(store);
  });
  it('active pointing to missing env falls back to first (negative control)', () => {
    const s = migrateEnv({ active: 'ghost', envs: { real: { a: '1' } } });
    expect(s.active).toBe('real');
  });
  it('null / invalid / empty → empty Default (never crash)', () => {
    expect(migrateEnv(null)).toEqual(emptyStore());
    expect(migrateEnv('garbage')).toEqual(emptyStore());
    expect(migrateEnv({})).toEqual(emptyStore());
    expect(migrateEnv({ active: 'x', envs: {} })).toEqual(emptyStore());
  });
  it('drops non-string variable values (sanitization)', () => {
    const s = migrateEnv({ good: 'ok', bad: 42 });
    expect(activeVars(s)).toEqual({ good: 'ok' });
  });
});

describe('variable CRUD on active env (immutable)', () => {
  it('setEnvVar writes only active env, does not mutate input', () => {
    const s0 = { active: 'dev', envs: { dev: { a: '1' }, prod: { a: '9' } } };
    const s1 = setEnvVar(s0, 'b', '2');
    expect(activeVars(s1)).toEqual({ a: '1', b: '2' });
    expect(s1.envs.prod).toEqual({ a: '9' });
    expect(s0.envs.dev).toEqual({ a: '1' });
  });
  it('empty / whitespace name is a no-op (negative control)', () => {
    const s0 = emptyStore();
    expect(setEnvVar(s0, '  ', 'x')).toBe(s0);
  });
  it('removeEnvVar removes from active only', () => {
    const s0 = { active: 'dev', envs: { dev: { a: '1', b: '2' } } };
    expect(activeVars(removeEnvVar(s0, 'a'))).toEqual({ b: '2' });
  });
});

describe('environment management (guards)', () => {
  it('addEnv creates and switches active; duplicate/empty no-op', () => {
    const s0 = emptyStore();
    const s1 = addEnv(s0, 'staging');
    expect(s1.active).toBe('staging');
    expect(envNames(s1)).toEqual(['Default', 'staging']);
    expect(addEnv(s1, 'staging')).toBe(s1);
    expect(addEnv(s1, '  ')).toBe(s1);
  });
  it('renameEnv updates active when renaming active; collision no-op', () => {
    const s0 = { active: 'dev', envs: { dev: { a: '1' }, prod: {} } };
    const s1 = renameEnv(s0, 'dev', 'development');
    expect(s1.active).toBe('development');
    expect(s1.envs.development).toEqual({ a: '1' });
    expect(renameEnv(s0, 'dev', 'prod')).toBe(s0);
    expect(renameEnv(s0, 'dev', 'dev')).toBe(s0);
  });
  it('deleteEnv switches active off deleted; last env protected (negative control)', () => {
    const s0 = { active: 'dev', envs: { dev: {}, prod: {} } };
    const s1 = deleteEnv(s0, 'dev');
    expect(s1.active).toBe('prod');
    expect(envNames(s1)).toEqual(['prod']);
    expect(deleteEnv(s1, 'prod')).toBe(s1);
  });
  it('switching active isolates variables (paired)', () => {
    let s = addEnv(emptyStore(), 'prod');
    s = setEnvVar(s, 'host', 'prod.api');
    s = { ...s, active: 'Default' };
    s = setEnvVar(s, 'host', 'dev.api');
    expect(activeVars(s)).toEqual({ host: 'dev.api' });
    expect(activeVars({ ...s, active: 'prod' })).toEqual({ host: 'prod.api' });
  });
});

describe('API-005 layered scopes (Postman precedence: environment > collection > global)', () => {
  function layered() {
    let s = emptyStore();
    s = setScopeVar(s, 'global', 'host', 'global.api');
    s = setScopeVar(s, 'global', 'region', 'us');
    s = setScopeVar(s, 'collection', 'host', 'collection.api');
    s = setScopeVar(s, 'collection', 'version', 'v1');
    s = setScopeVar(s, 'environment', 'host', 'env.api');
    return s;
  }

  it('narrower scope overrides broader (environment wins over collection over global)', () => {
    const s = layered();
    expect(activeVars(s)).toEqual({ host: 'env.api', region: 'us', version: 'v1' });
    expect(scopeOf(s, 'host')).toBe('environment');
    expect(scopeOf(s, 'version')).toBe('collection');
    expect(scopeOf(s, 'region')).toBe('global');
    expect(scopeOf(s, 'ghost')).toBeNull();
  });

  it('removing the environment override falls back to collection, then global', () => {
    let s = layered();
    s = removeScopeVar(s, 'environment', 'host');
    expect(activeVars(s).host).toBe('collection.api');
    expect(scopeOf(s, 'host')).toBe('collection');
    s = removeScopeVar(s, 'collection', 'host');
    expect(activeVars(s).host).toBe('global.api');
    expect(scopeOf(s, 'host')).toBe('global');
  });

  it('scopeVars returns each scope raw, isolated', () => {
    const s = layered();
    expect(scopeVars(s, 'global')).toEqual({ host: 'global.api', region: 'us' });
    expect(scopeVars(s, 'collection')).toEqual({ host: 'collection.api', version: 'v1' });
    expect(scopeVars(s, 'environment')).toEqual({ host: 'env.api' });
  });

  it('setScopeVar writes only the target scope, immutable (negative control)', () => {
    const s0 = layered();
    const s1 = setScopeVar(s0, 'global', 'extra', 'g');
    expect(scopeVars(s1, 'global').extra).toBe('g');
    expect(scopeVars(s0, 'global').extra).toBeUndefined();
    expect(scopeVars(s1, 'environment')).toEqual({ host: 'env.api' });
    expect(setScopeVar(s0, 'collection', '  ', 'x')).toBe(s0);
  });

  it('setEnvVar does NOT fold global/collection into the environment scope (correctness)', () => {
    const s = setEnvVar(layered(), 'newvar', 'n');
    expect(scopeVars(s, 'environment')).toEqual({ host: 'env.api', newvar: 'n' });
  });

  it('switching active environment keeps global/collection shared', () => {
    let s = layered();
    s = addEnv(s, 'staging');
    expect(activeVars(s).region).toBe('us');
    expect(activeVars(s).version).toBe('v1');
    expect(activeVars(s).host).toBe('collection.api');
  });
});

describe('API-005 secret value protection', () => {
  it('setSecret marks/unmarks by name across scopes; isSecret reflects it', () => {
    let s = setScopeVar(emptyStore(), 'environment', 'api_key', 'sk-secret');
    expect(isSecret(s, 'api_key')).toBe(false);
    s = setSecret(s, 'api_key', true);
    expect(isSecret(s, 'api_key')).toBe(true);
    s = setSecret(s, 'api_key', false);
    expect(isSecret(s, 'api_key')).toBe(false);
    expect(s.secrets).toBeUndefined();
  });

  it('exportableVars resolves precedence AND strips secret values to empty (negative control)', () => {
    let s = emptyStore();
    s = setScopeVar(s, 'global', 'host', 'global.api');
    s = setScopeVar(s, 'environment', 'host', 'env.api');
    s = setScopeVar(s, 'environment', 'api_key', 'sk-secret');
    s = setScopeVar(s, 'collection', 'token', 'tok-123');
    s = setSecret(s, 'api_key', true);
    s = setSecret(s, 'token', true);
    const exp = exportableVars(s);
    expect(exp).toEqual({ host: 'env.api', api_key: '', token: '' });
    expect(activeVars(s).api_key).toBe('sk-secret');
  });

  it('secret marking is independent of scope (global secret also stripped)', () => {
    let s = setScopeVar(emptyStore(), 'global', 'shared_key', 'g-secret');
    s = setSecret(s, 'shared_key', true);
    expect(exportableVars(s)).toEqual({ shared_key: '' });
  });
});

describe('API-005 migration preserves layers (backward-compat)', () => {
  it('store with global/collection/secrets passes through idempotently', () => {
    const store = { active: 'prod', envs: { prod: { a: '1' } }, global: { g: '2' }, collection: { c: '3' }, secrets: ['a'] };
    const m = migrateEnv(store);
    expect(m).toEqual(store);
    expect(migrateEnv(m)).toEqual(store);
    expect(activeVars(m)).toEqual({ g: '2', c: '3', a: '1' });
    expect(isSecret(m, 'a')).toBe(true);
  });

  it('legacy flat record still migrates to Default with no invented layers', () => {
    const s = migrateEnv({ token: 'abc' });
    expect(s).toEqual({ active: 'Default', envs: { Default: { token: 'abc' } } });
    expect(s.global).toBeUndefined();
    expect(s.collection).toBeUndefined();
  });

  it('drops invalid layer shapes and non-string secrets (sanitization, negative control)', () => {
    const s = migrateEnv({ active: 'p', envs: { p: {} }, global: { ok: '1', bad: 5 }, collection: 'nope', secrets: ['a', 7, 'a'] });
    expect(s.global).toEqual({ ok: '1' });
    expect(s.collection).toBeUndefined();
    expect(s.secrets).toEqual(['a']);
  });
});
