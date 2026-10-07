/**
 * audit-example-coverage.mjs —— 「一键填示例」的数据门禁
 * ---------------------------------------------------------------------------
 * 为什么要有这个脚本
 * ------------------------------------------------------------------
 * `example`（工具页「怎么用这个工具？」里的一键填示例）此前**没有任何机器把关**：
 * 新增工具时不写 example，页面只是少一个按钮，构建照样绿、测试照样过。
 * 但 `applyExample()`（src/layouts/tool.layout.vue）的实现是：
 *
 *     const el = findPrimaryInput();
 *     if (!el) return;        // ⛔ 无输入框 → 静默 return
 *
 * 于是「缺 example」有两类后果，都不会被现有任何环节发现：
 *   ① 该有 example 的工具没有 —— 用户第一次打开面对空白输入框，没人提醒；
 *   ② 不该有 example 的工具硬塞一个 —— 按钮显示在那里，点了**毫无反应**。
 *
 * ⛔ 为什么不自动探测「这个工具有没有输入控件」再据此判定
 *   形态检测要跑浏览器（依赖 dist + Chrome），不是秒级门禁；而且形态会随 DOM 演化漂移 ——
 *   本仓库已实测过：naive-ui 的 `n-input-number` 渲染成 `input[type="text"]`，
 *   静态读源码完全看不出它不接受文本（真机按键后值被回退成 ""）。
 *   所以这里用**显式白名单 + 反向完整性校验（E2）**：白名单会因E2 判红而被迫保鲜，
 *   不会像自动推断那样静默过期。
 *
 * 判据
 * ------------------------------------------------------------------
 *   E1 覆盖率：打印 N/101 与缺失清单；缺失且不在白名单 → 红
 *   E2 白名单双向完整：白名单条目已补 example / 无 why / path 非真实工具 → 红
 *   E3 text 合法性：非空、trim 后非空、长度 1..200、无弯引号
 *      （⛔ 原本还有一条「不含裸换行」，首跑就把11 个既有工具判红 —— json-minify /
 *      yaml-prettify / markdown-to-html / text-diff 这类工具的示例**本就该是多行**，
 *      压成一行反而更难读。复核确认是判据错了不是数据错了，已移除该条，
 *      多行工具改为在报告里单列可见、不判红。见 multilineExampleTools。）
 *   E4 en/zh 成对存在（text 逐字不同**仅告警**，不判红 —— 那几对是有意的本地化）
 *   E5 数字型 text 的 label 不得是「填入示例文本」这类泛化文案
 *   E6 --falsify：注入违例证明门能判红，且只认命中本判据的报告
 *   E7 注入变异复用文件自身换行符（guides.*.ts 在 Windows 仓库里是 CRLF）
 *   E8 数字型工具登记：白名单里靠数字控件吃饭但还没修 applyExample 的，必须显式登记
 *
 * 用法
 *   node scripts/audit-example-coverage.mjs --check     # 校验（只读）
 *   node scripts/audit-example-coverage.mjs --falsify   # 自检：注入违例证明门能判红
 *   node scripts/audit-example-coverage.mjs --report    # 顺带打印 applyExample 缺陷说明
 *
 * ⛔ 本脚本**只读**：不写 src/、不写 locales/、不碰 dist/。
 * ⛔ --falsify 会**临时**改写 guides.en.ts / guides.zh.ts 以注入违例，
 *    无论成败都在finally 里还原（用 git checkout 之外的方式：以原始字节为准回写）。
 */

import process from 'node:process';
import fs from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = f => argv.includes(f);

// ─────────────────────────────── 判据参数（一处定义，报告与实现共用） ───────────────────────────────
/** example.text 长度上限。实测现有 83 条：p50≈20、p90≈74、max=148（/jwt-parser）。 */
const TEXT_MAX = 200;
/** 弯引号：会让JSON / XML / SQL 示例在渲染时看起来像语法错误（真实存在的坑）。 */
const CURLY_QUOTES = /[“”‘’]/;

// ─────────────────────────────── 白名单（显式，逐条写 why） ───────────────────────────────
/**
 * 「不给 example」的工具，**必须**在这里显式登记并写清 why。
 *
 * ⛔ 每条 why 都来自 `scripts/probe-example-targets.mjs` 的**真机探测**
 *   （Chrome + CDP，逐页导航、真实按键 + blur 后读回），不是读源码推断的。
 *   探测报告：`_ops/example-probe-2026-10-07.md`。
 *
 * ⛔ 形态会变，why 也可能过期 —— 所以 E2 会强制复核：
 *   一旦某个条目补上了 example，E2 立刻判红并要求把它从白名单删掉。
 *   这正是「显式白名单优于自动推断」的落点：白名单不能悄悄腐烂。
 */
