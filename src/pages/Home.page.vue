<script setup lang="ts">
import { IconDragDrop, IconHeart, IconSearch, IconX } from '@tabler/icons-vue';
import { useHead } from '@vueuse/head';
import { computed, ref } from 'vue';
import Draggable from 'vuedraggable';
import ColoredCard from '../components/ColoredCard.vue';
import ToolCard from '../components/ToolCard.vue';
import { useToolStore } from '@/tools/tools.store';
import { ALIASES } from '@/tools/aliases';
import { config } from '@/config';

const toolStore = useToolStore();

useHead({ title: 'YQH 工具箱 - 开发者常用在线工具' });
const { t } = useI18n();

const favoriteTools = computed(() => toolStore.favoriteTools);

/**
 * 首页搜索。
 *
 * 86 个工具平铺在一屏里，光靠眼睛找很累。匹配范围除了标题和描述，
 * 还包括 aliases.ts 里的中文同义词 —— 用户搜「时间戳」要能找到「日期时间转换器」，
 * 搜「美化」要能找到 JSON / SQL / XML 的那几个格式化工具。
 */
const searchQuery = ref('');

const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase());

function toolHaystack(tool: { name: string; description: string; path: string }) {
  return [tool.name, tool.description, tool.path, ...(ALIASES[tool.path] ?? [])]
    .join(' ')
    .toLowerCase();
}

const matchedTools = computed(() => {
  const q = normalizedQuery.value;
  if (!q) return [];
  return toolStore.tools.filter(tool => toolHaystack(tool).includes(q));
});

const isSearching = computed(() => normalizedQuery.value.length > 0);

// Update favorite tools order when drag is finished
function onUpdateFavoriteTools() {
  toolStore.updateFavoriteTools(favoriteTools.value); // Update the store with the new order
}
</script>

<template>
  <div class="pt-50px">
    <div class="grid-wrapper">
      <!-- 搜索框：工具一多，「找得到」比「有多少」更重要 -->
      <div class="search-bar">
        <n-icon :component="IconSearch" class="search-icon" />
        <input
          v-model="searchQuery"
          class="search-input"
          type="search"
          placeholder="搜索工具，例如：时间戳、美化、二维码、base64"
          aria-label="搜索工具"
        >
        <button
          v-if="isSearching"
          class="search-clear"
          type="button"
          aria-label="清空搜索"
          @click="searchQuery = ''"
        >
          <n-icon :component="IconX" size="16" />
        </button>
      </div>

      <div v-if="isSearching" class="search-result-head">
        <span v-if="matchedTools.length > 0">
          找到 {{ matchedTools.length }} 个匹配「{{ searchQuery.trim() }}」的工具
        </span>
        <span v-else>
          没有找到匹配「{{ searchQuery.trim() }}」的工具，换个说法试试（如「格式化」「转换」「生成」）
        </span>
      </div>

      <div v-if="isSearching" class="grid grid-cols-1 gap-12px lg:grid-cols-3 md:grid-cols-3 sm:grid-cols-2 xl:grid-cols-4">
        <ToolCard v-for="tool in matchedTools" :key="tool.name" :tool="tool" />
      </div>

      <template v-if="!isSearching">
      <div class="grid grid-cols-1 gap-12px lg:grid-cols-3 md:grid-cols-3 sm:grid-cols-2 xl:grid-cols-4">
        <ColoredCard v-if="config.showBanner" :title="$t('home.follow.title')" :icon="IconHeart">
          {{ $t('home.follow.p1') }}
          <a
            href="https://github.com/yqh-core/yqh-devtools"
            rel="noopener"
            target="_blank"
            :aria-label="$t('home.follow.githubRepository')"
          >GitHub</a>
          {{ $t('home.follow.p2') }}
          <a
            href="https://github.com/yqh-core/yqh-devtools"
            rel="noopener"
            target="_blank"
            :aria-label="$t('home.follow.twitterXAccount')"
          >X</a>.
          {{ $t('home.follow.thankYou') }}
          <n-icon :component="IconHeart" />
        </ColoredCard>
      </div>

      <transition name="height">
        <div v-if="toolStore.favoriteTools.length > 0">
          <h3 class="mb-5px mt-25px text-neutral-400 font-500">
            {{ $t('home.categories.favoriteTools') }}
            <c-tooltip :tooltip="$t('home.categories.favoritesDndToolTip')">
              <n-icon :component="IconDragDrop" size="18" />
            </c-tooltip>
          </h3>
          <Draggable
            :list="favoriteTools"
            class="grid grid-cols-1 gap-12px lg:grid-cols-3 md:grid-cols-3 sm:grid-cols-2 xl:grid-cols-4"
            ghost-class="ghost-favorites-draggable"
            item-key="name"
            @end="onUpdateFavoriteTools"
          >
            <template #item="{ element: tool }">
              <ToolCard :tool="tool" />
            </template>
          </Draggable>
        </div>
      </transition>

      <div v-if="toolStore.newTools.length > 0">
        <h3 class="mb-5px mt-25px text-neutral-400 font-500">
          {{ t('home.categories.newestTools') }}
        </h3>
        <div class="grid grid-cols-1 gap-12px lg:grid-cols-3 md:grid-cols-3 sm:grid-cols-2 xl:grid-cols-4">
          <ToolCard v-for="tool in toolStore.newTools" :key="tool.name" :tool="tool" />
        </div>
      </div>

      <h3 class="mb-5px mt-25px text-neutral-400 font-500">
        {{ $t('home.categories.allTools') }}
      </h3>
      <div class="grid grid-cols-1 gap-12px lg:grid-cols-3 md:grid-cols-3 sm:grid-cols-2 xl:grid-cols-4">
        <ToolCard v-for="tool in toolStore.tools" :key="tool.name" :tool="tool" />
      </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="less">
