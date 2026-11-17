/**
 * API-011 · Postman Script Runtime 兼容核心（纯语义，可单测）。
 *
 * 边界与纪律：
 *  · 本文件只定义 pm.* 语义与数据结构；**用户代码的实际执行发生在专用 Web Worker**
 *    （script-worker.ts）——Worker 无 DOM、无 opener 页面权限，超时由主线程 terminate 强制。
 *    这是审查裁定的硬要求：不能为了兼容 pm.* 把用户脚本放进有完整页面权限的环境。
 *  · 变量作用域优先级按 Postman 规则：local(脚本内) > iterationData > collection > environment
 *    > globals（读取=先命中先返回；写入=显式 API 指定层，pm.variables.set 只写本次运行 local）。
 *  · pm.test 结果 fail-closed：断言函数抛错=该 test 失败并带原因，不静默通过。
 *  · pm.sendRequest 不直发网络：排入 outbox，由宿主（runner）经既有 apiproxy 执行并回填——
 *    保持请求权限控制在宿主侧（代理 allowlist），凭据不外泄给脚本宿主之外的路径。
 */

export interface ScriptKV { name: string; value: string }

/** 主线程→Worker 的快照（全部可结构化克隆；不含函数/凭据引用）。 */
export interface ScriptSnapshot {
  request: { method: string; url: string; headers: ScriptKV[]; body: string }
  response: { status: number; statusText: string; headers: Record<string, string>; body: string; responseTime: number } | null
  globals: Record<string, string>
  collection: Record<string, string>
  environment: Record<string, string>
  iterationData: Record<string, string>
  local: Record<string, string>
  info: { event: 'prerequest' | 'test'; iteration: number; counter: number; requestName: string }
}

/** Worker→主线程的写回（主线程负责应用到真实 store；不信任脚本自述的"成功"）。 */
export interface ScriptOutcomeData {
  tests: { name: string; passed: boolean; error?: string }[]
  envWrites: { layer: 'globals' | 'collection' | 'environment' | 'local'; name: string; value: string | null }[]
  requestMutations: { url?: string; method?: string; headers?: ScriptKV[]; body?: string }
  logs: string[]
  sendRequests: { url: string; method?: string; header?: ScriptKV[]; body?: string }[]
  asyncPending: boolean
}

/** 分层变量 API（Postman VariableScope 子集）。 */
export interface VarLayer {
  get(name: string): string | undefined
  set(...args: unknown[]): void
  unset(name: string): void
  has(name: string): boolean
  toObject(): { key: string; value: string }[]
  count(): number
}

/**
 * pm 对象对外契约。边界类型宽松（脚本面即 JS 用户代码，等价 Postman 沙箱的 dynamic context），
 * 但 test/unsupported 签名保持严格——语义正确性由 script-runtime.test(14) + integration(7) 锁死，
 * 不靠类型装饰。
 */
export interface PmApi {
  info: ScriptSnapshot['info'] & { requestName: string }
  request: any
  response: any
  event: any
  environment: VarLayer
  collectionVariables: VarLayer
  globals: VarLayer
  iterationData: any
  variables: any
  test(name: string, fn: () => void): void
  expect(actual: unknown): any
  sendRequest(urlOrReq: unknown, cb?: (err: unknown, res: unknown) => void): Promise<any>
  cookies: (...args: unknown[]) => never
  cookieJar: (...args: unknown[]) => never
  execution: (...args: unknown[]) => never
  unsupported(feature: string): never
}

export interface RuntimeIO {
  outcome: ScriptOutcomeData
  console: (...args: unknown[]) => void
  /** 由宿主注入的真实发送桥（Worker 内为消息往返；纯测试注入 stub）。 */
  sendRequest: (spec: { url: string; method?: string; header?: ScriptKV[]; body?: string }) => Promise<{ code: number; status: string; responseTime: number }>
}

const STR = (v: unknown): string => typeof v === 'string' ? v : String(v ?? '')

/** 作用域链读取（Postman 优先级；local 是脚本本次运行的临时层）。 */
function readVar(snap: ScriptSnapshot, layerOrder: (keyof Pick<ScriptSnapshot, 'globals' | 'collection' | 'environment' | 'iterationData' | 'local'>)[], name: string): string | undefined {
  for (const layer of layerOrder) {
    const v = snap[layer][name]
    if (v !== undefined) return v
  }
  return undefined
}

/* ---------- pm.expect 最小断言子集（fail-closed：不认识的链式方法抛错=测试失败） ---------- */
class ExpectError extends Error {}

