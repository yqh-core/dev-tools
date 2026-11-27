<script setup lang="ts">
import { useStorage } from '@vueuse/core';
import { useThemeVars } from 'naive-ui';
import { RouterLink, useRoute } from 'vue-router';
import MenuIconItem from './MenuIconItem.vue';
import type { Tool, ToolCategory } from '@/tools/tools.types';
import { normalizePath } from '@/seo/site';

const props = withDefaults(defineProps<{ toolsByCategory?: ToolCategory[] }>(), { toolsByCategory: () => [] });
const { toolsByCategory } = toRefs(props);
const route = useRoute();

// Menu item keys are tool registry paths without a trailing slash; Pages URLs are normalized here.
const currentPath = computed<string>(() => route.path.replace(/\/+$/, '') || '/');

const makeLabel = (tool: Tool) => () => h(RouterLink, { to: normalizePath(tool.path) }, { default: () => tool.name });
const makeIcon = (tool: Tool) => () => h(MenuIconItem, { tool });

const defaultCollapsedCategories = Object.fromEntries(
  toolsByCategory.value.map(({ name }) => [name, true]),
);
const collapsedCategories = useStorage<Record<string, boolean>>(
  'menu-tool-option:collapsed-categories',
  defaultCollapsedCategories,
  undefined,
  {
    deep: true,
    serializer: {
      read: v => (v ? JSON.parse(v) : null),
      write: v => JSON.stringify(v),
    },
  },
);

// Unknown/new groups are collapsed by default; explicit stored choices always win.
const activeCategoryName = computed(() =>
  toolsByCategory.value.find(({ components }) => components.some(tool => tool.path === currentPath.value))?.name ?? null,
);

// A deep-linked tool reveals only its own group. The override is route-scoped and is not
// persisted, so it does not silently rewrite a user's saved expand/collapse preferences.
const routeExpandedCategory = ref<string | null>(activeCategoryName.value);
watch(currentPath, () => {
  routeExpandedCategory.value = activeCategoryName.value;
});

function isCategoryCollapsed(name: string) {
  if (routeExpandedCategory.value === name) {
    return false;
  }
  return collapsedCategories.value[name] ?? true;
}

function toggleCategoryCollapse({ name }: { name: string }) {
  const currentlyCollapsed = isCategoryCollapsed(name);
  collapsedCategories.value[name] = !currentlyCollapsed;
  if (routeExpandedCategory.value === name) {
    routeExpandedCategory.value = null;
  }
}

const menuOptions = computed(() =>
  toolsByCategory.value.map(({ name, components }, index) => {
    const firstPath = components[0]?.path ?? String(index);
    const panelId = `tool-category-panel-${index}-${firstPath.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9_-]/gi, '-')}`;
    return {
      name,
      panelId,
      toggleId: `tool-category-toggle-${index}`,
      isCollapsed: isCategoryCollapsed(name),
      tools: components.map(tool => ({
        label: makeLabel(tool),
        icon: makeIcon(tool),
        key: tool.path,
      })),
    };
  }),
);

const themeVars = useThemeVars();
</script>

<template>
  <div v-for="{ name, tools, isCollapsed, panelId, toggleId } of menuOptions" :key="name">
    <button
      :id="toggleId"
      type="button"
      class="category-toggle"
      data-test-id="tool-category-toggle"
      :data-category-name="name"
      :aria-expanded="!isCollapsed"
      :aria-controls="panelId"
      @click="toggleCategoryCollapse({ name })"
    >
      <span
        class="category-toggle-chevron"
        :class="{ 'is-expanded': !isCollapsed }"
        aria-hidden="true"
      >
        <icon-mdi-chevron-right />
      </span>
      <span class="category-toggle-label">{{ name }}</span>
    </button>

    <n-collapse-transition :show="!isCollapsed">
      <div :id="panelId" class="menu-wrapper" role="region" :aria-labelledby="toggleId">
        <div class="toggle-bar" aria-hidden="true" />

        <n-menu
          class="menu"
          :value="currentPath"
          :collapsed-width="64"
          :collapsed-icon-size="22"
          :options="tools"
          :indent="8"
          :default-expand-all="true"
        />
      </div>
    </n-collapse-transition>
  </div>
</template>

<style scoped lang="less">
.category-toggle {
  display: flex;
  align-items: center;
  width: calc(100% - 12px);
  min-height: 44px;
  margin: 12px 6px 0;
  padding: 0 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  opacity: 0.72;
  transition: background-color ease 0.16s, opacity ease 0.16s;

  &:hover {
    opacity: 1;
    background-color: v-bind('themeVars.actionColor');
  }

  &:focus-visible {
    outline: 2px solid v-bind('themeVars.primaryColor');
    outline-offset: 2px;
  }

  .category-toggle-chevron {
    display: inline-flex;
    flex: 0 0 16px;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    line-height: 1;
    opacity: 0.56;
    transition: transform ease 0.16s;

    &.is-expanded {
      transform: rotate(90deg);
    }
  }

  .category-toggle-label {
    margin-left: 8px;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.3;
  }
}

.menu-wrapper {
  display: flex;
  flex-direction: row;

  .menu {
    flex: 1;
    margin-bottom: 5px;

    ::v-deep(.n-menu-item-content::before) {
      left: 0;
      right: 13px;
    }
  }

  .toggle-bar {
    position: relative;
    width: 24px;
    opacity: 0.1;

    &::before {
      position: absolute;
      top: 0;
      left: 14px;
      width: 2px;
      height: 100%;
      border-radius: 2px;
      background-color: v-bind('themeVars.textColor3');
      content: '';
    }
  }
}

/*
  经典版入口已摘除主站引导（2026-10-20）：/legacy 整站是 zh-CN + noindex，
  英文界面点它等于把用户丢进纯中文老站。主站不再在侧栏推这个入口；
  legacy 静态页仍保留、经 /legacy/ 直链可达（public/_redirects 的 catch-all 200 未动）。
  逐条退役等 legacy 93 条清单裁定。
*/
</style>
