/**
 * smoke-cases.mjs — 101 个工具页的 Smoke 用例声明
 * ---------------------------------------------------------------------------
 * 这个文件是**纯数据**，不含引擎逻辑。引擎在 ./smoke-tools.mjs。
 *
 * 为什么用例要单独放一个文件
 *   101 条用例里，每一条的「输入什么、期望什么、凭什么说它是对的」都不一样。
 *   把判定依据写在数据里（strategy 字段），报告就能回答「这条通过意味着什么」，
 *   而不是只给一个绿点。
 *
 * 字段
 *   path        工具路由（不带尾斜杠），必须与 src/tools/<dir>/index.ts 的 path 一致
 *   name        目录名，只用于报告与 --only
 *   category    所属分类（来自 src/tools/index.ts 的 toolsByCategory）
 *   zhTitle     locales/zh.yml 里声明的中文标题。引擎会拿它跟页面 H1 比对 ——
 *               这是**独立于被测实现**的期望值来源，能抓出「工具定义漏接 translate()」
 *               这类缺陷（本仓库真有，见 _ops/step5-findings.md 的 F-1）
 *   tier        'io'（真实输入→断言输出）| 'mount'（只保证挂载与不抛错）
 *   strategy    期望值的来源与判定逻辑，写给人看
 *   onlineOnly  依赖 /api/*，本地静态服务下必然拿不到数据，只在线上跑
 *   interceptApi 'fail500' | 'ok200' —— 用 CDP 拦截 /api/* 注入结果（A3 失败态）
 *   steps       步骤数组，见下
 *   expect      { text, not, regex,                        ← 取值面=整页文本+全部控件值
 *                 out, outRegex, outNot,                   ← 取值面=工具区文本+控件值(剔除与输入相同的)
 *                 js, imageData, canvasNonBlank, consoleNoise }
 *
 *   ⚠️ 「输出恰好是输入的**回显**」的工具（解析/格式化/范围展开…）必须用 out 家族，
 *      不能用 text/regex —— 期望值就躺在输入框里，text 断言恒真（假通过）。
 *      `--lint-only` 会扫出这类空转断言，blind 必须为 0。
 *
 *   expect.js 返回 true 通过；返回 false 或**非空字符串**即失败（字符串当失败原因打印）。
 *   注意别用 null 表示「通过」—— 早期引擎用 !! 强转，null 会变成 false 从而误报失败（踩过）。
 *
 * 步骤
 *   { applyExample: true }              点「怎么用这个工具？」里的示例按钮（guides.ts 的 example.text）
 *   { fill: { i, text, sel? } }         给 .tool-content 内第 i 个可见可写控件写值（原生 setter + input 事件）
 *   { fillLabel: { label, text } }      按界面上真实可见的 label 文案定位（多输入框工具更稳）
 *   { click: '文本' } / { clickExact }   按按钮文案点击（含 / 精确）
 *   { clickSel: '选择器' }               按选择器点击
 *   { pick: { sel, text } }             点开下拉再选中文案匹配的选项
 *   { upload: { i, file, sel? } }       给文件输入注入真实文件（路径相对仓库根）
 *   { js: '<表达式>' }                  页内脚本；返回字符串=失败，返回 null=通过
 *   { wait: 毫秒 } / { waitText: { text, ms, scope? } } / { waitSel: { sel, ms } }
 *                 等东西出现一律用 waitText / waitSel（轮询+上限）；wait 只让动画/防抖跑完。
 *                 waitText 默认在整页找 —— 工具页的文案常常在「使用说明」里也有一份，
 *                 而说明在 .tool-content 之外；等结果文案时务必带 scope: '.tool-content'，
 *                 或干脆用 waitSel 等结果元素（更硬）。两者都踩过。
 *
 * 断言策略（strategy 字段用的词）
 *   knownVector  外部公认测试向量（如 MD5("hello world")、BIP39 全零熵、罗马数字 2024）
 *   format       公认格式（UUID v4 / ULID / bcrypt 前缀 / PEM 头）
 *   roundTrip    页内往返：输出再喂回反变换，必须还原原文（不依赖任何外部期望值）
 *   differential 差分：改变某个输入，输出必须随之改变（证明该输入真的参与运算）
 *   reference    速查类：搜一个已知词，对应条目必须出现
 *   structural   结构性断言（非空、行数、可再次解析）
 *   fileUpload   注入真实文件，断言工具正确处理该文件
 */