const NO_EXAMPLE_WHITELIST = [
  {
    path: '/camera-recorder',
    why: '无任何输入控件：findPrimaryInput() 返回 null（探测 mode=no-input），页面只有 Start webcam 按钮',
  },
  {
    path: '/chronometer',
    why: '无任何输入控件：findPrimaryInput() 返回 null（探测 mode=no-input），只有 Start / Reset 按钮',
  },
  {
    path: '/device-information',
    why: '无任何输入控件：findPrimaryInput() 返回 null（探测 mode=no-input），纯只读展示',
  },
  {
    path: '/git-memo',
    why: '无任何输入控件：findPrimaryInput() 返回 null（探测 mode=no-input），纯只读速查表',
  },
  {
    path: '/html-wysiwyg-editor',
    why: '编辑器是 contenteditable（Tiptrap），不是 input/textarea —— findPrimaryInput() 的选择器命中不到（探测 mode=no-input）',
  },
  {
    path: '/keycode-info',
    why: '靠全局 keydown 事件捕获按键，没有输入框（探测 mode=no-input）',
  },
  {
    path: '/mime-types',
    why: '唯一交互是 n-data-table 的 searchable 内部输入框，不在 .tool-content 的直接 input 列表里；findPrimaryInput() 返回 null（探测 mode=no-input）',
  },
  {
    path: '/password-strength-analyser',
    why: '唯一输入控件是 input[type="password"]，不在 findPrimaryInput() 的选择器内（该选择器只含 text/search/number/无type）—— 探测 mode=no-input',
  },
  {
    path: '/pdf-signature-checker',
    why: '输入是文件上传（input[type=file] + Browse files 按钮），findPrimaryInput() 返回 null（探测 mode=no-input）',
  },
  {
    path: '/random-port-generator',
    why: '无任何输入控件：findPrimaryInput() 返回 null（探测 mode=no-input），只有 Copy / Refresh 按钮',
  },
  {
    path: '/regex-memo',
    why: '无任何输入控件：findPrimaryInput() 返回 null（探测 mode=no-input），纯静态正则速查表',
  },
  {
    path: '/today-in-history',
    why: '无任何输入控件：findPrimaryInput() 返回 null（探测 mode=no-input），打开即自动加载，只有重新加载按钮',
  },
  {
    path: '/chmod-calculator',
    why: 'findPrimaryInput() 命中的第一个控件是 readonly 的输出框（placeholder="Input text"）—— 往输出框里塞示例会被下一次渲染冲掉（探测 mode=readonly-output）',
  },
  {
    path: '/lorem-ipsum-generator',
    why: 'findPrimaryInput() 命中的第一个控件是 readonly 的结果区textarea —— 那是生成结果，不是输入（探测 mode=readonly-output）',
  },
  // —— 以下 4 条是 E8：数字控件吃掉写入，补了也是假功能（详见 KNOWN_DEFECT） ——
  {
    path: '/percentage-calculator',
    why: '主控件是 naive-ui n-input-number：真实按键输入文本并 blur 后控件值被回退成 ""（探测 mode=number-only）—— applyExample 未修前填文本等于没填',
  },
  {
    path: '/px-rem-converter',
    why: '主控件是 naive-ui n-input-number：真实按键输入文本并 blur 后控件值被回退成 ""（探测 mode=number-only）—— applyExample 未修前填文本等于没填',
  },
  {
    path: '/mac-address-generator',
    why: '主控件是 naive-ui n-input-number（Quantity）：真实按键输入文本并 blur 后控件值被回退成 ""（探测 mode=number-only）—— applyExample 未修前填文本等于没填',
  },
  {
    path: '/svg-placeholder-generator',
    why: '主控件是 naive-ui n-input-number（Width）：真实按键输入文本并 blur 后控件值被回退成 ""，且 SVG 渲染出 viewBox="0 0 null 350"（探测 mode=number-only）—— applyExample 未修前填文本等于没填',
  },
];

/**
 * applyExample 的已知缺陷 —— **只报告，不修**（用户明确要求不动实现）。
 * 门禁每次运行都把它打印成独立一节，供决策是否单独开一刀。
 */
