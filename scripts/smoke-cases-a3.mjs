/**
 * smoke-cases-a3.mjs — A3 专项：依赖 /api/* 的三个工具页
 * ---------------------------------------------------------------------------
 * 为什么单独一个文件：
 *   A1 的主用例（smoke-cases.mjs）是「101 条 ↔ 101 个页面」的一一对应；
 *   而这里同一个 path 要跑两种注入态（失败 / 成功），放进主文件会破坏那个对应关系。
 *   引擎用 `--cases=./smoke-cases-a3.mjs` 切换用例来源。
 *
 * 怎么验「API 失败时页面仍可用」这个动作 B 第 7 项：
 *   用 CDP Fetch 域拦下 `/api/*` 并**伪造响应**，不依赖真实后端、也不需要能连外网。
 *   这样「失败态 UI」就是确定性可复现的 —— 不靠「碰巧接口挂了」来观察。
 *
 * 判定口径：失败态要同时满足两条 ——
 *   ① 页面给出可读的错误提示（人看得懂，不是白屏 / 不是原始异常堆栈）
 *   ② 页面其余部分仍可用（表单还在、没被禁用，用户能改输入重试）
 *
 * 运行：
 *   node scripts/smoke-tools.mjs --serve-dist dist --base http://127.0.0.1:4192 \
 *     --canonical-origin https://digdevbox.com --cases=./smoke-cases-a3.mjs \
 *     --out D:/work/_ops/step5-a1/a3
 */

const WHOIS = {
  path: '/whois-lookup',
  zhTitle: 'WHOIS 查询',
};
const WEBSTATUS = {
  path: '/http-status-checker',
  zhTitle: 'HTTP 状态码检测',
};
const TODAY = {
  path: '/today-in-history',
  zhTitle: '历史上的今天',
};

/** 「页面其余部分仍可用」的统一判据：第一个输入框存在、未禁用、未只读。
 *  对 today-in-history 这种无输入页，退化为「重试按钮仍可点」。 */
const STILL_USABLE = `(function(){
  var inp = document.querySelector('.tool-content input, .tool-content textarea');
  if (inp) return !inp.disabled && !inp.readOnly;
  var btns = [].slice.call(document.querySelectorAll('.tool-content button'));
  return btns.some(function(b){ return !b.disabled && /重新加载|Retry|Refresh/i.test(b.innerText); });
})()`;

/**
 * 注入 500 时，浏览器必然把那次响应记成一条**同源 console error**
 * （`Failed to load resource: the server responded with a status of 500`）。
 * 这条错误是测试自己造的，不是页面缺陷，但它的形态与「接口真的挂了」完全一致，
 * 内置白名单区分不了 —— 所以由用例显式声明豁免，并要求把理由写清楚。
 */
const INJECTED_500_NOISE = [
  {
    re: /\/api\/(whois|webstatus|today)/,
    why: '本用例**故意**注入 500 来验失败态 UI；浏览器对这次响应记的同源 500 网络错误是被注入的故障，不是页面缺陷',
  },
];