export const SMOKE_CASES = [
  // ══════════════════════════ Crypto (12) ══════════════════════════

  {
    path: '/bcrypt',
    name: 'bcrypt',
    category: 'Crypto',
    zhTitle: 'Bcrypt 哈希',
    tier: 'io',
    strategy: 'format：bcrypt 哈希的公认前缀格式 $2a$10$…（外部标准，非抄组件实现）',
    steps: [{ applyExample: true }, { wait: 700 }],
    expect: { regex: ['\\$2[abxy]\\$\\d\\d\\$'], not: ['Error', 'undefined'] },
  },
  {
    path: '/bip39-generator',
    name: 'bip39-generator',
    category: 'Crypto',
    zhTitle: 'BIP39密码生成器',
    tier: 'io',
    strategy: 'knownVector：BIP39 官方测试向量 —— 全零 16 字节熵 → 12 个 abandon + about',
    steps: [{ fill: { i: 0, text: '00000000000000000000000000000000' } }, { wait: 700 }],
    expect: {
      text: ['abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'],
    },
  },
  {
    path: '/encryption',
    name: 'encryption',
    category: 'Crypto',
    zhTitle: '加密/解密文本',
    tier: 'io',
    strategy: 'roundTrip：加密 → 把密文喂回同页解密 → 必须还原原文（恒等性，无外部期望值）',
    steps: [
      { fillLabel: { label: 'Your text:', text: 'hello devbox' } },
      { fillLabel: { label: 'Your secret key:', text: 'secret123' } },
      { wait: 600 },
      {
        js: `(function(){
          var S = window.__smoke;
          var enc = S.byLabel('Your text encrypted:');
          if (!enc || !enc.value) return '加密输出为空';
          window.__enc = enc.value;
          var di = S.byLabel('Your encrypted text:');
          if (!di) return '解密输入框未找到';
          S.setVal(di, enc.value);
          var eds = S.editables();
          if (eds.length < 2) return '未找到解密密钥框';
          S.setVal(eds[eds.length - 1], 'secret123');
          return null;
        })()`,
      },
      { wait: 900 },
    ],
    expect: {
      // 标签是界面上的原文「Your decrypted text:」—— 写错一个词就永远查不到元素，
      // 会伪装成「功能坏了」。这里同时断言密文 ≠ 明文，防「加密没生效、原样透传」的假通过。
      js: `(function(){
        var S = window.__smoke;
        var d = S.byLabel('Your decrypted text:');
        if (!d) return false;
        return d.value.trim() === 'hello devbox' && window.__enc !== 'hello devbox' && window.__enc.length > 20;
      })()`,
      not: ['Error while decrypting', 'Error while encrypting'],
    },
  },
  {
    path: '/hash-text',
    name: 'hash-text',
    category: 'Crypto',
    zhTitle: 'Hash 文本',
    tier: 'io',
    strategy: 'knownVector：MD5/SHA1/SHA256("hello world") 的公认测试向量',
    steps: [{ applyExample: true }, { wait: 700 }],
    expect: {
      text: [
        '5eb63bbbe01eeed093cb22bb8f5acdc3',
        '2aae6c35c94fcfb415dbe95f408b9ce91ee846ed',
        'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
      ],
    },
  },
  {
    path: '/hmac-generator',
    name: 'hmac-generator',
    category: 'Crypto',
    zhTitle: 'Hmac 生成器',
    tier: 'io',
    strategy: 'differential：换密钥后 HMAC 必须改变（证明密钥真的参与运算）+ 输出长度下限',
    steps: [
      { fill: { i: 0, text: 'hello world' } },
      { fill: { i: 1, text: 'key-one' } },
      { wait: 600 },
      {
        js: `(function(){
          var S = window.__smoke;
          var o = S.byLabel('HMAC of your text');
          if (!o || !o.value) return 'HMAC 输出为空';
          window.__h1 = o.value;
          var eds = S.editables();
          S.setVal(eds[1], 'key-two');
          return null;
        })()`,
      },
      { wait: 600 },
    ],
    expect: {
      js: `(function(){
        var S = window.__smoke;
        var o = S.byLabel('HMAC of your text');
        if (!o || !o.value) return false;
        return o.value !== window.__h1 && window.__h1.length >= 16 && /^[0-9a-fA-F]+$|^[A-Za-z0-9+/=_-]+$/.test(window.__h1);
      })()`,
      not: ['Error'],
    },
  },
  {
    path: '/htpasswd-generator',
    name: 'htpasswd-generator',
    category: 'Crypto',
    zhTitle: 'htpasswd 生成与校验',
    tier: 'io',
    strategy: 'roundTrip：生成 htpasswd 行 → 送到校验区 → 必须报「密码匹配」（应用自己的两个方向互证）',
    steps: [
      { fillLabel: { label: '用户名：', text: 'admin' } },
      { fillLabel: { label: '密码：', text: 'secret' } },
      { clickExact: '生成' },
      { waitText: { text: '生成结果', ms: 4000 } },
      { clickExact: '拿去校验' },
      { wait: 400 },
      { clickExact: '校验' },
      { waitText: { text: '密码匹配', ms: 4000 } },
    ],
    // 往返互证：生成出的 apr1 行 → 喂给同页校验区 → 必须报「密码匹配」。
    // 「拿去校验」只在 generated 存在时才渲染，所以 waitText '生成结果' 是这一步的前置条件。
    expect: { text: ['admin:$apr1$', '密码匹配'], not: ['生成失败', '❌ 密码不匹配'] },
  },
  {
    path: '/password-strength-analyser',
    name: 'password-strength-analyser',
    category: 'Crypto',
    zhTitle: '密码强度分析仪',
    tier: 'io',
    strategy: 'differential：强密码与弱密码的「破解耗时」必须不同，且必须真的算出数字',
    steps: [
      {
        js: `(function(){
          var S = window.__smoke;
          var el = document.querySelector('.tool-content input[type="password"]');
          if (!el) return '密码输入框未找到';
          S.setVal(el, 'MyP@ssw0rd2024');
          return null;
        })()`,
      },
      { wait: 700 },
      {
        js: `(function(){
          var e = document.querySelector('[data-test-id="crack-duration"]');
          if (!e || !e.innerText.trim()) return '破解耗时未渲染';
          window.__d1 = e.innerText.trim();
          var S = window.__smoke;
          S.setVal(document.querySelector('.tool-content input[type="password"]'), 'a');
          return null;
        })()`,
      },
      { wait: 700 },
    ],
    expect: {
      js: `(function(){
        var e = document.querySelector('[data-test-id="crack-duration"]');
        if (!e) return false;
        var d2 = e.innerText.trim();
        return d2.length > 0 && d2 !== window.__d1 && !/NaN|undefined/.test(d2);
      })()`,
    },
  },
  {
    path: '/pdf-signature-checker',
    name: 'pdf-signature-checker',
    category: 'Crypto',
    zhTitle: 'PDF签名检查器',
    tier: 'io',
    strategy: 'fileUpload：注入一个结构合规的未签名 PDF，断言工具给出明确的「未找到签名」结论（不抛异常）',
    steps: [{ upload: { i: 0, file: 'scripts/smoke-fixtures/unsigned.pdf' } }, { wait: 2500 }],
    expect: { text: ['No signatures found in the provided file.'] },
  },
  {
    path: '/rsa-key-pair-generator',
    name: 'rsa-key-pair-generator',
    category: 'Crypto',
    zhTitle: 'RSA密钥对生成器',
    tier: 'io',
    strategy: 'format：输出必须是 PEM 格式的公钥与私钥（外部标准头尾）',
    steps: [{ wait: 1800 }],
    expect: {
      regex: ['-----BEGIN (RSA )?PRIVATE KEY-----', '-----BEGIN (RSA )?PUBLIC KEY-----'],
      not: ['Error'],
    },
  },
  {
    path: '/token-generator',
    name: 'token-generator',
    category: 'Crypto',
    zhTitle: 'Token 生成器',
    tier: 'io',
    strategy: 'differential：初始 token 非空且为可打印 ASCII；点刷新后必须变成另一个值',
    steps: [
      { wait: 500 },
      {
        js: `(function(){
          var S = window.__smoke;
          var t = S.controls().find(function(e){ return e.value && e.value.length >= 8; });
          if (!t) return '没找到 token 输出';
          window.__t1 = t.value;
          var bs = [].slice.call(document.querySelectorAll('.tool-content button')).filter(S.vis);
          if (bs.length < 2) return '按钮不足（期望复制+刷新两个）';
          bs[bs.length - 1].click();
          return null;
        })()`,
      },
      { wait: 600 },
    ],
    expect: {
      js: `(function(){
        var S = window.__smoke;
        var t = S.controls().find(function(e){ return e.value && e.value.length >= 8; });
        if (!t) return false;
        return t.value !== window.__t1 && /^[\\x21-\\x7e]+$/.test(window.__t1);
      })()`,
    },
  },
  {
    path: '/ulid-generator',
    name: 'ulid-generator',
    category: 'Crypto',
    zhTitle: 'ULID 生成器',
    tier: 'io',
    strategy: 'format：ULID 的公认格式 —— 26 位 Crockford Base32（排除 I/L/O/U）',
    steps: [{ wait: 600 }],
    expect: {
      js: `(function(){
        var e = document.querySelector('[data-test-id="ulids"]');
        if (!e) return false;
        return /^[0-9A-HJKMNP-TV-Z]{26}$/m.test(e.innerText.trim());
      })()`,
    },
  },
  {
    path: '/uuid-generator',
    name: 'uuid-generator',
    category: 'Crypto',
    zhTitle: 'UUIDs 生成器',
    tier: 'io',
    strategy: 'format：RFC 4122 UUID 格式（默认 v4，故第 13 位必须为 4、第 17 位为 8/9/a/b）',
    steps: [{ wait: 600 }],
    expect: {
      regex: ['[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'],
      not: ['Error'],
    },
  },

  // ══════════════════════════ Converter（第一批 13） ══════════════════════════

  {
    path: '/ascii-table',
    name: 'ascii-table',
    category: 'Converter',
    zhTitle: 'ASCII 码表',
    tier: 'io',
    strategy: 'reference：搜已知码位 65，必须出现 0x41 与对应说明',
    steps: [{ fill: { i: 0, text: '65' } }, { wait: 500 }],
    expect: { text: ['0x41', '大写字母 A 起始'] },
  },
  {
    path: '/base64-string-converter',
    name: 'base64-string-converter',
    category: 'Converter',
    zhTitle: 'Base64 字符串编码/解码',
    tier: 'io',
    strategy:
      'knownVector：base64(guides 示例文本 "Hello DigDevBox")，期望值由 Python base64 独立算出。'
      + '⚠ 本用例的期望值与 guides 的 example.text 耦合（applyExample 会填该文本）：'
      + '2026-09-20 品牌统一时 en/zh 两侧示例都改成同一串，才使本用例与语言无关；'
      + '以后再改示例文本，必须同步重算这里的期望值。',
    steps: [{ applyExample: true }, { wait: 600 }],
    expect: { text: ['SGVsbG8gRGlnRGV2Qm94'] },
  },
  {
    path: '/base-converter',
    name: 'integer-base-converter',
    category: 'Converter',
    zhTitle: '整数基转换器',
    tier: 'io',
    strategy: 'knownVector：255 的二进制/八进制/十六进制是算术事实（11111111 / 377 / ff）',
    steps: [{ applyExample: true }, { wait: 600 }],
    // 十六进制大小写由实现决定（本站输出小写 ff），所以用不区分大小写的正则，
    // 避免把「大小写风格」误判成「算错了」。
    expect: { text: ['11111111', '377'], regex: ['(?<![0-9a-zA-Z])[fF]{2}(?![0-9a-zA-Z])'], not: ['NaN'] },
  },
  {
    path: '/case-converter',
    name: 'case-converter',
    category: 'Converter',
    zhTitle: '大小写转换',
    tier: 'io',
    strategy: 'knownVector："hello world example" 的 camel/snake/kebab 形式是确定性变换',
    steps: [{ applyExample: true }, { wait: 600 }],
    expect: { text: ['helloWorldExample', 'hello_world_example', 'hello-world-example'] },
  },
  {
    path: '/color-converter',
    name: 'color-converter',
    category: 'Converter',
    zhTitle: 'Color 选择器',
    tier: 'io',
    strategy: 'knownVector：#ff6600 = rgb(255,102,0)，换算结果是算术事实',
    steps: [{ applyExample: true }, { wait: 600 }],
    expect: { text: ['255', '102', 'ff6600'] },
  },
  {
    path: '/list-converter',
    name: 'list-converter',
    category: 'Converter',
    zhTitle: 'List 转换器',
    tier: 'io',
    strategy: 'structural：示例四行列表必须完整渲染出三组不同内容（保留重复项 apple）',
    steps: [{ applyExample: true }, { wait: 600 }],
    expect: { text: ['banana', 'apple', 'cherry'] },
  },
  {
    path: '/rmb-uppercase',
    name: 'rmb-uppercase',
    category: 'Converter',
    zhTitle: '人民币大写转换',
    tier: 'io',
    strategy: 'knownVector：1409.05 的财务大写，按「元/角/分」规范逐位可推（壹仟肆佰零玖元…伍分）',
    steps: [{ applyExample: true }, { wait: 600 }],
    expect: { text: ['壹仟肆佰零玖', '伍分'] },
  },
  {
    path: '/roman-numeral-converter',
    name: 'roman-numeral-converter',
    category: 'Converter',
    zhTitle: '罗马数字转换器',
    tier: 'io',
    strategy: 'knownVector：2024 = MMXXIV，罗马数字规则是外部常识',
    steps: [{ applyExample: true }, { wait: 600 }],
    expect: { text: ['MMXXIV'] },
  },
  {
    path: '/text-to-binary',
    name: 'text-to-binary',
    category: 'Converter',
    zhTitle: '文本到 ASCII 二进制',
    tier: 'io',
    strategy: 'knownVector："Hi" 的 ASCII 二进制由 Python 独立算出（01001000 / 01101001）',
    steps: [{ applyExample: true }, { wait: 600 }],
    expect: { text: ['01001000', '01101001'] },
  },
  {
    path: '/text-to-nato-alphabet',
    name: 'text-to-nato-alphabet',
    category: 'Converter',
    zhTitle: '文本转北约字母表',
    tier: 'io',
    strategy: 'knownVector：北约音标字母表 S= Sierra、O= Oscar 是公开固定映射',
    steps: [{ applyExample: true }, { wait: 600 }],
    expect: { text: ['Sierra', 'Oscar'] },
  },
  {
    path: '/text-to-unicode',
    name: 'text-to-unicode',
    category: 'Converter',
    zhTitle: '文本转 Unicode',
    tier: 'io',
    strategy: 'knownVector + 往返：H=72、你=20320（十进制码点的事实），且转回文本必须还原原串',
    steps: [
      { applyExample: true },
      { wait: 600 },
      {
        js: `(function(){
          var S = window.__smoke;
          var out = S.byLabel('Unicode from your text');
          if (!out || !out.value) return 'Unicode 输出为空';
          var back = S.byLabel('Enter unicode to convert to text');
          if (!back) return '反向输入框未找到';
          S.setVal(back, out.value);
          return null;
        })()`,
      },
      { wait: 500 },
    ],
    // 本站实现按上游 it-tools 的语义输出**十进制** HTML 实体（&#72; / &#20320;），不是十六进制码点。
    // 期望值取的是「码点事实」（72 / 20320），编码风格则由实现决定，因此只断言两种可接受的等价写法。
    expect: {
      text: ['&#72;', '&#20320;'],
      js: `(function(){
        var S = window.__smoke;
        var t = S.byLabel('Text from your Unicode');
        return !!t && t.value.trim() === 'Hello 你好';
      })()`,
    },
  },
  {
    path: '/json-to-yaml-converter',
    name: 'json-to-yaml-converter',
    category: 'Converter',
    zhTitle: 'JSON到YAML转换器',
    tier: 'io',
    strategy: 'structural：YAML 必须保留原 JSON 的键值与数组元素（name: devbox / - web）',
    steps: [{ applyExample: true }, { wait: 600 }],
    expect: { text: ['name: devbox', 'web', 'api'] },
  },
  {
    path: '/json-to-toml',
    name: 'json-to-toml',
    category: 'Converter',
    zhTitle: 'JSON 转 TOML',
    tier: 'io',
    strategy: 'structural：TOML 必须保留原 JSON 的键值与嵌套表（title = "demo" / [server] / port = 8080）',
    steps: [{ applyExample: true }, { wait: 700 }],
    // 注意：本站用的 iarna-toml 默认给数字加下划线分隔（`port = 8_080`）——TOML 1.0 的合法写法，
    // 值仍是 8080。所以正则里允许可选下划线，只锁「值不能被改写」。
    expect: { text: ['title = "demo"', '[server]'], regex: ['port = 8_?080'] },
  },

  // ══════════════════════════ Converter 余下 (9) ══════════════════════════

  {
    path: '/base64-file-converter',
    name: 'base64-file-converter',
    category: 'Converter',
    zhTitle: 'Base64 文件转换器',
    tier: 'io',
    strategy: 'fileUpload + knownVector + roundTrip：上传真实 PNG → 产出 base64 必含 PNG 魔数 iVBORw0KGgo；再把该 base64 喂回「Base64 to file」侧，Preview image 必须真渲染出 <img>',
    steps: [
      { upload: { file: 'scripts/smoke-fixtures/sample.png' } },
      { wait: 1000 },
      {
        js: `(function(){
          var S = window.__smoke;
          var cs = S.controls();
          var ro = cs.filter(function(e){ return e.readOnly && (e.value||'').length > 20; });
          if (!ro.length) return '上传后没拿到 base64 输出';
          window.__up = ro[ro.length - 1].value;
          var tgt = cs.filter(function(e){ return !e.readOnly && e.tagName === 'TEXTAREA'; });
          if (!tgt.length) return '未找到可写的 base64 输入框';
          S.setVal(tgt[0], window.__up);
          return null;
        })()`,
      },
      { wait: 600 },
      { clickExact: 'Preview image' },
      { wait: 900 },
    ],
    expect: {
      regex: ['iVBORw0KGgo'],
      js: `(function(){ var c = document.getElementById('previewContainer'); return !!c && !!c.querySelector('img'); })()`,
    },
  },
  {
    path: '/date-converter',
    name: 'date-time-converter',
    category: 'Converter',
    zhTitle: '日期时间转换器',
    tier: 'io',
    strategy: 'knownVector：2024-01-01T00:00:00Z 的 Unix 时间戳是 1704067200（时区无关的事实）',
    steps: [
      { fill: { i: 0, text: '2024-01-01T00:00:00Z' } },
      { wait: 900 },
    ],
    // 输入带 Z 的绝对时刻，默认解析路径就能吃下，不必去动格式下拉
    // （naive-ui 的下拉是 teleport + 虚拟列表，点开再选的稳定性远不如直接给值）。
    // 时间戳是秒、也可能是毫秒 —— 1704067200 是后者的前缀，所以这一条能同时容忍两种口径。
    expect: { regex: ['1704067200'], text: ['Unix timestamp', 'ISO 8601'], not: ['Invalid date...'] },
  },
  {
    path: '/unix-timestamp-converter',
    name: 'unix-timestamp-converter',
    category: 'Converter',
    zhTitle: 'Unix 时间戳转换',
    tier: 'io',
    strategy: 'knownVector：1681333824 秒 = 2023-04-12T21:10:24Z（时区无关的事实）',
    steps: [
      { fill: { i: 0, text: '1681333824' } },
      { wait: 900 },
    ],
    expect: { regex: ['1681333824', '1681333824000'], text: ['Unix timestamp', 'Timestamp', 'UTC format'], not: ['Invalid date...'] },
  },
  {
    path: '/json-to-xml',
    name: 'json-to-xml',
    category: 'Converter',
    zhTitle: 'JSON 转 XML',
    tier: 'io',
    strategy: 'structural：示例 { "user": { "id": 1, "name": "Alice" } } 的键必须原样成为元素，值不能被改写',
    steps: [{ applyExample: true }, { wait: 800 }],
    expect: { text: ['Alice'], regex: ['<user>', '<name>'], not: ['Invalid'] },
  },
  {
    path: '/markdown-to-html',
    name: 'markdown-to-html',
    category: 'Converter',
    zhTitle: 'Markdown 转 HTML',
    tier: 'io',
    strategy: 'structural：示例 Markdown 的 #/**/ 列表/链接 必须各自变成对应的 HTML 标签',
    steps: [{ applyExample: true }, { wait: 800 }],
    expect: { text: ['<h1', '<strong>', '<li>', 'digdevbox.com'], not: ['Invalid'] },
  },
  {
    path: '/toml-to-json',
    name: 'toml-to-json',
    category: 'Converter',
    zhTitle: 'TOML 到 JSON',
    tier: 'io',
    strategy: 'structural：TOML 的标量与 [server] 表必须变成 JSON 的键值（title/port 均不得丢失）',
    steps: [{ applyExample: true }, { wait: 800 }],
    expect: { regex: ['"title":\\s*"demo"', '"port":\\s*8080'], not: ['Invalid'] },
  },
  {
    path: '/toml-to-yaml',
    name: 'toml-to-yaml',
    category: 'Converter',
    zhTitle: 'TOML 到 YAML',
    tier: 'io',
    strategy: 'structural：TOML 的标量与 [server] 表必须变成 YAML 的缩进结构',
    steps: [{ applyExample: true }, { wait: 800 }],
    expect: { text: ['title: demo', 'server:'], regex: ['port:\\s*8080'], not: ['Invalid'] },
  },
  {
    path: '/xml-to-json',
    name: 'xml-to-json',
    category: 'Converter',
    zhTitle: 'XML 转 JSON',
    tier: 'io',
    strategy: 'structural：示例 XML 的文本节点与属性都要进 JSON（Alice 与 name 键必须出现）',
    steps: [{ applyExample: true }, { wait: 800 }],
    expect: { text: ['Alice'], regex: ['"name"\\s*:'], not: ['Invalid'] },
  },
  {
    path: '/yaml-to-json-converter',
    name: 'yaml-to-json-converter',
    category: 'Converter',
    zhTitle: 'YAML到JSON转换器',
    tier: 'io',
    strategy: 'structural：YAML 的标量与数组必须变成 JSON 的字符串与数组（devbox / web / api 三者都要在）',
    steps: [{ applyExample: true }, { wait: 800 }],
    expect: { regex: ['"name":\\s*"devbox"', '"web"', '"api"'], not: ['Invalid'] },
  },
  {
    path: '/yaml-to-toml',
    name: 'yaml-to-toml',
    category: 'Converter',
    zhTitle: 'YAML 到 TOML',
    tier: 'io',
    strategy: 'structural：YAML 的嵌套映射必须变成 TOML 的 [server] 表，值不得被改写',
    steps: [{ applyExample: true }, { wait: 800 }],
    expect: { text: ['title = "demo"', '[server]'], regex: ['port = 8_?080'], not: ['Invalid'] },
  },

  // ══════════════════════════ Text (10) ══════════════════════════

  {
    path: '/ascii-text-drawer',
    name: 'ascii-text-drawer',
    category: 'Text',
    zhTitle: 'ASCII 艺术字生成器',
    tier: 'io',
    strategy: 'structural：输入 DigDevBox 后「Ascii Art text:」区必须产出多行、足够长的字符画，且不得报错',
    steps: [
      { fill: { i: 0, text: 'DigDevBox' } },
      { waitText: { text: 'Ascii Art text:', ms: 5000 } },
      { wait: 1500 },
    ],
    expect: {
      not: ['Could not render with font'],
      js: `(function(){
        // 输出走 TextareaCopyable → <n-code data-test-id="area-content">，不是 <textarea>。
        // 原断言按「只读 textarea」找，即使工具完全正常也永远为 false。
        var out = document.querySelector('.tool-content [data-test-id="area-content"]');
        if (!out) return false;
        var v = out.innerText || '';
        return v.split('\\n').length >= 3 && v.length > 100;
      })()`,
    },
  },
  {
    path: '/emoji-picker',
    name: 'emoji-picker',
    category: 'Text',
    zhTitle: 'Emoji 选择器',
    tier: 'io',
    strategy: 'reference：搜 smile 必须命中结果（不是 No results），且结果区真的含 Emoji 码位',
    steps: [
      { fill: { i: 0, text: 'smile' } },
      { wait: 1100 },
    ],
    expect: {
      text: ['Search result'],
      not: ['No results'],
      js: `(function(){
        var r = document.querySelector('.tool-content');
        return !!r && /[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/u.test(r.innerText);
      })()`,
    },
  },
  {
    path: '/fullwidth-converter',
    name: 'fullwidth-converter',
    category: 'Text',
    zhTitle: '全角半角转换',
    tier: 'io',
    strategy: 'knownVector：全角 ＡＢＣ１２３ 的码点比半角大 0xFEE0，切到「全角 → 半角」后必须是 ABC123（U+FF01–FF5E 全部落回 ASCII）',
    steps: [
      { applyExample: true },
      { wait: 700 },
      // 默认模式是「半角 → 全角」，对全角示例是恒等变换 —— 必须显式切到反方向才验得到转换。
      { click: '全角 → 半角' },
      { wait: 800 },
    ],
    expect: {
      text: ['ABC123'],
      // 不能对整页用 not —— 输入框里存的就是全角原文；而且界面标签里的全角冒号「：」(U+FF1A)
      // 本身就落在 FF01–FF5E 区间内，整页扫会把标签算成违规。
      // 所以只取「含 ABC123 的那一段」来判，把范围收敛到真正的输出值上。
      js: `(function(){
        var out = null;
        var t = document.querySelector('.tool-content').innerText;
        var m = t.match(/[^\\s]*ABC123[^\\s]*/);
        if (m) out = m[0];
        if (out === null) {
          var cs = [].slice.call(document.querySelectorAll('.tool-content textarea, .tool-content input'));
          var ro = cs.filter(function(e){ return e.readOnly && /ABC123/.test(e.value || ''); });
          if (ro.length) out = ro[0].value;
        }
        return out !== null && !/[\\uFF01-\\uFF5E]/.test(out);
      })()`,
    },
  },
  {
    path: '/lorem-ipsum-generator',
    name: 'lorem-ipsum-generator',
    category: 'Text',
    zhTitle: 'Lorem ipsum生成器',
    tier: 'io',
    strategy: 'structural：占位文本必须立刻产出，内容含经典的 lorem ipsum 开头',
    steps: [{ wait: 900 }],
    // 引擎的正则不带 i 标志，所以用字符类表达「不区分大小写」。
    expect: { regex: ['[Ll]orem [Ii]psum'], not: ['undefined'] },
  },
  {
    path: '/morse-code-converter',
    name: 'morse-code-converter',
    category: 'Text',
    zhTitle: '摩斯电码转换',
    tier: 'io',
    strategy: 'knownVector：SOS 的摩斯电码是 ... --- ...（国际公认，与实现无关）',
    steps: [{ applyExample: true }, { wait: 800 }],
    expect: { text: ['... --- ...'] },
  },
  {
    path: '/numeronym-generator',
    name: 'numeronym-generator',
    category: 'Text',
    zhTitle: '数字名称生成器',
    tier: 'io',
    strategy: 'knownVector：internationalization → i18n（首尾字母 + 中间字母数，i18n 本身就是这个工具的命名来源）',
    steps: [{ applyExample: true }, { wait: 800 }],
    expect: { text: ['i18n'] },
  },
  {
    path: '/string-obfuscator',
    name: 'string-obfuscator',
    category: 'Text',
    zhTitle: '字符串混淆器',
    tier: 'io',
    strategy: 'structural + diff：默认 keepFirst=4 / keepLast=4，22 字符的示例必须变成「前 4 位 + 14 个星号 + 后 4 位」，长度不变且中段原文消失',
    steps: [{ applyExample: true }, { wait: 800 }],
    expect: {
      // 14 = 22（原文长度）− 4（keepFirst）− 4（keepLast），是算出来的、不是抄页面的
      regex: ['my-s\\*{14}3456'],
      // 输出是卡片里的一个 div（不是输入框），所以按文本取值判断，别去查 textarea
      js: `(function(){
        var card = [].slice.call(document.querySelectorAll('.tool-content .c-card'))
          .filter(function(c){ return c.innerText.indexOf('*') >= 0; })[0];
        if (!card) return false;
        var v = card.innerText.replace(/\\s+/g, '').replace(/[^\\x20-\\x7E*]/g, '');
        var m = v.match(/[a-z0-9-]*\\*+[a-z0-9-]*/);
        return !!m && m[0].length === 'my-secret-token-123456'.length && m[0].indexOf('secret') === -1;
      })()`,
    },
  },
  {
    path: '/text-diff',
    name: 'text-diff',
    category: 'Text',
    zhTitle: '文本比较',
    tier: 'mount',
    expectMountOnly: true,
    // 诚实标注：这个工具就是一个 Monaco 双向 diff 编辑器，两侧内容由用户键入，
    // 组件没暴露任何可编程入口。本轮只能验「Monaco 真的挂载并初始化出两段初始文本」。
    // 真实编辑体验归 A2 人工抽样，不能拿这条的绿点冒充「diff 功能已验证」。
    strategy: 'structural（仅挂载层）：Monaco diff 编辑器必须初始化（.monaco-editor 存在）且两侧初始文本 original text / modified text 已渲染',
    mountTimeout: 45000,
    steps: [{ wait: 2500 }],
    expect: {
      text: ['original text', 'modified text'],
      js: `!!document.querySelector('.tool-content .monaco-editor')`,
    },
  },
  {
    path: '/text-replacer',
    name: 'text-replacer',
    category: 'Text',
    zhTitle: '文本批量替换',
    tier: 'io',
    strategy: 'knownVector + structural：把 name= 全部替成 user=，三处出现都要换到（Alice/Bob/Carol），且计数为 3',
    steps: [
      { applyExample: true },
      { wait: 700 },
      { fillLabel: { label: '查找：', text: 'name=' } },
      { fillLabel: { label: '替换为：', text: 'user=' } },
      { wait: 900 },
    ],
    expect: {
      text: ['user=Alice', 'user=Bob', 'user=Carol', '替换次数：'],
      regex: ['user=Carol'],
    },
  },
  {
    path: '/text-statistics',
    name: 'text-statistics',
    category: 'Text',
    zhTitle: '文本统计',
    tier: 'io',
    strategy: 'differential：Character count 必须等于输入框自身的长度（期望值由输入实时算出，不写死数字）',
    steps: [{ applyExample: true }, { wait: 800 }],
    expect: {
      text: ['Character count', 'Word count', 'Line count', 'Byte size'],
      js: `(function(){
        var st = [].slice.call(document.querySelectorAll('.n-statistic'));
        var c = st.filter(function(n){ return n.innerText.indexOf('Character count') >= 0; })[0];
        var inp = document.querySelector('.tool-content textarea');
        if (!c || !inp || !inp.value.length) return false;
        var m = c.innerText.match(/(\\d+)/);
        return !!m && Number(m[1]) === inp.value.length;
      })()`,
    },
  },

  // ═══════════════════════════ Web（18）═══════════════════════════

  {
    path: '/basic-auth-generator',
    name: 'basic-auth-generator',
    zhTitle: '基本身份验证生成器',
    strategy: 'knownVector：HTTP Basic 凭据 = base64("user:pass")，admin:secret → YWRtaW46c2VjcmV0（RFC 7617）',
    steps: [
      { fillLabel: { label: 'Username', text: 'admin' } },
      { fillLabel: { label: 'Password', text: 'secret' } },
      { wait: 700 },
    ],
    expect: { text: ['Basic YWRtaW46c2VjcmV0'] },
  },

  {
    path: '/device-information',
    name: 'device-information',
    zhTitle: '设备信息',
    strategy: 'structural：这些字段名是组件里写死的固定文案（与环境无关），页面必须把它们渲染出来',
    steps: [{ wait: 700 }],
    expect: { text: ['Screen', 'Screen size', 'Orientation', 'Browser vendor', 'User agent'] },
  },

  {
    path: '/html-entities',
    name: 'html-entities',
    zhTitle: '转义html实体',
    strategy: 'knownVector：HTML 实体转义 —— < 与 > 必须变成 &lt; / &gt;，文本内容本身不变',
    steps: [{ fill: { i: 0, text: '<div>Hello</div>' } }, { wait: 800 }],
    expect: { text: ['&lt;div&gt;Hello&lt;/div&gt;'] },
  },

  {
    path: '/html-wysiwyg-editor',
    name: 'html-wysiwyg-editor',
    zhTitle: 'HTML所见即所得编辑器',
    strategy: 'structural（挂载层）：tiptap/ProseMirror 必须初始化出可编辑区域；不出字符级断言，因为内容需人工键入',
    mountTimeout: 20000,
    steps: [{ wait: 2500 }],
    expect: {
      js: `(function(){
        var e = document.querySelector('.tool-content .ProseMirror, .tool-content [contenteditable="true"]');
        if (!e) return false;
        // 编辑器内容区必须真的可编辑（不是一片 loading 骨架）
        return e.getAttribute('contenteditable') === 'true';
      })()`,
    },
  },

  {
    path: '/http-headers',
    name: 'http-headers',
    zhTitle: 'HTTP 头速查',
    strategy: 'knownVector：按 cookie 过滤后，结果里必须出现真实的 HTTP 头字段名 Set-Cookie（RFC 6265）',
    steps: [{ fill: { i: 0, text: 'cookie' } }, { wait: 800 }],
    expect: { text: ['Set-Cookie'] },
  },

  {
    path: '/http-status-codes',
    name: 'http-status-codes',
    zhTitle: 'HTTP 状态码',
    strategy: 'knownVector：404 的标准原因短语是 Not Found（RFC 9110）',
    steps: [{ fill: { i: 0, text: '404' } }, { wait: 800 }],
    expect: { text: ['Not Found'] },
  },

  {
    path: '/json-diff',
    name: 'json-diff',
    zhTitle: 'JSON 差异比较',
    strategy: 'structural：两份只差一个值的 JSON，差异视图必须给出该差异（b: 2 vs b: 3），而不是判「相同」',
    steps: [
      { fill: { i: 0, text: '{"a":1,"b":2}' } },
      { fill: { i: 1, text: '{"a":1,"b":3}' } },
      { wait: 1200 },
    ],
    expect: {
      not: ['The provided JSONs are the same'],
      js: `(function(){
        var card = document.querySelector('.tool-content [data-test-id="diff-result"]');
        if (!card) return false;
        var t = card.innerText;
        return t.indexOf('2') >= 0 && t.indexOf('3') >= 0;
      })()`,
    },
  },

  {
    path: '/json-to-get-params',
    name: 'json-to-get-params',
    zhTitle: 'JSON / GET 参数互转',
    strategy: 'structural：默认方向 JSON → GET 参数，嵌套数组以 a[b][i] 方括号路径表示（组件 flatten 的既定语义）',
    steps: [{ fill: { i: 0, text: '{"a":1,"b":[1,2]}' } }, { wait: 900 }],
    expect: {
      text: ['a=1'],
      // 实测输出是 URL 编码形式（a=1&b%5B0%5D=1&b%5B1%5D=2）。
      // 期望值锚在「解码后的语义」而不是编码风格上：不管实现编不编码，decodeURIComponent 之后
      // 都必须等于这条查询串 —— 这样断言既独立于实现的编码偏好，又真的验证了扁平化路径的语义。
      js: `(function(){
        var t = document.querySelector('.tool-content').innerText;
        var m = t.match(/a=1[^\\s]*/);
        if (!m) return false;
        return decodeURIComponent(m[0]) === 'a=1&b[0]=1&b[1]=2';
      })()`,
      not: ['转换失败'],
    },
  },

  {
    path: '/jwt-parser',
    name: 'jwt-parser',
    zhTitle: 'JWT 解析器',
    // JWT 在页面内用标准 btoa 按 base64url 规则构造 —— 结构与期望值（payload 里 name=Alice）都是独立指定的事实，
    // 不读被测组件、也不依赖外部工具链。
    strategy: 'knownVector：JWT = base64url(header).base64url(payload).sig，解析后必须还原 payload 里的 name=Alice',
    steps: [
      {
        js: `(function(){
          var S = window.__smoke;
          function b64u(o){
            return btoa(JSON.stringify(o)).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
          }
          var t = b64u({ alg: 'HS256', typ: 'JWT' }) + '.' + b64u({ sub: '1234567890', name: 'Alice' }) + '.' + b64u('sig');
          var el = document.querySelector('.tool-content textarea') || document.querySelector('.tool-content input');
          if (!el) return 'JWT 输入框未找到';
          S.setVal(el, t);
          return null;
        })()`,
      },
      { wait: 1000 },
    ],
    expect: { text: ['Alice', 'HS256'], not: ['Invalid JWT'] },
  },

  {
    path: '/keycode-info',
    name: 'keycode-info',
    zhTitle: 'Keycode 信息',
    strategy: 'realInput：用 CDP 派发**真实键盘事件**（非 JS 伪造 Event），Enter 的 key/keyCode/code 是浏览器原生值',
    steps: [{ key: 'Enter' }, { wait: 800 }],
    expect: {
      text: ['Enter'],
      js: `(function(){
        var rows = [].slice.call(document.querySelectorAll('.tool-content .n-input-group'));
        function valOf(labelRe){
          var r = rows.filter(function(g){ return labelRe.test(g.innerText); })[0];
          if (!r) return null;
          var i = r.querySelector('input');
          return i ? i.value : null;
        }
        var code = valOf(/Code\\s*:/);
        var kc = valOf(/Keycode\\s*:/);
        return code === 'Enter' && kc === '13';
      })()`,
    },
  },

  {
    path: '/og-meta-generator',
    name: 'og-meta-generator',
    zhTitle: '开放式图形元生成器',
    strategy: 'structural：填入 Title 后，生成的 meta 标签集合里必须出现 og:title 与所填的值（Open Graph 协议字段名）',
    steps: [
      {
        js: `(function(){
          var S = window.__smoke;
          var el = document.querySelector('.tool-content input[placeholder*="title of your website"]');
          if (!el) return 'Title 输入框未找到';
          S.setVal(el, 'DigDevBox 冒烟标题');
          return null;
        })()`,
      },
      { wait: 1000 },
    ],
    expect: { text: ['og:title', 'DigDevBox 冒烟标题'] },
  },

  {
    path: '/mime-types',
    name: 'mime-types',
    zhTitle: 'mime类型',
    strategy: 'knownVector：application/pdf 是 IANA 注册媒体类型，其关联扩展名必须包含 pdf',
    steps: [
      // 本站自研下拉：点 .c-select-input 展开，选项是 .c-select-dropdown-option
      { pick: { sel: '.tool-content .c-select-input, .tool-content .n-select, .tool-content select', text: 'application/pdf' } },
      { wait: 1000 },
    ],
    expect: { text: ['application/pdf'], regex: ['\\.pdf'] },
  },

  {
    path: '/otp-generator',
    name: 'otp-generator',
    zhTitle: 'OTP代码生成器',
    strategy: 'knownVector：TOTP 默认输出 6 位数字（RFC 6238），固定 secret 后 token 必须是 6 位纯数字',
    steps: [
      { fillLabel: { label: 'Secret', text: 'JBSWY3DPEHPK3PXP' } },
      { wait: 1400 },
    ],
    expect: {
      text: ['Current OTP', 'Next in'],
      js: `(function(){
        var b = document.querySelector('.tool-content [data-test-id="previous-otp"]');
        if (!b) return false;
        return /^\\d{6}$/.test((b.innerText || '').trim());
      })()`,
    },
  },

  {
    path: '/safelink-decoder',
    name: 'safelink-decoder',
    zhTitle: 'Outlook 安全链接解码器',
    // 输入与期望输出这一对，直接取自仓库自带的单测 safelink-decoder.service.test.ts —— 权威且与被测 UI 代码独立。
    strategy: 'knownVector：期望值取自仓库自带单测的输入/输出对（decoded = 内嵌 url 参数的原值）',
    steps: [
      {
        fill: {
          i: 0,
          text: 'https://aus01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fwww.google.com%2Fsearch%3Fq%3Dsafelink%26rlz%3D1&data=05%7C02%7C&sdata=abc%3D&reserved=0',
        },
      },
      { wait: 900 },
    ],
    expect: { text: ['https://www.google.com/search?q=safelink&rlz=1'] },
  },

  {
    path: '/slugify-string',
    name: 'slugify-string',
    zhTitle: '字符串转 Slug',
    strategy: 'knownVector：slug 化规则 —— 空格转连字符、大写转小写，My file path → my-file-path',
    steps: [{ fill: { i: 0, text: 'My file path' } }, { wait: 800 }],
    expect: { text: ['my-file-path'] },
  },

  {
    path: '/url-encoder',
    name: 'url-encoder',
    zhTitle: '编码/解码url格式的字符串',
    strategy: 'knownVector：组件用 encodeURIComponent，空格→%20、&→%26、=→%3D（RFC 3986 保留字转义）',
    steps: [{ fill: { i: 0, text: 'a b&c=d' } }, { wait: 800 }],
    expect: { text: ['a%20b%26c%3Dd'] },
  },

  {
    path: '/url-parser',
    name: 'url-parser',
    zhTitle: 'Url分析器',
    strategy: 'structural：URL 的分量由 RFC 3986 定义，解析结果必须给出 protocol / host / pathname',
    // 用 out 而不是 text：`https:` / `example.com` / `/path/page` 全都是输入 URL 的子串，
    // 而 text 的取值面包含输入框的值 —— 用 text 断言等于拿输入去验它自己（恒真）。
    // out 取的是工具区文本 + 控件值，并剔除与本用例输入完全相同的那个值，
    // 因此这些 token 只可能来自「解析结果」那一列（只读 input）。
    steps: [
      { fill: { i: 0, text: 'https://example.com/path/page?q=1#frag' } },
      { wait: 900 },
    ],
    expect: { out: ['Protocol', 'Hostname', 'Path', 'https:', 'example.com', '/path/page', '?q=1'] },
  },

  {
    path: '/user-agent-parser',
    name: 'user-agent-parser',
    zhTitle: '用户代理分析器',
    strategy: 'knownVector：真实 Chrome/Windows UA 串解析后必须识别出浏览器 Chrome 与系统 Windows',
    steps: [
      {
        fill: {
          i: 0,
          text: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      },
      { wait: 1000 },
    ],
    // out 而非 text：Chrome / Windows 都是 UA 串的子串；Blink（引擎）与 amd64（CPU）
    // 则**只可能来自解析结果**（UA 串里没有这两个词），是最硬的可证伪信号。
    expect: { out: ['Browser', 'Chrome', 'Engine', 'Blink', 'OS', 'Windows', 'amd64'] },
  },

  // ═════════════════════════ Development（17）════════════════════════

  {
    path: '/chmod-calculator',
    name: 'chmod-calculator',
    zhTitle: 'Chmod 计算器',
    // 勾选 Read/Write/Execute 三行的 Owner 列 —— 即 u=rwx、g=o=---，八进制必须是 700。
    // 用「点哪一格」表达，不依赖任何组件内部状态。
    // 注意：naive-ui 的 n-checkbox 渲染成 <div class="n-checkbox" role="checkbox">，
    // **内部没有 <input>**（它自己用 click + 键盘事件维护状态）。按 input 找会永远找不到。
    strategy: 'knownVector：权限位 rwx=4+2+1=7，只要 Owner 全选、其余不选，chmod 八进制必为 700',
    // 点击与核对必须分成两步：naive-ui 的 aria-checked 是**响应式更新**的，
    // 在 .click() 的同一个同步块里读它还停留在旧值 —— 上一版就是因此在第 0 行提前 return，
    // 只勾上了 Read（八进制 400），却报出「点不上」这种误导性结论。
    steps: [
      {
        js: `(function(){
          var rows = document.querySelectorAll('.tool-content .permission-table tbody tr');
          if (rows.length < 3) return '权限表行数不足：' + rows.length;
          for (var r = 0; r < 3; r++) {
            var tds = rows[r].querySelectorAll('td');
            // tds[0] 是行标题（Read/Write/Execute），tds[1..3] 依次是 Owner / Group / Public
            var box = tds[1] && tds[1].querySelector('.n-checkbox');
            if (!box) return '第 ' + r + ' 行 Owner 列的勾选框未找到';
            box.click();
          }
          return null;
        })()`,
      },
      { wait: 500 },
      {
        // 核对「三点都真的落到了状态上」。放到独立步骤里读，才拿得到更新后的 aria-checked。
        js: `(function(){
          var rows = document.querySelectorAll('.tool-content .permission-table tbody tr');
          for (var r = 0; r < 3; r++) {
            var tds = rows[r].querySelectorAll('td');
            var box = tds[1] && tds[1].querySelector('.n-checkbox');
            if (!box) return '第 ' + r + ' 行 Owner 列的勾选框消失';
            if (box.getAttribute('aria-checked') !== 'true') {
              return '第 ' + r + ' 行 Owner 列未勾上（aria-checked=' + box.getAttribute('aria-checked') + '）';
            }
          }
          return null;
        })()`,
      },
      { wait: 300 },
    ],
    expect: {
      js: `(function(){
        var o = document.querySelector('.tool-content .octal-result');
        if (!o) return false;
        return o.innerText.trim() === '700';
      })()`,
    },
  },

  {
    path: '/crontab-generator',
    name: 'crontab-generator',
    zhTitle: 'Crontab 表达式生成',
    strategy: 'knownVector：* * * * * 是「每分钟」的标准 cron 表达式（5 段式，POSIX 语义）',
    steps: [{ fill: { i: 0, text: '* * * * *' } }, { wait: 900 }],
    expect: { text: ['Every minute'], not: ['Invalid'] },
  },

  {
    path: '/docker-run-to-docker-compose-converter',
    name: 'docker-run-to-docker-compose-converter',
    zhTitle: 'Docker Run 到 docker-compose 转换器',
    strategy: 'structural：docker run 的 -p 与镜像名必须一一落到 compose 的 ports 与 image 上',
    steps: [
      { fill: { i: 0, text: 'docker run -d -p 8080:80 --name web nginx' } },
      { wait: 1000 },
    ],
    expect: {
      out: ['services:', 'image: nginx', 'container_name'],
      outRegex: ['8080:80', 'ports:'],
    },
  },

  {
    path: '/email-normalizer',
    name: 'email-normalizer',
    zhTitle: '邮箱地址归一化',
    strategy: 'knownVector：Gmail 地址的等价规则 —— 本地部分的大小写与点号无意义、+后缀可忽略',
    steps: [{ fill: { i: 0, text: 'User.Name+Tag@Gmail.com' } }, { wait: 1000 }],
    expect: { text: ['username@gmail.com'] },
  },

  {
    path: '/git-memo',
    name: 'git-memo',
    zhTitle: 'Git 备忘录',
    strategy: 'structural：速查表必须渲染出真实 git 命令条目（关键词是 git 自身的子命令，不是界面文案）',
    steps: [{ wait: 700 }],
    expect: {
      text: ['git'],
      js: `(function(){
        var t = document.querySelector('.tool-content').innerText;
        // 至少要出现几个真实 git 子命令，才算表真的渲染了。
        // 关键词取自 git-memo.content.md 的**实际内容**（该文件自导入以来未改动，
        // 全文只有 config / init / clone / commit / reset / branch 六类命令，
        // **没有 rebase 与 stash**）。原先断言 rebase+stash 是把「我印象里速查表该有的内容」
        // 当成了被测事实 —— 表本身是渲染出来的，只是没有那两条。
        return ['git config', 'git init', 'git clone', 'git commit', 'git reset', 'git branch']
          .filter(function(k){ return t.indexOf(k) >= 0; }).length >= 4;
      })()`,
    },
  },

  {
    path: '/json-minify',
    name: 'json-minify',
    zhTitle: 'JSON 压缩',
    strategy: 'knownVector：压缩 = 去掉所有结构外空白，键值内容与顺序不变',
    steps: [{ fill: { i: 0, text: '{ "a": 1,  "b": [1, 2] }' } }, { wait: 800 }],
    expect: { text: ['{"a":1,"b":[1,2]}'] },
  },

  {
    path: '/json-to-code',
    name: 'json-to-code',
    zhTitle: 'JSON 生成实体类',
    strategy: 'structural：默认语言 TypeScript，根类名可指定，生成结果必须含字段名与原值',
    steps: [
      { fill: { i: 0, text: 'Root' } },
      { fill: { i: 1, text: '[{"id":1,"name":"devbox"}]' } },
      { wait: 1100 },
    ],
    // out 而非 text：生成的类型定义**只有字段名与类型、不含字段值**，
    // 所以 'devbox'（值）本来就不该被期望 —— 原断言能过，纯粹是输入框回显了它。
    // 现在断言真正由输入推导出来的东西：类名、字段名 + 推断出的类型。
    expect: {
      out: ['export interface Root', 'id: number', 'name: string'],
      outRegex: ['(interface|class|type)\\s+Root'],
      not: ['解析失败'],
    },
  },

  {
    path: '/json-to-csv',
    name: 'json-to-csv',
    zhTitle: 'JSON 转 CSV',
    strategy: 'structural：对象数组转 CSV，首行必须是表头（键名按出现顺序），其后每行一条记录',
    steps: [
      { fill: { i: 0, text: '[{"a":1,"b":2},{"a":3,"b":4}]' } },
      { wait: 1000 },
    ],
    expect: { regex: ['a\\s*,\\s*b'], text: ['1', '3'] },
  },

  {
    path: '/json-prettify',
    name: 'json-prettify',
    zhTitle: 'JSON美化和格式化',
    strategy: 'structural：美化 = 每个键值对独占一行且带缩进，键与值之间的冒号后有空格',
    // 必须按 label 定位：该页 DOM 里「Indent size」的 n-input-number 排在 JSON 文本框**前面**，
    // 用序号 0 会写进那个数字框（n-input-number 直接丢弃非法值 → 框被清空），
    // 页面于是继续美化它自己的默认值，看起来就像「功能没反应」。
    steps: [{ fillLabel: { label: 'Your raw JSON', text: '{"a":1,"b":{"c":2}}' } }, { wait: 1000 }],
    // out 而非 text：期望值写成**带空格**的 `"a": 1`，而输入是不带空格的 `"a":1` ——
    // 只有真的美化过才会有这个空格，输入回显永远给不出它。
    expect: { out: ['"a": 1', '"c": 2'], not: ['Invalid'] },
  },

  {
    path: '/linux-commands',
    name: 'linux-commands',
    zhTitle: 'Linux 命令速查',
    strategy: 'structural：搜索后必须命中该命令的真实条目，而不是只把搜索词回显出来',
    steps: [{ fill: { i: 0, text: 'rsync' } }, { wait: 800 }],
    expect: {
      js: `(function(){
        var t = document.querySelector('.tool-content').innerText;
        if (t.indexOf('rsync') < 0) return false;
        // 条目里必然带有 rsync 的真实选项/用法，仅回显搜索词不会有这些
        return /-a|-v|--archive|--delete/.test(t);
      })()`,
    },
  },

  {
    path: '/px-rem-converter',
    name: 'px-rem-converter',
    zhTitle: 'px / rem 转换',
    strategy: 'knownVector：浏览器默认根字号 16px，故 16px 恒等于 1rem',
    // 按 label 定位：该页「根字号」「小数位」两个 n-input-number 都排在「数值」框前面，
    // 序号 0 会写进根字号（被 n-input-number 丢弃 → 根字号变空、数值框始终为空 → 无输出）。
    steps: [{ fillLabel: { label: '数值：', text: '16px' } }, { wait: 800 }],
    expect: { text: ['1rem'] },
  },

  {
    path: '/random-port-generator',
    name: 'random-port-generator',
    zhTitle: '随机端口生成',
    strategy: 'knownVector：动态/私有端口范围是 1024–65535（IANA 端口号分配规范）',
    steps: [{ clickExact: 'Refresh' }, { wait: 800 }],
    expect: {
      js: `(function(){
        var t = document.querySelector('.tool-content').innerText;
        var m = t.match(/\\b(\\d{4,5})\\b/);
        if (!m) return false;
        var n = Number(m[1]);
        return n >= 1024 && n <= 65535;
      })()`,
    },
  },

  {
    path: '/regex-memo',
    name: 'regex-memo',
    zhTitle: '正则表达式速查表',
    strategy: 'structural：速查表必须渲染出真实的 JS 正则语法条目（这些词不属于界面文案）',
    steps: [{ wait: 700 }],
    expect: {
      js: `(function(){
        var t = document.querySelector('.tool-content').innerText;
        return ['lookahead', 'non-capturing', 'anchors', 'Quantifiers'].filter(function(k){
          return t.toLowerCase().indexOf(k.toLowerCase()) >= 0;
        }).length >= 2;
      })()`,
    },
  },

  {
    path: '/regex-tester',
    name: 'regex-tester',
    zhTitle: '正则表达式测试器',
    strategy: 'knownVector：\\d+ 在 abc123def456 上的匹配结果必然是 123 与 456（正则语义事实）',
    steps: [
      { fill: { i: 0, text: '\\d+' } },
      { fill: { i: 1, text: 'abc123def456' } },
      { wait: 1000 },
    ],
    // out 而非 text：123/456 是待匹配文本的子串，而待匹配文本就在输入框里；
    // 只有「匹配结果表」这一列才会把它们单独渲染出来（含命中位置 3 与 9）。
    expect: { out: ['Matches', 'Index in text', '123', '456'], outRegex: ['3\\s+123', '9\\s+456'] },
  },

  {
    path: '/sql-prettify',
    name: 'sql-prettify',
    zhTitle: 'SQL 美化和格式化',
    strategy: 'structural：美化后关键字按主流风格大写，且子句分行',
    steps: [
      { fill: { i: 0, text: 'select a,b from t where x=1' } },
      { wait: 1000 },
    ],
    expect: { regex: ['SELECT'], text: ['FROM', 'WHERE'] },
  },

  {
    path: '/xml-formatter',
    name: 'xml-formatter',
    zhTitle: 'XML 格式化',
    strategy: 'structural：格式化 = 嵌套标签各自换行并缩进，父子标签不再挤在一行',
    // 同 json-prettify：Indent size 的数字框排在 XML 文本框前面，序号 0 会打错控件。
    steps: [{ fillLabel: { label: 'Your XML', text: '<a><b>1</b></a>' } }, { wait: 1000 }],
    expect: {
      js: `(function(){
        var t = document.querySelector('.tool-content').innerText;
        return /<a>\\s*\\n\\s*<b>/.test(t);
      })()`,
    },
  },

  {
    path: '/yaml-prettify',
    name: 'yaml-prettify',
    zhTitle: 'YAML美化和格式化',
    strategy: 'structural：美化不得改变 YAML 的键值语义（b: 2 与 a: 1 必须原样保留）',
    // 三处修正：
    // ① 按 label 定位（Indent size 数字框在文本框之前，序号 0 会打错控件）；
    // ② 原文写的是 'b: 2\\na: 1' —— 在 JS 字符串里那是「反斜杠 + n」两个字符，
    //    送进去的是一行含字面 \n 的 YAML，而不是两行。要的是真换行，写 '\n'。
    // ③ 原输入与美化结果**逐字相同**，于是 text 断言验到的只是输入回显（恒真）。
    //    改为送一个需要规范化的输入（冒号后 3 个空格），断言结果区归一为单空格、
    //    且不得再出现带多空格的原始形式 —— 这两条都只有真的跑过美化才成立。
    steps: [{ fillLabel: { label: 'Your raw YAML', text: 'b:   2\na: 1' } }, { wait: 1000 }],
    expect: { out: ['b: 2'], outNot: ['b:   2'] },
  },

  // ═══════════════════════════ Math（3）═══════════════════════════

  {
    path: '/math-evaluator',
    name: 'math-evaluator',
    zhTitle: '数学计算器',
    strategy: 'knownVector：运算优先级 —— 2+3*4 = 14（不是 20）',
    steps: [{ fill: { i: 0, text: '2+3*4' } }, { wait: 900 }],
    expect: {
      text: ['14'],
      js: `(function(){
        var t = document.querySelector('.tool-content').innerText;
        return t.indexOf('Result') >= 0 && /(^|\\D)14(\\D|$)/.test(t);
      })()`,
    },
  },

  {
    path: '/percentage-calculator',
    name: 'percentage-calculator',
    zhTitle: '百分比计算器',
    strategy: 'knownVector：25% of 200 = 50（百分比定义：200 × 25 / 100）',
    // data-test-id 落在组件的**根元素**上（n-input-number / c-input-text 都是 div 包裹），
    // 不是里面那个真正的 <input>：直接对 div 调 setVal 只会给 div 挂个无用的 value 属性，
    // 不触发任何 input 事件，表现是「步骤全绿但控件里什么都留不下」。必须再往下一层取 input。
    steps: [
      {
        js: `(function(){
          var S = window.__smoke;
          function set(id, v){
            var box = document.querySelector('.tool-content [data-test-id="' + id + '"]');
            if (!box) return false;
            var el = box.tagName === 'INPUT' ? box : box.querySelector('input');
            if (!el) return false;
            S.setVal(el, v);
            return true;
          }
          if (!set('percentageX', '25')) return 'percentageX 输入框未找到';
          if (!set('percentageY', '200')) return 'percentageY 输入框未找到';
          return null;
        })()`,
      },
      { wait: 1000 },
    ],
    expect: {
      js: `(function(){
        var box = document.querySelector('.tool-content [data-test-id="percentageResult"]');
        var el = box && (box.tagName === 'INPUT' ? box : box.querySelector('input'));
        return !!el && String(el.value).trim() === '50';
      })()`,
    },
  },

  {
    path: '/eta-calculator',
    name: 'eta-calculator',
    zhTitle: 'ETA 计算器',
    // 结束时刻依赖「当前时间」，不可能写死期望值；这条只做结构与可用性断言
    // （表单字段齐、能算出结果、结果是格式化时间而非报错）。
    strategy: 'structural（无固定期望值）：结束时刻依赖当前时间，故只验证字段齐备且算出合法时间',
    steps: [{ wait: 800 }],
    expect: {
      text: ['Amount of element to consume', 'Total duration', 'It will end'],
    },
  },

  // ═══════════════════════ Network（9）═══════════════════════

  {
    path: '/http-status-checker',
    name: 'http-status-checker',
    zhTitle: 'HTTP 状态码检测',
    // 依赖 /api/webstatus，本地 dev / 静态预览必然失败 —— 线上跑才有效。
    // 它的「失败态 UI」在 A3 专项里用 CDP Fetch 域注入 500 单独验。
    onlineOnly: true,
    strategy: 'knownVector（线上）：example.com 必然返回 200，页面应展示状态码 200 与响应头',
    // 修正（线上首跑发现）：该组件**不自动检测**，check() 只由按钮 @click / 回车触发。
    // 原先只有「填值 + 等 4s」，从没点过按钮 —— 页面上永远不会有结果（假失败）。
    // 同时把断言从 text(regex '200') 收紧为「状态码 200 + 真实响应头」，两者都只可能来自接口。
    steps: [
      { fill: { i: 0, text: 'example.com' } },
      { click: '检测状态码' },
      // scope 限定到工具区：状态区的文案不能靠整页里同名的说明文字满足
      { waitText: { text: '响应头（', ms: 15000, scope: '.tool-content' } },
    ],
    expect: {
      out: ['状态码', '响应头'],
      outRegex: ['\\b200\\b', 'content-type'],
      outNot: ['检测失败'],
      not: ['Failed to fetch'],
    },
  },

  {
    path: '/ipv4-address-converter',
    name: 'ipv4-address-converter',
    zhTitle: 'Ipv4地址转换器',
    strategy: 'knownVector：192.168.1.1 的二进制形式是四个字节的直接展开（192=11000000 等），32 位无歧义',
    steps: [{ fill: { i: 0, text: '192.168.1.1' } }, { wait: 900 }],
    expect: { text: ['11000000101010000000000100000001'] },
  },

  {
    path: '/ipv4-range-expander',
    name: 'ipv4-range-expander',
    zhTitle: 'IPv4范围扩展器',
    strategy: 'structural：给定起止地址，展开结果必须给出覆盖该区间的 CIDR（192.168.1.1–1.3 → 192.168.1.0/30）',
    steps: [
      { fill: { i: 0, text: '192.168.1.1' } },
      { fill: { i: 1, text: '192.168.1.3' } },
      { wait: 1000 },
    ],
    // out 而非 text：两端的 192.168.1.1 / .3 就是输入框里的字（恒真）。
    // 改成断言**推导值**：区间 1–3 需要 4 个地址，对齐后必然是 192.168.1.0/30
    // —— 这个字符串输入里没有，只有真算过才会出现。
    expect: { out: ['Addresses in range', '192.168.1.0/30'] },
  },

  {
    path: '/ipv4-subnet-calculator',
    name: 'ipv4-subnet-calculator',
    zhTitle: 'IPv4子网计算器',
    // 192.168.1.10/24 的这三个值都是位运算事实：网络地址抹掉主机位、掩码 24 位全 1、广播地址主机位全 1。
    strategy: 'knownVector：192.168.1.10/24 → 网络号 192.168.1.0、掩码 255.255.255.0、广播 192.168.1.255',
    steps: [{ fill: { i: 0, text: '192.168.1.10/24' } }, { wait: 1000 }],
    expect: { text: ['192.168.1.0', '255.255.255.0', '192.168.1.255'] },
  },

  {
    path: '/ipv6-ula-generator',
    name: 'ipv6-ula-generator',
    zhTitle: 'IPv6 ULA生成器',
    strategy: 'knownVector：ULA 本地地址前缀固定落在 fd00::/8，故生成结果必须以 fd 开头（RFC 4193）',
    steps: [{ fill: { i: 0, text: '00:50:56:11:22:33' } }, { wait: 1000 }],
    expect: {
      js: `(function(){
        // 生成结果落在只读 <input> 里，而 innerText **不含** 表单控件的值 ——
        // 用 innerText 断言会得到「功能正常但一个字都读不到」的假失败。
        // __smokeText = 页面 innerText + 全部 input/textarea/select 的值。
        var t = (window.__smokeText || document.querySelector('.tool-content').innerText).toLowerCase();
        return /(^|[^0-9a-f])fd[0-9a-f]{2}:/.test(t);
      })()`,
    },
  },

  {
    path: '/mac-address-generator',
    name: 'mac-address-generator',
    zhTitle: 'MAC 地址生成器',
    strategy: 'structural：给定前缀后，生成的地址必须以前缀开头，且补齐为 6 组十六进制（分隔符可配置）',
    // 按 label 定位：DOM 里「Quantity」的 n-input-number 排在前缀框前面，
    // 序号 0 会把它写坏（n-input-number 丢弃非法值 → Quantity 变空 → 一条地址都不生成）。
    // 前缀取一个不易碰巧重复的值，让「以前缀开头」这条断言真的有鉴别力。
    steps: [{ fillLabel: { label: 'MAC address prefix:', text: 'DE:AD:BE' } }, { wait: 900 }],
    expect: {
      js: `(function(){
        var t = (window.__smokeText || document.querySelector('.tool-content').innerText).toUpperCase();
        return /DE[:\\-.]AD[:\\-.]BE[:\\-.][0-9A-F]{2}[:\\-.][0-9A-F]{2}[:\\-.][0-9A-F]{2}/.test(t);
      })()`,
    },
  },

  {
    path: '/mac-address-lookup',
    name: 'mac-address-lookup',
    zhTitle: 'MAC地址查找',
    // 00:50:56 是 IEEE 分配给 VMware 的 OUI（公开的注册事实，与本站实现无关）。
    strategy: 'knownVector：00:50:56 是 VMware 的 IEEE OUI，查询必须识别出厂商',
    // ⚠ 这里**不能用固定 wait**：OUI 数据是 3.46MB 的独立 chunk，按需动态 import，
    // 线上首次访问要现下（本地 --serve-dist 读磁盘秒读，所以本地一直过）。
    // 实测线上单跑三次：FAIL / OK / FAIL —— 固定 1100ms 等的是一个「下载完没有」的赌局，
    // 判据实际测的是网速而不是工具能力。改为**有界条件等待**：等到结果区（.tool-content）
    // 真的出现厂商名。首次线上跑观测到 8.9s / 17.1s / 11.2s / 22.2s 的波动（3.46MB chunk
    // 在 CF 边缘冷启动下载耗时不稳定），故上限放到 45s 留足余量；超时才算真失败。
    // （scope 必须写 .tool-content：整页文本里工具说明处也可能出现厂商名。）
    steps: [
      { fill: { i: 0, text: '00:50:56:11:22:33' } },
      { waitText: { text: 'VMware', scope: '.tool-content', ms: 45000 } },
    ],
    expect: { regex: ['VMware'] },
  },

  {
    path: '/today-in-history',
    name: 'today-in-history',
    zhTitle: '历史上的今天',
    onlineOnly: true,
    // 修正（线上首跑发现）：数据集只收录了 29 个日期（见 functions/api/today.js），
    // 于是「当日必须有条目」这条断言一年里有 336 天必然失败 —— 是断言依赖数据，
    // 不是页面缺陷。改成认**两种合法态**：有收录则必须渲染出带年份的事件；
    // 未收录则必须给出空态说明。唯一不允许的是加载失败。
    strategy: 'structural（线上）：当日有收录→必须渲染带年份的事件；未收录→必须有空态说明；都不许是加载失败',
    steps: [
      // 等「加载完成」的**元素**而不是固定 sleep：数据集非空 → 渲染事件卡片；
      // 数据集为空（本数据集只覆盖 29/365 天）→ 渲染提示 alert。两种都算加载完成。
      { waitSel: { sel: '.tool-content .c-alert, .tool-content .c-card, .tool-content .n-card', ms: 12000 } },
    ],
    expect: {
      // 返回 true 通过；返回**非空字符串**即失败并把原因打出来（引擎的 js 约定）
      js: `(function(){
        var t = document.querySelector('.tool-content').innerText;
        if (/加载失败|Failed to fetch|服务返回/.test(t)) return '接口失败：' + t.slice(0, 160);
        var hasEvents = /\\b(1[0-9]{3}|20[0-9]{2})\\b/.test(t);
        var emptyState = /暂无收录|没有查到历史事件/.test(t);
        if (hasEvents || emptyState) return true;
        return '既没有事件也没有空态说明：' + t.slice(0, 160);
      })()`,
      outNot: ['加载失败'],
      not: ['Failed to fetch'],
    },
  },

  {
    path: '/whois-lookup',
    name: 'whois-lookup',
    zhTitle: 'WHOIS 查询',
    onlineOnly: true,
    strategy: 'structural（线上）：查询 example.com（IANA 保留的示例域）必须返回注册信息（RDAP 字段）',
    // 修正（线上首跑发现，且是个**假通过**）：该组件同样必须点按钮才查，
    // 原用例只有「填值 + 等 5s」，查询从未发生；而原断言 text:['example.com']
    // 又被自己填进输入框的那串字符满足 —— 功能好坏都会绿。
    // 现在：补点击，断言改为 RDAP 结果里的真实字段名（注册商/到期时间），
    // 它们只可能来自接口返回的 raw 文本。
    steps: [
      { fill: { i: 0, text: 'example.com' } },
      { click: '查询 WHOIS' },
      // 等**元素**而不是等文案：'注册信息' 这四个字在工具页的「使用说明」里也有，
      // 而说明在 .tool-content 之外 —— 等文案会被它立刻满足，请求却还在飞
      // （实测线上：3s 后断言，按钮停在「查询中…」）。结果区只在成功时渲染。
      { waitSel: { sel: '.tool-content [data-test-id="area-content"]', ms: 15000 } },
    ],
    expect: {
      out: ['注册信息', '注册商', '到期时间'],
      outNot: ['查询失败'],
      not: ['Failed to fetch'],
    },
  },

  // ═══════════════════════════ Data（2）═══════════════════════════

  {
    path: '/iban-validator-and-parser',
    name: 'iban-validator-and-parser',
    zhTitle: 'IBAN验证器和解析器',
    // DE89 3704 0044 0532 0130 00 是 ISO 13616 里最常被引用的德国示例 IBAN，MOD-97 校验位合法。
    strategy: 'knownVector：DE89370400440532013000 是合法的德国 IBAN，解析结果必须产出结构化字段',
    steps: [{ fill: { i: 0, text: 'DE89370400440532013000' } }, { wait: 1000 }],
    expect: {
      text: ['DE'],
      js: `!!document.querySelector('.tool-content [data-test-id="iban-info"]')`,
    },
  },

  {
    path: '/phone-parser-and-formatter',
    name: 'phone-parser-and-formatter',
    zhTitle: '电话分析器和格式化程序',
    // +86 是中国大陆的国际电话区号，138 段是中国移动号段（E.164 与公开号段事实）。
    strategy: 'knownVector：+86 是中国大陆区号，带 +86 的号码必须被解析出国家 China',
    steps: [{ fill: { i: 0, text: '+8613800138000' } }, { wait: 1300 }],
    expect: { regex: ['China'], not: ['Unknown'] },
  },

  // ═════════════════════ Images and videos（4）════════════════════

  {
    path: '/camera-recorder',
    name: 'camera-recorder',
    zhTitle: '摄像机记录器',
    mountTimeout: 20000,
    // 摄像头需要真实设备授权，无头环境拿不到 MediaStream。这条只做挂载层：
    // 页面结构齐、组件没抛异常。真实设备路径（--use-fake-device-for-media-stream、录制出 blob）
    // 属于 A3 专项，与 A1 的「全站可用性」口径分开记。
    strategy: 'structural（挂载层 + 环境受限）：无头环境无摄像头，只验证 UI 结构完整且无未捕获异常',
    steps: [{ wait: 1800 }],
    expect: {
      text: ['Video:', 'Audio:'],
      not: ['is not a function', 'Cannot read properties of undefined'],
    },
  },

  {
    path: '/qrcode-generator',
    name: 'qrcode-generator',
    zhTitle: '二维码生成器',
    strategy: 'realInput：二维码是图片产物 —— 必须真的解码出一张非平凡位图（不能靠文本断言）',
    steps: [{ fill: { i: 0, text: 'https://digdevbox.com' } }, { wait: 1400 }],
    // 本工具走 QRCode.toDataURL() → <n-image> 即 <img src="data:image/png;base64,...">。
    // 页面上没有 canvas，用 canvasNonBlank 会得到 {"count":0} 的假失败。
    expect: { imageData: true },
  },

  {
    path: '/svg-placeholder-generator',
    name: 'svg-placeholder-generator',
    zhTitle: 'SVG 占位符生成器',
    strategy: 'structural：占位图是 SVG 产物，输出必须是可解析的 <svg> 元素（含 width/height 属性）',
    steps: [{ wait: 1200 }],
    expect: {
      text: ['<svg'],
      js: `(function(){
        var t = document.querySelector('.tool-content').innerText;
        return /<svg[^>]*width/.test(t) && /height/.test(t);
      })()`,
    },
  },

  {
    path: '/wifi-qrcode-generator',
    name: 'wifi-qrcode-generator',
    zhTitle: 'WiFi 二维码生成器',
    // WiFi 二维码的载荷格式是 WIFI:S:<ssid>;T:<type>;P:<pass>;;（通行约定），
    // 但不同实现渲染方式不同，这里只断言「填好必填项后真的出图」。
    strategy: 'realInput：填入 SSID + 密码后必须解码出二维码位图（payload 文本格式因实现而异，不锁死）',
    // 必须同时给密码：该工具的载荷生成逻辑（useQRCode.ts 的 getQrCodeText）在
    //   「加密方式既不是 nopass 也不是 WPA2-EAP，且**没有 password**」时直接 return null，
    // 于是 qrcode 为空、<img> 整块不渲染，而且**界面不给任何提示**（静默空状态）。
    // 这是它的既定行为（无密码的 WPA 网络没有意义），不是缺陷；但只填 SSID 的用例会得到假失败。
    steps: [
      {
        js: `(function(){
          var S = window.__smoke;
          var ssid = document.querySelector('.tool-content input[placeholder*="SSID"]');
          if (!ssid) return 'SSID 输入框未找到';
          S.setVal(ssid, 'DigDevBox-Smoke');
          var pwd = document.querySelector('.tool-content input[type="password"]');
          if (!pwd) return '密码输入框未找到';
          S.setVal(pwd, 'smoke-pass-123');
          return null;
        })()`,
      },
      { wait: 1600 },
    ],
    // 同 qrcode-generator：产物是 data-URL 的 <img>，页面上没有 canvas，canvasNonBlank 是假失败判据。
    expect: { imageData: true },
  },

  // ═══════════════════════ Measurement（4）═══════════════════════

  {
    path: '/benchmark-builder',
    name: 'benchmark-builder',
    zhTitle: '基准生成器',
    // values 是动态列表（默认已有初始值），这里只改 suite 名 —— 目的是验证
    // 「改名会驱动统计表重算」，而不是自己造一套基准数据。
    strategy: 'structural：改了 suite 名之后，统计输出区必须跟着更新并给出统计量',
    steps: [
      {
        js: `(function(){
          var S = window.__smoke;
          var el = document.querySelector('.tool-content input[placeholder*="Suite name"]');
          if (!el) return 'Suite name 输入框未找到';
          S.setVal(el, 'Smoke');
          return null;
        })()`,
      },
      { wait: 1200 },
    ],
    expect: {
      text: ['Smoke'],
      js: `(function(){
        var t = document.querySelector('.tool-content').innerText.toLowerCase();
        // 该工具统计表的列是 POSITION / SUITE / SAMPLES / MEAN / VARIANCE（组件里写死的表头）。
        // 原断言列的是 mean/median/min/max —— 后三个这个工具压根不显示，属「凭印象写期望」，
        // 于是「表算对了也判失败」。改成实际存在的两列，并要求表里真的出现算好的数值与改名后的 suite。
        if (['mean', 'variance'].filter(function(k){ return t.indexOf(k) >= 0; }).length < 2) return false;
        return /\\d/.test(t) && /smoke/.test(t);
      })()`,
    },
  },

  {
    path: '/chronometer',
    name: 'chronometer',
    zhTitle: '计时器',
    // 期望值取「计时器语义」：跑 1.3 秒后停止，读数必须 ≥ 1 秒。
    // 不锁死具体格式与数值（那是实现细节），只锁「真的在计时」。
    strategy: 'realInput：Start → 等待 → Stop，读数必须真的走过至少 1 秒',
    steps: [
      { clickExact: 'Start' },
      { wait: 1400 },
      { clickExact: 'Stop' },
      { wait: 400 },
    ],
    expect: {
      js: `(function(){
        var d = document.querySelector('.tool-content .duration');
        if (!d) return false;
        var t = d.innerText.trim();
        var m = t.match(/(\\d{1,2}):(\\d{2}):(\\d{2})/);
        if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) >= 1;
        // 没有冒号格式，就退化为「读数不等于零」
        return /[1-9]/.test(t);
      })()`,
    },
  },

  {
    path: '/temperature-converter',
    name: 'temperature-converter',
    zhTitle: '温度转换器',
    // 输入框顺序由组件里 units 的定义顺序决定：kelvin, celsius, fahrenheit, ...
    // 填第 2 个（Celsius）为 100，水的沸点恒为 212°F。
    strategy: 'knownVector：100°C = 212°F（冰点/沸点的定义换算，与实现无关）',
    steps: [{ fill: { i: 1, text: '100' } }, { wait: 1000 }],
    expect: { regex: ['212'] },
  },

  {
    path: '/unit-converter',
    name: 'unit-converter',
    zhTitle: '单位换算',
    // 默认类别与默认源单位由组件定义，这里不假定具体是哪一个，
    // 只要求「给出数值后必须产出非空换算结果」。
    strategy: 'realInput：给出数值后必须产出非空换算结果（类别与单位取自默认选择）',
    // 这里必须用页内的 setVal，不能用引擎的 `fill` 步骤：
    // 该数值框是 naive-ui 的 n-input-number，而 `fill` 会「先清空、再写入、最后 blur」，
    // 那串动作会把它的模型打成 null（先前的失败留证：controlValues 为空、结果区整个不渲染），
    // 第二次写入不生效。setVal 直接写值 + 派发 input，n-input-number 能正常接收
    // （percentage-calculator 用同一条路径是通的）。
    steps: [
      {
        js: `(function(){
          var S = window.__smoke;
          var el = document.querySelector('.tool-content input[placeholder="数值"]');
          if (!el) return '数值输入框未找到';
          S.setVal(el, '2');
          return null;
        })()`,
      },
      { wait: 1000 },
    ],
    expect: {
      text: ['换算结果：'],
      js: `(function(){
        // 输出走 TextareaCopyable → 渲染成 <n-code data-test-id="area-content">，
        // **不是 <textarea>**（原断言按 textarea 找，必然拿不到）。
        var out = document.querySelector('.tool-content [data-test-id="area-content"]');
        if (!out) return false;
        var t = out.innerText;
        // 默认 category=长度、fromUnit=米（组件里 ref/FACTORS 的取值）。
        // 输入 2 米 → 基准行必须是「米（输入）: 2」，且不是只有这一行。
        return t.indexOf('米（输入）: 2') >= 0 && t.split('\\n').length >= 3;
      })()`,
    },
  },
];
