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

/** A-018 outbox 资源上限（任务书 A5：过量消息/异常大对象有明确上限，fail-closed 不静默丢）。
 *  终审 P1-03 口径明确化：OUTBOX_MAX_SENDS=**累计发送数**上限（非 pending——outcome.sendRequests
 *  只增不清，旧名 MAX_QUEUED 误导）；spec 上限按 **UTF-8 字节**（非 UTF-16 码元数）。 */
export const OUTBOX_MAX_SENDS = 100;
export const OUTBOX_SPEC_MAX_BYTES = 1_000_000;
/** 宿主桥回填响应体截断上限（字节）——脚本面不接收无界响应体（终审 P1-03）。 */
export const RESPONSE_BODY_MAX_BYTES = 1_000_000;
/** 单次脚本运行 console 捕获总量上限（字节）——超出后丢弃并标记，不静默无限增长。 */
export const CONSOLE_TOTAL_MAX_BYTES = 262_144;

const te = new TextEncoder();
/** spec 的 UTF-8 字节数（终审 P1-03：原 JSON.stringify.length 是 UTF-16 码元数，口径不符）。 */
export function specByteLength(spec: unknown): number {
  return te.encode(JSON.stringify(spec ?? '')).byteLength;
}
/** 字符串 UTF-8 字节数（console 累计上限计量用）。 */
export function utf8Bytes(s: string): number {
  return te.encode(s).byteLength;
}
/** 响应体字节级截断（多字节字符尾部不完整序列由 TextDecoder 非 fatal 丢弃，不冒充完整内容）。 */
export function truncateResponseBody(body: string, max = RESPONSE_BODY_MAX_BYTES): { body: string; truncated: boolean } {
  const bytes = te.encode(body);
  if (bytes.byteLength <= max) {
    return { body, truncated: false };
  }
  return { body: `${new TextDecoder().decode(bytes.slice(0, max))}\n[truncated at ${max} bytes by sandbox response cap]`, truncated: true };
}

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
  /**
   * 由宿主注入的真实发送桥（Worker 内为消息往返；纯测试注入 stub）。
   * 终审 P1-04：桥回填**完整响应面**（status/statusText/headers/body/responseTime），
   * 响应体经 truncateResponseBody 字节级截断；未声明的字段不暴露（访问即 undefined，
   * 支持矩阵见 docs/api-studio/PM_SUPPORT_MATRIX.md pm.sendRequest 行）。
   */
  sendRequest: (spec: { url: string; method?: string; header?: ScriptKV[]; body?: string }) => Promise<BridgeResponse>
}

/** 宿主桥→脚本面的响应形状（pm.sendRequest 的 then/callback 入参由运行时包装成 Postman 风格视图）。 */
export interface BridgeResponse {
  code: number
  status: string
  statusText?: string
  headers?: ScriptKV[]
  body?: string
  responseTime?: number
  truncated?: boolean
}

/** pm.sendRequest 返回值包装（Postman 风格视图：code/status/headers.get/text/json/responseTime/size）。 */
function wrapBridgeResponse(res: BridgeResponse) {
  const body = res.body ?? '';
  const headers = res.headers ?? [];
  const lower = (n: string) => n.toLowerCase();
  return {
    code: res.code,
    status: res.status ?? String(res.code),
    statusText: res.statusText ?? '',
    headers: {
      get: (n: string) => headers.find(h => lower(h.name) === lower(n))?.value,
      has: (n: string) => headers.some(h => lower(h.name) === lower(n)),
      all: () => headers.map(h => ({ key: h.name, value: h.value })),
      count: () => headers.length,
    },
    text: () => body,
    json: () => JSON.parse(body),
    responseTime: res.responseTime ?? 0,
    size: body.length,
    ...(res.truncated ? { truncated: true as const } : {}),
  };
}

const STR = (v: unknown): string => typeof v === 'string' ? v : String(v ?? '');

/**
 * 变量解析优先级（Postman 语义；终审 P1-01：唯一权威序——resolveVariable 供
 * get/has/replaceIn/toObject 共用；请求插值（runner mergedForSubstitution）由
 * consistency 五层同名矩阵锁证明与此序等价）。
 */
export const VARIABLE_PRECEDENCE = ['local', 'iterationData', 'environment', 'collection', 'globals'] as const;
export type VarLayerName = (typeof VARIABLE_PRECEDENCE)[number];

