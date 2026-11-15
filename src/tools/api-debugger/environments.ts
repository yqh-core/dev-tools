/**
 * API-005 · 环境作用域分层（对标 Postman variables：global / collection / environment）。
 *
 * 优先级（窄域覆盖宽域，与 Postman 一致）：environment > collection > global。
 * 存储形态 EnvStore = { active, envs:{ 名:{变量:值} }, global?, collection?, secrets? }。
 *  · envs = 环境作用域（每个命名环境一份变量表）；global/collection 为可选的共享层；
 *  · secrets = 标记为敏感的变量名集合（任意作用域）：UI 遮罩、导出/共享剥离其值；
 *  · 旧版扁平 Record 与早期 { active, envs } 经 migrateEnv 幂等迁移，不丢用户已有变量；
 *    迁移只在输入确有 global/collection/secrets 时保留它们（不无中生有，保证幂等 passthrough）。
 * 所有写操作返回新对象（不可变），便于响应式与单测。
 *
 * 敏感值边界（诚实）：secret 仅本机 localStorage 明文存储 + UI 遮罩 + 导出剥离，
 * 不提供对 XSS/浏览器配置文件泄露的防护；发送请求时 secret 值仍会按 {{var}} 替换进请求
 * （这是变量替换的本意），分享 cURL 的脱敏只剔凭据头不剔 body（既有边界，文案已明示）。
 */
export type VarScope = 'global' | 'collection' | 'environment';

export interface EnvStore {
  active: string
  envs: Record<string, Record<string, string>>
  global?: Record<string, string>
  collection?: Record<string, string>
  secrets?: string[]
}

export const DEFAULT_ENV = 'Default';
export const VAR_SCOPES: VarScope[] = ['environment', 'collection', 'global'];

export function emptyStore(): EnvStore {
  return { active: DEFAULT_ENV, envs: { [DEFAULT_ENV]: {} } };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function cleanStringMap(v: unknown): Record<string, string> | null {
  if (!isRecord(v)) {
    return null;
  }
  return Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === 'string')) as Record<string, string>;
}

/** 幂等迁移：已是 EnvStore 原样返回（仅净化）；扁平 Record 包成 Default；非法→空 Default。
 *  global/collection/secrets 仅在输入存在且合法时保留，绝不无中生有。 */
export function migrateEnv(raw: unknown): EnvStore {
  if (isRecord(raw) && typeof raw.active === 'string' && isRecord(raw.envs)) {
    const envs: Record<string, Record<string, string>> = {};
    for (const [name, vars] of Object.entries(raw.envs)) {
      const cleaned = cleanStringMap(vars);
      if (cleaned) {
        envs[name] = cleaned;
      }
    }
    if (Object.keys(envs).length === 0) {
      return emptyStore();
    }
    const active = typeof envs[raw.active] !== 'undefined' ? raw.active : Object.keys(envs)[0];
    const out: EnvStore = { active, envs };
    const g = cleanStringMap(raw.global);
    if (g) {
      out.global = g;
    }
    const c = cleanStringMap(raw.collection);
    if (c) {
      out.collection = c;
    }
    if (Array.isArray(raw.secrets)) {
      const s = raw.secrets.filter((x): x is string => typeof x === 'string');
      if (s.length) {
        out.secrets = [...new Set(s)];
      }
    }
    return out;
  }
  if (isRecord(raw)) {
    const flat = cleanStringMap(raw) ?? {};
    return { active: DEFAULT_ENV, envs: { [DEFAULT_ENV]: flat } };
  }
  return emptyStore();
}

/** 某作用域的原始变量表（environment = 当前激活环境）。 */
export function scopeVars(store: EnvStore, scope: VarScope): Record<string, string> {
  if (scope === 'global') {
    return store.global ?? {};
  }
  if (scope === 'collection') {
    return store.collection ?? {};
  }
  return store.envs[store.active] ?? {};
}

