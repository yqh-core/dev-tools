/**
 * scanGuideCrossLinks 的单测 —— 重点是**证伪**：
 * 一条只会返回空数组的判据，和一个真有判别力的判据，在绿灯报表里长得一模一样。
 * 所以除了「干净输入判干净」，必须有一条「喂进悬空链接它得报出来」的对照组。
 */
import { describe, expect, it } from 'vitest';

import { buildGuideEdgeMap, missingLocaleKeys, reachableFrom, scanGuideCrossLinks, scanToolEntryLinks } from './guide-links';

const PAGES = [{ path: '/guides/csv-to-json' }, { path: '/guides/json-prettify' }];

function htmlWith(targets: string[]) {
  return `<article>${targets.map(t => `<a href="${t}">x</a>`).join('')}</article>`;
}

describe('scanGuideCrossLinks', () => {
  it('全部命中已生成文章时判干净，且真的扫到了链接（不是空转）', () => {
    const map = new Map<string, string>([
      ['/guides/csv-to-json', htmlWith(['/guides/json-prettify', '/guides/csv-to-json'])],
      ['/guides/json-prettify', htmlWith(['/guides/csv-to-json'])],
    ]);
    const r = scanGuideCrossLinks(PAGES, p => map.get(p) ?? '');
    expect(r.dangling).toEqual([]);
    expect(r.checked).toBe(3);
    expect(Object.values(r.perPage).reduce((a, b) => a + b, 0)).toBe(r.checked);
  });

  it('对照组：混进一条未生成的 slug 必须被点名（证明这条判据不是摆设）', () => {
    const map = new Map<string, string>([
      ['/guides/csv-to-json', htmlWith(['/guides/json-prettify', '/guides/never-built'])],
      ['/guides/json-prettify', htmlWith(['/guides/csv-to-json'])],
    ]);
    const r = scanGuideCrossLinks(PAGES, p => map.get(p) ?? '');
    expect(r.checked).toBe(3);
    expect(r.dangling).toEqual(['/guides/csv-to-json -> /guides/never-built']);
  });

  it('带尾斜杠的写法一样要扫到，否则正则一失效整条判据就静默空转', () => {
    const map = new Map<string, string>([
      ['/guides/csv-to-json', htmlWith(['/guides/never-built/'])],
      ['/guides/json-prettify', htmlWith([])],
    ]);
    const r = scanGuideCrossLinks(PAGES, p => map.get(p) ?? '');
    expect(r.checked).toBe(1);
    expect(r.dangling).toEqual(['/guides/csv-to-json -> /guides/never-built']);
  });

  it('页面 HTML 缺失时按 0 条计，checked 会掉下来 —— 调用方靠它识别判据失效', () => {
    const r = scanGuideCrossLinks(PAGES, () => '');
    expect(r.checked).toBe(0);
    expect(r.dangling).toEqual([]);
  });

  it('不把站外绝对 URL 算进来（canonical 由别的判据管）', () => {
    const map = new Map<string, string>([
      ['/guides/csv-to-json', '<link rel="canonical" href="https://digdevbox.com/guides/csv-to-json/">'],
      ['/guides/json-prettify', ''],
    ]);
    const r = scanGuideCrossLinks(PAGES, p => map.get(p) ?? '');
    expect(r.checked).toBe(0);
  });
});

/**
 * F1：工具页 → 文章页的入口链接。
 * 这条判据的红线是「骨架与真实面板必须同时有」，所以它必须能分别抓到两侧各自缺失的情况，
 * 而不是只在两边都没有时才响（两边都没有 = 全站没这条边 = expected>0 && linked=0）。
 */
describe('scanToolEntryLinks', () => {
  const TOOLS = [{ path: '/csv-to-json' }, { path: '/json-prettify' }];
  const ARTICLES = ['/guides/csv-to-json', '/guides/json-prettify'];
  const link = (t: string) => `<a href="/guides/${t}/">x</a>`;

  it('两侧都有入口链接时判干净，且 expected 真的吃到了数据', () => {
    const map = new Map<string, string>([
      ['/csv-to-json', `<main>${link('csv-to-json')}</main>`],
      ['/json-prettify', `<main>${link('json-prettify')}</main>`],
    ]);
    const r = scanToolEntryLinks(TOOLS, p => map.get(p) ?? '', ARTICLES);
    expect(r.expected).toBe(2);
    expect(r.linked).toBe(2);
    expect(r.missing).toEqual([]);
    expect(r.dangling).toEqual([]);
  });

  it('对照组：剥掉一个工具页的入口链接，必须点名那一个', () => {
    const map = new Map<string, string>([
      ['/csv-to-json', '<main><!-- 被剥掉了 --></main>'],
      ['/json-prettify', `<main>${link('json-prettify')}</main>`],
    ]);
    const r = scanToolEntryLinks(TOOLS, p => map.get(p) ?? '', ARTICLES);
    expect(r.missing).toEqual(['/csv-to-json']);
    expect(r.linked).toBe(1);
    expect(r.expected).toBe(2);
  });

  it('没有文章的工具不许进 expected（否则「链接缺失」会被虚增）', () => {
    const map = new Map<string, string>([['/csv-to-json', `<main>${link('csv-to-json')}</main>`]]);
    const r = scanToolEntryLinks([{ path: '/csv-to-json' }, { path: '/no-article-tool' }], p => map.get(p) ?? '', ARTICLES);
    expect(r.expected).toBe(1);
    expect(r.linked).toBe(1);
    expect(r.missing).toEqual([]);
  });

  it('工具页链到一篇不存在的文章 → 进 dangling（软 404），不算 linked', () => {
    const map = new Map<string, string>([['/csv-to-json', `<main>${link('csv-to-json')}</main>`]]);
    const r = scanToolEntryLinks(
      [{ path: '/csv-to-json' }],
      p => map.get(p) ?? '',
      ['/guides/csv-to-json', '/guides/json-prettify'],
    );
    expect(r.missing).toEqual([]);
    // 上面这条 HTML 只链了自己那篇（存在），所以不该有悬空
    expect(r.dangling).toEqual([]);
    const r2 = scanToolEntryLinks(
      [{ path: '/csv-to-json' }],
      () => '<a href="/guides/ghost-article/">y</a>',
      ['/guides/csv-to-json'],
    );
    expect(r2.dangling).toEqual(['/csv-to-json -> /guides/ghost-article']);
  });

  it('不带尾斜杠的 href 也算就位（判据不许因为写法差异假红）', () => {
    const r = scanToolEntryLinks(
      [{ path: '/csv-to-json' }],
      () => '<a href="/guides/csv-to-json">z</a>',
      ['/guides/csv-to-json'],
    );
    expect(r.linked).toBe(1);
    expect(r.missing).toEqual([]);
  });
});