.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;

  margin-bottom: 12px;
  padding: 10px 14px;

  border: 1px solid rgba(128, 128, 128, 0.35);
  border-radius: 8px;
  background: rgba(128, 128, 128, 0.06);

  &:focus-within {
    border-color: rgba(24, 160, 88, 0.8);
  }

  .search-icon {
    flex: none;
    opacity: 0.5;
  }

  .search-input {
    flex: 1;
    min-width: 0;

    border: none;
    background: transparent;
    outline: none;

    color: inherit;
    font-size: 15px;
    font-family: inherit;

    &::placeholder {
      color: inherit;
      opacity: 0.4;
    }

    /* 去掉 Chrome 搜索框自带的清除按钮，用自己的 */
    &::-webkit-search-cancel-button {
      display: none;
    }
  }

  .search-clear {
    display: flex;
    align-items: center;

    padding: 2px;
    border: none;
    border-radius: 4px;
    background: none;

    color: inherit;
    cursor: pointer;
    opacity: 0.5;

    &:hover {
      opacity: 1;
    }
  }
}

.search-result-head {
  margin-bottom: 10px;
  opacity: 0.6;
  font-size: 13px;
}

.height-enter-active,
.height-leave-active {
  transition: all 0.5s ease-in-out;
  overflow: hidden;
  max-height: 500px;
}

.height-enter-from,
.height-leave-to {
  max-height: 42px;
  overflow: hidden;
  opacity: 0;
  margin-bottom: 0;
}

.ghost-favorites-draggable {
  opacity: 0.4;
  background-color: #ccc;
  border: 2px dashed #666;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
  transform: scale(1.1);
  animation: ghost-favorites-draggable-animation 0.2s ease-out;
}

@keyframes ghost-favorites-draggable-animation {
  0% {
    opacity: 0;
    transform: scale(0.9);
  }
  100% {
    opacity: 0.4;
    transform: scale(1.0);
  }
}
</style>
