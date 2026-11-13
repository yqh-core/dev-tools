import { describe, expect, it } from 'vitest';
import { activeVars, addEnv, deleteEnv, emptyStore, envNames, migrateEnv, removeEnvVar, renameEnv, setEnvVar } from './environments';

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
