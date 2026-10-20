import { describe, expect, it } from 'vitest';
import { TOOL_CLUSTERS } from '../seo/clusters';
import { groupByPrimaryCluster } from './nav-groups';

// 用真实簇里的 path 构造，确保测的是「按真实簇去重/排序」，不是自造 fixture 自循环。
const t = (path: string) => ({ path });

describe('groupByPrimaryCluster — 内链守恒不变式', () => {
  const tools = [
    t('/json-prettify'),
    t('/json-minify'),
    t('/json-to-csv'),
    t('/csv-to-json'),
    t('/yaml-to-json-converter'),
    t('/xml-to-json'),
    t('/uuid-generator'),
    t('/nanoid-generator'),
    t('/qr-code-generator'), // 不在任何簇 → 兜底组
    t('/meta-tag-generator'), // 不在任何簇 → 兜底组
  ];

  it('分组不丢不重：Σ 组内工具数 == 输入数，且 path 全局唯一', () => {
    const groups = groupByPrimaryCluster(tools);
    const flat = groups.flatMap(g => g.tools.map(x => x.path));
    expect(flat.length).toBe(tools.length);
    expect(new Set(flat).size).toBe(tools.length);
  });

  it('空输入 → 空数组（不抛错、不产出幽灵组）', () => {
    expect(groupByPrimaryCluster([])).toEqual([]);
  });

  it('兜底组（clusterId=null）永远排在最后，且只收未成簇工具', () => {
    const groups = groupByPrimaryCluster(tools);
    const restIdx = groups.findIndex(g => g.clusterId === null);
    expect(restIdx).toBe(groups.length - 1);
    expect(groups[restIdx].tools.map(x => x.path).sort()).toEqual(['/meta-tag-generator', '/qr-code-generator']);
  });
});

describe('groupByPrimaryCluster — 主簇去重（多归属工具只进定义序第一个簇）', () => {
  it('/yaml-to-json-converter 归 json 主簇，不在 yaml 组重复出现', () => {
    const groups = groupByPrimaryCluster([t('/yaml-to-json-converter'), t('/yaml-to-toml')]);
    const pathsIn = (id: string) => groups.find(g => g.clusterId === id)?.tools.map(x => x.path) ?? [];
    expect(pathsIn('json')).toContain('/yaml-to-json-converter');
    expect(pathsIn('yaml')).not.toContain('/yaml-to-json-converter');
    // /yaml-to-toml 主簇是 yaml（json 簇没有它）
    expect(pathsIn('yaml')).toContain('/yaml-to-toml');
  });

  it('/xml-to-json 归 json 主簇（定义序 json 在 xml 之前）', () => {
    const groups = groupByPrimaryCluster([t('/xml-to-json')]);
    expect(groups.find(g => g.clusterId === 'json')?.tools.map(x => x.path)).toContain('/xml-to-json');
    expect(groups.some(g => g.clusterId === 'xml')).toBe(false);
  });
});

describe('groupByPrimaryCluster — 组内顺序 = 该簇 members 顺序', () => {
  it('乱序输入，json 组按 clusters.ts 定义顺序重排（顺序即工作流语义）', () => {
    const jsonCluster = TOOL_CLUSTERS.find(c => c.id === 'json')!;
    // 故意按 members 逆序喂进去
    const reversed = [...jsonCluster.members].reverse().map(t);
    const groups = groupByPrimaryCluster(reversed);
    const jsonGroup = groups.find(g => g.clusterId === 'json')!;
    expect(jsonGroup.tools.map(x => x.path)).toEqual(jsonCluster.members);
  });
});