const KNOWN_DEFECT = {
  id: 'APPLY-EXAMPLE-N-INPUT-NUMBER',
  title: 'applyExample() 对 naive-ui n-input-number 静默失效',
  rootCause: [
    'src/layouts/tool.layout.vue 的 findPrimaryInput() 选择器包含 input[type="text"]，',
    '而 naive-ui 的 n-input-number 渲染出来的 DOM正是 <input type="text" class="n-input__input-el">。',
    '于是数字控件被「主输入控件」判定命中。',
    '',
    '但 setInputValue() 走的是原生 value setter + input 事件。naive-ui 在 blur 时才解析输入内容，',
    '解析失败（文本不是合法数字）就把内部 value 置空并回写DOM —— 于是 example.text 被丢弃。',
    '按钮点击后界面毫无变化：exampleApplied 仍会置true（按钮文案变成「已填入」），但数据没进去。',
  ],
  evidence: [
    'scripts/probe-example-targets.mjs 用 CDP Input.insertText 模拟真实按键 + Tab 触发 blur，',
    '对 4 个 n-input-number 工具：输入 "Hello Dev 123" → blur → 控件值全部被回退成 ""；',
    '输入 "42" → blur → 存活。判据是「blur 后是否存活」，不是 setter 写入后 el.value 是否还在',
    '（setter 会绕过组件解析，对数字控件给出假阳性）。',
    'svg-placeholder-generator 在文本轮里实际渲染出 viewBox="0 0 null 350"，即数值已损坏。',
  ],
  impact: [
    '受影响工具（当前 4 个）：/percentage-calculator、/px-rem-converter、/mac-address-generator、/svg-placeholder-generator。',
    '潜在影响面：全站任何以 n-input-number 作为首个输入的工具 ——',
    'findPrimaryInput() 的选择器把 n-input-number 误判为文本框，是通用缺陷而非这 4 个工具的个例。',
    '当前之所以没暴露成线上缺陷，纯粹是因为这 4 个工具都还没配 example（已登记进白名单）。',
    '⛔ 一旦有人给它们补 example，就会立刻变成「按钮显示、点击无效」。',
  ],
  suggestedFix: [
    '方向 A（推荐）：让 setInputValue 在写入后**派发 blur**，让naive-ui 走自己的解析与校验路径；',
    '  解析失败时读回真实值，若与写入值不符则不置exampleApplied=true，并给出可见反馈。',
    '  —— 改动小，且顺带修掉所有 n-input-number 工具。',
    '方向 B：findPrimaryInput() 排除 .n-input-number 内的 input，改用其兄弟 input 容器；',
    '  但这会改变「主输入控件」的定义，对已有 83 条 example 的行为影响面更大，需要逐条回归。',
    '方向 C（数据侧绕行）：给这 4 个工具补**纯数字** example（如 "16"），文本能存活。',
    '  —— 成本最低，但只是绕过通用缺陷，且按钮文案必须说清填的是数字（例如「填入 16」）。',
    '⛔ 三个方向都未实施：用户明确要求本轮不改applyExample / findPrimaryInput。',
    '建议：单独开一刀做方向 A + C（方向 A 修根因，方向 C 立即恢复这 4 个工具的示例能力）。',
  ],
};

// ─────────────────────────────── 加载数据 ───────────────────────────────
const vite = await createServer({
  root,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'warn',
});

let GUIDES;
let GUIDES_ZH;
let TOOL_PATHS;
try {
  GUIDES = (await vite.ssrLoadModule('/src/tools/guides.en.ts')).GUIDES;
  GUIDES_ZH = (await vite.ssrLoadModule('/src/tools/guides.zh.ts')).GUIDES;
  const { TOOL_SEO_PAGES } = await vite.ssrLoadModule('/src/seo/tool-page.ts');
  TOOL_PATHS = TOOL_SEO_PAGES.map(p => p.path);
}
finally {
  await vite.close();
}

const ALL = Object.keys(GUIDES);
const WHITELIST_PATHS = new Set(NO_EXAMPLE_WHITELIST.map(w => w.path));

// ─────────────────────────────── 判据实现 ───────────────────────────────
/**
 * 每条判据返回自己的问题列表。**不合并**—— 报告要能指明是哪条判据红的，
 * 否则 --falsify 的 expect关键词就无从对齐（E6）。
 */
