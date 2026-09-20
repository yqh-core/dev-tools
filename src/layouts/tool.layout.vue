<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useHead } from '@vueuse/head';
import type { HeadObject } from '@vueuse/head';

import BaseLayout from './base.layout.vue';
import FavoriteButton from '@/components/FavoriteButton.vue';
import ToolCard from '@/components/ToolCard.vue';
import { useToolStore } from '@/tools/tools.store';
import type { Tool } from '@/tools/tools.types';

// 入口模块本身不含数据（只导出类型 + 按语言加载的函数），
// 两份说明各自是懒加载 chunk，不会把几十 KB 文案打进主包。
import { loadGuides } from '@/tools/guides';
import type { ToolGuide } from '@/tools/guides';

const route = useRoute();

const { t, locale } = useI18n();

/**
 * 同类相关工具。
 *
 * 工具定义本身不带分类字段，分类是聚合层（toolsByCategory）后来加的，
 * 所以这里从 store 的 tools（已含 category）按当前路由反查分类，再取同分类的其它工具。
 * 进工具页时给一个「同类推荐」，不用退出当前页就能发现相邻工具。
 */
const toolStore = useToolStore();

/**
 * 当前工具在注册表里的规范 path（不带尾斜杠）。
 *
 * 为什么不直接用 route.path
 * ------------------------------------------------------------------
 * Cloudflare Pages 的目录型路由对「磁盘存在同名目录」的路径强制 308 到带斜杠形式，
 * 本站的 canonical 与 sitemap 也统一写带斜杠形态 —— 也就是说，真实用户和爬虫拿到的
 * URL 是 `/hash-text/`，`route.path` 也就是 `/hash-text/`。
 * 而工具注册表、GUIDES、ALIASES、侧栏菜单 key 用的全是不带斜杠的 `/hash-text`。
 * 直接比对会静默失配：使用说明、一键示例、相关工具、面包屑分类、收藏 path
 * 会在**每一个真实访问**下一起失效（且失败被 catch 吞掉，界面上看不出报错）。
 */
const toolPath = computed<string>(() => route.path.replace(/\/+$/, '') || '/');

const currentTool = computed(
  () => toolStore.tools.find(tool => tool.path === toolPath.value),
);

const currentCategory = computed(() => currentTool.value?.category ?? '');

/**
 * 最近使用：进入工具页即记录一次。
 *
 * 用 watch + immediate 而不是 onMounted：路由在同一布局内切换（工具 A → 工具 B）
 * 不会重新挂载组件，onMounted 只会记一次，漏掉后续每一次。
 */
watch(
  currentTool,
  (tool) => {
    if (tool) {
      toolStore.recordToolUse({ tool });
    }
  },
  { immediate: true },
);
const relatedTools = computed(() =>
  currentCategory.value
    ? toolStore.tools
        .filter(tool => tool.category === currentCategory.value && tool.path !== toolPath.value)
        .slice(0, 8)
    : [],
);

