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
    // 摘要渲染在**只读 input** 里（InputCopyable），不是 innerText —— 所以这里不能用
    // waitText（它只读 .tool-content.innerText，永远等不到摘要，我上一版就犯了这个通道错配）。
    // 填充是否落地已由引擎在 applyExample 步骤内验（点完必须看到主输入从空变非空，
    // 否则重试到第三次再判红），这里只留一小段等摘要计算与渲染的时间。
    steps: [{ applyExample: true }, { wait: 250 }],
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
    strategy: 'roundTrip：生成 htpasswd 行 → 送到校验区 → 必须报「Password matches」（应用自己的两个方向互证）',
    steps: [
      { fillLabel: { label: 'Username:', text: 'admin' } },
      { fillLabel: { label: 'Password:', text: 'secret' } },
      { clickExact: 'Generate' },
      { waitText: { text: 'Generated line', ms: 4000, scope: '.tool-content' } },
      { clickExact: 'Send to verifier' },
      { wait: 400 },
      { clickExact: 'Verify' },
      { waitText: { text: 'Password matches', ms: 4000, scope: '.tool-content' } },
    ],
    // 往返互证：生成出的 apr1 行 → 喂给同页校验区 → 必须报「Password matches」。
    // Send to verifier 只在 generated 存在时才渲染，所以 waitText 'Generated line' 是这一步的前置条件。
    expect: { out: ['admin:$apr1$', 'Password matches'], outNot: ['Password does not match'] },
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
    path: '/image-resize',
    name: 'image-resize',
    category: 'Images and videos',
    zhTitle: '图片尺寸调整',
    tier: 'io',
    strategy: '真重采样断言：上传 1200x630 夹具 → 填目标宽 600（锁比例应自动算出高 315）→ 点提交 → 读回 <img> 的 naturalWidth/Height 必须精确等于 600x315，且产物是 blob 且非空。只验结果区出现会漏掉图像层静默不执行',
    steps: [
      { upload: { i: 0, file: 'scripts/smoke-fixtures/photo-sample.jpg' } },
      { waitSel: { sel: '[data-test-id="source-info"]', ms: 10000 } },
      {
        js: `(function(){
          var el = document.querySelector('[data-test-id="source-info"]');
          var txt = el ? el.textContent : '';
          if (txt.indexOf('1200') === -1 || txt.indexOf('630') === -1) return '源图信息未显示真实尺寸: ' + txt.slice(0, 80);
          return null;
        })()`,
      },
      { fill: { sel: '[data-test-id="target-width"] .n-input__input-el', text: '600' } },
      { wait: 400 },
      {
        js: `(function(){
          var h = document.querySelector('[data-test-id="target-height"] .n-input__input-el');
          if (!h) return '找不到高度输入框';
          if (String(h.value) !== '315') return '锁定宽高比未自动换算高度，实际=' + h.value;
          return null;
        })()`,
      },
      { clickSel: '[data-test-id="resize-submit"]' },
      { waitSel: { sel: '[data-test-id="resize-output"]', ms: 20000 } },
      {
        js: `(function(){
          var img = document.querySelector('[data-test-id="resize-output"]');
          if (!img) return '结果图缺失';
          if (img.naturalWidth !== 600 || img.naturalHeight !== 315) {
            return '输出尺寸不是 600x315，实际=' + img.naturalWidth + 'x' + img.naturalHeight;
          }
          var a = document.querySelector('[data-test-id="resize-download"]');
          var link = a ? a.closest('a') : null;
          if (!link || (link.href || '').indexOf('blob:') !== 0) return '下载链接不是 blob 产物';
          if (!/\.(png|jpg|jpeg|webp)$/.test(link.getAttribute('download') || '')) return '下载文件名没有正确扩展名';
          return null;
        })()`,
      },
    ],
  },
  {
    path: '/image-compress',
    name: 'image-compress',
    category: 'Images and videos',
    zhTitle: '图片压缩',
    tier: 'io',
    strategy: '真压缩量化断言：上传 75KB 夹具 → 设目标体积 20KB → 压缩 → 产物必须 < 源体积的 90%（即降幅≥10%）且 blob 头为 JPEG/RIFF-WEBP 魔数、扩展名与真实类型一致。只验结果出现等于没测',
    steps: [
      { upload: { i: 0, file: 'scripts/smoke-fixtures/photo-sample.jpg' } },
      { waitSel: { sel: '[data-test-id="source-info"]', ms: 10000 } },
      { fill: { sel: '[data-test-id="target-kb"] .n-input__input-el', text: '20' } },
      { wait: 300 },
      { clickSel: '[data-test-id="compress-submit"]' },
      { waitSel: { sel: '[data-test-id="compress-result"]', ms: 25000 } },
      {
        js: `(function(){
          var link = document.querySelector('[data-test-id="compress-download"]');
          link = link ? link.closest('a') : null;
          if (!link) return '下载链接缺失';
          if ((link.href || '').indexOf('blob:') !== 0) return '产物不是 blob';
          var x = new XMLHttpRequest();
          x.open('GET', link.href, false);
          x.overrideMimeType('text/plain; charset=x-user-defined');
          x.send();
          var raw = x.responseText || '';
          if (raw.length < 1000) return '产物仅 ' + raw.length + ' 字节，疑似空文件';
          var b = function (i) { return raw.charCodeAt(i) & 0xff; };
          var isJpeg = b(0) === 0xFF && b(1) === 0xD8;
          var riff = String.fromCharCode(b(0), b(1), b(2), b(3)) === 'RIFF'
                  && String.fromCharCode(b(8), b(9), b(10), b(11)) === 'WEBP';
          if (!isJpeg && !riff) return '产物不是合法 JPEG/WebP，头=' + b(0) + ',' + b(1);
          var name = link.getAttribute('download') || '';
          var extOk = (isJpeg && /\.(jpg|jpeg)$/.test(name)) || (riff && /\.webp$/.test(name));
          if (!extOk) return '扩展名与真实编码类型不符: ' + name;
          // 不解析 UI 文案（脆且无必要）：直接拿产物字节数对比夹具真实大小 75234 B，
          // 断言至少 10% 的可测降幅 —— 图像层静默不执行时产物会接近或超过原大小，必红。
          var SOURCE_BYTES = 75234;
          if (raw.length >= SOURCE_BYTES * 0.9) {
            return '压缩未产生 ≥10% 可测收益: 夹具 ' + SOURCE_BYTES + 'B → 产物 ' + raw.length + 'B';
          }
          return null;
        })()`,
      },
    ],
  },
  {
    path: '/pdf-signature-checker',
    name: 'pdf-signature-checker',
    category: 'Crypto',
    zhTitle: 'PDF签名检查器',
    tier: 'io',
    strategy: 'fileUpload：注入结构合规的未签名 PDF，断言给出「未签名」结论，'
      + '且必须自带「未签名 ≠ 被篡改」的区分句（任务2 把混报错当缺陷修掉了，文案与语义一起跟上新版）',
    // 旧版那句 "No signatures found in the provided file." 把「没有签名」和「读不出来」混成一式，
    // 55ce4f5 之后 UI 改成标题给结论 + 正文显式声明这本身不代表篡改。
    // 这里既断新文案在，也断旧文案**不再出现** —— 退回去就会红，而不是静默共存。
    steps: [{ upload: { i: 0, file: 'scripts/smoke-fixtures/unsigned.pdf' } }, { wait: 2500 }],
    expect: {
      text: ['No digital signature found', 'does not, by itself, indicate tampering'],
      not: ['No signatures found in the provided file.'],
    },
  },

  {
    path: '/pdf-merge',
    name: 'pdf-merge',
    category: 'Crypto',
    zhTitle: 'PDF 合并',
    tier: 'io',
    strategy: '真合并断言：一次上传 2 个 PDF（按钮启用条件 files.length>=2）→ 断言「2 files selected」文案 → 点 Merge PDFs → 同步读回 blob 验 %PDF- 头与字节下界',
    steps: [
      { upload: { i: 0, file: ['scripts/smoke-fixtures/unsigned.pdf', 'scripts/smoke-fixtures/photo-pages.pdf'] } },
      { waitText: { text: '2 files selected', scope: '.tool-content', ms: 8000 } },
      {
        js: `(function(){
          var b = [].slice.call(document.querySelectorAll('.tool-content button'))
            .find(function(x){ return /merge pdfs/i.test(x.innerText); });
          if (!b) return '找不到 Merge PDFs 按钮';
          if (b.disabled) return '两个文件已登记但按钮仍禁用';
          return null;
        })()`,
      },
      { click: 'Merge PDFs' },
      { waitSel: { sel: 'a[download="merged.pdf"]', ms: 20000 } },
      {
        js: `(function(){
          var a = document.querySelector('a[download="merged.pdf"]');
          if (!a) return '下载锚点缺失';
          if ((a.href || '').indexOf('blob:') !== 0) return 'href 不是 blob，产物未真正生成：' + a.href;
          var x = new XMLHttpRequest();
          x.open('GET', a.href, false);
          x.overrideMimeType('text/plain; charset=x-user-defined');
          x.send();
          var raw = x.responseText || '';
          var u = { length: raw.length, at: function (k) { return raw.charCodeAt(k) & 0xff; } };
          if (u.length < 900) return '合并结果仅 ' + u.length + ' 字节，小于两个输入的量级';
          var head = String.fromCharCode(u.at(0),u.at(1),u.at(2),u.at(3),u.at(4));
          if (head !== '%PDF-') return '合并结果不是 PDF 头：' + head;
          return null;
        })()`,
      },
    ],
  },
  {
    path: '/pdf-split',
    name: 'pdf-split',
    category: 'Crypto',
    zhTitle: 'PDF 拆分',
    tier: 'io',
    strategy: '真拆分断言：上传 3 页夹具 → 断言工具自己数出「has 3 pages」（证明真的解析了 PDF）→ 点 Split PDF → 至少 1 个 blob 下载项且 %PDF- 头正确。末尾再传 1 页夹具验**单数形态**（"has 1 page."，不是 "1 pages."）——这条是复数缺陷 a49276b 的回归锁',
    steps: [
      { upload: { i: 0, file: 'scripts/smoke-fixtures/photo-pages.pdf' } },
      { waitText: { text: 'has 3 pages', scope: '.tool-content', ms: 10000 } },
      { click: 'Split PDF' },
      { waitSel: { sel: '.tool-content a[download]', ms: 20000 } },
      {
        js: `(function(){
          var as = [].slice.call(document.querySelectorAll('.tool-content a[download]'));
          if (!as.length) return '拆分后没有任何下载项';
          var blobs = as.filter(function(a){ return (a.href || '').indexOf('blob:') === 0; });
          if (!blobs.length) return '有下载项但都不是 blob 产物';
          var x = new XMLHttpRequest();
          x.open('GET', blobs[0].href, false);
          x.overrideMimeType('text/plain; charset=x-user-defined');
          x.send();
          var raw = x.responseText || '';
          var u = { length: raw.length, at: function (k) { return raw.charCodeAt(k) & 0xff; } };
          if (u.length < 300) return '首个产物仅 ' + u.length + ' 字节';
          var head = String.fromCharCode(u.at(0),u.at(1),u.at(2),u.at(3),u.at(4));
          if (head !== '%PDF-') return '首个产物不是 PDF 头：' + head;
          return null;
        })()`,
      },
      // —— 单数形态回归锁（a49276b 修的就是这个）——
      // 必须带句点：'has 1 page' 是 'has 1 pages' 的前缀，用它会永远为真（假绿）。
      { upload: { i: 0, file: 'scripts/smoke-fixtures/one-page.pdf' } },
      { waitText: { text: 'has 1 page.', scope: '.tool-content', ms: 10000 } },
    ],
  },
  {
    path: '/pdf-watermark',
    name: 'pdf-watermark',
    category: 'Crypto',
    zhTitle: 'PDF 水印',
    tier: 'io',
    strategy: '真水印断言：上传 + 填水印文本 → Apply watermark → 读回 blob 验 %PDF- 头，并要求产物严格大于输入 595 字节（否则说明内容没写进去）',
    steps: [
      { upload: { i: 0, file: 'scripts/smoke-fixtures/unsigned.pdf' } },
      { fill: { sel: '.tool-content input[placeholder="e.g. CONFIDENTIAL"]', text: 'CONFIDENTIAL' } },
      {
        js: `(function(){
          var el = document.querySelector('.tool-content input[placeholder="e.g. CONFIDENTIAL"]');
          if (!el) return '找不到水印文本框';
          if (el.value !== 'CONFIDENTIAL') return '文本未真正写入模型，实际值=' + JSON.stringify(el.value);
          return null;
        })()`,
      },
      { click: 'Apply watermark' },
      { waitSel: { sel: 'a[download="watermarked.pdf"]', ms: 20000 } },
      {
        js: `(function(){
          var a = document.querySelector('a[download="watermarked.pdf"]');
          if (!a) return '下载锚点缺失';
          if ((a.href || '').indexOf('blob:') !== 0) return 'href 不是 blob';
          var x = new XMLHttpRequest();
          x.open('GET', a.href, false);
          x.overrideMimeType('text/plain; charset=x-user-defined');
          x.send();
          var raw = x.responseText || '';
          var u = { length: raw.length, at: function (k) { return raw.charCodeAt(k) & 0xff; } };
          var head = String.fromCharCode(u.at(0),u.at(1),u.at(2),u.at(3),u.at(4));
          if (head !== '%PDF-') return '产物不是 PDF 头：' + head;
          if (u.length <= 595) return '产物 ' + u.length + ' 字节未超过输入 595 字节，水印可能没写进去';
          return null;
        })()`,
      },
    ],
  },
  {
    path: '/pdf-compress',
    name: 'pdf-compress',
    category: 'Crypto',
    zhTitle: 'PDF 压缩器',
    tier: 'io',
    strategy: '真压断言：上传 3 页含 75KB JPEG 的夹具 PDF（photo-pages.pdf），点 data-test-id=compress-btn（locale 无关；smoke 按 en 渲染，按中文文案点必假失败），等 .tool-content 出现 After 行后解析 Before/After 体积，必须降 ≥10%——只验链路会漏掉图像层未执行类回归',
    steps: [
      { upload: { i: 0, file: 'scripts/smoke-fixtures/photo-pages.pdf' } },
      { clickSel: '[data-test-id="compress-btn"]' },
      { waitText: { text: 'After:', scope: '.tool-content', ms: 10000 } },
    ],
    expect: {
      text: ['compressed.pdf'],
      js: `(function(){
        var t = (document.querySelector('.tool-content') || {}).innerText || '';
        var b = /Before:\\s*([\\d.]+)\\s*(B|KB|MB)/.exec(t);
        var a = /After:\\s*([\\d.]+)\\s*(B|KB|MB)/.exec(t);
        if (!b || !a) return 'NO-LINES';
        var mult = { B: 1, KB: 1024, MB: 1048576 };
        var bv = parseFloat(b[1]) * mult[b[2]], av = parseFloat(a[1]) * mult[a[2]];
        return av < bv * 0.9 ? true : 'NO-SHRINK before=' + bv + ' after=' + av;
      })()`,
    },
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
    path: '/password-generator',
    name: 'password-generator',
    category: 'Crypto',
    zhTitle: '密码生成器',
    tier: 'io',
    strategy: 'differential+exclusion：初始密码非空可打印；刷新后必须变值；且不含易混淆字符（默认排除 I l 1 O 0 o）',
    steps: [
      { wait: 500 },
      {
        js: `(function(){
          var S = window.__smoke;
          var t = S.controls().find(function(e){ return e.value && e.value.length >= 8; });
          if (!t) return '没找到 password 输出';
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
        return t.value !== window.__t1 && /^[\\x21-\\x7e]+$/.test(window.__t1) && !/[Il1O0o]/.test(window.__t1);
      })()`,
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
    strategy: 'reference：搜已知码位 65，必须出现 0x41 与对应说明（随界面英文化，原期望值「大写字母 A 起始」对应页面特例分支 Start of uppercase A-Z，而不是 Uppercase letter A）',
    steps: [{ fill: { i: 0, text: '65' } }, { wait: 500 }],
    expect: { out: ['0x41', 'Start of uppercase A-Z'] },
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
      js: '(function(){ var c = document.getElementById(\'previewContainer\'); return !!c && !!c.querySelector(\'img\'); })()',
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
    // 原来这里还有 regex:['1681333824'] —— 引擎判为空转：那串数字是我自己填进输入框的值，
    // 整页文本必然含它，功能好坏都会绿。秒值交给毫秒行去反证（×1000 只有真换算才成立）。
    expect: { outRegex: ['1681333824000'], text: ['Unix timestamp', 'Timestamp', 'UTC format'], not: ['Invalid date...'] },
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
    strategy: 'knownVector：全角 ＡＢＣ１２３ 的码点比半角大 0xFEE0，切到「Full-width → Half-width」后必须是 ABC123（U+FF01–FF5E 全部落回 ASCII）',
    steps: [
      { applyExample: true },
      { wait: 700 },
      // 默认模式是「Half-width → Full-width」，对全角示例是恒等变换 —— 必须显式切到反方向才验得到转换。
      { click: 'Full-width → Half-width' },
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
      js: '!!document.querySelector(\'.tool-content .monaco-editor\')',
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
      { fillLabel: { label: 'Find:', text: 'name=' } },
      { fillLabel: { label: 'Replace with:', text: 'user=' } },
      { wait: 900 },
    ],
    expect: {
      out: ['user=Alice', 'user=Bob', 'user=Carol', 'Replacements: 3'],
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
    path: '/csv-to-json',
    name: 'csv-to-json',
    zhTitle: 'CSV 转 JSON',
    strategy: 'structural：CSV 转 JSON 数组，首行为键名，输出必须同时含键名与该行的值',
    steps: [
      { fill: { i: 0, text: 'name,role\nAda,engineer\nGrace,lead' } },
      { wait: 1000 },
    ],
    expect: {
      // 用 outRegex 而非 text/regex：engineer、lead 在用例自己填的 CSV 里就有，
      // 拿整页文本比对会恒真（引擎 lint 已点名空转）。JSON 片段只在转换后出现，
      // 且 outRegex 取值面是工具区文本+控件值，并剔除与输入相同的值。
      outRegex: ['"name":\\s*"Ada"', '"role":\\s*"engineer"', '"name":\\s*"Grace"'],
      not: ['Unterminated', 'Could not parse'],
    },
  },

  {
    path: '/json-to-csv',
    name: 'json-to-csv',
    zhTitle: 'JSON 转 CSV',
    strategy: 'structural：对象数组转 CSV，首行必须是表头（键名按出现顺序），其后每行一条记录；'
      + '外加下载按钮的端到端判据（文件名 + 文件内容都要对）',
    steps: [
      { fill: { i: 0, text: '[{"a":1,"b":2},{"a":3,"b":4}]' } },
      { wait: 1000 },
      {
        /**
         * 下载按钮的持续回归判据（任务1 的尾账，之前只有一次性手工 CDP 检查）。
         *
         * 不能只断言「按钮在页面上」——那既不证真下载也不证内容。这里在页面里临时接管
         * `<a download>` 的点击与 URL.createObjectURL，然后：
         *   ① 必须真的有一次带 download 属性的锚点被点击；
         *   ② 文件名必须逐字等于 converted.csv（download-filename + output-language 拼出来的）；
         *   ③ 落到 blob 里的**字节内容**必须就是转换结果（表头 + 两行数据）。
         * 钩子只活在这一步里，随后原样还原，不污染后面的用例。
         */
        js: `(async function(){
          var st = { clicks: [], blob: null };
          var origClick = HTMLAnchorElement.prototype.click;
          var origCreate = URL.createObjectURL;
          URL.createObjectURL = function (b) { st.blob = b; return origCreate.call(URL, b); };
          HTMLAnchorElement.prototype.click = function () {
            if (this.hasAttribute('download')) { st.clicks.push(this.download || this.getAttribute('download')); return; }
            return origClick.call(this);
          };
          var btn = document.querySelector('[data-test-id="download-button"]');
          if (!btn) { URL.createObjectURL = origCreate; HTMLAnchorElement.prototype.click = origClick;
            return '找不到下载按钮 [data-test-id="download-button"]（新增的用户可见入口，掉了就是回归）'; }
          btn.click();
          await new Promise(function (r) { setTimeout(r, 300); });
          URL.createObjectURL = origCreate;
          HTMLAnchorElement.prototype.click = origClick;
          if (!st.clicks.length) {
            return '点了下载按钮，但没有任何 <a download> 被触发（按钮接的是空函数/没绑上）';
          }
          if (st.clicks[0] !== 'converted.csv') return '下载文件名不对：' + JSON.stringify(st.clicks[0]);
          var txt = st.blob && st.blob.text ? await st.blob.text() : '';
          if (txt.indexOf('a,b') !== 0) return '下载内容第一行不是表头 a,b：' + JSON.stringify(txt.slice(0, 40));
          if (txt.indexOf('1,2') < 0 || txt.indexOf('3,4') < 0) return '下载内容缺数据行：' + JSON.stringify(txt.slice(0, 60));
          return null;
        })()`,
      },
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
    //
    // js 这条是 F1（工具页 → 指南文章页入口）在**运行时侧**的判据。
    // 构建期门禁（build-seo 的 scanToolEntryLinks）判的是预渲染骨架，那一层对爬虫负责；
    // 这一条判的是 hydration 之后真实面板里的那条链接 —— 两处必须都在，
    // 否则「骨架有、用户没有」就是违反本项目红线（给抓取器看的句子得真实存在于可见页面）。
    // 用 textContent 而不是 innerText：指南面板是 v-show，收起时 innerText 为空，
    // 会把「链接在不在」判成「用户当时展没展开」；也不去点 .guide-toggle，
    // 因为 guide-seen 写进 localStorage 后，后续用例的面板初值就变了（跨用例状态污染）。
    expect: {
      out: ['"a": 1', '"c": 2'],
      not: ['Invalid'],
      js: `(function(){
        var a = document.querySelector('.guide-article-link a');
        if (!a) return '真实指南面板里没有指向文章页的入口链接（骨架有、面板没有 = 违反同源红线）';
        var href = a.getAttribute('href') || '';
        if (href !== '/guides/json-prettify/') return '入口链接 href 不对：' + href;
        var txt = (a.textContent || '').replace(/\\s+/g, ' ').trim();
        if (txt !== 'Read the full step-by-step guide for this tool') return '入口链接文案与骨架不同源：' + txt;
        return true;
      })()`,
    },
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
    // 按 label 定位：该页 Root font size 与 Decimals 两个 n-input-number 都排在 Values 框前面，
    // 序号 0 会写进根字号（被 n-input-number 丢弃 → 根字号变空、Values 框始终为空 → 无输出）。
    // label 文案随界面英文化同步改过：原先是「数值：」。
    steps: [{ fillLabel: { label: 'Values:', text: '16px' } }, { wait: 800 }],
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
      { click: 'Check status code' },
      // scope 限定到工具区：状态区的文案不能靠整页里同名的说明文字满足
      { waitText: { text: 'Response headers (', ms: 15000, scope: '.tool-content' } },
    ],
    expect: {
      out: ['Status code:', 'Response headers'],
      outRegex: ['\\b200\\b', 'content-type'],
      outNot: ['Check failed'],
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
        if (/Load failed|Failed to fetch|Service returned HTTP/.test(t)) return '接口失败：' + t.slice(0, 160);
        var hasEvents = /\\b(1[0-9]{3}|20[0-9]{2})\\b/.test(t);
        var emptyState = /暂无收录|No events recorded/.test(t);
        if (hasEvents || emptyState) return true;
        return '既没有事件也没有空态说明：' + t.slice(0, 160);
      })()`,
      outNot: ['Load failed'],
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
      { click: 'Query WHOIS' },
      // 等**元素**而不是等文案：说明文字在 .tool-content 之外，等文案会被它立刻满足，
      // 而说明在 .tool-content 之外 —— 等文案会被它立刻满足，请求却还在飞
      // （历史实测：按钮停在 Querying… 时结果区还没挂载）。结果区只在成功时渲染。
      { waitSel: { sel: '.tool-content [data-test-id="area-content"]', ms: 15000 } },
    ],
    expect: {
      out: ['注册商', '到期时间'],
      outNot: ['Lookup failed'],
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
      js: '!!document.querySelector(\'.tool-content [data-test-id="iban-info"]\')',
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
    path: '/reaction-time-test',
    name: 'reaction-time-test',
    zhTitle: '反应速度测试',
    // 随机前摇上限 4500ms → 固定等 4800ms 保证已变绿；引擎点「Click now!」只可能发生在
    // ready 帧之后。断言绑定结果卡内的真实毫秒数（>0 且 <5000）：结果未渲染必假红。
    strategy: 'realInput：Start → 等过随机上限 → 点 Click now! → 结果卡必须出现真实毫秒读数',
    steps: [
      { clickExact: 'Start' },
      { wait: 4800 },
      { clickExact: 'Click now!' },
      { wait: 300 },
    ],
    expect: {
      js: `(function(){
        var el = document.querySelector('[data-test-id="rt-result"]');
        if (!el) return false;
        var m = el.innerText.match(/([0-9]+(\\.[0-9]+)?)\\s*ms/);
        return !!m && Number(m[1]) > 0 && Number(m[1]) < 5000;
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
          var el = document.querySelector('.tool-content input[placeholder="Value"]');
          if (!el) return 'Value input box not found';
          S.setVal(el, '2');
          return null;
        })()`,
      },
      { wait: 1000 },
    ],
    expect: {
      text: ['Conversion result:'],
      js: `(function(){
        // 输出走 TextareaCopyable → 渲染成 <n-code data-test-id="area-content">，
        // **不是 <textarea>**（原断言按 textarea 找，必然拿不到）。
        var out = document.querySelector('.tool-content [data-test-id="area-content"]');
        if (!out) return false;
        var t = out.innerText;
        // 默认 category='Length'、fromUnit=unitsOf('Length')[1]='m'（组件里的取值顺序就是输出顺序）。
        // 输入 2 → 首行回显「2 m」、基准行「m (input): 2」，且 km 行必须是 0.002
        // —— 独立算一遍换算，防「只有基准行、换算全空」这类假绿。
        var lines = t.split('\\n');
        return lines[0] === '2 m'
          && lines.indexOf('m (input): 2') >= 0
          && lines.indexOf('km: 0.002') >= 0
          && lines.length >= 3;
      })()`,
    },
  },
  /* ===================== B2 §5-B 批次 2：图像四页（量化断言，全部像素级 / 字节级） =====================
   *
   * 夹具 scripts/smoke-fixtures/color-quadrants.png = 200×200、四象限各一纯色
   * （TL #FF0000 / TR #00FF00 / BL #0000FF / BR #FF00FF），生成器已逐像素自证。
   * 这四个颜色刻意互不相同且都不是黑/透明：空画布读出 (0,0,0,0) 不可能蒙对，
   * 而「裁剪或取样丢了偏移」这类 bug 会把采样点送进别的象限，颜色立刻错。
   */
  {
    path: '/image-crop',
    name: 'image-crop',
    category: 'Images and videos',
    zhTitle: '图片裁剪',
    tier: 'io',
    strategy: '像素级真裁（拖 NW 角点造非零偏移）：上传四象限夹具 → 断言默认选区=整图且底图真的解码上屏 → CDP 真鼠标把 NW 手柄拖到图像 (50,50)，选区应为 150×150、原点非零 → 导出必须满足：①尺寸严格等于工具自报选区（零容差，这条与输入精度无关）②中心像素=源图 (125,125) 的品红 ③三边角=红/青绿/蓝。偏移被丢掉时中心会是红色而不是品红；只验尺寸则验不出内容。落点尺寸给 ±2 容差是因为 CDP 坐标取整到设备像素（640px 显示 200px 图 → 1 设备像素=0.32 图像像素），那是测量层量化误差，产品侧判据一律零容差',
    steps: [
      { upload: { i: 0, file: 'scripts/smoke-fixtures/color-quadrants.png' } },
      { waitSel: { sel: '[data-test-id="source-info"]', ms: 10000 } },
      {
        js: `(function(){
          var el = document.querySelector('[data-test-id="source-info"]');
          var txt = el ? el.textContent : '';
          if (txt.indexOf('200') === -1) return '源图信息没显示 200：' + txt.slice(0, 80);
          var size = document.querySelector('[data-test-id="crop-size"]');
          var s = size ? size.textContent : '';
          if (!/200[^0-9]{1,6}200/.test(s)) return '默认选区不是整图 200×200，实际=' + JSON.stringify(s);
          var img = document.querySelector('[data-test-id="crop-image"]');
          if (!img || img.naturalWidth !== 200) return '底图未真正解码上屏，naturalWidth=' + (img && img.naturalWidth);
          return null;
        })()`,
      },
      {
        // 拖 NW 角点：让选区落到图像 (50,50)-(200,200)，**偏移非零**才有内容可验
        // ——若导出把源矩形偏移丢了（从 (0,0) 起裁），中心点会从品红变成红，立刻红。
        drag: { sel: '[data-test-id="crop-box"] .h.nw', host: '[data-test-id="crop-stage"]', to: [0.25, 0.25], steps: 6 },
      },
      {
        js: `(function(){
          var size = document.querySelector('[data-test-id="crop-size"]');
          var nums = ((size ? size.textContent : '').match(/\\d+/g) || []).map(Number);
          if (nums.length < 2) return '读不到选区尺寸：' + JSON.stringify(size && size.textContent);
          // 期望 150×150；容 ±2 是因为 CDP 落点会取整到设备像素（640px 显示 200px 图，
          // 1 设备像素 = 0.32 图像像素），这是**测量层**的量化误差，不是产品缺陷。
          // 真正的判据在下面：导出尺寸必须严格等于工具自报的选区尺寸，像素必须落在对的象限。
          if (Math.abs(nums[0] - 150) > 2 || Math.abs(nums[1] - 150) > 2) {
            return '拖拽后选区不在 150×150±2，实际=' + nums[0] + '×' + nums[1];
          }
          window.__sel = { w: nums[0], h: nums[1] };
          return null;
        })()`,
      },
      { clickSel: '[data-test-id="crop-submit"]' },
      { waitSel: { sel: '[data-test-id="crop-output"]', ms: 20000 } },
      {
        js: `(function(){
          var want = window.__sel || {};
          var out = document.querySelector('[data-test-id="crop-output"]');
          if (!out) return '结果图缺失';
          // 导出尺寸 == 自报选区尺寸：这条**不给任何容差**（自一致，与输入精度无关）
          if (out.naturalWidth !== want.w || out.naturalHeight !== want.h) {
            return '导出尺寸与工具自报选区不符：产物 ' + out.naturalWidth + 'x' + out.naturalHeight
              + ' 自报 ' + want.w + 'x' + want.h;
          }
          var c = document.createElement('canvas');
          c.width = want.w; c.height = want.h;
          var ctx = c.getContext('2d');
          ctx.drawImage(out, 0, 0);
          function at(x, y) { var d = ctx.getImageData(x, y, 1, 1).data; return d[0] + ',' + d[1] + ',' + d[2] + ',' + d[3]; }
          // 选区 = 源图 (50,50)-(200,200)：中心在 BR（品红），三角落在另外三个象限
          var checks = [
            [Math.floor(want.w / 2), Math.floor(want.h / 2), '255,0,255,255', '中心(应=源图 BR 象限 品红)'],
            [0, 0, '255,0,0,255', '左上(应=源图 (50,50) 红)'],
            [want.w - 1, 0, '0,255,0,255', '右上(应=源图 TR 青绿)'],
            [0, want.h - 1, '0,0,255,255', '左下(应=源图 BL 蓝)'],
          ];
          for (var i = 0; i < checks.length; i++) {
            var x = checks[i][0], y = checks[i][1], exp = checks[i][2];
            var got = at(x, y);
            if (got !== exp) return checks[i][3] + ' 不是 ' + exp + '，实际=' + got + '（偏移或尺寸错了）';
          }
          var a = document.querySelector('[data-test-id="crop-download"]');
          a = a ? a.closest('a') : null;
          if (!a || (a.href || '').indexOf('blob:') !== 0) return '下载链接不是 blob 产物';
          var nm = a.getAttribute('download') || '';
          if (nm.indexOf('-crop-' + want.w + 'x' + want.h + '.png') === -1) return '下载名未反映真实尺寸：' + nm;
          return null;
        })()`,
      },
    ],
  },
  {
    path: '/image-color-picker',
    name: 'image-color-picker',
    category: 'Images and videos',
    zhTitle: '图片取色器',
    tier: 'io',
    strategy: '两次**非对称**取色钉死坐标映射：点图像 (175,75) 必须报 #00FF00 / rgb(0, 255, 0) / hsl(120, 100%, 50%)，点 (25,125) 必须报 #0000FF / hsl(240, 100%, 50%)。选 x≠y 的点是为了让「xy 互换」这类 bug 必须变红（对称点互换后颜色不变，等于没测）；坐标读数容差 ±1 px——CDP 点击的 clientY 会被取整到设备像素，实测 150 落到 y=149，这是输入栅格化的正常误差，不是产品缺陷',
    steps: [
      { upload: { i: 0, file: 'scripts/smoke-fixtures/color-quadrants.png' } },
      { waitSel: { sel: '[data-test-id="picker-canvas"]', ms: 10000 } },
      {
        js: `(function(){
          var cv = document.querySelector('[data-test-id="picker-canvas"]');
          if (!cv) return '画布未挂载';
          if (cv.width !== 200 || cv.height !== 200) return '画布位图尺寸不是原图 200×200，实际=' + cv.width + 'x' + cv.height;
          return null;
        })()`,
      },
      // from == to 的 drag 就是一次真实点击（按下+抬起同一点），
      // 不用 dispatchEvent 伪造：伪造点击能过，但用户用的是鼠标。
      { drag: { sel: '[data-test-id="picker-canvas"]', to: [0.875, 0.375], from: [0.875, 0.375], steps: 1 } },
      { waitSel: { sel: '[data-test-id="picker-result"]', ms: 8000 } },
      {
        js: `(function(){
          function txt(sel) { var e = document.querySelector(sel); return e ? e.textContent.trim() : ''; }
          var hex = txt('[data-test-id="copy-hex"]').toUpperCase();
          var rgb = txt('[data-test-id="value-rgb"]');
          var hsl = txt('[data-test-id="value-hsl"]');
          var pos = txt('[data-test-id="picked-pos"]');
          var nums = (pos.match(/-?\\d+/g) || []).map(Number);
          if (hex !== '#00FF00') return '(175,75) 取色不是 #00FF00（右上象限），实际=' + hex + ' 读数=' + JSON.stringify(pos);
          if (rgb !== 'rgb(0, 255, 0)') return 'RGB 表达不对，实际=' + rgb;
          if (hsl !== 'hsl(120, 100%, 50%)') return 'HSL 表达不对，实际=' + hsl;
          if (nums.length < 2 || Math.abs(nums[0] - 175) > 1 || Math.abs(nums[1] - 75) > 1) {
            return '坐标读数不在 (175,75)±1，实际=' + JSON.stringify(pos);
          }
          var sw = document.querySelector('[data-test-id="picker-swatch"]');
          var bg = sw ? String(sw.getAttribute('style') || '') : '';
          if (!/00ff00|0,\\s*255,\\s*0/i.test(bg)) return '色块背景与报告值不一致：' + bg;
          return null;
        })()`,
      },
      { drag: { sel: '[data-test-id="picker-canvas"]', to: [0.125, 0.625], from: [0.125, 0.625], steps: 1 } },
      { wait: 400 },
      {
        js: `(function(){
          function txt(sel) { var e = document.querySelector(sel); return e ? e.textContent.trim() : ''; }
          var hex = txt('[data-test-id="copy-hex"]').toUpperCase();
          var hsl = txt('[data-test-id="value-hsl"]');
          var pos = txt('[data-test-id="picked-pos"]');
          var nums = (pos.match(/-?\\d+/g) || []).map(Number);
          if (hex !== '#0000FF') return '第二击 (25,125) 未更新为 #0000FF，实际=' + hex + ' 读数=' + JSON.stringify(pos);
          if (hsl !== 'hsl(240, 100%, 50%)') return '第二击 HSL 不对，实际=' + hsl;
          if (nums.length < 2 || Math.abs(nums[0] - 25) > 1 || Math.abs(nums[1] - 125) > 1) {
            return '第二击坐标读数不在 (25,125)±1，实际=' + JSON.stringify(pos);
          }
          return null;
        })()`,
      },
    ],
  },
  {
    path: '/favicon-generator',
    name: 'favicon-generator',
    category: 'Images and videos',
    zhTitle: 'Favicon 生成器',
    tier: 'io',
    strategy: '字节级验 ICO 结构：上传 1200×630 非方图（走居中裁方分支）→ 产物 .ico 必须 ICONDIR=00 00 01 00 / count=3、三条目录宽高字节 16/32/48、位平面=1、深度=32、数据偏移是绝对地址且指向 PNG 魔数、内嵌 IHDR 声明的尺寸等于目录尺寸、Σ(头+目录+各流)=文件总长。另断言两张附带 PNG 是 180×180 与 512×512（非方图源若被拉伸则宽高不等）',
    steps: [
      { upload: { i: 0, file: 'scripts/smoke-fixtures/photo-sample.jpg' } },
      { waitSel: { sel: '[data-test-id="source-info"]', ms: 10000 } },
      {
        js: `(function(){
          var el = document.querySelector('[data-test-id="source-info"]');
          var txt = el ? el.textContent : '';
          if (txt.indexOf('1200') === -1 || txt.indexOf('630') === -1) return '源图信息未显示 1200×630：' + txt.slice(0, 80);
          return null;
        })()`,
      },
      { clickSel: '[data-test-id="favicon-submit"]' },
      { waitSel: { sel: '[data-test-id="ico-summary"]', ms: 25000 } },
      {
        js: `(function(){
          function readBlob(sel) {
            var btn = document.querySelector(sel);
            var a = btn ? btn.closest('a') : null;
            if (!a || (a.href || '').indexOf('blob:') !== 0) return null;
            var x = new XMLHttpRequest();
            x.open('GET', a.href, false);
            x.overrideMimeType('text/plain; charset=x-user-defined');
            x.send();
            return { raw: x.responseText || '', name: a.getAttribute('download') || '' };
          }
          var got = readBlob('[data-test-id="ico-download"]');
          if (!got) return 'favicon.ico 下载项缺失或不是 blob';
          if (got.name !== 'favicon.ico') return '下载名不是 favicon.ico，实际=' + got.name;
          var raw = got.raw, n = raw.length;
          function b(i) { return raw.charCodeAt(i) & 0xff; }
          function u16(i) { return b(i) | (b(i + 1) << 8); }
          function u32(i) { return ((b(i) | (b(i + 1) << 8) | (b(i + 2) << 16) | (b(i + 3) << 24))) >>> 0; }
          if (n < 6 + 48) return 'ico 只有 ' + n + ' 字节，装不下 3 条目';
          if (u16(0) !== 0 || u16(2) !== 1 || u16(4) !== 3) {
            return 'ICONDIR 不合法：reserved/type/count = ' + u16(0) + '/' + u16(2) + '/' + u16(4);
          }
          var want = [16, 32, 48];
          var cursor = 6 + 3 * 16;
          for (var i = 0; i < 3; i++) {
            var d = 6 + i * 16;
            var w = b(d), h = b(d + 1), planes = u16(d + 4), bits = u16(d + 6);
            var size = u32(d + 8), off = u32(d + 12);
            if (w !== want[i] || h !== want[i]) return '条目 ' + i + ' 宽高字节不是 ' + want[i] + '，实际=' + w + 'x' + h;
            if (planes !== 1 || bits !== 32) return '条目 ' + i + ' 位平面/深度异常：' + planes + '/' + bits;
            if (off !== cursor) return '条目 ' + i + ' 偏移不是绝对地址：期望 ' + cursor + '，实际 ' + off;
            if (b(off) !== 0x89 || b(off + 1) !== 0x50 || b(off + 2) !== 0x4e || b(off + 3) !== 0x47) {
              return '条目 ' + i + ' 指向的不是 PNG 魔数（PNG-in-ICO 形态）';
            }
            // 注意字节序：ICO 目录里的 size/offset 是**小端**，但 PNG 的 IHDR 宽高是**大端**。
            // 这里曾按小端读 IHDR，16 被读成 268435456（0x10000000），是自己写错的断言而非产物问题。
            var pw = ((b(off + 16) << 24) | (b(off + 17) << 16) | (b(off + 18) << 8) | b(off + 19)) >>> 0;
            var ph = ((b(off + 20) << 24) | (b(off + 21) << 16) | (b(off + 22) << 8) | b(off + 23)) >>> 0;
            if (pw !== want[i] || ph !== want[i]) return '条目 ' + i + ' 内嵌 PNG 的 IHDR 是 ' + pw + 'x' + ph + '，应为 ' + want[i];
            if (size < 60) return '条目 ' + i + ' 声称只有 ' + size + ' 字节，疑似空流';
            cursor += size;
          }
          if (cursor !== n) return '目录 byteLength 不闭合：Σ=' + cursor + ' 实际文件=' + n;
          return null;
        })()`,
      },
      {
        js: `(function(){
          var rows = [].slice.call(document.querySelectorAll('[data-test-id="png-row"] img'));
          if (rows.length !== 2) return '附带 PNG 数量不是 2，实际=' + rows.length;
          var got = rows.map(function (im) { return im.naturalWidth + 'x' + im.naturalHeight; });
          if (got.join(',') !== '180x180,512x512') return '两张 PNG 不是正方形 180/512（非方图被拉伸的话宽高不等）：' + got.join(',');
          var as = [].slice.call(document.querySelectorAll('[data-test-id="png-row"] a'));
          var names = as.map(function (a) { return a.getAttribute('download'); });
          if (names.join(',') !== 'apple-touch-icon.png,icon-512.png') return 'PNG 下载名不对：' + names.join(',');
          var snippet = document.querySelector('[data-test-id="html-snippet"]');
          var s = snippet ? snippet.textContent : '';
          var missing = ['favicon.ico', 'apple-touch-icon.png', 'icon-512.png'].filter(function (k) { return s.indexOf(k) === -1; });
          if (missing.length) return 'HTML 片段缺少引用：' + missing.join(',');
          return null;
        })()`,
      },
      // —— 居中裁方的内容判据（补的缺口）——
      // 上面那条只能看出「产物是正方形」，看不出「内容有没有被拉扁」：
      // 把 1200×630 直接画进 512×512 同样是 512×512。我自己就先犯过这个错，
      // 所以换一张 400×200 的判据图：左右边缘各有红/蓝条（在居中裁方窗口之外），
      // 正中有一块黑（在窗口之内）。裁方做对了 → 边缘白 + 正中黑；
      // 退化成整幅拉伸 → 边缘出现红/蓝；画布是空的 → 正中不是黑。两头都堵。
      { upload: { i: 0, file: 'scripts/smoke-fixtures/wide-edge-bars.png' } },
      { clickSel: '[data-test-id="favicon-submit"]' },
      { wait: 1500 },
      {
        js: `(function(){
          var im = [].slice.call(document.querySelectorAll('[data-test-id="png-row"] img'))
            .find(function (x) { return x.naturalWidth === 512; });
          if (!im) return '没有 512 的 PNG 产物行';
          var c = document.createElement('canvas');
          c.width = 512; c.height = 512;
          var ctx = c.getContext('2d');
          ctx.drawImage(im, 0, 0);
          function at(x, y) { var d = ctx.getImageData(x, y, 1, 1).data; return [d[0], d[1], d[2]]; }
          function kind(p) {
            var r = p[0], g = p[1], b = p[2];
            if (r > 200 && g < 80 && b < 80) { return 'RED'; }
            if (b > 200 && r < 80) { return 'BLUE'; }
            if (r < 60 && g < 60 && b < 60) { return 'BLACK'; }
            if (r > 200 && g > 200 && b > 200) { return 'WHITE'; }
            return 'OTHER(' + r + ',' + g + ',' + b + ')';
          }
          var left = kind(at(4, 256)), right = kind(at(507, 256)), centre = kind(at(256, 256));
          if (centre !== 'BLACK') return '正中不是黑方块（' + centre + '）：裁方后的内容没进图标，或画布是空的';
          if (left !== 'WHITE' || right !== 'WHITE') {
            return '图标两侧出现 ' + left + '/' + right + '：源图边缘的红/蓝条本该被居中裁方丢弃，出现即说明整幅被拉成了方形';
          }
          return null;
        })()`,
      },
    ],
  },
  {
    path: '/image-to-pdf',
    name: 'image-to-pdf',
    category: 'Images and videos',
    zhTitle: '图片转 PDF',
    tier: 'io',
    strategy: '页契约三断言：2 图 + 边距 20 → 产物里 /Type/Page 减去 /Type/Pages = 2；两个 MediaBox 分别是 [0 0 1240 670] 与 [0 0 240 240]（同时证明边距真的作用、页尺寸真的随图）；源 JPEG 的 4096-8191 字节必须在 PDF 里连续命中（逐字节嵌入的正面证据，被重编码则落空）。再单传 1 图复跑，页数必须变回 1，抓「文件列表/结果状态不重置」',
    steps: [
      { upload: { i: 0, file: ['scripts/smoke-fixtures/photo-sample.jpg', 'scripts/smoke-fixtures/color-quadrants.png'] } },
      { waitSel: { sel: '[data-test-id="page-count"]', ms: 10000 } },
      {
        js: `(function(){
          var el = document.querySelector('[data-test-id="page-count"]');
          var t = el ? el.textContent : '';
          if (t.indexOf('2') === -1) return '选中计数没有登记两张图：' + JSON.stringify(t);
          var rows = [].slice.call(document.querySelectorAll('[data-test-id="image-row"]'));
          if (rows.length !== 2) return '列表行数不是 2，实际=' + rows.length;
          var txt = rows.map(function (r) { return r.textContent; }).join(' | ');
          if (txt.indexOf('1200') === -1 || txt.indexOf('630') === -1) return '列表未显示 jpg 真实尺寸：' + txt.slice(0, 120);
          if (txt.indexOf('200') === -1) return '列表未显示 png 真实尺寸：' + txt.slice(0, 120);
          if (txt.indexOf('\\u2192') !== -1) return 'jpg/png 都属于可直接嵌入类型，不该出现转码标记：' + txt.slice(0, 120);
          return null;
        })()`,
      },
      { fill: { sel: '[data-test-id="margin"] .n-input__input-el', text: '20' } },
      { wait: 300 },
      {
        js: `(function(){
          var el = document.querySelector('[data-test-id="margin"] .n-input__input-el');
          if (!el || String(el.value) !== '20') return '边距值未真正写进模型，实际=' + (el && el.value);
          return null;
        })()`,
      },
      { clickSel: '[data-test-id="pdf-submit"]' },
      { waitSel: { sel: '[data-test-id="pdf-download"]', ms: 25000 } },
      {
        js: `(function(){
          function readBlobUrl(u) {
            var x = new XMLHttpRequest();
            x.open('GET', u, false);
            x.overrideMimeType('text/plain; charset=x-user-defined');
            x.send();
            // x-user-defined 把每个字节 b 映射成 U+F700+b。这里统一压回 0~255 的「字节串」，
            // 否则拿 & 0xff 处理过的 needle 去 indexOf 未处理的 pdf 串，永远不可能命中
            // ——这是判据自己的假红，不是产品把图像重编码了（实测踩过）。
            var s = x.responseText || '', out = new Array(s.length);
            for (var k = 0; k < s.length; k++) { out[k] = String.fromCharCode(s.charCodeAt(k) & 0xff); }
            return out.join('');
          }
          var btn = document.querySelector('[data-test-id="pdf-download"]');
          var a = btn ? btn.closest('a') : null;
          if (!a || (a.href || '').indexOf('blob:') !== 0) return 'PDF 下载项缺失或不是 blob';
          if ((a.getAttribute('download') || '') !== 'images.pdf') return '下载名不是 images.pdf';
          var pdf = readBlobUrl(a.href);
          var n = pdf.length;
          function b(i) { return pdf.charCodeAt(i) & 0xff; }
          if (n < 70000) return 'PDF 只有 ' + n + ' 字节，装不下 75KB 源图';
          var head = '';
          for (var i = 0; i < 5; i++) { head += String.fromCharCode(b(i)); }
          if (head !== '%PDF-') return '产物头不是 %PDF-，实际=' + JSON.stringify(head);
          var flat = pdf.replace(/\\s+/g, '');
          var pages = (flat.split('/Type/Page').length - 1) - (flat.split('/Type/Pages').length - 1);
          if (pages !== 2) return '页数不是 2（两张图），实际=' + pages;
          // MediaBox 只能在**未去空白**的原文里取：数字之间的空格是内容不是排版
          var boxes = [];
          var re = /\\/MediaBox\\s*\\[\\s*([0-9.\\s]+?)\\s*\\]/g;
          var m;
          while ((m = re.exec(pdf))) { boxes.push(m[1].replace(/\\s+/g, ' ').trim()); }
          if (boxes.join(' | ') !== '0 0 1240 670 | 0 0 240 240') {
            return 'MediaBox 不符合「图尺寸 + 2×20 边距」：' + boxes.join(' | ');
          }
          var f = document.querySelector('.tool-content input[type="file"]');
          if (!f || !f.files || !f.files[0]) return '找不到源文件 input，无法做逐字节比对';
          var src = readBlobUrl(URL.createObjectURL(f.files[0]));
          if (src.length < 10000) return '源 JPEG 读回只有 ' + src.length + ' 字节';
          // 两边都用同一种「x-user-defined」表示再比：ASCII 原样、高位字节是 U+F7xx。
          // 之前把 needle 手动 & 0xff 归一了而 pdf 没有 —— 编码空间不一致，永远不可能命中，
          // 报出来却像「图像被重编码」，是判据自己的假红。取子串最稳。
          var needle = src.substring(4096, 8192);
          if (needle.length !== 4096) return 'needle 长度异常=' + needle.length;
          if (pdf.indexOf(needle) === -1) {
            return 'JPEG 中段未连续命中 src=' + src.length + ' pdf=' + n
              + ' 头64字节@' + pdf.indexOf(src.substring(0, 64))
              + ' DCT=' + (pdf.indexOf('/DCTDecode') > -1)
              + ' Flate=' + (pdf.indexOf('/FlateDecode') > -1);
          }
          return null;
        })()`,
      },
      { upload: { i: 0, file: 'scripts/smoke-fixtures/color-quadrants.png' } },
      { waitSel: { sel: '[data-test-id="page-count"]', ms: 10000 } },
      {
        js: `(function(){
          var el = document.querySelector('[data-test-id="page-count"]');
          var t = el ? el.textContent : '';
          if (t.indexOf('1') === -1 || t.indexOf('2') !== -1) return '换成单图后计数未复位：' + JSON.stringify(t);
          var rows = document.querySelectorAll('[data-test-id="image-row"]');
          if (rows.length !== 1) return '单图后列表仍有 ' + rows.length + ' 行';
          return null;
        })()`,
      },
      { clickSel: '[data-test-id="pdf-submit"]' },
      { wait: 1500 },
      {
        js: `(function(){
          var btn = document.querySelector('[data-test-id="pdf-download"]');
          var a = btn ? btn.closest('a') : null;
          if (!a || (a.href || '').indexOf('blob:') !== 0) return '第二次生成的 PDF 下载项缺失';
          var x = new XMLHttpRequest();
          x.open('GET', a.href, false);
          x.overrideMimeType('text/plain; charset=x-user-defined');
          x.send();
          var pdf = x.responseText || '';
          var flat = pdf.replace(/\\s+/g, '');
          var pages = (flat.split('/Type/Page').length - 1) - (flat.split('/Type/Pages').length - 1);
          if (pages !== 1) return '单图重跑页数不是 1，实际=' + pages + '（列表状态未重置进产物）';
          var boxes = [];
          var re = /\\/MediaBox\\s*\\[\\s*([0-9.\\s]+?)\\s*\\]/g;
          var m;
          while ((m = re.exec(pdf))) { boxes.push(m[1].replace(/\\s+/g, ' ').trim()); }
          // 边距输入沿用上一步的 20，200×200 的图 → 唯一一页应为 240×240；
          // 若产物仍带上一轮 1200×630 的状态，这里必然不是这个值
          if (boxes.join(',') !== '0 0 240 240') return '单图重跑的 MediaBox 不是 0 0 240 240，实际=' + boxes.join(' | ');
          return null;
        })()`,
      },
    ],
  },
  {
    path: '/nanoid-generator',
    name: 'nanoid-generator',
    category: 'Crypto',
    tier: 'io',
    strategy: 'knownVector + differential：长度/字符集必须逐行成立，且「重新生成」必须改变输出（防常量随机源）',
    steps: [
      { fill: { i: 0, text: '16' } },
      { wait: 600 },
      {
        // 第一步只判「格式 + 字符集」，不碰按钮：把点击和读取分开，
        // 否则会在 v-if 重渲染的空窗里读到 null（上一版就是这么抛出 Uncaught 的）。
        js: `(function(){
          var pre = document.querySelector('.tool-content pre');
          if (!pre) return '结果区没有出现';
          var lines = (pre.innerText || '').split('\\n').filter(function(l){ return l.length; });
          if (lines.length < 2) return '结果区不足两条，差分判据失去意义：' + lines.length;
          var bad = lines.filter(function(l){ return !/^[A-Za-z0-9_-]{16}$/.test(l); });
          if (bad.length) return '有 ' + bad.length + ' 行不是 16 位 URL 安全字符（样例: ' + bad[0].slice(0, 20) + '）';
          window.__nanoidBefore = lines.join('|');
          var btn = document.querySelector('[data-test-id="refresh"]');
          if (!btn) return '找不到重新生成按钮';
          btn.click();
          return null;
        })()`,
      },
      { wait: 600 },
      {
        js: `(function(){
          var pre = document.querySelector('.tool-content pre');
          if (!pre) return '点击重新生成后结果区消失';
          var lines = (pre.innerText || '').split('\\n').filter(function(l){ return l.length; });
          if (lines.length < 2) return '重新生成后结果不足两条';
          var bad = lines.filter(function(l){ return !/^[A-Za-z0-9_-]{16}$/.test(l); });
          if (bad.length) return '重新生成后出现不符合长度/字符集的行';
          if (window.__nanoidBefore === lines.join('|')) return '重新生成没有改变任何 ID —— 随机源疑似常量';
          if (new Set(lines).size !== lines.length) return '同一批里出现了重复 ID';
          return null;
        })()`,
      },
    ],
    expect: {
      outRegex: ['[A-Za-z0-9_-]{16}'],
      not: ['Needs at least two distinct characters', 'Failed to fetch'],
    },
  },
  {
    path: '/color-contrast-checker',
    name: 'color-contrast-checker',
    category: 'Colors',
    tier: 'io',
    strategy: 'knownVector + differential：#777/#fff 必须 4.48 且 AA 正文不达标，改一格成 #767676 必须变 4.54 且达标',
    steps: [
      { fill: { i: 0, text: '#777777' } },
      { fill: { i: 1, text: '#ffffff' } },
      { wait: 600 },
      {
        js: `(function(){
          var box = document.querySelector('.tool-content');
          var ratio = box.querySelector('[data-test-id="ratio"]');
          if (!ratio) return '没有出现比值区块（两格已填，应当出结果）';
          if (!/4\.48/.test(ratio.innerText)) return 'AA 临界灰的比值不是 4.48，实到: ' + ratio.innerText.trim().slice(0, 24);
          var verdicts = [].slice.call(box.querySelectorAll('[data-test-id="verdict"]')).map(function(e){ return e.innerText.trim(); });
          if (verdicts.length !== 4) return '判定行应有 4 条（AA 正文/AA 大字/AAA 正文/AAA 大字），实到 ' + verdicts.length;
          if (verdicts[0] !== 'Fail') return '4.48 不该通过 AA 正文门限（显示值取整会骗人，这里判的是原始比值）';
          if (verdicts[1] !== 'Pass') return '4.48 应当通过 AA 大字号（3:1）';
          return null;
        })()`,
      },
      { fill: { i: 0, text: '#767676' } },
      { wait: 600 },
      {
        js: `(function(){
          var box = document.querySelector('.tool-content');
          var ratio = box.querySelector('[data-test-id="ratio"]');
          if (!ratio) return '改色后比值区块消失';
          if (!/4\.54/.test(ratio.innerText)) return '差一格的比值不是 4.54，实到: ' + ratio.innerText.trim().slice(0, 24);
          var verdicts = [].slice.call(box.querySelectorAll('[data-test-id="verdict"]')).map(function(e){ return e.innerText.trim(); });
          if (verdicts[0] !== 'Pass') return '4.54 必须通过 AA 正文，否则门限判定写反或做了取整比较';
          return null;
        })()`,
      },
    ],
    expect: {
      out: ['4.54'],
      not: ['Two colours needed', 'Failed to fetch'],
    },
  },
  {
    // 中文界面下那条入口链接的**真实文案**取证。
    // 为什么放在冒烟里而不是用本机 Chrome 看一眼：这个 profile 开着整页自动翻译
    // （documentElement.class = translated-ltr、数百个 <font> 包裹），
    // 看到的「阅读该工具的…」其实是 Chrome 把我们写的句子又翻了一遍 —— 拿它当证据会骗人。
    // 无头浏览器没有翻译扩展，取到的就是应用自己渲染的字符串。
    //
    // 顺序说明：运行时 H1 的比对在所有步骤**之前**完成（runCase 里先读 H1 再跑 steps），
    // 所以这里切换语言不会把「运行时 H1 ≠ 预渲染 H1」搞成假红。
    path: '/json-prettify',
    name: 'panel-link-zh',
    category: 'Formatter',
    tier: 'io',
    strategy: 'structural：切到 zh 后，指南面板里的文章入口必须渲染成 locales/zh.yml 那句原文',
    steps: [
      {
        // 语言选择器是 naive-ui 的 c-select；选项节点在收起态也在 DOM 里（hidden），
        // 程序化点击两处即可切换 —— 不依赖鼠标坐标，也不动 localStorage（本应用不持久化语言）。
        js: `(function(){
          var sel = document.querySelector('.c-select');
          if (!sel) return '页面上找不到语言选择器 .c-select';
          sel.click();
          var opts = [].slice.call(document.querySelectorAll('.c-select-dropdown-option'));
          var zh = opts.filter(function(o){ return (o.textContent || '').indexOf('中文') >= 0; })[0];
          if (!zh) return '语言选项里没有「中文」（现有选项 ' + opts.map(function(o){ return (o.textContent || '').trim(); }).join('/') + '）';
          zh.click();
          return null;
        })()`,
      },
      {
        // 切换是异步重渲染，等有内容的 h1 出现再往下读（不是等固定时长）。
        waitText: { text: 'JSON', ms: 6000 },
      },
      {
        js: `(function(){
          var a = document.querySelector('.guide-article-link a');
          if (!a) return '切到中文后指南面板里的文章入口链接不见了';
          var href = a.getAttribute('href') || '';
          if (href !== '/guides/json-prettify/') return '入口链接 href 变了：' + href;
          var txt = (a.textContent || '').replace(/\s+/g, ' ').trim();
          if (txt !== '阅读这个工具的完整分步使用指南') return '入口文案不是 locales/zh.yml 的原文：' + txt;
          return null;
        })()`,
      },
      {
        // 复原：把语言切回英文并清掉那个 storage 键，避免污染同一 profile 里的后续用例。
        js: `(function(){
          var sel = document.querySelector('.c-select');
          if (sel) {
            sel.click();
            var en = [].slice.call(document.querySelectorAll('.c-select-dropdown-option'))
              .filter(function(o){ return (o.textContent || '').indexOf('English') >= 0 || (o.textContent || '').trim() === '英语'; })[0];
            if (en) en.click();
          }
          try { localStorage.removeItem('locale'); } catch (e) {}
          return null;
        })()`,
      },
    ],
    expect: {
      // 切语言之后整页都是中文，英文词条断言会假红 —— 这一条只管上面那个 js。
      not: ['Guide not found'],
    },
  },

  // ── 静态内容页（pageKind: 'static'）：/faq 与 /guides/<tool> ──────────────────────
  // 这一档不是工具页：没有 .tool-layout / .tool-content，H1 也不来自 tools.* 词条。
  // 引擎按 pageKind 换了**同等强度**的判据（#app 内渲染出带文字的 h1、
  // Vue 实例在位、正文长度过阈值），不是「跳过工具页判据就当绿」。
  {
    // 失败场景：未知 slug 必须是**硬 404**，不能是「200 + 一篇没内容的壳」。
    // 软 404 比 404 更糟 —— 爬虫会把「未找到」当正文收录，还会反复抓这条链接。
    //
    // 线上实测（2026-10-17）：/guides/<未知>/ 与 /<未知>/ 都是 HTTP 404 + 404.html
    // （1982 字节，H1「Page not found」，`meta robots=noindex`，无任何 JSON-LD）。
    // 本地 --serve-dist 已改成同一行为（缺文件 → 404.html + 状态 404），
    // 所以这条**本地就能验**，不再挂 onlineOnly 长期吃灰。
    //
    // standalone：404.html 是自包含页面，没有 #app、没有 JS —— 运行时三层对它不适用，
    // 引擎会显式记「未取证」而不是当作通过。因此本条只允许初始 HTML 层的断言。
    path: '/guides/this-slug-does-not-exist',
    name: 'guide-unknown-slug',
    category: 'Guides',
    pageKind: 'static',
    standalone: true,
    expectStatus: 404,
    expectedH1: 'Page not found',
    tier: 'io',
    strategy: 'structural：未知指南 slug 必须硬 404（状态 + 无 Article/FAQPage 结构化数据），不得渲染成软 404 空壳',
    steps: [],
    expect: {
      htmlNotLd: ['Article', 'FAQPage', 'BreadcrumbList'],
    },
  },
  {
    path: '/faq',
    name: 'faq',
    category: 'Guides',
    pageKind: 'static',
    expectedH1: 'FAQ',
    minBodyChars: 800,
    tier: 'io',
    strategy: 'structural：目录锚点数 == 小节数、FAQPage JSON-LD 逐条等于可见问答、点目录真的滚动',
    steps: [
      {
        // 不用 expect.text 数「有 9 条问答」—— 整页文本会被侧栏与说明凑数；
        // 这里数 DOM，并把结构化数据与正文逐条对齐（不同源必红）。
        js: `(function(){
          var secs = [].slice.call(document.querySelectorAll('section[id^="faq-"]'));
          var toc = [].slice.call(document.querySelectorAll('a[href^="#faq-"]'));
          if (secs.length < 5) return '可见问答只有 ' + secs.length + ' 条';
          if (toc.length !== secs.length) return '目录 ' + toc.length + ' 条 ≠ 小节 ' + secs.length + ' 条';
          var dead = toc.filter(function(a){ return !document.getElementById(a.getAttribute('href').slice(1)); });
          if (dead.length) return '目录有 ' + dead.length + ' 条指向不存在的小节';
          // 运行时 head 会被 unhead 重组，结构化数据在不在这里读都不算 —— 存在性由
          // expect.htmlLd 在初始 HTML 层判。这里只做「DOM 结构自洽」的核对。
          var ld = [].slice.call(document.querySelectorAll('script[type="application/ld+json"]'))
            .map(function(s){ try { return JSON.parse(s.textContent); } catch (e) { return null; } })
            .filter(function(x){ return x && x['@type']; });
          var faq = ld.filter(function(x){ return x['@type'] === 'FAQPage'; })[0];
          if (faq) {
            var ents = faq.mainEntity || [];
            if (ents.length !== secs.length) return 'JSON-LD ' + ents.length + ' 条 ≠ 正文 ' + secs.length + ' 条';
            var qs = secs.map(function(s){ var h = s.querySelector('h2'); return h ? h.innerText.trim() : ''; });
            var stray = ents.filter(function(m){ return qs.indexOf((m.name || '').trim()) === -1; });
            if (stray.length) return 'JSON-LD 里的问题不在正文: ' + (stray[0].name || '').slice(0, 40);
            var leak = ents.some(function(m){
              return (m.name || '').indexOf('{{') >= 0 || ((m.acceptedAnswer || {}).text || '').indexOf('{{') >= 0;
            });
            if (leak) return '结构化数据里漏出未替换的占位符';
          }
          return null;
        })()`,
      },
      {
        js: `(function(){
          var a = document.querySelector('a[href="#faq-3"]');
          if (!a) return '找不到 #faq-3 的目录链接';
          a.click();
          return null;
        })()`,
      },
      { wait: 900 },
      {
        // 只判 DOM 存在性时「点了目录但页面纹丝不动」也会绿 —— 这条就是抓这个的。
        // （实测过：缺 scrollBehavior 时 hash 变了、滚动容器一动不转。）
        js: `(function(){
          var el = document.getElementById('faq-3');
          if (!el) return '目标小节不存在';
          var top = el.getBoundingClientRect().top;
          if (top > 200) return '点目录后未滚动：#faq-3 仍在视口 ' + Math.round(top) + 'px 处';
          return null;
        })()`,
      },
    ],
    expect: {
      // canonical 与 FAQPage 的一致性在上面 js 步骤里逐条核过了（它们在 <head>）。
      // expect.text/regex 比的是**运行时 body 文本**，拿 <head> 里的标签写断言永远不会命中 ——
      // 我第一版就这么写过，造出一条假红。这里只留 body 里真能看见的判据。
      text: ['Contents', 'Where do I report an accessibility problem?'],
      // 结构化数据落在初始 HTML 层（爬虫读的就是这份）
      htmlLd: ['FAQPage'],
      not: ['Failed to fetch'],
    },
  },
  {
    path: '/guides/csv-to-json',
    name: 'guide-csv-to-json',
    category: 'Guides',
    pageKind: 'static',
    expectedH1: 'CSV to JSON — Guide',
    minBodyChars: 600,
    tier: 'io',
    strategy: 'structural：目录与小节一一对应、面包屑回链工具页、示例代码块非空、Article + BreadcrumbList 齐发',
    steps: [
      {
        js: `(function(){
          var secs = [].slice.call(document.querySelectorAll('article section[id]'));
          var toc = [].slice.call(document.querySelectorAll('article nav a[href^="#"]'))
            .concat([].slice.call(document.querySelectorAll('nav a[href^="#what-it-is"], nav a[href^="#how-to-use"], nav a[href^="#faq"]')));
          if (secs.length < 3) return '文章分节只有 ' + secs.length + ' 节';
          var ids = secs.map(function(s){ return s.id; });
          var links = [].slice.call(document.querySelectorAll('a[href^="#"]')).filter(function(a){
            return ids.indexOf(a.getAttribute('href').slice(1)) >= 0;
          });
          if (links.length < 3) return '目录里能对上小节的链接只有 ' + links.length + ' 条';
          var dup = ids.length !== new Set(ids).size;
          if (dup) return '小节 id 有重复，锚点会互相盖掉';
          if (!document.querySelector('a[href="/csv-to-json"]')) return '没有回链到工具页';
          var pre = document.querySelector('article pre');
          if (!pre || pre.innerText.trim().length < 10) return '示例代码块是空的';
          // 结构化数据不在这里判 —— 见 expect.htmlLd 的注释（运行时 head 会被 unhead 重组）
          return null;
        })()`,
      },
    ],
    expect: {
      // canonical 由初始 HTML 层的 canonicalSelf 判；结构化数据由 htmlLd 判（同一层）。
      // 这里只留 body 里真能看见的小节标题。
      text: ['A worked example', 'Things that trip people up', 'Questions people ask'],
      htmlLd: ['Article', 'BreadcrumbList', 'FAQPage'],
      not: ['Guide not found', 'Failed to fetch'],
    },
  },
];
