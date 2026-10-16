import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';
import { useToolFetch } from './toolFetch';

interface FakeResponse {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

function jsonResponse(body: unknown, status = 200): FakeResponse {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

function brokenJsonResponse(status = 200): FakeResponse {
  return { ok: status < 300, status, json: () => Promise.reject(new Error('bad json')) };
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** 谁都想少写点：本文件所有用例统一用最简单的解释器 */
function plain(urlField = 'raw') {
  return {
    resolveUrl: (input: string) => (input.trim() ? { url: `https://api.test/?q=${input}` } : { error: 'Enter a domain first' }),
    interpret: (payload: Record<string, unknown>) => ({ data: String(payload[urlField] ?? '') }),
  };
}

describe('useToolFetch 状态机', () => {
  it('探测器不是摆设：合法输入必须真的发出一次请求（否则后面所有「0 次」断言都不成立）', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ raw: 'hello' }));
    const { execute } = useToolFetch<string>(plain());

    await execute('example.com');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/?q=example.com');
  });

  it('初始是 idle：没 loading、没错误、没数据、也没偷发请求', () => {
    const { isLoading, error, data } = useToolFetch<string>(plain());

    expect(isLoading.value).toBe(false);
    expect(error.value).toBe('');
    expect(data.value).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(0); // 对照组：上一条用例这里必须是 1
  });

  it('请求进行中是 loading，结束落到 ok', async () => {
    let release: (v: FakeResponse) => void = () => {};
    fetchMock.mockReturnValue(new Promise((resolve) => {
      release = resolve;
    }));
    const { execute, isLoading, state } = useToolFetch<string>(plain());

    const running = execute('a.com');
    expect(isLoading.value).toBe(true);
    expect(state.value.status).toBe('loading');

    release(jsonResponse({ raw: 'ok-result' }));
    await running;

    expect(isLoading.value).toBe(false);
    expect(state.value.status).toBe('ok');
  });

  it('输入不合法：不发请求、直接给文案，且不许卡在 loading', async () => {
    const { execute, isLoading, error } = useToolFetch<string>(plain());

    await execute('   ');

    expect(fetchMock).toHaveBeenCalledTimes(0);
    expect(error.value).toBe('Enter a domain first');
    expect(isLoading.value).toBe(false);
  });

