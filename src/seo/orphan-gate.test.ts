import { describe, expect, it } from 'vitest';
import { findOrphanPages } from './tool-page';
import { TOOL_SEO_PAGES } from './tool-page';
import { STANDALONE_ALLOWLIST } from './clusters';

// F5 防回归门禁的**证伪自检**：证明 findOrphanPages 既是「摆设的反面」（能判红），
// 又不过度误伤（链到 / 豁免即判绿）。全部用合成小数据，不依赖真实 116 页顺序。
type Page = Parameters<typeof findOrphanPages>[0][number];
const rel = (p: string) => ({ path: p, name: p });
const wf = (p: string, current = false) => ({ path: p, name: p, current });

function page(path: string, related: Page['related'] = [], workflow: Page['workflow'] = []): Page {
  return { path, related, workflow } as Page;
}

describe('findOrphanPages — 会判红（非摆设）', () => {
  it('没有任何页链到它、自身也非豁免 → 判为孤立', () => {
    const pages = [
      page('/a', [rel('/b')], [wf('/a', true), wf('/b')]),
      page('/b', [rel('/a')], [wf('/b', true), wf('/a')]),
      page('/orphan'), // 谁都不链它，自己也谁都不链
    ];
    const orphans = findOrphanPages(pages, new Set());
    expect(orphans.map(o => o.path)).toEqual(['/orphan']);
  });

  it('只被自己在 related 里“链到”不算入度（self 不计）', () => {
    // /x 的 related 含 /x（防御性：真实数据不该出现，但判据不能被它骗）
    const pages = [page('/x', [rel('/x')], [wf('/x', true)])];
    expect(findOrphanPages(pages, new Set()).map(o => o.path)).toEqual(['/x']);
  });

  it('workflow 里 current:true 的自身标记不算入度', () => {
    const pages = [
      page('/a', [rel('/a')]), // /a 自链 related（被 self 守卫挡掉）
      page('/b', [], [wf('/b', true)]), // /b 只在自己工作流里当 current → 不算入度
    ];
    const flagged = findOrphanPages(pages, new Set()).map(o => o.path).sort();
    expect(flagged).toEqual(['/a', '/b']);
  });
});

describe('findOrphanPages — 不误伤（任一入口或豁免即放行）', () => {
  it('被别的页 related 链到 → 放行', () => {
    const pages = [
      page('/a', [rel('/orphan')]),
      page('/orphan', [rel('/a')]),
    ];
    expect(findOrphanPages(pages, new Set())).toEqual([]);
  });

  it('进入别的页 workflow（非 current）→ 放行', () => {
    const pages = [
      page('/a', [], [wf('/a', true), wf('/orphan')]),
      page('/orphan', [rel('/a')]), // 让 /a 也有入度（来自 /orphan 的 related），否则 /a 本身被判孤立
    ];
    expect(findOrphanPages(pages, new Set())).toEqual([]);
  });

  it('在 allowlist 中显式豁免 → 放行（即便真的 R=W=0）', () => {
    // /orphan 是真正 R=W=0 的页（没人链它），仅因 allowlist 放行；
    // /a 靠 /orphan 的 related 拿到入度，避免它自己被误判。
    const pages = [page('/a', [rel('/a')], []), page('/orphan', [rel('/a')])];
    expect(findOrphanPages(pages, new Set(['/orphan']))).toEqual([]);
  });
});

describe('findOrphanPages — 真实数据当前必须 0 孤立（锁死 F5-02 收口）', () => {
  it('白名单每条路径必须真实存在于工具页集合（拼错 / 死路由 → 判红）', () => {
    // 失效白名单比没有白名单更糟：反向自检对不存在的条目「查无此人」会空过，
    // 真实数据测试也因 !allowlist.has(真路径) 匹配不上而失去保护 —— 该页若哪天
    // 掉成 R=W=0，门禁反而拦不住。所以路径存在性必须在门禁链里显式断言。
    const realPaths = new Set(TOOL_SEO_PAGES.map((e) => e.path));
    for (const p of STANDALONE_ALLOWLIST) {
      expect(realPaths.has(p), `STANDALONE_ALLOWLIST 含无效路径：${p}（不存在于 ${realPaths.size} 个工具页中）`).toBe(true);
    }
  });

  it('白名单非空（清空会让反向自检 0 迭代假通过）', () => {
    // vitest 的 for 循环体 0 次迭代 = 测试静默绿；此处给反向自检补一个
    // 不依赖循环的对照组：当前恰好 2 条豁免（keycode-info / today-in-history），
    // 若将来有人删除白名单，先在这里变红，而不是让 §反向自检 空转。
    expect(STANDALONE_ALLOWLIST.size).toBeGreaterThan(0);
  });

  it('116 页里，非豁免工具全部至少有一个语境入口', () => {
    const orphans = findOrphanPages(TOOL_SEO_PAGES, STANDALONE_ALLOWLIST);
    // 若这里变红，说明新增/改簇让某个工具重新掉成 R=W=0 且没进白名单。
    expect(orphans).toEqual([]);
  });

  it('白名单里的页确实是真的“无近邻”（防止白名单变成藏污纳垢的兜底）', () => {
    // 反向自检：STANDALONE_ALLOWLIST 每个成员在真实数据里必须 R=W=0，
    // 否则它早该归簇、不该躺在白名单里。
    const asPage = (e: typeof TOOL_SEO_PAGES[number]): Page => ({
      path: e.path,
      related: e.related,
      workflow: e.workflow,
    });
    // 去掉 allowlist 后，这些页**本应**被判为孤立——用「只喂它自己 + 一个对照」来验证
    // 它在真实 related/workflow 里确实没有外部入度。
    for (const allowPath of STANDALONE_ALLOWLIST) {
      const inboundFromOthers = TOOL_SEO_PAGES.some(
        e =>
          e.path !== allowPath &&
          (e.related.some(r => r.path === allowPath) ||
            e.workflow.some(w => w.path === allowPath && !w.current)),
      );
      expect(inboundFromOthers, `${allowPath} 已有外部入度，不该再留在 STANDALONE_ALLOWLIST`).toBe(false);
    }
  });
});