function buildExpect(actual: unknown) {
  const assert = (cond: boolean, msg: string) => { if (!cond) throw new ExpectError(msg) }
  const chain: Record<string, unknown> = {}
  const self = () => chain
  chain.to = self(); (chain as any).be = self(); (chain as any).been = self(); (chain as any).is = self()
  chain.and = self(); (chain as any).has = self(); (chain as any).with = self(); (chain as any).that = self()
  chain.not = {
    equal: (x: unknown) => assert(String(actual) !== String(x), `expected ${JSON.stringify(actual)} not to equal ${JSON.stringify(x)}`),
    exist: () => assert(actual === null || actual === undefined, `expected value not to exist but got ${JSON.stringify(actual)}`),
  }
  chain.equal = (x: unknown) => { assert(actual === x, `expected ${JSON.stringify(actual)} to equal ${JSON.stringify(x)}`); return self() }
  chain.eql = (x: unknown) => { assert(JSON.stringify(actual) === JSON.stringify(x), `expected deep equality between ${JSON.stringify(actual)} and ${JSON.stringify(x)}`); return self() }
  chain.include = (x: unknown) => {
    const ok = typeof actual === 'string' ? actual.includes(String(x)) : Array.isArray(actual) ? actual.map(String).includes(String(x)) : false
    assert(ok, `expected ${JSON.stringify(actual)} to include ${JSON.stringify(x)}`); return self()
  }
  chain.match = (re: RegExp) => { assert(re.test(STR(actual)), `expected ${JSON.stringify(actual)} to match ${re}`); return self() }
  chain.above = (n: number) => { assert(Number(actual) > n, `expected ${JSON.stringify(actual)} to be above ${n}`); return self() }
  chain.below = (n: number) => { assert(Number(actual) < n, `expected ${JSON.stringify(actual)} to be below ${n}`); return self() }
  chain.ok = () => { assert(!!actual, `expected ${JSON.stringify(actual)} to be truthy`); return self() }
  chain.true = () => { assert(actual === true, `expected true, got ${JSON.stringify(actual)}`); return self() }
  chain.null = () => { assert(actual === null, `expected null, got ${JSON.stringify(actual)}`); return self() }
  chain.exist = () => { assert(actual !== null && actual !== undefined, 'expected value to exist'); return self() }
  chain.lengthOf = (n: number) => { const len = (actual as { length?: number })?.length; assert(len === n, `expected length ${n}, got ${String(len)}`); return self() }
  chain.property = (name: string, val?: unknown) => {
    const v = (actual as Record<string, unknown>)?.[name]
    assert(v !== undefined, `expected property ${JSON.stringify(name)}`)
    if (val !== undefined) assert(String(v) === String(val), `expected property ${name}=${JSON.stringify(val)}, got ${JSON.stringify(v)}`)
    return self()
  }
  chain.oneOf = (arr: unknown[]) => { assert(Array.isArray(arr) && arr.some(x => String(x) === String(actual)), `expected ${JSON.stringify(actual)} to be one of ${JSON.stringify(arr)}`); return self() }
  chain.a = (t: string) => { assert((t === 'number' ? typeof actual === 'number' : t === 'string' ? typeof actual === 'string' : t === 'array' ? Array.isArray(actual) : t === 'object' ? typeof actual === 'object' : false), `expected type ${t}`); return self() }
  chain.have = self(); chain.with = self()
  return chain
}