  it('输入不合法时不许抹掉屏幕上已有的上一次结果（改造前的行为）', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ raw: 'kept' }));
    const { execute, data, error } = useToolFetch<string>(plain());

    await execute('example.com');
    expect(data.value).toBe('kept');

    await execute('');

    expect(data.value).toBe('kept');
    expect(error.value).toBe('Enter a domain first');
  });

  it('MaybeRefOrGetter 真的走 toValue：模板可以直接把 ref 交给 execute', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ raw: 'from-ref' }));
    const domain = ref('from-ref.example');
    const { execute } = useToolFetch<string>(plain());

    await execute(domain);

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/?q=from-ref.example');
  });

  describe('失败路径的文案所有权', () => {
    it('非 2xx 且 body 带 error 时用 body 的（比状态码有用）', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ error: 'rate limited' }, 503));
      const { execute, error } = useToolFetch<string>({ ...plain(), errorPrefix: 'Lookup failed' });

      await execute('x.com');

      expect(error.value).toBe('Lookup failed: rate limited (this tool needs the Cloudflare Pages deployment)');
    });

    it('非 2xx 且 body 没给 error 时退回 HTTP 状态码文案', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, 503));
      const { execute, error } = useToolFetch<string>({ ...plain(), errorPrefix: 'Check failed' });

      await execute('x.com');

      expect(error.value).toContain('Service returned HTTP 503');
    });

    it('2xx 但 JSON 解析不了，也算没拿到 payload', async () => {
      fetchMock.mockResolvedValue(brokenJsonResponse(200));
      const { execute, error } = useToolFetch<string>({ ...plain(), errorPrefix: 'Load failed' });

      await execute('x.com');

      expect(error.value).toContain('Service returned HTTP 200');
    });

    it('网络直接 reject 时也要带部署尾注；显式关掉尾注就不带（证明尾注由开关控制，不是恒在）', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
      const withHint = useToolFetch<string>({ ...plain(), errorPrefix: 'Lookup failed' });
      await withHint.execute('x.com');
      expect(withHint.error.value).toBe('Lookup failed: Failed to fetch (this tool needs the Cloudflare Pages deployment)');

      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
      const noHint = useToolFetch<string>({ ...plain(), errorPrefix: 'Lookup failed', deploymentHint: false });
      await noHint.execute('x.com');
      expect(noHint.error.value).toBe('Lookup failed: Failed to fetch');
    });

    it('errorPrefix 给 ref 时也生效（三页各自保留动词的扩展点）', async () => {
      fetchMock.mockRejectedValue(new Error('boom'));
      const prefix = ref('Lookup failed');
      const { execute, error } = useToolFetch<string>({ ...plain(), errorPrefix: prefix });

      await execute('x.com');
      expect(error.value.startsWith('Lookup failed: boom')).toBe(true);

      fetchMock.mockRejectedValue(new Error('boom'));
      prefix.value = 'Check failed';
      await execute('x.com');
      expect(error.value.startsWith('Check failed: boom')).toBe(true);
    });

    it('四类失败都不许把状态留在 loading', async () => {
      const cases = [
        jsonResponse({ error: 'nope' }, 500),
        brokenJsonResponse(200),
        jsonResponse({}, 404),
      ];
      for (const resp of cases) {
        fetchMock.mockResolvedValue(resp);
        const { execute, isLoading, state } = useToolFetch<string>(plain());
        await execute('x.com');
        expect(isLoading.value).toBe(false);
        expect(state.value.status).toBe('error');
      }

      fetchMock.mockRejectedValue(new Error('down'));
      const net = useToolFetch<string>(plain());
      await net.execute('x.com');
      expect(net.isLoading.value).toBe(false);
      expect(net.state.value.status).toBe('error');
    });
  });

  describe('业务层「部分结果 + 错误」（三页里真实存在、不能压成二选一）', () => {
    it('interpret 给 error 且带 data 时，错误与数据同时可见', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ headers: { a: '1' } }));
      const { execute, error, data } = useToolFetch<{ status: number | null; headers: Record<string, string> }>({
        resolveUrl: input => (input ? { url: `https://api.test/?u=${input}` } : { error: 'Enter a URL first' }),
        interpret: payload => ({
          error: 'The service returned no status code',
          data: { status: null, headers: (payload.headers as Record<string, string>) ?? {} },
        }),
      });

      await execute('example.com');

      expect(error.value).toBe('The service returned no status code');
      expect(data.value?.headers).toEqual({ a: '1' });
    });

    it('interpret 自己抛异常时按失败处理，不卡 loading', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ raw: 'x' }));
      const { execute, error, isLoading } = useToolFetch<string>({
        resolveUrl: input => ({ url: input }),
        interpret: () => {
          throw new Error('interpret blew up');
        },
        errorPrefix: 'Load failed',
      });

      await execute('u');

      expect(error.value).toContain('interpret blew up');
      expect(isLoading.value).toBe(false);
    });
  });

  describe('重复请求', () => {
    it('慢响应后到不得覆盖新结果，也不得改动新请求的状态', async () => {
      const gates: Array<(v: FakeResponse) => void> = [];
      fetchMock.mockImplementation(() => new Promise((resolve) => {
        gates.push(resolve);
      }));
      const { execute, data, error, isLoading } = useToolFetch<string>(plain());

      const slow = execute('slow.com');
      const fast = execute('fast.com');
      expect(fetchMock).toHaveBeenCalledTimes(2);

      gates[1](jsonResponse({ raw: 'fast-result' }));
      await fast;
      expect(data.value).toBe('fast-result');
      expect(isLoading.value).toBe(false);

      // 迟到的第一次响应：整体丢弃
      gates[0](jsonResponse({ raw: 'slow-result' }));
      await slow;

      expect(data.value).toBe('fast-result');
      expect(error.value).toBe('');
      expect(isLoading.value).toBe(false);
    });

    it('慢响应即使在最后 reject，也不能污染最新一次的成功结果', async () => {
      const gates: Array<(v?: unknown) => void> = [];
      fetchMock.mockImplementation(() => new Promise((resolve, reject) => {
        gates.push(reject);
      }));
      const { execute, data } = useToolFetch<string>(plain());

      gates.length = 0;
      const first = execute('slow.com');
      fetchMock.mockResolvedValue(jsonResponse({ raw: 'second' }));
      await execute('fast.com');
      expect(data.value).toBe('second');

      gates[0](new Error('late network failure'));
      await first;

      expect(data.value).toBe('second');
    });
  });

  it('clear() 回到 idle：文案与数据一起清掉', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ raw: 'shown' }));
    const { execute, clear, data, error, state } = useToolFetch<string>(plain());

    await execute('example.com');
    expect(state.value.status).toBe('ok');

    clear();

    expect(state.value.status).toBe('idle');
    expect(data.value).toBeUndefined();
    expect(error.value).toBe('');
  });

  it('clear() 之后迟到的响应也不能把结果写回来', async () => {
    let release: (v: FakeResponse) => void = () => {};
    fetchMock.mockReturnValue(new Promise((resolve) => {
      release = resolve;
    }));
    const { execute, clear, data } = useToolFetch<string>(plain());

    const running = execute('example.com');
    clear();
    release(jsonResponse({ raw: 'ghost' }));
    await running;

    expect(data.value).toBeUndefined();
  });

  // 组件卸载后的遗留副作用：请求还挂在天上，响应后到时不许再写已销毁作用域的 ref。
  // 本用例只断言"结果不被写入"，不断言"请求被取消"——取消要 AbortController，属另一项裁定。
  it('作用域销毁（组件卸载）后，在飞请求的响应不得写回状态', async () => {
    let release: (v: FakeResponse) => void = () => {};
    fetchMock.mockReturnValue(new Promise((resolve) => {
      release = resolve;
    }));

    const scope = effectScope();
    let api: ReturnType<typeof useToolFetch<string>> | undefined;
    scope.run(() => {
      api = useToolFetch<string>(plain());
    });
    expect(api).toBeDefined();

    const running = api!.execute('example.com');
    // 先证明请求真的在飞：fetch 已被调用 1 次、状态停在 loading
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(api!.state.value.status).toBe('loading');

    scope.stop();
    release(jsonResponse({ raw: 'after-unmount' }));
    await running;

    expect(api!.state.value.status).toBe('loading'); // 没有被改写成 ok
    expect(api!.data.value).toBeUndefined();
    expect(api!.error.value).toBe('');
  });
});
