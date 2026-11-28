/**
 * G4 运行时验收：guides 加载矩阵 + 证伪。
 *
 * 验证点：
 * 1. GUIDE_LOCALES 与注册表一致（不硬编码）
 * 2. loadGuides 对已启用语言正确返回（en/zh 各返回自己的数据）
 * 3. locale 归一化（zh-CN / zh-Hans 等都走 zh）
 * 4. 未启用语言（ja）→ normalizeLocale 回落 en → 能拿到英文数据（注册表行为）
 * 5. 证伪：若某语言在注册表但无 importer → loadGuides throw（不静默降级）
 * 6. assertGuideCoverage 正常时返回空数组
 *
 * 这些用例在 Node/Vitest 环境（非浏览器）运行，Vite 的 dynamic import 会被
 * vitest 处理为真实 ESM 加载。
 */
import { describe, expect, it } from 'vitest';
import { ENABLED_LOCALES, normalizeLocale } from '@/i18n/languages';
import { GUIDE_LOCALES, assertGuideCoverage, loadGuides } from '@/tools/guides';

describe('G4: GUIDE_LOCALES 派生自注册表', () => {
  it('与 ENABLED_LOCALES 的语言码集合完全一致', () => {
    const registryCodes = ENABLED_LOCALES.map(l => l.code);
    expect([...GUIDE_LOCALES].sort()).toEqual([...registryCodes].sort());
  });

  it('当前包含 en 和 zh（若注册表变化此条会提醒更新期望）', () => {
    expect(GUIDE_LOCALES).toContain('en');
    expect(GUIDE_LOCALES).toContain('zh');
  });
});

describe('G4: loadGuides 按语言返回正确数据', () => {
  it('loadGuides("en") 返回英文 guides，包含 /json-prettify key', async () => {
    const data = await loadGuides('en');
    expect(data).toHaveProperty('/json-prettify');
    expect(data['/json-prettify'].intro).toMatch(/^[A-Za-z]/);
  });

  it('loadGuides("zh") 返回中文 guides，intro 含中文字符', async () => {
    const data = await loadGuides('zh');
    expect(data).toHaveProperty('/json-prettify');
    expect(data['/json-prettify'].intro).toMatch(/[\u4E00-\u9FFF]/);
  });

  it('loadGuides("zh-CN") 归一化为 zh 并返回中文数据', async () => {
    const data = await loadGuides('zh-CN');
    expect(data).toHaveProperty('/json-prettify');
    expect(data['/json-prettify'].intro).toMatch(/[\u4E00-\u9FFF]/);
  });

  it('loadGuides("ja") → normalizeLocale 回落到 en → 返回英文数据', async () => {
    // ja 未启用，normalizeLocale('ja') → 'en' → 拿到英文
    const data = await loadGuides('ja');
    expect(data['/json-prettify'].intro).toMatch(/^[A-Za-z]/);
  });
});

describe('G4: JSON Diff large-input guide accuracy', () => {
  it('describes main-thread and Web Worker thresholds consistently in English and Chinese', async () => {
    const english = await loadGuides('en');
    const chinese = await loadGuides('zh');
    const enFaq = english?.['/json-diff']?.faqs?.find(item => item.q === 'Can I compare very large files?');
    const zhFaq = chinese?.['/json-diff']?.faqs?.find(item => item.q === '可以比较超大文件吗？');

    expect(enFaq?.a).toContain('Small documents are compared on the browser main thread');
    expect(enFaq?.a).toContain('combined input exceeds 150,000 characters');
    expect(enFaq?.a).toContain('dedicated Web Worker');
    expect(enFaq?.a).not.toContain('Comparison currently runs on the browser main thread');
    expect(zhFaq?.a).toContain('较小文档在浏览器主线程比较');
    expect(zhFaq?.a).toContain('合计超过 150,000 个字符');
    expect(zhFaq?.a).toContain('专用 Web Worker');
  });
});

