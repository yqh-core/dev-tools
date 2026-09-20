import { type MaybeRef, get, useStorage } from '@vueuse/core';
import { defineStore } from 'pinia';
import type { Ref } from 'vue';
import _ from 'lodash';
import type { Tool, ToolWithCategory } from './tools.types';
import { toolsWithCategory } from './index';

/**
 * 分类分区的实际形状。
 *
 * 不能写成 tools.types 里的 `ToolCategory`（那是 `components: Tool[]`）：
 * 这里的分组来自 `tools`（`ToolWithCategory[]`），每个元素都带 `category`，
 * 用 `ToolCategory` 声明等于把已知信息丢掉 —— 调用方（如首页
 * `<ToolCard :tool="tool" />`）会拿不到 category 而报类型错。
 *
 * 刻意不再带 `path` 字段：lodash `_.map` 回调的第三个参数是**整个集合对象**，
 * 早期代码把它当成分类名塞进了 `path`，是个从未被任何调用方使用的错值。
 */
type ToolCategoryGroup = {
  name: string
  components: ToolWithCategory[]
};

/** 最近使用最多保留多少条 —— 只在客户端 localStorage 里，不参与 SSG 渲染。 */
const RECENT_LIMIT = 12;

export const useToolStore = defineStore('tools', () => {
  const favoriteToolsName = useStorage('favoriteToolsName', []) as Ref<string[]>;
  const recentToolsName = useStorage('recentToolsName', []) as Ref<string[]>;
  const { t } = useI18n();

  const tools = computed<ToolWithCategory[]>(() => toolsWithCategory.map((tool) => {
    const toolI18nKey = tool.path.replace(/\//g, '');

    return ({
      ...tool,
      path: tool.path,
      name: t(`tools.${toolI18nKey}.title`, tool.name),
      description: t(`tools.${toolI18nKey}.description`, tool.description),
      category: t(`tools.categories.${tool.category.toLowerCase()}`, tool.category),
    });
  }));

  const toolsByCategory = computed<ToolCategoryGroup[]>(() => {
    return _.chain(tools.value)
      .groupBy('category')
      .map((components, name) => ({
        name,
        components,
      }))
      .value();
  });

  const favoriteTools = computed(() => {
    return favoriteToolsName.value
      .map(favoriteName => tools.value.find(({ name, path }) => name === favoriteName || path === favoriteName))
      .filter(Boolean) as ToolWithCategory[]; // cast because .filter(Boolean) does not remove undefined from type
  });

  /**
   * 最近使用 —— 与收藏同源（localStorage），不需要登录。
   *
   * 只存 `path`（不像收藏那样兼容 name）：收藏是历史遗留、早期存过 name，
   * 最近使用是新增能力，从一开始就只写 path，避免再引入第二种取值口径。
   * 过滤掉已下架/改名的工具（`find` 返回 undefined），防止旧数据把列表打空。
   */
  const recentTools = computed(() => {
    return recentToolsName.value
      .map(path => tools.value.find(tool => tool.path === path))
      .filter(Boolean) as ToolWithCategory[];
  });

  return {
    tools,
    favoriteTools,
    recentTools,
    toolsByCategory,
    newTools: computed(() => tools.value.filter(({ isNew }) => isNew)),

    addToolToFavorites({ tool }: { tool: MaybeRef<Tool> }) {
      const toolPath = get(tool).path;
      if (toolPath) {
        favoriteToolsName.value.push(toolPath);
      }
    },

    removeToolFromFavorites({ tool }: { tool: MaybeRef<Tool> }) {
      favoriteToolsName.value = favoriteToolsName.value.filter(name => get(tool).name !== name && get(tool).path !== name);
    },

    isToolFavorite({ tool }: { tool: MaybeRef<Tool> }) {
      return favoriteToolsName.value.includes(get(tool).name)
        || favoriteToolsName.value.includes(get(tool).path);
    },

    updateFavoriteTools(newOrder: ToolWithCategory[]) {
      favoriteToolsName.value = newOrder.map(tool => tool.path);
    },

    /**
     * 记录一次使用：去重后置顶，超长截断。
     *
     * 为什么先过滤再 unshift 而不是直接 push：用户连续打开同一个工具时，
     * 列表里只应保留一条且排在最前；push 会让同一工具占满整个列表。
     */
    recordToolUse({ tool }: { tool: MaybeRef<Tool> }) {
      const toolPath = get(tool).path;
      if (!toolPath) {
        return;
      }
      const rest = recentToolsName.value.filter(path => path !== toolPath);
      recentToolsName.value = [toolPath, ...rest].slice(0, RECENT_LIMIT);
    },

    removeToolFromRecent({ tool }: { tool: MaybeRef<Tool> }) {
      recentToolsName.value = recentToolsName.value.filter(path => path !== get(tool).path);
    },

    clearRecentTools() {
      recentToolsName.value = [];
    },
  };
});