/** 解析后的有效变量：environment 覆盖 collection 覆盖 global（窄域优先）。 */
export function activeVars(store: EnvStore): Record<string, string> {
  return { ...(store.global ?? {}), ...(store.collection ?? {}), ...(store.envs[store.active] ?? {}) };
}

/** 某变量名当前由哪个作用域提供（窄域优先）；都不存在→null。 */
export function scopeOf(store: EnvStore, name: string): VarScope | null {
  if (Object.prototype.hasOwnProperty.call(store.envs[store.active] ?? {}, name)) {
    return 'environment';
  }
  if (Object.prototype.hasOwnProperty.call(store.collection ?? {}, name)) {
    return 'collection';
  }
  if (Object.prototype.hasOwnProperty.call(store.global ?? {}, name)) {
    return 'global';
  }
  return null;
}

export function envNames(store: EnvStore): string[] {
  return Object.keys(store.envs);
}

/** 写入指定作用域（不可变）。environment 写当前激活环境。 */
export function setScopeVar(store: EnvStore, scope: VarScope, name: string, value: string): EnvStore {
  const n = name.trim();
  if (!n) {
    return store;
  }
  if (scope === 'global') {
    return { ...store, global: { ...(store.global ?? {}), [n]: value } };
  }
  if (scope === 'collection') {
    return { ...store, collection: { ...(store.collection ?? {}), [n]: value } };
  }
  return { ...store, envs: { ...store.envs, [store.active]: { ...(store.envs[store.active] ?? {}), [n]: value } } };
}

export function removeScopeVar(store: EnvStore, scope: VarScope, name: string): EnvStore {
  if (scope === 'global') {
    const next = { ...(store.global ?? {}) };
    delete next[name];
    return { ...store, global: next };
  }
  if (scope === 'collection') {
    const next = { ...(store.collection ?? {}) };
    delete next[name];
    return { ...store, collection: next };
  }
  const next = { ...(store.envs[store.active] ?? {}) };
  delete next[name];
  return { ...store, envs: { ...store.envs, [store.active]: next } };
}

/** 兼容旧接口：写当前激活环境。 */
export function setEnvVar(store: EnvStore, name: string, value: string): EnvStore {
  return setScopeVar(store, 'environment', name, value);
}

export function removeEnvVar(store: EnvStore, name: string): EnvStore {
  return removeScopeVar(store, 'environment', name);
}

export function isSecret(store: EnvStore, name: string): boolean {
  return (store.secrets ?? []).includes(name);
}

/** 标记/取消敏感（按变量名，跨作用域生效）。 */
export function setSecret(store: EnvStore, name: string, secret: boolean): EnvStore {
  const cur = new Set(store.secrets ?? []);
  if (secret) {
    cur.add(name);
  }
  else {
    cur.delete(name);
  }
  const arr = [...cur];
  if (arr.length === 0) {
    const rest = { ...store };
    delete rest.secrets;
    return rest;
  }
  return { ...store, secrets: arr };
}

/** 导出/共享用：解析后的变量，敏感值以空串替换（结构保留、值不外泄）。 */
export function exportableVars(store: EnvStore): Record<string, string> {
  const resolved = activeVars(store);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(resolved)) {
    out[k] = isSecret(store, k) ? '' : v;
  }
  return out;
}

export function addEnv(store: EnvStore, name: string): EnvStore {
  const n = name.trim();
  if (!n || store.envs[n]) {
    return store;
  }
  return { ...store, active: n, envs: { ...store.envs, [n]: {} } };
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
  return { ...store, active: store.active === oldName ? n : store.active, envs };
}

export function deleteEnv(store: EnvStore, name: string): EnvStore {
  const names = Object.keys(store.envs);
  if (!store.envs[name] || names.length <= 1) {
    return store; // 最后一个环境不可删
  }
  const envs = { ...store.envs };
  delete envs[name];
  const active = store.active === name ? Object.keys(envs)[0] : store.active;
  return { ...store, active, envs };
}
