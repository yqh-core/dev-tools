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

export const useToolStore = defineStore('tools', () => {
  const favoriteToolsName = useStorage('favoriteToolsName', []) as Ref<string[]>;
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

  return {
    tools,
    favoriteTools,
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
  };
});
