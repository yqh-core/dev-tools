/**
 * 指南文章互链扫描 —— 纯函数，零依赖。
 *
 * 单独成文件（而不是塞进 guide-articles.ts）只有一个理由：
 * guide-articles.ts 会拉起 TOOL_SEO_PAGES → 101 个工具的 defineTool → naive-ui / i18n，
 * 单元测试为了测一个正则就得整套环境起来。放这里，node 环境下直接可测。
 *
 * ## 为什么这条判据必须在构建期跑
 * 指向 `/guides/<x>` 的链接如果对应的文章没生成，用户与爬虫拿到的是**软 404**
 * （HTTP 200 + 「没找到」）。软 404 比 404 更糟：爬虫把这条链接当有效页面反复抓，
 * 还可能把「未找到」当正文收录。构建期手里同时有全量文章清单和全量 HTML，
 * 这一刻判定成本最低、证据最完整；过了这一刻就只能靠线上巡检。
 *
 * ## checked 是自证位，不是日志
 * 匹配不到任何链接时 `dangling` 也是空的 —— 「扫到 0 条」和「一条都不悬空」如果
 * 输出一样，这条判据就是摆设。所以调用方必须要求 `checked > 0`。
 */

/**
 * 实测形状（2026-10-17，116 篇 `dist/guides/<slug>/index.html`）：
 * 668 条 `href="/guides/<slug>"`，**全部不带尾斜杠**。
 * 正则仍容忍带斜杠的写法，免得将来改成 `<router-link>` 生成绝对形式时静默漏扫。
 * 只匹配站内相对链接：canonical 那种 `href="https://digdevbox.com/guides/x/"`
 * 不在这里判（它由预渲染层的 canonical 断言单独管）。
 */
const GUIDE_HREF_RE = /href="(\/guides\/[a-z0-9-]+)\/?"/g;

export interface GuideLinkScan {
  /** 悬空链接，形如 `/guides/a -> /guides/b`。 */
  dangling: string[]
  /** 实际扫过的 `/guides/...` 链接条数。为 0 说明判据没吃到数据，调用方必须判红。 */
  checked: number
  /** 每篇扫到多少条，供构建日志核对（总数 == checked）。 */
  perPage: Record<string, number>
}

export function scanGuideCrossLinks(
  pages: readonly { path: string }[],
  htmlOf: (path: string) => string,
): GuideLinkScan {
  const built = new Set(pages.map(p => p.path.replace(/\/+$/, '')));
  const dangling: string[] = [];
  const perPage: Record<string, number> = {};
  let checked = 0;
  for (const page of pages) {
    const html = htmlOf(page.path) ?? '';
    let n = 0;
    for (const m of html.matchAll(GUIDE_HREF_RE)) {
      checked += 1;
      n += 1;
      const target = m[1];
      if (!built.has(target)) {
        dangling.push(`${page.path} -> ${target}`);
      }
    }
    perPage[page.path] = n;
  }
  return { dangling, checked, perPage };
}