/** 先命中先返回；undefined 不遮蔽更低优先级层（Postman：未定义=穿透）。 */
export function resolveVariable(snap: ScriptSnapshot, name: string): string | undefined {
  for (const layer of VARIABLE_PRECEDENCE) {
    const v = snap[layer][name];
    if (v !== undefined) {
      return v;
    }
  }
  return undefined;
}

/* ---------- pm.expect 最小断言子集（fail-closed：不认识的链式方法抛错=测试失败） ----------
 * G1 严格消息口径（yqh 裁定②）：消息面**默认不格式化 actual/expected 原始值**——只承载断言类型/
 * 失败原因/操作符/安全字段路径/类型信息/安全标量（阈值/长度/候选数）。原始值不留消息面
 * （UI/stdout/JSON/JUnit/下载报告全安全）；label/测试名承载定位信息。
 * 值级脱敏（报告层 redactText）保留为纵深防御——用户脚本自有 throw 文本/上游错误原文等第三方文本面。 */
function typeName(v: unknown): string {
  return v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
}
const STRICT_TAIL = ' Raw values are not printed by default (security default; marked-secret values are additionally redacted at the report layer).';
class ExpectError extends Error {}

function buildExpect(actual: unknown) {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) {
      throw new ExpectError(msg);
    }
  };

  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.to = self();
  (chain as any).be = self();
  (chain as any).been = self();
  (chain as any).is = self();
  chain.and = self();
  (chain as any).has = self();
  (chain as any).with = self();
  (chain as any).that = self();
  chain.not = {
    equal: (x: unknown) => assert(String(actual) !== String(x), `Assertion failed: inequality not satisfied (operator=not.equal; actual type=${typeName(actual)}, expected type=${typeName(x)}).${STRICT_TAIL}`),
    exist: () => assert(actual === null || actual === undefined, `Assertion failed: expected absence but value exists (operator=not.exist; actual type=${typeName(actual)}).`),
  };
  chain.equal = (x: unknown) => {
    assert(actual === x, `Assertion failed: equality not satisfied (operator=equal; actual type=${typeName(actual)}, expected type=${typeName(x)}).${STRICT_TAIL}`);

    return self();
  };
  chain.eql = (x: unknown) => {
    assert(JSON.stringify(actual) === JSON.stringify(x), `Assertion failed: deep equality not satisfied (operator=eql; actual type=${typeName(actual)}, expected type=${typeName(x)}).${STRICT_TAIL}`);

    return self();
  };
  chain.include = (x: unknown) => {
    const ok = typeof actual === 'string' ? actual.includes(String(x)) : Array.isArray(actual) ? actual.map(String).includes(String(x)) : false;
    assert(ok, `Assertion failed: inclusion not satisfied (operator=include; actual type=${typeName(actual)}).${STRICT_TAIL}`);
    return self();
  };
  chain.match = (re: RegExp) => {
    assert(re.test(STR(actual)), `Assertion failed: regex match not satisfied (operator=match; actual type=string).${STRICT_TAIL}`);

    return self();
  };
  chain.above = (n: number) => {
    assert(Number(actual) > n, `Assertion failed: numeric order (operator=above; threshold=${n}; actual type=${typeName(actual)}).${STRICT_TAIL}`);

    return self();
  };
  chain.below = (n: number) => {
    assert(Number(actual) < n, `Assertion failed: numeric order (operator=below; threshold=${n}; actual type=${typeName(actual)}).${STRICT_TAIL}`);

    return self();
  };
  chain.ok = () => {
    assert(!!actual, `Assertion failed: truthiness (operator=ok; actual type=${typeName(actual)}).`);

    return self();
  };
  chain.true = () => {
    assert(actual === true, `Assertion failed: expected true (operator=true; actual type=${typeName(actual)}).`);

    return self();
  };
  chain.null = () => {
    assert(actual === null, `Assertion failed: expected null (operator=null; actual type=${typeName(actual)}).`);

    return self();
  };
  chain.exist = () => {
    assert(actual !== null && actual !== undefined, `Assertion failed: expected value to exist (operator=exist; actual type=${typeName(actual)}).`);

    return self();
  };
  chain.lengthOf = (n: number) => {
    const len = (actual as { length?: number })?.length;

    assert(len === n, `Assertion failed: length (operator=lengthOf; expected length=${n}, actual length=${len === undefined ? 'n/a' : len}).`);
    return self();
  };
  chain.property = (name: string, val?: unknown) => {
    const v = (actual as Record<string, unknown>)?.[name];
    assert(v !== undefined, `Assertion failed: property path "${name}" not present (operator=property).`);
    if (val !== undefined) {
      assert(String(v) === String(val), `Assertion failed: property path "${name}" value mismatch (operator=property; actual type=${typeName(v)}, expected type=${typeName(val)}).${STRICT_TAIL}`);
    }
    return self();
  };
  chain.oneOf = (arr: unknown[]) => {
    assert(Array.isArray(arr) && arr.some(x => String(x) === String(actual)), `Assertion failed: membership (operator=oneOf; actual type=${typeName(actual)}, candidates=${arr.length}).${STRICT_TAIL}`);

    return self();
  };
  chain.a = (t: string) => {
    assert((t === 'number' ? typeof actual === 'number' : t === 'string' ? typeof actual === 'string' : t === 'array' ? Array.isArray(actual) : t === 'object' ? typeof actual === 'object' : false), `Assertion failed: type (operator=a; expected type=${t}, actual type=${typeName(actual)}).`);

    return self();
  };
  chain.have = self();
  chain.with = self();
  return chain;
}