export const SMOKE_CASES = [
  // ─────────────────────────── /whois-lookup ───────────────────────────

  {
    ...WHOIS,
    name: 'whois-lookup@api-500',
    interceptApi: 'fail500',
    strategy:
      'realInput（失败态注入）：拦 /api/whois 返回 500 + JSON，页面必须给出可读错误提示，且表单仍可用',
    steps: [
      { fill: { i: 0, text: 'example.com' } },
      { clickExact: '查询 WHOIS' },
      { wait: 1800 },
    ],
    expect: {
      text: ['查询失败'],
      js: `(function(){
        var alert = document.querySelector('.tool-content .c-alert');
        if (!alert) return false;
        if (!alert.innerText.trim()) return false;
        return ${STILL_USABLE};
      })()`,
      // 失败态不得把原始异常堆栈糊到界面上
      not: ['TypeError', 'Uncaught', 'at Object.'],
      consoleNoise: INJECTED_500_NOISE,
    },
  },

  {
    ...WHOIS,
    name: 'whois-lookup@api-200',
    interceptApi: 'ok200',
    strategy:
      'realInput（成功态对照组）：注入符合 /api/whois 契约的 200 响应 { domain, raw }，页面必须渲染注册信息且不出错误提示',
    steps: [
      { fill: { i: 0, text: 'example.com' } },
      { clickExact: '查询 WHOIS' },
      { wait: 1800 },
    ],
    expect: {
      text: ['注册信息'],
      not: ['查询失败'],
      // 结果区不是 <textarea>：whois 用 TextareaCopyable，它渲染的是 <n-code>
      // （高亮代码块，带 data-test-id="area-content"）。按 textarea 找会假失败。
      js: `(function(){
        var out = document.querySelector('.tool-content [data-test-id="area-content"]');
        if (!out || !/EXAMPLE\\.COM/.test(out.innerText || '')) return false;
        return ${STILL_USABLE};
      })()`,
    },
  },

  // ─────────────────────── /http-status-checker ───────────────────────

  {
    ...WEBSTATUS,
    name: 'http-status-checker@api-500',
    interceptApi: 'fail500',
    strategy:
      'realInput（失败态注入）：拦 /api/webstatus 返回 500，页面必须给出可读错误提示且表单仍可用',
    steps: [
      { fill: { i: 0, text: 'example.com' } },
      { clickExact: '检测状态码' },
      { wait: 1800 },
    ],
    expect: {
      text: ['检测失败'],
      js: `(function(){
        var alert = document.querySelector('.tool-content .c-alert');
        if (!alert || !alert.innerText.trim()) return false;
        // 失败时不得凭空显示一个状态码
        var card = [].slice.call(document.querySelectorAll('.tool-content .n-card, .tool-content .c-card'))
          .filter(function(c){ return /状态码/.test(c.innerText); });
        if (card.length) return false;
        return ${STILL_USABLE};
      })()`,
      not: ['TypeError', 'Uncaught'],
      consoleNoise: INJECTED_500_NOISE,
    },
  },

  {
    ...WEBSTATUS,
    name: 'http-status-checker@api-200',
    interceptApi: 'ok200',
    strategy:
      'realInput（成功态对照组）：注入 { status: 200, headers } —— 页面必须展示状态码 200 与响应头',
    steps: [
      { fill: { i: 0, text: 'example.com' } },
      { clickExact: '检测状态码' },
      { wait: 1800 },
    ],
    expect: {
      text: ['200', '响应头'],
      not: ['检测失败'],
      js: `(function(){
        var t = document.querySelector('.tool-content').innerText;
        return /content-type/i.test(t);
      })()`,
    },
  },

  // ──────────────────────── /today-in-history ────────────────────────

  {
    ...TODAY,
    name: 'today-in-history@api-500',
    interceptApi: 'fail500',
    strategy:
      'realInput（失败态注入）：拦 /api/today 返回 500，页面必须给出可读错误提示且保留重试入口',
    steps: [{ wait: 2200 }],
    expect: {
      text: ['加载失败'],
      js: `(function(){
        var alert = document.querySelector('.tool-content .c-alert');
        if (!alert || !alert.innerText.trim()) return false;
        return ${STILL_USABLE};
      })()`,
      not: ['TypeError', 'Uncaught'],
      consoleNoise: INJECTED_500_NOISE,
    },
  },

  {
    ...TODAY,
    name: 'today-in-history@api-200',
    interceptApi: 'ok200',
    strategy:
      'realInput（成功态对照组）：注入 { events: [...] }，页面必须把事件条目渲染出来（进入页面即自动加载）',
    steps: [{ wait: 2200 }],
    expect: {
      text: ['1991-08-06', 'stub event for smoke test'],
      not: ['加载失败'],
    },
  },

  {
    // F-8 的验证（新增）：接口在 events 为空时会返回 note 解释「为什么没有」，
    // 但组件原先把它丢了、只硬编码一句「今天没有查到历史事件记录」。
    // 用注入伪造「空 events + note」是**确定性**的 —— 不依赖当天恰好没收录
    // （数据集只覆盖 29/365 天，靠等日期来验这条一年只能验几个月）。
    ...TODAY,
    name: 'today-in-history@api-200empty',
    interceptApi: 'ok200empty',
    strategy:
      'realInput（空态注入）：注入 { events: [], note } —— 页面必须把接口给的「为什么没有」渲染出来，而不是只丢一句「没查到」',
    steps: [{ wait: 2200 }],
    expect: {
      // note 原文出现在页面上 = 接口的说明真的透到了 UI（这是 F-8 的修复目标）
      text: ['今日暂无收录事件，数据集持续完善中'],
      not: ['加载失败'],
      // 空态不得同时把「加载失败」的文案也渲染出来（两者互斥）
      outNot: ['加载失败'],
      js: `(function(){
        var alert = document.querySelector('.tool-content .c-alert');
        if (!alert || !alert.innerText.trim()) return false;
        return ${STILL_USABLE};
      })()`,
    },
  },
];