const CHECKS = [
  {
    id: 'E1',
    name: 'example 覆盖率',
    run() {
      const missing = ALL.filter(p => !GUIDES[p].example && !WHITELIST_PATHS.has(p));
      return {
        problems: missing.map(p => `E1 缺 example 且未登记白名单：${p}（新增工具请补 example，或在 NO_EXAMPLE_WHITELIST 里写清 why）`),
      };
    },
  },
  {
    id: 'E2',
    name: '白名单双向完整',
    run() {
      const problems = [];
      for (const entry of NO_EXAMPLE_WHITELIST) {
        if (!entry.why || !entry.why.trim()) {
          problems.push(`E2 白名单条目缺 why：${entry.path} —— 必须写清「为什么这个工具不该有 example」`);
        }
        if (!TOOL_PATHS.includes(entry.path)) {
          problems.push(`E2 白名单 path 不是真实工具路径：${entry.path}（工具已改名或删除？请同步白名单）`);
        }
        if (GUIDES[entry.path]?.example) {
          problems.push(`E2 白名单条目已补 example，应从白名单删掉：${entry.path}`);
        }
      }
      return { problems };
    },
  },
  {
    id: 'E3',
    name: 'example.text 合法性',
    run() {
      const problems = [];
      for (const p of ALL) {
        const ex = GUIDES[p].example;
        if (!ex) continue;
        for (const [lang, table] of [['en', GUIDES], ['zh', GUIDES_ZH]]) {
          const e = table[p]?.example;
          if (!e) continue; // 成对性归E4
          const { text } = e;
          if (typeof text !== 'string' || text.length === 0) {
            problems.push(`E3 ${lang} ${p}：example.text 为空`);
            continue;
          }
          if (text.trim().length === 0) {
            problems.push(`E3 ${lang} ${p}：example.text 只有空白字符`);
          }
          if (text.length > TEXT_MAX) {
            problems.push(`E3 ${lang} ${p}：example.text 长度 ${text.length} > ${TEXT_MAX}`);
          }
          if (CURLY_QUOTES.test(text)) {
            problems.push(`E3 ${lang} ${p}：example.text 含弯引号 ${JSON.stringify(text)} —— 会让 JSON/XML/SQL 示例看起来像语法错误`);
          }
          if (typeof ex.label !== 'string' || ex.label.trim().length === 0) {
            problems.push(`E3 ${lang} ${p}：example.label 为空`);
          }
        }
      }
      return { problems };
    },
  },
  {
    id: 'E4',
    name: 'en / zh 成对存在',
    run() {
      const problems = [];
      for (const p of ALL) {
        if (!!GUIDES[p].example !== !!GUIDES_ZH[p]?.example) {
          const side = GUIDES[p].example ? 'zh缺 example' : 'en 缺 example';
          problems.push(`E4 ${p}：en/zh 不成对（${side}）—— 只补一种语言时，另一种语言的工具页会静默没有示例按钮`);
        }
      }
      return { problems };
    },
  },
  {
    id: 'E5',
    name: '数字型 example 的 label 必须说清填什么',
    run() {
      const problems = [];
      // 「泛化文案」黑名单：这些文案完全不描述填进去的是什么，
      // 用在数字控件上用户不知道该期待什么。
      // ⛔ en / zh 两套词必须同步维护：首版 zh 正则漏了「数值」，
      //   结果 /unit-converter 的 zh侧「填入示例数值」没被拦下而 en侧被拦下 ——
      //   同一份数据两侧判定不一致，门禁自己就不自洽。
      const VAGUE = /^(fill in|paste|show|type|enter)?\s*(a\s+)?sample\s+(text|value|string|item)s?\b/i;
      const VAGUE_ZH = /^(填入|粘贴|输入|显示)?\s*示例?(文本|文字|值|数值|数据|内容)$/;
      for (const p of ALL) {
        for (const [lang, table] of [['en', GUIDES], ['zh', GUIDES_ZH]]) {
          const e = table[p]?.example;
          if (!e) continue;
          // 纯数字（含小数与负号）才要求 label 说清；带单位的（如 "1.5rem"）不算
          if (!/^-?\d+(?:\.\d+)?$/.test(e.text.trim())) continue;
          if (VAGUE.test(e.label.trim()) || VAGUE_ZH.test(e.label.trim())) {
            problems.push(
              `E5 ${lang} ${p}：example.text 是纯数字 ${JSON.stringify(e.text)}，`
              + `但 label ${JSON.stringify(e.label)} 是泛化文案 —— 数字型工具的按钮要说清填的是什么（例如「填入 16」）`,
            );
          }
        }
      }
      return { problems };
    },
  },
  {
    id: 'E8',
    name: '数字型工具登记（applyExample 未修前不得补 example）',
    run() {
      // 反向断言：E8 的实际作用是「确保 KNOWN_DEFECT 里列出的受影响工具都在白名单里」。
      // 一旦有人绕过白名单给它们补了 example，门禁必须在这里拦下——
      // 因为那会立刻变成「按钮显示、点击无效」的线上缺陷。
      const problems = [];
      const numericOnly = NO_EXAMPLE_WHITELIST.filter(w => /n-input-number/.test(w.why)).map(w => w.path);
      for (const p of numericOnly) {
        if (GUIDES[p]?.example) {
          problems.push(
            `E8 ${p}：主控件是 n-input-number，applyExample 对它无效（${KNOWN_DEFECT.id}）—— `
            + '给它补 example 会得到「点了没反应」的假功能。请先修 applyExample，或改用纯数字载荷。',
          );
        }
      }
      return { problems };
    },
  },
];