/* ---------- pm.* API 工厂（纯：一切副作用记录进 io.outcome） ---------- */
export function createPmAPI(snap: ScriptSnapshot, io: RuntimeIO) {
  const { outcome } = io;
  const tests: ScriptOutcomeData['tests'] = [];
  const pendingTests: Promise<void>[] = []; // E5 异步断言（pm.test 回调返回 Promise）等待收集
  const varList = (layer: keyof Pick<ScriptSnapshot, 'globals' | 'collection' | 'environment' | 'iterationData' | 'local'>) =>
    Object.entries(snap[layer]).map(([key, value]) => ({ key, value }));

  const makeVarLayer = (layer: 'globals' | 'collection' | 'environment') => ({
    get: (name: string) => snap[layer][name],
    set: (name: string | { key: string; value: string } | Record<string, string>, value?: string) => {
      if (typeof name === 'string') {
        outcome.envWrites.push({ layer, name, value: STR(value) });
        snap[layer][name] = STR(value);
      }
      else if (Array.isArray(name)) {
        for (const v of name) {
          outcome.envWrites.push({ layer, name: v.key, value: STR(v.value) });
          snap[layer][v.key] = STR(v.value);
        }
      }
      else {
        for (const [k, v] of Object.entries(name)) {
          outcome.envWrites.push({ layer, name: k, value: STR(v) });
          snap[layer][k] = STR(v);
        }
      }
    },
    unset: (name: string) => {
      outcome.envWrites.push({ layer, name, value: null });
      delete snap[layer][name];
    },
    has: (name: string) => snap[layer][name] !== undefined,
    toObject: () => varList(layer),
    count: () => Object.keys(snap[layer]).length,
  });

  const response = snap.response
    ? {
        code: snap.response.status,
        status: snap.response.statusText,
        text: () => snap.response!.body,
        json: (pathOrReviver?: unknown) => {
          const parsed = JSON.parse(snap.response!.body);
          if (typeof pathOrReviver === 'function') {
            return (pathOrReviver as (k: string, v: unknown) => unknown)('', parsed);
          }
          return parsed;
        },
        headers: {
          get: (name: string) => snap.response!.headers[name.toLowerCase()] ?? snap.response!.headers[name],
          all: () => Object.entries(snap.response!.headers).map(([key, value]) => ({ key, value })),
          has: (name: string) => snap.response!.headers[name.toLowerCase()] !== undefined || snap.response!.headers[name] !== undefined,
          count: () => Object.keys(snap.response!.headers).length,
        },
        responseTime: snap.response.responseTime,
        size: snap.response.body.length,
      }
    : null;

  const request = {
    url: { toString: () => snap.request.url },
    method: snap.request.method,
    headers: {
      get: (name: string) => snap.request.headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value,
      upsert: (h: { key: string; value: string }) => {
        const i = snap.request.headers.findIndex(x => x.name.toLowerCase() === h.key.toLowerCase());
        const nv = { name: h.key, value: STR(h.value) };
        if (i >= 0) {
          snap.request.headers[i] = nv;
        }
        else { snap.request.headers.push(nv); }
        outcome.requestMutations.headers = [...snap.request.headers];
      },
      add: (h: { key: string; value: string }) => {
        snap.request.headers.push({ name: h.key, value: STR(h.value) });
        outcome.requestMutations.headers = [...snap.request.headers];
      },
      remove: (keyOrName: string) => {
        snap.request.headers = snap.request.headers.filter(x => x.name !== keyOrName);
        outcome.requestMutations.headers = [...snap.request.headers];
      },
      all: () => snap.request.headers.map(h => ({ key: h.name, value: h.value })),
      has: (name: string) => snap.request.headers.some(h => h.name.toLowerCase() === name.toLowerCase()),
      count: () => snap.request.headers.length,
    },
    body: {
      toString: () => snap.request.body,
      update: (raw: string) => {
        snap.request.body = STR(raw);
        outcome.requestMutations.body = snap.request.body;
      },
    },
  };

  const unsupported = (feature: string): never => {
    throw new ExpectError(`pm.${feature} is not supported by API Studio script runtime yet (see docs/api-studio/PM_SUPPORT_MATRIX.md). Use the documented pm.* subset or pm.sendRequest.`);
  };
  const pm: Record<string, unknown> = {
    info: { event: snap.info.event, iteration: snap.info.iteration, counter: snap.info.counter, requestName: snap.info.requestName },
    event: { response, request },
    request,
    response,
    environment: makeVarLayer('environment'),
    collectionVariables: makeVarLayer('collection'),
    globals: makeVarLayer('globals'),
    iterationData: { get: (n: string) => snap.iterationData[n], has: (n: string) => snap.iterationData[n] !== undefined, toObject: () => varList('iterationData'), count: () => Object.keys(snap.iterationData).length },
    variables: {
      get: (n: string) => resolveVariable(snap, n),
      set: (n: string, v: string) => {
        outcome.envWrites.push({ layer: 'local', name: n, value: STR(v) });
        snap.local[n] = STR(v);
      },
      unset: (n: string) => {
        outcome.envWrites.push({ layer: 'local', name: n, value: null });
        delete snap.local[n];
      },
      has: (n: string) => resolveVariable(snap, n) !== undefined,
      toObject: () => {
        // 与 resolveVariable 同序：高优先级覆盖低优先级（先赋低优先级，后赋高优先级）
        const merged: Record<string, string> = {};
        for (const layer of [...VARIABLE_PRECEDENCE].reverse()) {
          Object.assign(merged, snap[layer]);
        }
        return Object.entries(merged).map(([key, value]) => ({ key, value }));
      },
      replaceIn: (text: string) => STR(text).replace(/{{\s*([\w.-]+)\s*}}/g, (_m, name: string) => resolveVariable(snap, name) ?? ''),
    },
    test: (name: string, fn: () => void | Promise<void>) => {
      try {
        const r = fn();
        if (r && typeof (r as PromiseLike<void>).then === 'function') {
          // E5 异步断言（终审 P1-2）：settled 后才定成败——Postman 沙箱语义，
          // 脚本未完成结论不出具（同步路径行为不变，回归锁保护）。
          pendingTests.push(Promise.resolve(r).then(
            () => { tests.push({ name, passed: true }); },
            (e: unknown) => { tests.push({ name, passed: false, error: e instanceof Error ? e.message : String(e) }); },
          ));
        }
        else {
          tests.push({ name, passed: true });
        }
      }
      catch (e) { tests.push({ name, passed: false, error: e instanceof Error ? e.message : String(e) }); }
    },
    expect: (actual: unknown) => buildExpect(actual),
    sendRequest: async (urlOrReq: unknown, cb?: (err: unknown, res: unknown) => void) => {
      let spec = typeof urlOrReq === 'string' ? { url: urlOrReq } : urlOrReq as RuntimeIO['outcome']['sendRequests'][number];
      // Postman 同口径：outbox URL 经同一 resolver 做 {{}} 插值（终审 P1-01 单源序；E2E S14c 实弹）
      spec = { ...spec, url: STR(spec.url).replace(/{{\s*([\w.-]+)\s*}}/g, (_m, n: string) => resolveVariable(snap, n) ?? '') };
      // A-018/终审 P1-03 资源上限（fail-closed：拒绝而非静默丢、不假装成功；无限循环由 5s terminate 兜底已测）
      // 口径：OUTBOX_MAX_SENDS=单脚本**累计**发送数上限；spec 上限按 UTF-8 字节（非码元数）。
      if (outcome.sendRequests.length >= OUTBOX_MAX_SENDS) {
        const e = new Error(`pm.sendRequest cumulative send limit (${OUTBOX_MAX_SENDS} per script run) exceeded — host aborting to protect resources.`);
        cb?.(e, null);
        throw e;
      }
      const bytes = specByteLength(spec);
      if (bytes > OUTBOX_SPEC_MAX_BYTES) {
        const e = new Error(`pm.sendRequest spec exceeds ${OUTBOX_SPEC_MAX_BYTES} UTF-8 bytes (got ${bytes}; URL+headers+body) — host aborting to protect resources.`);
        cb?.(e, null);
        throw e;
      }
      outcome.sendRequests.push(spec);
      try {
        const res = await io.sendRequest(spec);
        const wrapped = wrapBridgeResponse(res); // 终审 P1-04：Postman 风格响应视图（text/json/headers.get…）
        cb?.(null, wrapped);
        return wrapped;
      }
      catch (e) {
        cb?.(e, null);
        throw e;
      }
    },
    // fail-closed：pm.cookie / pm.execution 未实现就显式报错，绝不静默 no-op 伪装支持
    cookies: unsupported as unknown as never,
    cookieJar: unsupported as unknown as never,
    execution: unsupported as unknown as never,
    /** 未逐条实现的 API 一律显式失败（fail-closed），不静默 no-op 伪装支持。 */
    unsupported: (feature: string): never => { throw new ExpectError(`pm.${feature} is not supported by API Studio script runtime yet`); },
  };
  const consoleShim = {
    log: (...a: unknown[]) => io.console(...a),
    info: (...a: unknown[]) => io.console(...a),
    warn: (...a: unknown[]) => io.console(...a),
    error: (...a: unknown[]) => io.console(...a),
    debug: (...a: unknown[]) => io.console(...a),
  };
  // E5 双模 flushTests：同步脚本路径（pendingTests 空）立即 push——现有调用零回归；
  // 异步断言路径返回 Promise（worker 统一 await；同步调用方不 await 也已拿到结果）。
  const flushTests = (): void | Promise<void> => {
    if (pendingTests.length === 0) {
      outcome.tests.push(...tests);
      return;
    }

    return Promise.allSettled(pendingTests).then(() => {
      outcome.tests.push(...tests);
    });
  };
  return { pm: pm as unknown as PmApi, console: consoleShim, flushTests };
}

