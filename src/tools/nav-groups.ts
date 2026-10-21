import { TOOL_CLUSTERS, clusterOf } from '../seo/clusters';

/**
 * 侧栏 / 首页的「任务簇视角」分组器（纯函数，零 i18n / 零 DOM，可在 Node 直接测）。
 *
 * ## 为什么要有这一层
 * 此前侧栏和首页分类卡都按 `toolsByCategory` 的 10 个**数据库分类**（Crypto / Converter /
 * Web …）组织。但用户脑子里想的是任务（「我要转 JSON」「我要弄图片」），不是分类。
 * `TOOL_CLUSTERS` 已经把工具按任务组织成了若干任务簇（数量以 `clusters.ts` 为准，
 * 还带工作流顺序），只是这份「任务视角」此前只用在工具页底部的 related / workflow，
 * 没用到导航。这里把它接上。
 *
 * ## 两条硬约束（决定了正确性，改动前务必读）
 * 1. **按主簇去重**：一个 path 可以出现在多个簇（`/yaml-to-json-converter` 同时在 json
 *    和 yaml 簇里，见 clusters.ts 文件头第 1 条）。侧栏若按簇平铺会让它出现两次。
 *    用 `clusterOf`（主簇 = 定义顺序上第一个包含它的簇）保证**每个工具只进一个组**。
 * 2. **内链守恒**：未成簇的工具不能丢（红线「整站内链不减少」）。所有没有主簇的
 *    工具统一归到末尾的 `clusterId === null` 兜底组（组件层显示为「更多工具」）。
 *    这条由单测的不变式 `Σ groups[].tools.length === tools.length` 锁死，不是靠自觉。
 *
 * 簇内顺序沿用该簇 `members` 的相对顺序（顺序 = 工作流语义，见 clusters.ts 文件头第 2 条），
 * 而不是 tools 入参顺序。
 */
export interface NavGroup {
  /** 簇 id；null = 未成簇工具的兜底组。组件层用 `clusters.<id>` 或「更多工具」词条解析显示名。 */
  clusterId: string | null
}

export interface NavGroupWithTools<T> extends NavGroup {
  tools: T[]
}

export function groupByPrimaryCluster<T extends { path: string }>(tools: T[]): NavGroupWithTools<T>[] {
  const byCluster = new Map<string, T[]>();
  const rest: T[] = [];

  for (const tool of tools) {
    const cluster = clusterOf(tool.path);
    if (cluster) {
      const bucket = byCluster.get(cluster.id);
      if (bucket) {
        bucket.push(tool);
      }
      else {
        byCluster.set(cluster.id, [tool]);
      }
    }
    else {
      rest.push(tool);
    }
  }

  // 按 TOOL_CLUSTERS 的定义顺序产出组（稳定），组内按该簇 members 顺序重排。
  const groups: NavGroupWithTools<T>[] = TOOL_CLUSTERS
    .filter(cluster => byCluster.has(cluster.id))
    .map((cluster) => {
      const bucket = byCluster.get(cluster.id)!;
      const order = new Map(cluster.members.map((m, i) => [m, i]));
      bucket.sort((a, b) => (order.get(a.path) ?? 0) - (order.get(b.path) ?? 0));
      return { clusterId: cluster.id as string | null, tools: bucket };
    });

  if (rest.length > 0) {
    groups.push({ clusterId: null, tools: rest });
  }

  return groups;
}
