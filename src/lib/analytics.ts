/**
 * DigDevBox 真实使用测量闭环 · 埋点核心（生产就绪，隔离原型）
 *
 * 漏斗：visit → tool_start → tool_success → download → return_visit
 * 纪律：
 *  - PV ≠ 使用。visit 只是页面访问；tool_start/tool_success 才代表真实使用。
 *  - 隐私友好：匿名随机会话 id，绝不采集文件名/输入内容/PII。只记 tool id + 事件 + 时间戳。
 *  - 不适合采集的事件标 NOT_COLLECTED，不估算、不伪造。
 *  - 核心逻辑纯函数化（无 DOM），Node 可单测；浏览器传输（sendBeacon）分离注入。
 *
 * 本模块已接入生产（2026-11-12 测量第一批授权：image-compress + ip）；隐私红线不变。
 */

export const FUNNEL_EVENTS = ['visit', 'tool_start', 'tool_success', 'download', 'return_visit'] as const;
export type FunnelEvent = typeof FUNNEL_EVENTS[number];

export interface TrackEvent {
  tool: string
  event: FunnelEvent
  ts: number
  sid: string // 匿名随机会话 id（非 PII）
  seq: number
}

export interface Transport {
  send(events: TrackEvent[]): void
}

// 隐私红线：事件 payload 绝不允许携带这些字段
const FORBIDDEN_KEYS = ['filename', 'fileName', 'input', 'content', 'ip', 'email', 'user', 'password', 'token', 'cookie'];

export class FunnelTracker {
  private sid: string;
  private seq = 0;
  private queue: TrackEvent[] = [];
  private seen = new Set<string>(); // 去重：每会话每工具每事件一次（visit/return 除外）
  private notCollected: Set<FunnelEvent>;
  private transport: Transport;
  readonly tool: string;

  constructor(tool: string, transport: Transport, opts?: { notCollected?: FunnelEvent[]; sid?: string }) {
    this.tool = tool;
    this.transport = transport;
    this.notCollected = new Set(opts?.notCollected ?? []);
    this.sid = opts?.sid ?? FunnelTracker.randomSid();
  }

  static randomSid(): string {
    // 匿名随机会话 id，不含任何用户标识
    return `s_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  }

  /** 校验事件隐私合规：禁止 PII 字段。返回是否合规。 */
  static isPrivacySafe(payload: Record<string, unknown>): boolean {
    return !Object.keys(payload).some(k => FORBIDDEN_KEYS.includes(k.toLowerCase()));
  }

  /** 记录一个漏斗事件。返回 'tracked' | 'dedup' | 'not_collected' | 'invalid'。 */
  track(event: FunnelEvent, extra?: Record<string, unknown>): string {
    if (!FUNNEL_EVENTS.includes(event)) {
      return 'invalid';
    }
    if (this.notCollected.has(event)) {
      return 'not_collected';
    }
    if (extra && !FunnelTracker.isPrivacySafe(extra)) {
      return 'invalid';
    }
    // visit / return_visit 允许重复；其余每会话每工具去重
    const dedupKey = `${this.tool}:${event}`;
    if (event !== 'visit' && event !== 'return_visit') {
      if (this.seen.has(dedupKey)) {
        return 'dedup';
      }
      this.seen.add(dedupKey);
    }
    this.queue.push({ tool: this.tool, event, ts: Date.now(), sid: this.sid, seq: this.seq++ });
    return 'tracked';
  }

  /**  flush 队列到传输层。 */
  flush(): TrackEvent[] {
    const out = this.queue.slice();
    this.queue = [];
    if (out.length) {
      this.transport.send(out);
    }
    return out;
  }

  pending(): number { return this.queue.length; }
}

/** 浏览器传输：sendBeacon（页面卸载也能发）。endpoint 可配置。 */
export function beaconTransport(endpoint: string): Transport {
  return {
    send(events) {
      try {
        // 用 text/plain 而非 application/json：sendBeacon 对非简单 content-type 会触发 CORS 预检，
        // 而 beacon 的异步预检流程在 Chrome 下会卡住导致 POST 永不发出（实测网络层 POST pending）。
        // text/plain 是简单类型、无预检、立即发出；body 仍是 JSON 串，收集器 request.json() 照常解析。
        const blob = new Blob([JSON.stringify(events)], { type: 'text/plain;charset=UTF-8' });
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
          navigator.sendBeacon(endpoint, blob);
        }
      }
      catch { /* 测量失败不阻塞产品 */ }
    },
  };
}

/** 内存传输（测试/demo 用）。 */
export function memoryTransport(): Transport & { events: TrackEvent[] } {
  const events: TrackEvent[] = [];
  return {
    events,
    send(e) {
      events.push(...e);
    },
  };
}