/** E4 的告警（不判红）：en/zh text 逐字不同的条目。 */
function textDivergenceWarnings() {
  const out = [];
  for (const p of ALL) {
    const en = GUIDES[p]?.example;
    const zh = GUIDES_ZH[p]?.example;
    if (!en || !zh || en.text === zh.text) continue;
    out.push({ path: p, en: en.text, zh: zh.text });
  }
  return out;
}

/**
 * 多行 example 的工具清单 —— **刻意不判红**。
 *
 * ⛔ 首版E3 里有「text 不含裸换行」这条，首跑就把 11 个既有工具判红
 *   （json-minify / yaml-prettify / markdown-to-html / text-diff / list-converter …）。
 *   复核后确认：**是判据错了，不是数据错了**。
 *   JSON、YAML、Markdown、逐行对比这几类工具的示例**本来就该是多行** ——
 *   把 `{"name":"devbox","list":[1,2,3]}` 压成一行当示例，比多行更难让人一眼看懂结构。
 *   为让门禁变绿而把它们压成单行，是把有价值的示例改成低价值的，纯属倒退。
 *
 *   ⇒ 换行本身不是问题，**真正的问题只有一种**：换行是 JSON/XML 破损的**成因**，
 *   而那种已经被「弯引号」那条覆盖。所以这里保留清单、只做可见性，不参与判红。
 */
function multilineExampleTools() {
  return ALL
    .filter(p => /[\r\n]/.test(GUIDES[p]?.example?.text || ''))
    .map(p => ({ path: p, text: GUIDES[p].example.text }));
}

function runAllChecks() {
  const results = [];
  for (const c of CHECKS) {
    const { problems } = c.run();
    results.push({ id: c.id, name: c.name, problems });
  }
  return results;
}

// ─────────────────────────────── 报告 ───────────────────────────────
const withExample = ALL.filter(p => GUIDES[p].example);
const missingAll = ALL.filter(p => !GUIDES[p].example);
const missingUnlisted = missingAll.filter(p => !WHITELIST_PATHS.has(p));
const knownButFixed = NO_EXAMPLE_WHITELIST.filter(w => GUIDES[w.path]?.example).map(w => w.path);

function printReport(results, { exitCode }) {
  const divergences = textDivergenceWarnings();
  const multiline = multilineExampleTools();
  console.log('[example] 覆盖率 ' + `${withExample.length}/${ALL.length}` + `（缺 ${missingAll.length}，其中 ${missingUnlisted.length} 个未登记白名单）`);
  console.log(`[example] 白名单 ${NO_EXAMPLE_WHITELIST.length} 项（显式登记，每条带 why）`);
  if (missingAll.length) {
    console.log('[example] 缺 example 清单：');
    for (const p of missingAll) {
      const w = WHITELIST_PATHS.has(p);
      console.log(`  ${w ? '○ 白名单豁免' : '✗ 未登记'}  ${p}`);
    }
  }

  for (const r of results) {
    const tag = r.problems.length ? '✗ FAIL' : '✓ PASS';
    console.log(`[${r.id}] ${tag} ${r.name}${r.problems.length ? ` —— ${r.problems.length} 条` : ''}`);
    for (const msg of r.problems) {
      console.log(`  ✗ ${msg}`);
    }
  }

  if (multiline.length) {
    console.log('');
    console.log(`[example] ℹ️ 以下 ${multiline.length} 个工具的 example.text 是多行 —— **刻意允许，不判红**`);
    console.log('         JSON / YAML / Markdown / 逐行对比这几类工具的示例本就该多行，压成一行反而更难读。');
    console.log('         首版E3 有「不含裸换行」这条，首跑把这批既有数据全判红了 —— 复核确认是判据错了，已移除。');
    for (const m of multiline) {
      console.log(`  ℹ ${m.path}：${JSON.stringify(m.text.slice(0, 70))}${m.text.length > 70 ? '…' : ''}`);
    }
  }

  if (divergences.length) {
    console.log('');
    console.log(`[example] ⚠️ 以下 ${divergences.length} 对工具的 en/zh example.text 逐字不同 —— **这是有意的本地化，不是漏改**`);
    console.log('         （例：中文界面填中文句子更自然；填非 ASCII 本身就在演示 URL 编码的中文场景）');
    for (const d of divergences) {
      console.log(`  ⚠ ${d.path}`);
      console.log(`      en: ${JSON.stringify(d.en)}`);
      console.log(`      zh: ${JSON.stringify(d.zh)}`);
    }
  }

  console.log('');
  console.log(`[example] 已知缺陷 ${KNOWN_DEFECT.id}：${KNOWN_DEFECT.title}`);
  console.log('  根因：');
  for (const l of KNOWN_DEFECT.rootCause) {
    console.log(`    · ${l}`);
  }
  console.log('  实测证据：');
  for (const l of KNOWN_DEFECT.evidence) {
    console.log(`    · ${l}`);
  }
  console.log('  影响范围：');
  for (const l of KNOWN_DEFECT.impact) {
    console.log(`    · ${l}`);
  }
  console.log('  建议修法（本轮⛔ 未实施，用户要求不动 applyExample / findPrimaryInput）：');
  for (const l of KNOWN_DEFECT.suggestedFix) {
    console.log(`    · ${l}`);
  }

  const total = results.reduce((n, r) => n + r.problems.length, 0);
  console.log('');
  if (total) {
    console.log(`[example] 校验失败：${total} 条问题（覆盖 ${results.filter(r => r.problems.length).map(r => r.id).join(', ')}）`);
  }
  else {
    console.log('[example] 校验通过：全部 8 条判据均无问题');
    console.log(`[example] 注：known-but-fixed 白名单条目 ${knownButFixed.length} 个${knownButFixed.length ? '：' + knownButFixed.join(' ') : ''}`);
  }
  return total;
}