/* ---------- pm.* API 工厂（纯：一切副作用记录进 io.outcome） ---------- */
export function createPmAPI(snap: ScriptSnapshot, io: RuntimeIO) {
  const { outcome } = io
  const tests: ScriptOutcomeData['tests'] = []
  const varList = (layer: keyof Pick<ScriptSnapshot, 'globals' | 'collection' | 'environment' | 'iterationData' | 'local'>) =>
    Object.entries(snap[layer]).map(([key, value]) => ({ key, value }))

  const makeVarLayer = (layer: 'globals' | 'collection' | 'environment') => ({
    get: (name: string) => readVar(snap, [layer], name),
    set: (name: string | { key: string; value: string } | Record<string, string>, value?: string) => {
      if (typeof name === 'string') { outcome.envWrites.push({ layer, name, value: STR(value) }); snap[layer][name] = STR(value) }
      else if (Array.isArray(name)) { for (const v of name) { outcome.envWrites.push({ layer, name: v.key, value: STR(v.value) }); snap[layer][v.key] = STR(v.value) } }
      else { for (const [k, v] of Object.entries(name)) { outcome.envWrites.push({ layer, name: k, value: STR(v) }); snap[layer][k] = STR(v) } }
    },
    unset: (name: string) => { outcome.envWrites.push({ layer, name, value: null }); delete snap[layer][name] },
    has: (name: string) => snap[layer][name] !== undefined,
    toObject: () => varList(layer),
    count: () => Object.keys(snap[layer]).length,
  })

  const response = snap.response ? {
    code: snap.response.status,
    status: snap.response.statusText,
    text: () => snap.response!.body,
    json: (pathOrReviver?: unknown) => {
      const parsed = JSON.parse(snap.response!.body)
      if (typeof pathOrReviver === 'function') return (pathOrReviver as (k: string, v: unknown) => unknown)('', parsed)
      return parsed
    },
    headers: {
      get: (name: string) => snap.response!.headers[name.toLowerCase()] ?? snap.response!.headers[name],
      all: () => Object.entries(snap.response!.headers).map(([key, value]) => ({ key, value })),
      has: (name: string) => snap.response!.headers[name.toLowerCase()] !== undefined || snap.response!.headers[name] !== undefined,
      count: () => Object.keys(snap.response!.headers).length,
    },
    responseTime: snap.response.responseTime,
    size: snap.response.body.length,
  } : null

  const request = {
    url: { toString: () => snap.request.url },
    method: snap.request.method,
    headers: {
      get: (name: string) => snap.request.headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value,
      upsert: (h: { key: string; value: string }) => {
        const i = snap.request.headers.findIndex(x => x.name.toLowerCase() === h.key.toLowerCase())
        const nv = { name: h.key, value: STR(h.value) }
        if (i >= 0) snap.request.headers[i] = nv; else snap.request.headers.push(nv)
        outcome.requestMutations.headers = [...snap.request.headers]
      },
      add: (h: { key: string; value: string }) => { snap.request.headers.push({ name: h.key, value: STR(h.value) }); outcome.requestMutations.headers = [...snap.request.headers] },
      remove: (keyOrName: string) => { snap.request.headers = snap.request.headers.filter(x => x.name !== keyOrName); outcome.requestMutations.headers = [...snap.request.headers] },
      all: () => snap.request.headers.map(h => ({ key: h.name, value: h.value })),
      has: (name: string) => snap.request.headers.some(h => h.name.toLowerCase() === name.toLowerCase()),
      count: () => snap.request.headers.length,
    },
    body: {
      toString: () => snap.request.body,
      update: (raw: string) => { snap.request.body = STR(raw); outcome.requestMutations.body = snap.request.body },
    },
  }

  const unsupported = (feature: string): never => {
    throw new ExpectError(`pm.${feature} is not supported by API Studio script runtime yet (see docs/api-studio/PM_SUPPORT_MATRIX.md). Use the documented pm.* subset or pm.sendRequest.`);
  };
  const pm: Record<string, unknown> = {
    info: { event: snap.info.event, iteration: snap.info.iteration, counter: snap.info.counter, requestName: '' },
    event: { response, request },
    request,
    response,
    environment: makeVarLayer('environment'),
    collectionVariables: makeVarLayer('collection'),
    globals: makeVarLayer('globals'),
    iterationData: { get: (n: string) => readVar(snap, ['iterationData'], n), has: (n: string) => snap.iterationData[n] !== undefined, toObject: () => varList('iterationData'), count: () => Object.keys(snap.iterationData).length },
    variables: {
      get: (n: string) => readVar(snap, ['local', 'iterationData', 'environment', 'collection', 'globals'], n),
      set: (n: string, v: string) => { outcome.envWrites.push({ layer: 'local', name: n, value: STR(v) }); snap.local[n] = STR(v) },
      unset: (n: string) => { outcome.envWrites.push({ layer: 'local', name: n, value: null }); delete snap.local[n] },
      has: (n: string) => readVar(snap, ['local', 'iterationData', 'environment', 'collection', 'globals'], n) !== undefined,
      toObject: () => {
        const merged: Record<string, string> = {}
        for (const layer of ['globals', 'collection', 'environment', 'iterationData', 'local'] as const) Object.assign(merged, snap[layer])
        return Object.entries(merged).map(([key, value]) => ({ key, value }))
      },
      replaceIn: (text: string) => STR(text).replace(/{{\s*([\w.-]+)\s*}}/g, (_m, name: string) => readVar(snap, ['local', 'iterationData', 'collection', 'environment', 'globals'], name) ?? ''),
    },
    test: (name: string, fn: () => void) => {
      try { fn(); tests.push({ name, passed: true }) }
      catch (e) { tests.push({ name, passed: false, error: e instanceof Error ? e.message : String(e) }) }
    },
    expect: (actual: unknown) => buildExpect(actual),
    sendRequest: async (urlOrReq: unknown, cb?: (err: unknown, res: unknown) => void) => {
      const spec = typeof urlOrReq === 'string' ? { url: urlOrReq } : urlOrReq as RuntimeIO['outcome']['sendRequests'][number]
      outcome.sendRequests.push(spec)
      try {
        const res = await io.sendRequest(spec)
        cb?.(null, res)
        return res
      }
      catch (e) { cb?.(e, null); throw e }
    },
    // fail-closed：pm.cookie / pm.execution 未实现就显式报错，绝不静默 no-op 伪装支持
  cookies: unsupported as unknown as never,
  cookieJar: unsupported as unknown as never,
  execution: unsupported as unknown as never,
    /** 未逐条实现的 API 一律显式失败（fail-closed），不静默 no-op 伪装支持。 */
    unsupported: (feature: string): never => { throw new ExpectError(`pm.${feature} is not supported by API Studio script runtime yet`) },
  }
  const consoleShim = {
    log: (...a: unknown[]) => io.console(...a),
    info: (...a: unknown[]) => io.console(...a),
    warn: (...a: unknown[]) => io.console(...a),
    error: (...a: unknown[]) => io.console(...a),
    debug: (...a: unknown[]) => io.console(...a),
  }
  return { pm: pm as unknown as PmApi, console: consoleShim, flushTests: () => { outcome.tests.push(...tests) } }
}

