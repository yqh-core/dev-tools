<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useHead } from '@vueuse/head';
import type { HeadObject } from '@vueuse/head';

import BaseLayout from './base.layout.vue';
import FavoriteButton from '@/components/FavoriteButton.vue';
import type { Tool } from '@/tools/tools.types';

// 只取类型，不会把几十 KB 的文案打进主包
import type { ToolGuide } from '@/tools/guides';

const route = useRoute();

const head = computed<HeadObject>(() => ({
  title: `${route.meta.name} - 开发者工具箱`,
  meta: [
    {
      name: 'description',
      content: route.meta?.description as string,
    },
    {
      name: 'keywords',
      content: ((route.meta.keywords ?? []) as string[]).join(','),
    },
  ],
}));
useHead(head);
const { t } = useI18n();

const i18nKey = computed<string>(() => route.path.trim().replace('/', ''));
const toolTitle = computed<string>(() => t(`tools.${i18nKey.value}.title`, String(route.meta.name)));
const toolDescription = computed<string>(() => t(`tools.${i18nKey.value}.description`, String(route.meta.description)));

/**
 * 使用说明按需加载。
 *
 * 86 条说明是纯文案，同步 import 会把它们塞进主包拖慢首屏，
 * 所以只在进入工具页时才动态加载，且整个站共用同一个 chunk。
 */
const guide = ref<ToolGuide | null>(null);

async function loadGuide(path: string) {
  try {
    const { GUIDES } = await import('@/tools/guides');
    guide.value = GUIDES[path] ?? null;
  }
  catch {
    guide.value = null; // 加载失败就当这个工具没说明，不影响使用
  }
}

watch(() => route.path, path => loadGuide(path), { immediate: true });

/**
 * 说明面板是否展开。
 *
 * 默认折叠，免得每次进工具都被一大段文字挡住；但用户只要展开过一次，
 * 说明他愿意看，之后就默认展开。偏好记在 localStorage 里。
 */
const GUIDE_SEEN_KEY = 'digdevbox:guide-seen';
const guideOpen = ref(false);

try {
  guideOpen.value = localStorage.getItem(GUIDE_SEEN_KEY) === '1';
}
catch {
  // 隐私模式下 localStorage 不可用，保持折叠即可
}

watch(guideOpen, (open) => {
  if (!open) {
    return;
  }
  try {
    localStorage.setItem(GUIDE_SEEN_KEY, '1');
  }
  catch {
    // 写不进去不影响使用
  }
});

const exampleApplied = ref(false);
watch(() => route.path, () => {
  exampleApplied.value = false;
});

/**
 * 把示例文本填进页面的第一个输入框。
 *
 * 工具页没有统一的输入组件，这里按「主内容区第一个可编辑控件」定位，
 * 并用原生 setter + input 事件赋值 —— 直接改 el.value 不会触发 Vue 的响应式更新。
 */
function applyExample() {
  const root = document.querySelector('.tool-content');
  if (!root || !guide.value?.example) {
    return;
  }

  const el = root.querySelector(
    'textarea, input[type="text"], input[type="search"], input[type="number"], input:not([type])',
  ) as HTMLTextAreaElement | HTMLInputElement | null;

  if (!el) {
    return;
  }

  const proto = Object.getPrototypeOf(el);
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) {
    setter.call(el, guide.value.example.text);
  }
  else {
    el.value = guide.value.example.text;
  }

  el.dispatchEvent(new Event('input', { bubbles: true }));
  exampleApplied.value = true;
  setTimeout(() => {
    exampleApplied.value = false;
  }, 2000);
}
</script>

<template>
  <BaseLayout>
    <div class="tool-layout">
      <div class="tool-header">
        <div flex flex-nowrap items-center justify-between>
          <n-h1>
            {{ toolTitle }}
          </n-h1>

          <div>
            <FavoriteButton :tool="{ name: route.meta.name, path: route.path } as Tool" />
          </div>
        </div>

        <div class="separator" />

        <div class="description">
          {{ toolDescription }}
        </div>

        <div v-if="guide" class="guide">
          <button
            class="guide-toggle"
            type="button"
            :aria-expanded="guideOpen"
            @click="guideOpen = !guideOpen"
          >
            <span class="guide-caret" :class="{ 'is-open': guideOpen }">▸</span>
            {{ guideOpen ? '收起使用说明' : '怎么用这个工具？' }}
          </button>

          <div v-show="guideOpen" class="guide-body">
            <p class="guide-intro">
              {{ guide.intro }}
            </p>

            <ol class="guide-steps">
              <li v-for="(step, index) in guide.steps" :key="index">
                {{ step }}
              </li>
            </ol>

            <div v-if="guide.example" class="guide-example">
              <button class="guide-example-btn" type="button" @click="applyExample">
                {{ exampleApplied ? '✓ 已填入' : guide.example.label }}
              </button>
              <span class="guide-example-tip">不确定填什么？点一下自动填一份示例内容。</span>
            </div>

            <ul v-if="guide.notes?.length" class="guide-notes">
              <li v-for="(note, index) in guide.notes" :key="index">
                {{ note }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <div class="tool-content">
      <slot />
    </div>
  </BaseLayout>
</template>

<style lang="less" scoped>
.tool-content {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 16px;

  ::v-deep(& > *) {
    flex: 0 1 600px;
  }
}

.tool-layout {
  max-width: 600px;
  margin: 0 auto;
  box-sizing: border-box;

  .tool-header {
    padding: 40px 0;
    width: 100%;

    .n-h1 {
      opacity: 0.9;
      font-size: 40px;
      font-weight: 400;
      margin: 0;
      line-height: 1;
    }

    .separator {
      width: 200px;
      height: 2px;
      background: rgb(161, 161, 161);
      opacity: 0.2;

      margin: 10px 0;
    }

    .description {
      margin: 0;

      opacity: 0.7;
    }
  }
}

/* 使用说明：默认折叠，展开后才是完整内容 */
.guide {
  margin-top: 16px;

  .guide-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;

    padding: 4px 0;
    border: none;
    background: none;
    cursor: pointer;

    color: inherit;
    font-size: 14px;
    opacity: 0.75;

    &:hover {
      opacity: 1;
    }

    .guide-caret {
      display: inline-block;
      transition: transform 0.15s ease;

      &.is-open {
        transform: rotate(90deg);
      }
    }
  }

  .guide-body {
    margin-top: 8px;
    padding: 14px 16px;

    border-left: 3px solid rgba(24, 160, 88, 0.6);
    border-radius: 4px;
    background: rgba(128, 128, 128, 0.08);

    font-size: 14px;
    line-height: 1.7;
  }

  .guide-intro {
    margin: 0 0 10px;
    opacity: 0.85;
  }

  .guide-steps {
    margin: 0;
    padding-left: 20px;
    opacity: 0.8;

    li {
      margin-bottom: 4px;
    }
  }

  .guide-example {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;

    margin-top: 12px;

    .guide-example-btn {
      padding: 5px 12px;
      border: 1px solid rgba(24, 160, 88, 0.8);
      border-radius: 4px;

      background: rgba(24, 160, 88, 0.1);
      color: inherit;
      cursor: pointer;

      font-size: 13px;

      &:hover {
        background: rgba(24, 160, 88, 0.2);
      }
    }

    .guide-example-tip {
      opacity: 0.55;
      font-size: 12px;
    }
  }

  .guide-notes {
    margin: 12px 0 0;
    padding-left: 20px;

    opacity: 0.7;
    font-size: 13px;

    li {
      margin-bottom: 3px;
    }
  }
}
</style>