// ─────────────────────────────── --falsify（E6） ───────────────────────────────
/**
 * 注入违例 → 跑判据 → 必须 exit 1 **且报告命中本判据的关键词**。
 *
 * ⛔ 每条变异都必须带 expect 关键词，且只认命中该关键词的报告。
 *   上一轮踩过的坑：首版只断言「出现了新问题」，结果某个变异是靠**另一条**判据判红的，
 *   门是红了，但证明的是错的判据 —— falsify 因此变成自欺。
 *
 * ⛔ E7：注入必须复用文件自身换行符。guides.*.ts 在本仓库是 CRLF 为主
 *   （实测 en 1511 CRLF / 20 裸LF），写死 '\n' 会让「按行定位下一条 entry」全部错位，
 *   变异静默无操作、判据形同虚设却不报错 —— forge-notes 那轮就是这么栽的。
 *   这里统一走 split(文件自身 eol) / join(同一个 eol)，与文件实际形态无关。
 */
const TARGETS = {
  EN: join(root, 'src/tools/guides.en.ts'),
  ZH: join(root, 'src/tools/guides.zh.ts'),
};

function readEntryBlock(text, toolPath) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(eol);
  const start = lines.findIndex(l => l.trimStart().startsWith(`'${toolPath}': {`));
  if (start < 0) {
    throw new Error(`找不到条目 ${toolPath}`);
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^ {2}'\//.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { eol, lines, start, end };
}

/**
 * 在目标条目里插入或替换一行 example（复用文件自身 eol，见 E7）。
 *
 * 插入点优先选notes 行之后；⛔ 但 notes 是**可选**字段 ——
 *   /random-port-generator 这类条目压根没有 notes 行（首版 falsify 的 M2 就死在这：
 *   变异静默抛错、门禁红了但证明的是「脚本崩了」而不是「E2 能判红」）。
 *   所以没有 notes 时退回「entry 里第一个属性行之后」，只要 entry 有 intro 就一定插得进去。
 */
