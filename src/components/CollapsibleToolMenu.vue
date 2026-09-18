<script setup lang="ts">
import { IconHistory } from '@tabler/icons-vue';
import { useStorage } from '@vueuse/core';
import { useThemeVars } from 'naive-ui';
import { RouterLink, useRoute } from 'vue-router';
import { CLASSIC_SITE_TOOL_COUNT, classicSiteUrl } from '@/classic-site';
import MenuIconItem from './MenuIconItem.vue';
import type { Tool, ToolCategory } from '@/tools/tools.types';

const props = withDefaults(defineProps<{ toolsByCategory?: ToolCategory[] }>(), { toolsByCategory: () => [] });
const { toolsByCategory } = toRefs(props);
const route = useRoute();

const makeLabel = (tool: Tool) => () => h(RouterLink, { to: tool.path }, { default: () => tool.name });
const makeIcon = (tool: Tool) => () => h(MenuIconItem, { tool });

const collapsedCategories = useStorage<Record<string, boolean>>(
  'menu-tool-option:collapsed-categories',
  {},
  undefined,
  {
    deep: true,
    serializer: {
      read: v => (v ? JSON.parse(v) : null),
      write: v => JSON.stringify(v),
    },
  },
);

function toggleCategoryCollapse({ name }: { name: string }) {
  collapsedCategories.value[name] = !collapsedCategories.value[name];
}

const menuOptions = computed(() =>
  toolsByCategory.value.map(({ name, components }) => ({
    name,
    isCollapsed: collapsedCategories.value[name],
    tools: components.map(tool => ({
      label: makeLabel(tool),
      icon: makeIcon(tool),
      key: tool.path,
    })),
  })),
);

const themeVars = useThemeVars();
</script>

<template>
  <div v-for="{ name, tools, isCollapsed } of menuOptions" :key="name">
    <div ml-6px mt-12px flex cursor-pointer items-center op-60 @click="toggleCategoryCollapse({ name })">
      <span :class="{ 'rotate-0': isCollapsed, 'rotate-90': !isCollapsed }" text-16px lh-1 op-50 transition-transform>
        <icon-mdi-chevron-right />
      </span>

      <span ml-8px text-13px>
        {{ name }}
      </span>
    </div>

    <n-collapse-transition :show="!isCollapsed">
      <div class="menu-wrapper">
        <div class="toggle-bar" @click="toggleCategoryCollapse({ name })" />

        <n-menu
          class="menu"
          :value="route.path"
          :collapsed-width="64"
          :collapsed-icon-size="22"
          :options="tools"
          :indent="8"
          :default-expand-all="true"
        />
      </div>
    </n-collapse-transition>
  </div>

  <!--
    经典版入口（162 个早期工具，由 public/legacy/ 静态提供）。
    它不在 vue-router 路由表内，所以这里必须是原生 <a>：
    换成 RouterLink 会被路由接住并落到 404。
  -->
  <a class="classic-entry" :href="classicSiteUrl">
    <n-icon :component="IconHistory" :size="16" />
    <span class="classic-label">{{ $t('home.classic.entry') }}</span>
    <span class="classic-count">{{ CLASSIC_SITE_TOOL_COUNT }}</span>
  </a>
</template>

<style scoped lang="less">
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
    width: 24px;
    opacity: 0.1;
    transition: opacity ease 0.2s;
    position: relative;
    cursor: pointer;

    &::before {
      width: 2px;
      height: 100%;
      content: ' ';
      background-color: v-bind('themeVars.textColor3');
      border-radius: 2px;
      position: absolute;
      top: 0;
      left: 14px;
    }

    &:hover {
      opacity: 0.5;
    }
  }
}

/*
  经典版入口。与上方的工具菜单刻意做出区分：虚线边框 + 计数徽标，
  传达「这是另一套站点（静态子站），不是本页路由」。
*/
.classic-entry {
  display: flex;
  align-items: center;

  margin: 14px 6px 10px;
  padding: 8px 10px;
  border: 1px dashed v-bind('themeVars.borderColor');
  border-radius: 6px;

  color: inherit;
  text-decoration: none;
  opacity: 0.75;

  transition: opacity 0.2s ease, border-color 0.2s ease;

  &:hover {
    opacity: 1;
    border-color: v-bind('themeVars.primaryColor');
  }

  .classic-label {
    margin-left: 8px;
    font-size: 13px;
  }

  .classic-count {
    min-width: 20px;
    margin-left: auto;
    padding: 0 6px;
    border-radius: 9px;
    background-color: v-bind('themeVars.actionColor');

    font-size: 11px;
    line-height: 18px;
    text-align: center;
    opacity: 0.75;
  }
}
</style>