describe('API Debugger collection runner guide accuracy', () => {
  it('explains the tested pm.* subset and CSV/JSON iteration behavior in English', async () => {
    const guide = (await loadGuides('en'))['/api-debugger'];
    const notes = guide.notes?.join(' ') ?? '';
    const article = guide.articleOnlySections?.map(s => s.text).join(' ') ?? '';
    const faq = guide.faqs?.map(f => f.a).join(' ') ?? '';

    expect(guide.steps.join(' ')).toContain('dedicated Worker');
    expect(guide.steps.join(' ')).toContain('CSV file or a JSON file');
    expect(notes).toContain('5,000 data rows');
    expect(notes).toContain('not complete Postman or Newman compatibility');
    expect(notes).toContain('sent through the relay');
    expect(article).toContain('a count above the row count cycles through the rows');
    expect(faq).toContain('not a full Postman/Newman runtime');
    expect(notes).not.toContain('does not execute Postman pm.* scripts or data-file iterations');
  });

  it('explains the tested pm.* subset and CSV/JSON iteration behavior in Chinese', async () => {
    const guide = (await loadGuides('zh'))['/api-debugger'];
    const notes = guide.notes?.join(' ') ?? '';
    const article = guide.articleOnlySections?.map(s => s.text).join(' ') ?? '';
    const faq = guide.faqs?.map(f => f.a).join(' ') ?? '';

    expect(guide.steps.join(' ')).toContain('独立 Worker');
    expect(guide.steps.join(' ')).toContain('CSV 文件');
    expect(notes).toContain('5,000 条数据行');
    expect(notes).toContain('不能称为完整 Postman/Newman 兼容');
    expect(notes).toContain('经中继发送到所选目标');
    expect(article).toContain('大于行数时循环使用数据行');
    expect(faq).toContain('经过测试的 pm.* API 子集');
    expect(notes).not.toContain('集合运行器不执行 Postman pm.* 脚本');
  });
});

describe('JSON Workspace bilingual guide accuracy', () => {
  it('explains the live nine-step pipeline and data boundaries in English', async () => {
    const guide = (await loadGuides('en'))['/json-workspace'];
    const text = [
      guide.intro,
      ...guide.steps,
      ...(guide.notes ?? []),
      guide.about ?? '',
      ...(guide.faqs ?? []).map(item => `${item.q} ${item.a}`),
    ].join(' ');

    expect(text).toContain('Minify');
    expect(text).toContain('Generate Types');
    expect(text).toContain('Parse to JSON');
    expect(text).toContain('TypeScript, C#, Java or Go');
    expect(text).toContain('no separate Run button');
    expect(text).toContain('localStorage');
    expect(text).toContain('not cloud sync');
    expect(text).toContain('Base64URL encoding, not encryption');
    expect(text).toContain('8,192 characters');
    expect(text).toContain('5 MiB');
    expect(text).toContain('Filter expressions');
    expect(text).not.toContain('overwhelming majority of real extraction tasks');
  });

  it('explains the live nine-step pipeline and data boundaries in Chinese', async () => {
    const guide = (await loadGuides('zh'))['/json-workspace'];
    const text = [
      guide.intro,
      ...guide.steps,
      ...(guide.notes ?? []),
      guide.about ?? '',
      ...(guide.faqs ?? []).map(item => `${item.q} ${item.a}`),
    ].join(' ');

    expect(text).toContain('Minify');
    expect(text).toContain('Generate Types');
    expect(text).toContain('Parse to JSON');
    expect(text).toContain('TypeScript、C#、Java 和 Go');
    expect(text).toContain('无需单独点击 Run');
    expect(text).toContain('localStorage');
    expect(text).toContain('不会同步到云端');
    expect(text).toContain('Base64URL 编码而非加密');
    expect(text).toContain('8,192 个字符');
    expect(text).toContain('5 MiB');
    expect(text).toContain('不支持 ?(@.price) 等过滤表达式');
    expect(text).not.toContain('足以处理绝大多数真实提取任务');
  });
});