// 去掉**全部**斜杠拼 i18n key（与 tools.store.ts 的 toolI18nKey 保持同一写法）。
// 只 replace 第一个 '/' 会让 key 变成 `hash-text/`，任何语言文件里都不存在这种 key。
const i18nKey = computed<string>(() => toolPath.value.replace(/\//g, ''));
const toolTitle = computed<string>(() => t(`tools.${i18nKey.value}.title`, String(route.meta.name)));
const toolDescription = computed<string>(() => t(`tools.${i18nKey.value}.description`, String(route.meta.description)));

/**
 * 客户端页面 head（title / description / keywords）。
 *
 * ⚠ 为什么这一段曾经导致全站工具页报错、而且**没有任何人发现**
 * --------------------------------------------------------------
 * 原来的写法是把它写在文件开头、`const { t } = useI18n()` **之前**：
 *
 *     const head = computed(() => ({ title: `${route.meta.name} - ${t('site.name')}` }))
 *     useHead(head)              // ← 这里就会首次求值 head
 *     const { t } = useI18n()    // ← 太晚了
 *
 * computed 是惰性的，但 `useHead` 在 setup 阶段就会取值 → `t` 仍在 TDZ，
 * 打包后变量名被压成 `r`，于是每个工具页都抛
 * `ReferenceError: Cannot access 'r' before initialization`。
 *
 * 后果**不是**「控制台多一行红字」，而是 **整个 head 从未生效**：
 *   · 浏览器标签页标题退化成 index.html 模板里的通用标题
 *     （实测 "DigDevBox - Online Developer Tools" —— 而 SSG 里是对的 "Hash text - DigDevBox"）
 *   · meta description 同样没被写入
 * 这正是「爬虫看一套、用户看另一套」，也是 E1-L10N 存在的理由。
 *
 * 修法是**调整声明顺序**（不用 try/catch 掩盖），并改用 `toolTitle` / `toolDescription`：
 * 与 SSG 骨架（`ToolSeoPage`）读同一批 `tools.<key>.title/description` 词条，
 * 所以两边逐字一致，切中文时标题也跟着变中文。
 */
const head = computed<HeadObject>(() => ({
  title: `${toolTitle.value} - ${t('site.name')}`,
  meta: [
    {
      name: 'description',
      content: toolDescription.value,
    },
    {
      name: 'keywords',
      content: ((route.meta.keywords ?? []) as string[]).join(','),
    },
  ],
}));
useHead(head);

/**
 * 使用说明按需加载（跟随当前语言）。
 *
 * 说明是纯文案，同步 import 会把它们塞进主包拖慢首屏，所以只在进入工具页时
 * 动态加载；en / zh 各是一个 chunk，切换语言时再取另一份。
 *
 * 依赖 `locale` 而不只是路由：只换界面文案、不换说明正文，会变成
 * 「中文界面 + 英文说明」的另一种语言断层（与修 F-4 之前的方向相反）。
 */
const guide = ref<ToolGuide | null>(null);

async function loadGuide(path: string) {
  try {
    const table = await loadGuides(locale.value);
    guide.value = table[path] ?? null;
  }
  catch {
    guide.value = null; // 加载失败就当这个工具没说明，不影响使用
  }
}

watch([toolPath, locale], ([path]) => loadGuide(path), { immediate: true });

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
        <div class="breadcrumb">
          <RouterLink to="/">{{ $t('home.home') }}</RouterLink>
          <span class="sep">/</span>
          <span>{{ currentCategory }}</span>
          <span class="sep">/</span>
          <span class="current">{{ toolTitle }}</span>
        </div>

        <div flex flex-nowrap items-center justify-between>
          <n-h1>
            {{ toolTitle }}
          </n-h1>

          <div>
            <FavoriteButton :tool="{ name: route.meta.name, path: toolPath } as Tool" />
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
            {{ guideOpen ? $t('tool.guideCollapse') : $t('tool.guideExpand') }}
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
                {{ exampleApplied ? $t('tool.guideExampleApplied') : guide.example.label }}
              </button>
              <span class="guide-example-tip">{{ $t('tool.guideExampleTip') }}</span>
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

    <div v-if="relatedTools.length" class="related">
      <h3 class="related-head">{{ $t('tool.relatedTitle') }}</h3>
      <div class="grid grid-cols-1 gap-12px sm:grid-cols-2 md:grid-cols-3">
        <ToolCard v-for="tool in relatedTools" :key="tool.name" :tool="tool" />
      </div>
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

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;

    font-size: 13px;
    opacity: 0.6;

    a {
      color: inherit;
      text-decoration: none;
      opacity: 0.85;

      &:hover {
        opacity: 1;
        text-decoration: underline;
      }
    }

    .sep {
      opacity: 0.5;
    }

    .current {
      opacity: 0.9;
    }
  }

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

/* 同类相关工具推荐 */
.related {
  max-width: 600px;
  margin: 0 auto;
  box-sizing: border-box;
  padding-top: 28px;

  .related-head {
    margin: 0 0 12px;

    font-size: 15px;
    font-weight: 500;
    opacity: 0.75;
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
