/**
 * smoke-console-rules 的合成输入测试 —— 裁定点名的三种情况都在这里的标题里。
 *
 * 这一批测试存在的意义：以前「这条分类对不对」只能靠真跑一轮冒烟去猜，
 * 而真跑只会告诉你「今天没红」，不会告诉你「规则其实把真故障放行了」。
 * 所以每一条 blocking 判据都配一个「喂进真故障必须判红」的对照组。
 */
import { describe, expect, it } from 'vitest';

import {
  attributeFailure,
  classifyException,
  classifyLoadFailure,
  isThirdPartyUrl,
} from './smoke-console-rules.mjs';

const BASE = 'http://127.0.0.1:4192';
const ctx = { base: BASE };

describe('情况一：缺失 URL（不可归属）', () => {
  it('loadingFailed 没有 URL 且回捞不到 → unattributed，不阻断也不并入噪声', () => {
    const r = classifyLoadFailure({ error: 'net::ERR_CONNECTION_TIMED_OUT', type: 'Script' }, ctx);
    expect(r.kind).toBe('unattributed');
    expect(r.url).toBe('');
  });

  it('对照组：同一错误只要带上自家 URL，就必须阻断（"不可归属"不能变成放行通道）', () => {
    const r = classifyLoadFailure(
      { url: `${BASE}/assets/chunk-abc.js`, error: 'net::ERR_CONNECTION_TIMED_OUT', type: 'Script' },
      ctx,
    );
    expect(r.kind).toBe('blocking');
  });

  it('attributeFailure 能从同轮 console 条目里回捞 URL（回捞成功就不该落到 unattributed）', () => {
    const entries = [{ url: 'https://ad.example/x.js', text: 'Failed to load resource: net::ERR_CONNECTION_TIMED_OUT' }];
    expect(attributeFailure({ url: '', error: 'net::ERR_CONNECTION_TIMED_OUT' }, entries))
      .toBe('https://ad.example/x.js');
    expect(attributeFailure({ url: '', error: 'net::ERR_NAME_NOT_RESOLVED' }, entries)).toBe('');
    expect(attributeFailure({ url: `${BASE}/a.js`, error: '' }, [])).toBe(`${BASE}/a.js`);
  });
});

describe('情况二：已有归属（同源 = 站点自己的资源）', () => {
  it('自家 chunk 失败必须阻断', () => {
    const r = classifyLoadFailure({ url: `${BASE}/assets/index-1.js`, error: 'net::ERR_FAILED' }, ctx);
    expect(r.kind).toBe('blocking');
  });

  it('同源也允许豁免，但只有点名的那几条：favicon / 清单 / SW / ABORTED / 网络抖动', () => {
    expect(classifyLoadFailure({ url: `${BASE}/favicon-32x32.png`, error: 'net::ERR_FAILED' }, ctx).kind).toBe('noise');
    expect(classifyLoadFailure({ url: `${BASE}/manifest.webmanifest`, error: 'net::ERR_FAILED' }, ctx).kind).toBe('noise');
    expect(classifyLoadFailure({ url: `${BASE}/sw.js`, error: 'net::ERR_FAILED' }, ctx).kind).toBe('noise');
    expect(classifyLoadFailure({ url: `${BASE}/assets/index-1.js`, error: 'net::ERR_INTERNET_DISCONNECTED' }, ctx).kind).toBe('noise');
  });

  it('对照组：同源且不在点名名单上（比如一条普通 CSS）→ 仍然阻断，白名单没有被当成通用豁免', () => {
    const r = classifyLoadFailure({ url: `${BASE}/assets/app-9.css`, error: 'net::ERR_FAILED' }, ctx);
    expect(r.kind).toBe('blocking');
  });

  it('canceled / ERR_ABORTED 属于流程噪声，直接跳过（不算缺陷也不算资源失败）', () => {
    expect(classifyLoadFailure({ url: `${BASE}/a.js`, error: 'x', canceled: true }, ctx).kind).toBe('skip');
    expect(classifyLoadFailure({ url: `${BASE}/a.js`, error: 'net::ERR_ABORTED' }, ctx).kind).toBe('skip');
  });
});

describe('情况三：未知归属（外部但不在第三方名单）', () => {
  it('第三方名单里的域 → 噪声且带 why', () => {
    const r = classifyLoadFailure({ url: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', error: 'net::ERR_FAILED' }, ctx);
    expect(r.kind).toBe('noise');
    expect(r.why).toBe('third-party');
  });

  it('未列入名单的外部 host：本站之外的绝对 URL 一律按第三方（「是不是自家资源」看源，不看名单）', () => {
    // 这一条把我原先写的期望证伪了：shipped 语义是 `^https?:// 且不是被测源 ⇒ 第三方`。
    // 跨域资源本来就归不到「站点自身资源」这一类，所以真正的硬判据是**同源必须阻断**
    // （上面那条对照组），而不是给外部流量再加一层名单。留着这条是为了不让我自己
    // 以后把「未知外部 host」当成漏网之鱼去改动同源规则。
    const r = classifyLoadFailure({ url: 'https://weird-tracker.example/pixel.gif', error: 'net::ERR_FAILED' }, ctx);
    expect(r.kind).toBe('noise');
    expect(r.why).toBe('third-party');
  });

  it('用例声明的豁免只在带 why 时生效（没写 why 就等于没声明）', () => {
    const withWhy = { base: BASE, caseNoiseHit: () => ({ why: 'A3 故意注入的 500' }) };
    expect(classifyLoadFailure({ url: 'https://x.example/a.png', error: 'net::ERR_FAILED' }, withWhy).kind).toBe('noise');
    expect(classifyLoadFailure({ url: `${BASE}/assets/a.js`, error: 'net::ERR_FAILED' }, withWhy).kind).toBe('noise');
    const noWhy = { base: BASE, caseNoiseHit: () => undefined };
    expect(classifyLoadFailure({ url: `${BASE}/assets/a.js`, error: 'net::ERR_FAILED' }, noWhy).kind).toBe('blocking');
  });

  it('isThirdPartyUrl：站内绝对 URL 不算第三方（否则 canonical 自指会被误放行）', () => {
    expect(isThirdPartyUrl(`${BASE}/assets/a.js`, BASE)).toBe(false);
    expect(isThirdPartyUrl('https://digdevbox.com/guides/x/', BASE)).toBe(true);
  });
});

describe('未捕获异常的归属与资源失败同一套规则', () => {
  it('第三方脚本报的 uncaught 归噪声（实测 AdSense show_ads_impl.js 就是这个形态）', () => {
    const r = classifyException({ url: 'https://pagead2.googlesyndication.com/pagead/managed/js/adsense/m1/show_ads_impl.js', text: 'Uncaught (in promise) undefined' }, ctx);
    expect(r.kind).toBe('noise');
  });

  it('自家脚本报的 uncaught 必须阻断；异常没有 URL 时保持阻断（这一路不降级）', () => {
    expect(classifyException({ url: `${BASE}/assets/app.js`, text: 'Uncaught TypeError' }, ctx).kind).toBe('blocking');
    expect(classifyException({ url: '', text: 'Uncaught' }, ctx).kind).toBe('blocking');
  });
});
