/**
 * API-011/A5 沙箱网络中和负控。
 * 判据方向：install 之后读取逃逸 API 必须抛错；未 install 时可用（证明"能红"）；
 * 自身协议通道 postMessage 不受封锁（worker 通信命脉）。
 */
import { describe, expect, it } from 'vitest';
import { installSandboxGuards, SANDBOX_BLOCKED_GLOBALS } from './script-runtime';

function fakeScope() {
  return {
    fetch: () => Promise.resolve(),
    XMLHttpRequest: class {},
    WebSocket: class {},
    EventSource: class {},
    Worker: class {},
    BroadcastChannel: class {},
    caches: {},
    indexedDB: {},
    postMessage: () => 'kept',
    navigator: { sendBeacon: () => true },
  };
}

describe('installSandboxGuards', () => {
  it('清单内每个全局读取即抛错（fail-closed）', () => {
    const scope = fakeScope() as unknown as Record<string, unknown>;
    installSandboxGuards(scope);
    for (const k of SANDBOX_BLOCKED_GLOBALS) {
      expect(() => scope[k]).toThrow(/sandbox/);
    }
  });

  it('负控：未安装时 fetch 可用（证明判据不是恒真）', () => {
    const scope = fakeScope() as unknown as Record<string, unknown>;
    expect(typeof scope.fetch).toBe('function');
  });

  it('navigator.sendBeacon 被中和，postMessage 保留（worker 协议命脉）', () => {
    const scope = fakeScope() as unknown as Record<string, unknown>;
    installSandboxGuards(scope);
    expect(() => (scope.navigator as { sendBeacon: unknown }).sendBeacon).toThrow(/sandbox/);
    expect((scope.postMessage as () => string)()).toBe('kept');
  });

  it('不存在的全局（如 module Worker 的 importScripts）补成抛错访问器——不放过未来可用性', () => {
    const scope = fakeScope() as unknown as Record<string, unknown>;
    delete (scope as Record<string, unknown>).Worker; // 模拟某运行时缺该全局
    installSandboxGuards(scope);
    expect(() => scope.Worker).toThrow(/sandbox/);
  });
});
