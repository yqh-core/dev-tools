/**
 * smoke-console-rules.mjs —— 资源加载失败的**归属与分级规则**（纯函数，零依赖）
 * ---------------------------------------------------------------------------
 * 为什么要从引擎里拆出来：
 *   引擎（scripts/smoke-tools.mjs）一 import 就会启动 Chrome、起静态服务、跑用例，
 *   所以「这条分类规则对不对」以前**只能靠真跑一整轮冒烟去猜**。
 *   裁定要求「对事件分类与归属规则构造最小合成输入，验证缺失 URL、未知归属、已有归属三种情况」，
 *   没有这个可导入的接缝就做不到，只能拿真实现场当测试 —— 那是假通过的温床。
 *
 * 规则本身没有变化，是从 smoke-tools.mjs 的 loadFailures 分支逐条搬过来的；
 * 搬完之后由引擎反向 import，保证**只有一份**规则（不会出现测试测的和跑的不一样）。
 *
 * 三条硬约束（写在测试里，不写在注释里）：
 *   ① 同源（自家）资源失败**永远阻断**，只有明确列出的那几条 pattern 能豁免；
 *   ② 归因不到 URL 的事件单列 unattributed —— 既不阻断也不并入噪声，必须可见；
 *   ③ 不在第三方名单里的外部 host 仍然阻断：「看起来像广告」不是豁免理由。
 */

/** 第三方 host：广告 / 统计 / 字体。这些域报错与被测功能无关。 */
export const NOISE_HOSTS = [
  'googlesyndication.com',
  'doubleclick.net',
  'googleadservices.com',
  'google-analytics.com',
  'googletagservices.com',
  'gstatic.com',
  'googleapis.com',
  'plausible.io',
  'cloudflareinsights.com',
  'sentry.io',
];

/** 同源但可豁免的 pattern。每一条都要写清理由，否则等于把真问题也在沉默里吞掉。 */
export const NOISE_SAME_ORIGIN = [
  { re: /\/favicon[^/]*\.(ico|png|svg)(\?|$)/, why: '图标缺失与工具功能无关（含 favicon-32x32.png / favicon-16x16.png 等变体）' },
  // 本站清单文件名是 manifest.webmanifest（不是 create-react-app 那套 site.webmanifest），
  // 原来这条只写了 site.webmanifest|manifest.json —— 真跑里清单抖动就会冒充站点缺陷。
  // 放宽的只是「PWA 元数据」这一类非代码资源；自家 JS/CSS chunk 仍然一律阻断。
  { re: /\/apple-touch-icon|\.webmanifest$|manifest\.json/, why: 'PWA 图标与清单缺失，不影响工具功能' },
  { re: /\/sw\.js|workbox-|service.?worker/i, why: '无头环境首轮注册 Service Worker 的固有噪声' },
  { re: /net::ERR_ABORTED/, why: '导航切换时被主动中断的请求，非缺陷' },
  { re: /net::ERR_NETWORK_CHANGED|net::ERR_INTERNET_DISCONNECTED/, why: '执行环境网络抖动' },
  { re: /net::ERR_CACHE_MISS/, why: '无缓存首次加载的固有噪声' },
  {
    re: /report-only Content Security Policy|frame-ancestors 'self'/,
    why: 'CSP 处于 report-only 模式（只记录、不阻断）：AdSense iframe 嵌 google.com 触发的日志，非功能缺陷',
  },
];

/** 第三方判定：命中名单，或者是「别处的绝对 URL」（不是被测站点自己）。 */
export function isThirdPartyUrl(url, base) {
  return NOISE_HOSTS.some(h => url.includes(h))
    || (/^https?:\/\//.test(url) && !url.startsWith(base));
}

/**
 * 把一次 loadingFailed 尽量归到具体 URL 上。
 * `Network.loadingFailed` 只给 requestId；URL 靠 requestWillBeSent 建的表反查。
 * 表里没有时，退而求其次：同一轮 console 里错误码文字相同的条目通常带 url。
 * 两条都拿不到 → 空串（= 不可归属，交给 unattributed）。
 */
export function attributeFailure(f, logEntries = []) {
  if (f.url) return f.url;
  if (!f.error) return '';
  const twin = logEntries.find(e => (e.url || '') && (e.text || '').includes(f.error));
  return twin ? twin.url : '';
}

/**
 * 分类一次资源加载失败。
 *
 * @param f      { url, error, type, canceled }
 * @param ctx    { base, logEntries?, caseNoiseHit? }
 * @returns {kind:'skip'|'unattributed'|'noise'|'blocking', why?:string, url:string}
 */
export function classifyLoadFailure(f, ctx) {
  const base = ctx.base;
  if (f.canceled) return { kind: 'skip', url: f.url || '' };
  if (/ERR_ABORTED/.test(f.error || '')) return { kind: 'skip', url: f.url || '' };

  const url = attributeFailure(f, ctx.logEntries || []);
  if (!url) return { kind: 'unattributed', url: '' };

  if (url.startsWith(base)) {
    // 与原引擎逐条同序：同源 pattern 白名单 → 用例声明（必须带 why）→ 阻断。
    // 兜底那条不许被绕过：自家代码资源失败就是站点缺陷。
    const hit = NOISE_SAME_ORIGIN.find(n => n.re.test(url) || n.re.test(f.error || ''));
    if (hit) return { kind: 'noise', url, why: hit.why };
    const byCase = ctx.caseNoiseHit ? ctx.caseNoiseHit(url, f.error) : null;
    if (byCase) return { kind: 'noise', url, why: `用例声明：${byCase.why}` };
    return { kind: 'blocking', url };
  }

  if (isThirdPartyUrl(url, base)) return { kind: 'noise', url, why: 'third-party' };
  const byCase2 = ctx.caseNoiseHit ? ctx.caseNoiseHit(url, f.error) : null;
  if (byCase2) return { kind: 'noise', url, why: `用例声明：${byCase2.why}` };
  // 未知外部 host：不豁免。让它红，人来定性 —— 反过来悄悄放行就是拿绿灯换隐身。
  return { kind: 'blocking', url };
}

/**
 * 未捕获异常的归属（与资源失败同一套规则）：抛异常的脚本来自哪里就怎么分。
 * 实测 AdSense 的 show_ads_impl.js 在被掐断的网络里 reject，页面功能完全正常。
 */
export function classifyException(x, ctx) {
  const url = x.url || (x.exception && x.exception.url) || '';
  if (url && isThirdPartyUrl(url, ctx.base)) return { kind: 'noise', url, why: 'third-party' };
  return { kind: 'blocking', url };
}