function mutateEntry(text, toolPath, buildLine) {
  const { eol, lines, start, end } = readEntryBlock(text, toolPath);
  const hasExampleIdx = lines.findIndex((l, i) => i > start && i < end && /^\s{4}example: \{/.test(l));
  if (hasExampleIdx >= 0) {
    lines[hasExampleIdx] = buildLine(lines[hasExampleIdx].match(/^\s*/)[0]);
  }
  else {
    const notesIdx = lines.findIndex((l, i) => i > start && i < end && /^\s{4}notes: \[/.test(l));
    if (notesIdx >= 0) {
      lines.splice(notesIdx + 1, 0, buildLine('    '));
    }
    else {
      // 退回：entry 内第一个 4 空格缩进的属性行（intro 必有）
      const firstPropIdx = lines.findIndex((l, i) => i > start && i < end && /^\s{4}(intro|steps|about|faqs):/.test(l));
      if (firstPropIdx < 0) {
        throw new Error(`${toolPath} 里找不到任何可作为插入点的属性行（intro/steps/notes/about/faqs 全都没有）`);
      }
      lines.splice(firstPropIdx + 1, 0, buildLine('    '));
    }
  }
  return lines.join(eol);
}

const MUTATIONS = [
  {
    id: 'M1',
    check: 'E1',
    expect: 'E1 缺 example 且未登记白名单',
    desc: '删掉一个有 example 的工具的 example 行 → E1 应判红',
    async apply() {
      const orig = await readFile(TARGETS.EN, 'utf8');
      const next = mutateEntry(orig, '/benchmark-builder', () => '    example: undefined,');
      // 直接删掉整行更贴近真实「忘记写」
      const { eol, lines, start, end } = readEntryBlock(next, '/benchmark-builder');
      const idx = lines.findIndex((l, i) => i > start && i < end && /^\s{4}example: /.test(l));
      lines.splice(idx, 1);
      await writeFile(TARGETS.EN, lines.join(eol), 'utf8');
      return async () => writeFile(TARGETS.EN, orig, 'utf8');
    },
  },
  {
    id: 'M2',
    check: 'E2',
    expect: 'E2 白名单条目已补 example',
    desc: '给白名单里的 /random-port-generator 补上 example → E2 应判红',
    async apply() {
      const orig = await readFile(TARGETS.EN, 'utf8');
      const next = mutateEntry(orig, '/random-port-generator', () => "    example: { label: 'Fill in sample text', text: 'hello' },");
      await writeFile(TARGETS.EN, next, 'utf8');
      return async () => writeFile(TARGETS.EN, orig, 'utf8');
    },
  },
  {
    id: 'M3',
    check: 'E3',
    expect: 'example.text 为空',
    desc: '把 example.text 改成空串 → E3 应判红',
    async apply() {
      const orig = await readFile(TARGETS.EN, 'utf8');
      const next = mutateEntry(orig, '/benchmark-builder', () => "    example: { label: 'Fill in a sample suite name', text: '' },");
      await writeFile(TARGETS.EN, next, 'utf8');
      return async () => writeFile(TARGETS.EN, orig, 'utf8');
    },
  },
  {
    id: 'M4',
    check: 'E3',
    expect: 'example.text 含弯引号',
    desc: '把 example.text 改成含弯引号的 JSON → E3 应判红',
    async apply() {
      const orig = await readFile(TARGETS.EN, 'utf8');
      const next = mutateEntry(orig, '/benchmark-builder', () => '    example: { label: \'Fill in sample JSON\', text: \'{"name":"“Alice”"}\' },');
      await writeFile(TARGETS.EN, next, 'utf8');
      return async () => writeFile(TARGETS.EN, orig, 'utf8');
    },
  },
  {
    id: 'M5',
    check: 'E3',
    expect: 'example.text 长度',
    desc: '把 example.text 改成 300 字符超长 → E3 应判红',
    async apply() {
      const orig = await readFile(TARGETS.EN, 'utf8');
      const long = 'x'.repeat(300);
      const next = mutateEntry(orig, '/benchmark-builder', () => `    example: { label: 'Fill in sample text', text: '${long}' },`);
      await writeFile(TARGETS.EN, next, 'utf8');
      return async () => writeFile(TARGETS.EN, orig, 'utf8');
    },
  },
  {
    id: 'M6',
    check: 'E4',
    expect: 'en/zh 不成对',
    desc: '只留 en 侧的 example（删掉 zh 的）→ E4 应判红',
    async apply() {
      const orig = await readFile(TARGETS.ZH, 'utf8');
      const { eol, lines, start, end } = readEntryBlock(orig, '/benchmark-builder');
      const idx = lines.findIndex((l, i) => i > start && i < end && /^\s{4}example: /.test(l));
      if (idx < 0) {
        throw new Error('M6 前置失败：/benchmark-builder 在 zh 里没有 example 行');
      }
      lines.splice(idx, 1);
      await writeFile(TARGETS.ZH, lines.join(eol), 'utf8');
      return async () => writeFile(TARGETS.ZH, orig, 'utf8');
    },
  },
  {
    id: 'M7',
    check: 'E5',
    expect: '但 label',
    desc: '给数字型 text 配泛化 label（/base-converter 用 "Fill in sample text"）→ E5 应判红',
    async apply() {
      const orig = await readFile(TARGETS.EN, 'utf8');
      const next = mutateEntry(orig, '/base-converter', () => "    example: { label: 'Fill in sample text', text: '255' },");
      await writeFile(TARGETS.EN, next, 'utf8');
      return async () => writeFile(TARGETS.EN, orig, 'utf8');
    },
  },
  {
    id: 'M8',
    check: 'E8',
    expect: 'n-input-number',
    desc: '给 n-input-number 工具 /px-rem-converter 补文本 example → E8 应判红',
    async apply() {
      const orig = await readFile(TARGETS.EN, 'utf8');
      const next = mutateEntry(orig, '/px-rem-converter', () => "    example: { label: 'Fill in a sample number', text: '16px' },");
      await writeFile(TARGETS.EN, next, 'utf8');
      return async () => writeFile(TARGETS.EN, orig, 'utf8');
    },
  },
];

/**
 * 重新加载数据。
 *
 * ⛔ 每条变异都要开**一个全新的 vite server**。
 * 首版给模块路径加了 `?falsify=<ts>-<rand>` 查询串想绕开模块缓存，结果 esbuild
 * 把整个查询串当成 loader 类型解析，直接抛 `Invalid loader value: "829986929195236"`。
 * 实测（_ops/test-vite-fresh.mjs 记录）：全新 server 本身就���读磁盘，
 * 不需要任何 cache-buster —— 查询串这条多余的路是纯负债，删掉。
 */
async function loadGuidesFresh() {
  const v = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  try {
    const en = (await v.ssrLoadModule('/src/tools/guides.en.ts')).GUIDES;
    const zh = (await v.ssrLoadModule('/src/tools/guides.zh.ts')).GUIDES;
    return { en, zh };
  }
  finally {
    await v.close();
  }
}

/** 在注入后的数据上跑单条判据，返回问题列表 */
async function runCheckWithFreshData(checkId) {
  const { en, zh } = await loadGuidesFresh();
  GUIDES = en;
  GUIDES_ZH = zh;
  const check = CHECKS.find(c => c.id === checkId);
  return check.run().problems;
}

async function falsify() {
  console.log('[falsify] 目的：证明门禁真能判红，且红的是**本判据**而不是别的判据');
  console.log('[falsify] 口径：每条变异带 expect 关键词，只认命中该关键词的报告');
  console.log('');
  const results = [];

  for (const m of MUTATIONS) {
    let restore = null;
    let problems = [];
    let error = '';
    try {
      restore = await m.apply();
      problems = await runCheckWithFreshData(m.check);
    }
    catch (e) {
      error = String(e.message || e);
    }
    finally {
      if (restore) {
        try {
          await restore();
        }
        catch {}
      }
    }
    // 还原后再验一次：文件必须回到干净状态，否则后面的变异在污染数据上跑
    const { en: cleanEn, zh: cleanZh } = await loadGuidesFresh();
    GUIDES = cleanEn;
    GUIDES_ZH = cleanZh;
    const residual = CHECKS.flatMap(c => c.run().problems);

    const hit = problems.some(p => p.includes(m.expect));
    const passed = !error && hit && residual.length === 0;
    results.push({ id: m.id, desc: m.desc, expect: m.expect, hit, residual: residual.length, error, passed });
    const badge = passed ? '✓✓' : error ? '✗✗' : '✗✗';
    console.log(`[falsify] ${badge} ${m.id}（判据 ${m.check}）${m.desc}`);
    console.log(`         expect 关键词：${JSON.stringify(m.expect)}`);
    if (error) {
      console.log(`         执行异常：${error}`);
    }
    else if (!hit) {
      console.log(`         ✗ 未命中本判据关键词 —— 该变异是被别的判据判红的话，falsify 就是自欺`);
      console.log(`           实际命中：${problems.length ? problems.map(p => p.slice(0, 90)).join(' | ') : '（该判据无问题，未判红）'}`);
    }
    else {
      console.log(`         ✓ 命中：${problems.find(p => p.includes(m.expect)).slice(0, 140)}`);
    }
    if (residual.length) {
      console.log(`         ✗ 还原后仍有 ${residual.length} 条问题 —— 变异没有干净回滚：${residual[0].slice(0, 100)}`);
    }
    else {
      console.log('         ✓ 还原后干净（0 条残留问题）');
    }
  }

  const failed = results.filter(r => !r.passed);
  console.log('');
  console.log(`[falsify] 结果：${results.length - failed.length}/${results.length} 条变异被成功证伪`);
  for (const f of failed) {
    console.log(`  ✗ ${f.id}：${f.error || '未命中本判据 / 回滚不干净'}`);
  }
  if (failed.length) {
    console.log('[falsify] 门禁不可信 —— 判红能力或判据归属有问题，必须修');
    return 1;
  }
  console.log('[falsify] 门禁可信：每条判据都能被自己的变异证伪');
  return 0;
}

// ─────────────────────────────── 入口 ───────────────────────────────
if (has('--falsify')) {
  printReport(runAllChecks(), { exitCode: 0 });
  console.log('');
  process.exit(await falsify());
}

const results = runAllChecks();
const total = results.reduce((n, r) => n + r.problems.length, 0);
printReport(results, { exitCode: total ? 1 : 0 });
// --report 用于人工阅读（报告里始终会打印已知缺陷一节）；其余模式一律带退出码。
process.exit(total ? 1 : 0);