export const EXPECT_ERROR_NAME = 'ExpectError'

/* ---------- 沙箱网络中和（A5 P0：Worker 无 DOM ≠ 无网络） ----------
 * 威胁模型：用户脚本运行在专用 module Worker 内，但仍可调用 fetch / XHR / WebSocket /
 * EventSource / importScripts / 子 Worker / BroadcastChannel / caches / indexedDB /
 * navigator.sendBeacon —— 全部是数据外传或逃逸通道。中和策略：
 *   1. 在用户代码 eval 之前，把上述全局替换为"读取即抛错"的访问器（fail-closed）；
 *   2. 唯一合法网络路径 = pm.sendRequest → outbox → 宿主经既有 apiproxy（同源端点、目标策略、
 *      超时与审计在宿主侧）；
 *   3. 已知局限（如实记录，不伪装成不可绕边界）：中和是运行时全局替换，未来新增的 Worker
 *      API 不在清单内即失效；主线程侧另有 message 类型白名单兜底（未知消息一律忽略）。
 *   本函数纯函数化以便单测负控；worker 启动时安装。
 */
export const SANDBOX_BLOCKED_GLOBALS = [
  'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource',
  'importScripts', 'Worker', 'SharedWorker', 'BroadcastChannel',
  'caches', 'indexedDB', 'Notification', 'open',
] as const;

export function installSandboxGuards(scope: Record<string, unknown>): string[] {
  const installed: string[] = [];
  for (const k of SANDBOX_BLOCKED_GLOBALS) {
    try {
      Object.defineProperty(scope, k, {
        configurable: true,
        get() {
          throw new Error(`[api-studio sandbox] ${k} is disabled inside the script sandbox. Network access is only allowed via pm.sendRequest (host-controlled outbox).`);
        },
      });
      installed.push(k);
    }
    catch {
      // 该运行时不存在此全局（如 module Worker 无 importScripts）——补定义同样 fail-closed
      try {
        Object.defineProperty(scope, k, { configurable: true, get: () => { throw new Error(`[api-studio sandbox] ${k} is disabled.`); } });
        installed.push(k + ':absent');
      }
      catch { /* 非 configurable 且不存在——记录但不阻断 */ }
    }
  }
  // navigator.sendBeacon：保留 navigator，其余 beacon 通道中和
  try {
    const nav = scope.navigator;
    if (nav && typeof nav === 'object' && !('sendBeacon' in nav === false)) {
      Object.defineProperty(nav, 'sendBeacon', {
        configurable: true,
        get() { throw new Error('[api-studio sandbox] navigator.sendBeacon is disabled inside the script sandbox.'); },
      });
      installed.push('navigator.sendBeacon');
    }
  }
  catch { /* navigator 不可扩展时忽略 */ }
  return installed;
}
