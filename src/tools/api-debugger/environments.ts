/**
 * API-005 · 环境作用域（对标 Postman environments：dev/staging/prod 命名变量集）。
 *
 * 存储形态 EnvStore = { active, envs: { 名: { 变量: 值 } } }。
 * 旧版是扁平 Record<变量,值>，migrateEnv 幂等迁移为 { active:'Default', envs:{Default:旧} }，
 * 不丢用户已有变量；非法/空 → 空 Default。所有写操作返回新对象（不可变），便于响应式与单测。
 */
export interface EnvStore { active: string; envs: Record<string, Record<string, string>> }

export const DEFAULT_ENV = 'Default';

export function emptyStore(): EnvStore {
  return { active: DEFAULT_ENV, envs: { [DEFAULT_ENV]: {} } };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** 幂等迁移：已是 EnvStore 原样返回；扁平 Record 包成 Default；非法→空 Default。 */
export function migrateEnv(raw: unknown): EnvStore {
  if (isRecord(raw) && typeof raw.active === 'string' && isRecord(raw.envs)) {
    const envs: Record<string, Record<string, string>> = {};
    for (const [name, vars] of Object.entries(raw.envs)) {
      if (isRecord(vars)) {
        envs[name] = Object.fromEntries(Object.entries(vars).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
      }
    }
    if (Object.keys(envs).length === 0) {
      return emptyStore();
    }
    const active = typeof envs[raw.active] !== 'undefined' ? raw.active : Object.keys(envs)[0];
    return { active, envs };
  }
  if (isRecord(raw)) {
    const flat = Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
    return { active: DEFAULT_ENV, envs: { [DEFAULT_ENV]: flat } };
  }
  return emptyStore();
}

export function activeVars(store: EnvStore): Record<string, string> {
  return store.envs[store.active] ?? {};
}

export function envNames(store: EnvStore): string[] {
  return Object.keys(store.envs);
}

export function setEnvVar(store: EnvStore, name: string, value: string): EnvStore {
  const n = name.trim();
  if (!n) {
    return store;
  }
  return { ...store, envs: { ...store.envs, [store.active]: { ...activeVars(store), [n]: value } } };
}

export function removeEnvVar(store: EnvStore, name: string): EnvStore {
  const next = { ...activeVars(store) };
  delete next[name];
  return { ...store, envs: { ...store.envs, [store.active]: next } };
}

export function addEnv(store: EnvStore, name: string): EnvStore {
  const n = name.trim();
  if (!n || store.envs[n]) {
    return store;
  }
  return { active: n, envs: { ...store.envs, [n]: {} } };
}

export function renameEnv(store: EnvStore, oldName: string, newName: string): EnvStore {
  const n = newName.trim();
  if (!n || n === oldName || !store.envs[oldName] || store.envs[n]) {
    return store;
  }
  const envs: Record<string, Record<string, string>> = {};
  for (const [k, v] of Object.entries(store.envs)) {
    envs[k === oldName ? n : k] = v;
  }
  return { active: store.active === oldName ? n : store.active, envs };
}

export function deleteEnv(store: EnvStore, name: string): EnvStore {
  const names = Object.keys(store.envs);
  if (!store.envs[name] || names.length <= 1) {
    return store; // 最后一个环境不可删
  }
  const envs = { ...store.envs };
  delete envs[name];
  const active = store.active === name ? Object.keys(envs)[0] : store.active;
  return { active, envs };
}