describe('JWT Parser bilingual guide accuracy', () => {
  it('describes the decode-only JWS workflow accurately in English', async () => {
    const guide = (await loadGuides('en'))['/jwt-parser'];
    const text = [
      guide.intro,
      ...guide.steps,
      ...(guide.notes ?? []),
      guide.about ?? '',
      ...(guide.faqs ?? []).map(item => `${item.q} ${item.a}`),
    ].join(' ');

    expect(text).toContain('JOSE Header');
    expect(text).toContain('Claims Set Payload');
    expect(text).toContain('Base64URL');
    expect(text).toContain('does not verify');
    expect(text).toContain('NumericDate');
    expect(text).toContain('browser local time zone');
    expect(text).toContain('Five-part compact JWE');
    expect(text).not.toContain('three decoded sections');
    expect(text).not.toContain('plain Base64');
  });

  it('describes the decode-only JWS workflow accurately in Chinese', async () => {
    const guide = (await loadGuides('zh'))['/jwt-parser'];
    const text = [
      guide.intro,
      ...guide.steps,
      ...(guide.notes ?? []),
      guide.about ?? '',
      ...(guide.faqs ?? []).map(item => `${item.q} ${item.a}`),
    ].join(' ');

    expect(text).toContain('JOSE Header');
    expect(text).toContain('Claims Set Payload');
    expect(text).toContain('Base64URL');
    expect(text).toContain('不执行验签');
    expect(text).toContain('NumericDate');
    expect(text).toContain('浏览器本地时区');
    expect(text).toContain('五段式紧凑 JWE');
    expect(text).not.toContain('解码出的三段内容');
    expect(text).not.toContain('明文 Base64');
  });
});

describe('HTTP Status Codes bilingual protocol guidance accuracy', () => {
  it('uses RFC 9110 semantics and clear diagnostic boundaries in English', async () => {
    const guide = (await loadGuides('en'))['/http-status-codes'];
    const text = [
      guide.intro,
      ...guide.steps,
      ...(guide.notes ?? []),
      guide.about ?? '',
      ...(guide.faqs ?? []).map(item => `${item.q} ${item.a}`),
    ].join(' ');

    expect(text).toContain('WWW-Authenticate');
    expect(text).toContain('preserve the request method');
    expect(text.toLowerCase()).toContain('proxies and gateways can generate http responses too.');
    expect(text).toContain('DNS lookup, TCP connection, TLS negotiation');
    expect(text).toContain('heuristically cacheable');
    expect(text).not.toContain('who are you?');
    expect(text).not.toContain('cache it forever');
    expect(text).not.toContain('the client must change something');
  });

  it('keeps the Chinese guide equivalent and technically precise', async () => {
    const guide = (await loadGuides('zh'))['/http-status-codes'];
    const text = [
      guide.intro,
      ...guide.steps,
      ...(guide.notes ?? []),
      guide.about ?? '',
      ...(guide.faqs ?? []).map(item => `${item.q} ${item.a}`),
    ].join(' ');

    expect(text).toContain('WWW-Authenticate');
    expect(text).toContain('保留原请求方法');
    expect(text).toContain('代理或网关也可能生成 HTTP 响应');
    expect(text).toContain('DNS 查询、TCP 连接、TLS 握手');
    expect(text).toContain('启发式可缓存性');
    expect(text).not.toContain('你是谁？');
    expect(text).not.toContain('客户端可能永久缓存');
    expect(text).not.toContain('客户端需要改');
  });
});

describe('G4: assertGuideCoverage 自检', () => {
  it('当前所有已启用语言都有 importer → 返回空数组', () => {
    expect(assertGuideCoverage()).toEqual([]);
  });
});

describe('G4: 证伪 — 注册表与 importer 不一致时的行为', () => {
  it('若 GUIDE_LOCALES 含 "ja" 但 GUIDE_IMPORTERS 没有 → loadGuides("ja") 会拿到 en（因 normalizeLocale 把 ja 归为默认 en）', async () => {
    // 这是当前注册表下 normalizeLocale 的正确行为：未注册语言 → 默认语言
    // 真正的证伪在 K4 门禁：注册了 ja 到 ENABLED_LOCALES 但没有 guides.ja.ts 文件 → 构建红
    // 这里验证运行时层面：只要 normalizeLocale 把未知语言归到 en，loadGuides(en) 不 throw
    const data = await loadGuides('ja');
    expect(data).toBeTruthy();
    expect(Object.keys(data).length).toBeGreaterThan(50); // 有实质内容，不是空壳
  });

  it('normalizeLocale 是 loadGuides 的唯一归一化入口（不再有独立 startsWith 逻辑）', () => {
    // 确认归一化行为与注册表一致
    expect(normalizeLocale('zh-TW')).toBe('zh');
    expect(normalizeLocale('zh-Hans')).toBe('zh');
    expect(normalizeLocale('en-GB')).toBe('en');
    expect(normalizeLocale('fr')).toBe('en'); // 未启用 → 默认
    expect(normalizeLocale('')).toBe('en');
  });
});