export const EXPECT_ERROR_NAME = 'ExpectError';

/* ---------- 沙箱网络中和（A5 P0：Worker 无 DOM ≠ 无网络） ----------
 * 威胁模型：用户脚本运行在专用 module Worker 内，但仍可调用 fetch / XHR / WebSocket /
 * EventSource / importScripts / 子 Worker / BroadcastChannel / caches / indexedDB /
 * navigator.sendBeacon —— 全部是数据外传或逃逸通道。中和策略：
 *   1. 在用户代码 eval 之前，把上述全局替换为"读取即抛错"的访问器（fail-closed）；
 *   2. 唯一合法网络路径 = pm.sendRequest → outbox → 宿主经既有 apiproxy（同源端点、目标策略、
 *      超时与审计在宿主侧）；
 *   3. 终审 P0-01/P1-09 补强：Function 构造器 / eval 读取即抛（直接构造逃逸闭合）。
 *      **WebAssembly 试列后实证排除**：worker_threads 引导期存在无 JS 栈的原生 WebAssembly
 *      读（getter 抛错致 bundle 加载即炸，干净目录冒烟捕获）——原生读不可中和，列它反而
 *      破坏沙箱自身启动；WASM 内存面 DoS 由宿主 resourceLimits（maxOldGenerationSizeMb）
 *      上限兜住。WASM 无宿主导入即无 fs/net 能力，非外传通道。
 *      **如实登记的残余**：原型链混淆（''.constructor.constructor + 拆分字符串）在
 *      worker_threads 下仍可达动态 import——进程内 JS 沙箱无法对恶意代码闭环（Node 官方
 *      Permission Model 同样实证不拦模块加载）；对恶意代码的完整闭环需 OS 边界隔离
 *      （独立低权限子进程/容器），登记为产品决策项。定位=开发工具脚本环境 + fail-closed
 *      守卫，不正称"不可绕边界"。
 *   4. 已知局限（如实记录，不伪装成不可绕边界）：静态模块护栏是正则，混淆构造可绕过；
 *      中和是运行时全局替换，未来新增的 Worker API 不在清单内即失效；主线程侧另有 message
 *      类型白名单兜底（未知消息一律忽略）。
 *   本函数纯函数化以便单测负控；worker 启动时安装。
 */
export const SANDBOX_BLOCKED_GLOBALS = [
  'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource',
  'importScripts', 'Worker', 'SharedWorker', 'BroadcastChannel',
  'caches', 'indexedDB', 'Notification', 'open',
  'Function', 'eval',
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
        Object.defineProperty(scope, k, {
          configurable: true,
          get: () => {
            throw new Error(`[api-studio sandbox] ${k} is disabled.`);
          },
        });

        installed.push(`${k}:absent`);
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
