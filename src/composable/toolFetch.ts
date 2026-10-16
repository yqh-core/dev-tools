/**
 * 联网工具页共用的「请求状态机」。
 *
 * 为什么要有这个文件
 * ------------------------------------------------------------------
 * whois-lookup、http-status-checker、today-in-history 三页各自手写过一遍同样的东西：
 * 三个互相依赖的 ref（loading / error / result）+ 同一条 `!resp.ok || !data` 判断 +
 * 同一段 `e instanceof Error ? e.message : String(e)` + 同一句「需部署到 Cloudflare Pages」尾注。
 * 三个 ref 表达一个状态就是布尔汤：`loading=false && error=''` 既可能是「还没查」也可能是
 * 「刚清掉」，读代码的人必须把三条分支全看一遍才知道界面会显示什么。
 * 这里换成判别联合，一次只有一个合法形态。
 *
 * 为什么没做成「一个通用 fetch 完事」
 * ------------------------------------------------------------------
 * 这三页的请求语义**确实不一样**，所以留了两个必填扩展点而不是硬统一：
 *   resolveUrl —— 谁校验收输入、谁补协议、谁拼查询参数，各页自己决定；
 *   interpret  —— HTTP 200 之后 payload 怎么解释，各页自己决定。
 * 特别是「部分结果 + 错误」这一档必须能表达：http-status 在拿到响应头但状态码为空时，
 * 原文案是**同时**显示响应头和一句错误；today-in-history 在数据集当天为空时，
 * 要显示接口给的 note 解释「为什么空」。把它们压成 success/xor/error 会丢功能。
 *
 * 一个顺带修掉的真实缺陷
 * ------------------------------------------------------------------
 * 老代码没有竞态保护：连点两次按钮时，先发的慢响应会后到并覆盖掉快响应的结果，
 * 而且 finally 会把 loading 关掉。这里用请求序号丢弃过期响应。
 *
 * 输入用 MaybeRefOrGetter 而不是只收字符串：调用方直接把 useStorage 的 ref 交给
 * execute() 即可（模板里 `@keydown.enter="execute(domain)"`），由 toValue 在调用时机解析，
 * 避免页面为了传值先写一层 .value 解构。回调类参数（resolveUrl / interpret）**不走**这个类型，
 * 否则会被当成 getter 误调用。
 */
import { computed, getCurrentScope, onScopeDispose, shallowRef, toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';

export type ToolFetchState<TData> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: TData }
  /** data 允许存在：用于「拿到了部分结果，但同时有个要说明的错误」 */
  | { status: 'error'; message: string; data?: TData };

/** 请求前的输入处理：给 url 就发请求，给 error 就地报错且不发请求 */
export type ResolvedRequest = { url: string } | { error: string };

/** 2xx + 有 JSON 之后怎么解释：给 data 就算成功，给 error 就算业务失败（可带部分 data） */
export type InterpretedResult<TData> = { data: TData } | { error: string; data?: TData };

export interface ToolFetchOptions<TData> {
  resolveUrl: (input: string) => ResolvedRequest
  interpret: (payload: Record<string, unknown>) => InterpretedResult<TData>
  /** 失败文案前缀，保留各页原有动词（Lookup failed / Check failed / Load failed） */
  errorPrefix?: MaybeRefOrGetter<string>
  /** 默认带「该工具需部署到 Cloudflare Pages 后可用」尾注；传 false 可关 */
  deploymentHint?: MaybeRefOrGetter<boolean>
}

const DEPLOYMENT_HINT = ' (this tool needs the Cloudflare Pages deployment)';

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useToolFetch<TData>(options: ToolFetchOptions<TData>) {
  // 用 shallowRef 而不是 ref：状态整体替换、从不改嵌套字段；
  // 而 ref<ToolFetchState<TData>> 会对泛型 TData 做 DeepUnwrap，
  // 把 data 的类型变成 UnwrapRef<TData>，vue-tsc 在赋值处直接判错。
  const state = shallowRef<ToolFetchState<TData>>({ status: 'idle' });

  // 每次 execute 都自增；响应回来时若不是最新一次就整体丢弃（含 loading 收尾）。
  let seq = 0;

  // 作用域销毁（组件卸载）时再推进一次序号：此后任何在飞请求的响应都因序号不匹配被丢弃，
  // 不会给已销毁组件的 ref 赋值。注意这里只"丢弃结果"，不取消请求本身
  // ——取消要引入 AbortController，那会真实掐断在飞请求，属行为变更，未纳入本次重构。
  // 先判 getCurrentScope：在组件外（例如单测里裸调）没有作用域，直接注册会让 Vue 抛
  // "onScopeDispose() is called when there is no active effect scope" 警告。
  if (getCurrentScope()) {
    onScopeDispose(() => {
      seq++;
    });
  }

  const isLoading = computed(() => state.value.status === 'loading');
  const error = computed(() => (state.value.status === 'error' ? state.value.message : ''));
  const data = computed<TData | undefined>(() =>
    state.value.status === 'ok' || state.value.status === 'error'
      ? state.value.data
      : undefined,
  );

  function latestData(): TData | undefined {
    return state.value.status === 'ok' || state.value.status === 'error'
      ? state.value.data
      : undefined;
  }

  function fail(message: string, keepData: TData | undefined) {
    state.value = keepData === undefined
      ? { status: 'error', message }
      : { status: 'error', message, data: keepData };
  }

  async function execute(source: MaybeRefOrGetter<string> = ''): Promise<void> {
    const token = ++seq;
    const resolved = options.resolveUrl(toValue(source));

    if ('error' in resolved) {
      // 输入不合法：不发请求，也不清掉用户屏幕上已有的上一次结果（与改造前一致）。
      fail(resolved.error, latestData());
      return;
    }

    state.value = { status: 'loading' };
    try {
      const resp = await fetch(resolved.url);
      const payload = (await resp.json().catch(() => null)) as Record<string, unknown> | null;

      if (!resp.ok || !payload) {
        // 服务端在 4xx/5xx 里给的 error 字段比状态码有用，优先用它（原行为）。
        const fromBody = typeof payload?.error === 'string' ? payload.error : '';
        throw new Error(fromBody || `Service returned HTTP ${resp.status}`);
      }

      const outcome = options.interpret(payload);
      if (token !== seq) {
        return;
      }
      if ('error' in outcome) {
        fail(outcome.error, outcome.data);
      }
      else {
        state.value = { status: 'ok', data: outcome.data };
      }
    }
    catch (e) {
      // 过期响应（含慢响应后到、或 interpret 自身抛错）一律不写状态：
      // 最新那次请求才是状态的唯一所有者，谁写 loading 收尾由它自己负责。
      if (token !== seq) {
        return;
      }
      const prefix = options.errorPrefix === undefined ? 'Request failed' : toValue(options.errorPrefix);
      const withHint = options.deploymentHint === undefined || toValue(options.deploymentHint);
      state.value = {
        status: 'error',
        message: `${prefix}: ${toMessage(e)}${withHint ? DEPLOYMENT_HINT : ''}`,
      };
    }
  }

  function clear() {
    seq++;
    state.value = { status: 'idle' };
  }

  return { state, isLoading, error, data, execute, clear };
}