/**
 * F2：可达性。这里专门锁一个我自己真踩过的错：第一版把**种子**也按节点集合过滤了，
 * 而种子恰恰是「工具页 + 静态页 + 已收录文章」—— 工具页不在文章节点集里，
 * 于是全部种子被丢掉，可达数塌成 1，孤岛数=115。
 * 判据当时以「炸出 115 篇孤岛」的形式暴露，算运气好：如果图里恰好有一条文章互链，
 * 它会给出一个看似合理但完全错误的数字。所以这几条测试是写给未来改这段代码的人的。
 */
describe('reachableFrom', () => {
  const articles = ['/guides/a', '/guides/b', '/guides/c'];

  it('种子不在节点集合里也必须能穿过它走到节点（当年就是死在这）', () => {
    const edges = new Map<string, string[]>([
      ['/tool-a', ['/guides/a']],
      ['/guides/a', ['/guides/b']],
    ]);
    const got = reachableFrom(['/tool-a'], edges, articles);
    expect([...got].sort()).toEqual(['/guides/a', '/guides/b']);
  });

  it('孤岛 = 既没被种子覆盖、也没人链向它的文章', () => {
    const edges = new Map<string, string[]>([['/tool-a', ['/guides/a']]]);
    const got = reachableFrom(['/tool-a'], edges, articles);
    expect([...got]).toEqual(['/guides/a']);
    expect(articles.filter(p => !got.has(p)).sort()).toEqual(['/guides/b', '/guides/c']);
  });

  it('成环不死循环，且每个环内节点都算可达', () => {
    const edges = new Map<string, string[]>([
      ['/tool-a', ['/guides/a']],
      ['/guides/a', ['/guides/b']],
      ['/guides/b', ['/guides/a', '/guides/c']],
    ]);
    const got = reachableFrom(['/tool-a'], edges, articles);
    expect(got.size).toBe(3);
  });

  it('空边表时可达数只等于「种子本身就是文章」的那部分（不许凭空可达）', () => {
    const got = reachableFrom(['/guides/a', '/tool-x'], new Map(), articles);
    expect([...got]).toEqual(['/guides/a']);
  });

  it('buildGuideEdgeMap 剔除自链：只链自己的页面不提供任何入链', () => {
    const pages = [{ path: '/guides/a' }];
    const edges = buildGuideEdgeMap(pages, () => '<a href="/guides/a/">self</a><a href="/guides/b">b</a>');
    expect(edges.get('/guides/a')).toEqual(['/guides/b']);
  });
});

/**
 * 词条成对判据。骨架恒按 en 渲染，面板按用户语言渲染 ——
 * 一个键只在 en.yml 里有，英文页与构建都正常，**中文页把键名原样渲染出来**。
 * 这类缺陷界面上不报错，只能靠机器拦。
 */
describe('missingLocaleKeys', () => {
  const en = { seo: { guideArticleLink: 'Read the full step-by-step guide for this tool', faqTitle: 'FAQ' } };
  const zh = { seo: { guideArticleLink: '阅读这个工具的完整分步使用指南', faqTitle: '常见问题' } };

  it('两侧都有时判干净', () => {
    expect(missingLocaleKeys(['seo.guideArticleLink', 'seo.faqTitle'], en, zh)).toEqual([]);
  });

  it('对照组：zh 缺键必须点名，且标出缺在哪一侧', () => {
    const zhBroken = { seo: { faqTitle: '常见问题' } };
    expect(missingLocaleKeys(['seo.guideArticleLink'], en, zhBroken))
      .toEqual([{ key: 'seo.guideArticleLink', missingIn: 'zh' }]);
  });

  it('空串也算缺（值存在但是空的，句子一样会塌）', () => {
    const zhBlank = { seo: { guideArticleLink: '   ', faqTitle: '常见问题' } };
    expect(missingLocaleKeys(['seo.guideArticleLink'], en, zhBlank))
      .toEqual([{ key: 'seo.guideArticleLink', missingIn: 'zh' }]);
  });

  it('嵌套路径取不到中间层时不许抛异常，要报成缺键', () => {
    expect(missingLocaleKeys(['seo.nope.deeper.link'], en, zh))
      .toEqual([{ key: 'seo.nope.deeper.link', missingIn: 'en+zh' }]);
  });
});
