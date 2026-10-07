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
import { clusterOf, resolveRelated, resolveWorkflow } from '@/seo/clusters';

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
/**
 * 相关工具：同任务簇优先，簇内不够再由同分类补齐。
 *
 * 旧规则是「同分类前 8」，于是 `/json-prettify`（Development）的相关工具里出现
 * `/git-memo`、`/chmod-calculator` —— 分类是数据库视角，不是用户任务视角。
 * 簇定义见 `src/seo/clusters.ts`；构建期骨架（`ToolSeoPage`）读同一份数据，
 * 因此预渲染 HTML 与客户端页面的链接集合逐条一致。
 */
const relatedTools = computed(() =>
  resolveRelated({
    path: toolPath.value,
    category: currentCategory.value,
    tools: toolStore.tools,
    max: 6,
  }),
);

/**
 * 工作流链条：当前工具所在簇的完整顺序（含「你在这里」标记）。
 * 不属于任何簇时为空 —— 此时不渲染区块，而不是退化成同分类列表。
 */
const workflowNodes = computed(() =>
  resolveWorkflow({ path: toolPath.value, tools: toolStore.tools, max: 8 }),
);

const clusterLabel = computed<string>(() => {
  const id = clusterOf(toolPath.value)?.id;
  return id ? t(`clusters.${id}`, id) : '';
});

// 去掉**全部**斜杠拼 i18n key（与 tools.store.ts 的 toolI18nKey 保持同一写法）。
// 只 replace 第一个 '/' 会让 key 变成 `hash-text/`，任何语言文件里都不存在这种 key。
const i18nKey = computed<string>(() => toolPath.value.replace(/\//g, ''));
const toolTitle = computed<string>(() => t(`tools.${i18nKey.value}.title`, String(route.meta.name)));
const toolDescription = computed<string>(() => t(`tools.${i18nKey.value}.description`, String(route.meta.description)));
/**
 * 页面 H1 = title 的核心词（em dash 前半段）。
 *
 * Keyword Map V1（G-01a）的定位策略：`<title>` 带长尾后缀（"X — Y Online"）去打
 * 搜索结果页，H1 保持短核心词照顾页面可读性。title 无 em dash 的工具（101 个里
 * 目前只有 Keyword Map 落地的 7 个）split 结果就是原文，行为不变。
 */
const toolH1 = computed<string>(() => toolTitle.value.split(' — ')[0]);

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

/**
 * 配套长文（notes.digdevbox.com）—— 与 `guide` 同一个数据源的同一个字段。
 *
 * 单独一个 computed 而不是模板里 `guide.relatedNotes`：模板里写 `guide?.relatedNotes`
 * 在 `guide` 还是 null 的首帧会整块消失，而这是一个**常显**区块（不是折叠面板里的），
 * 首帧闪烁比多一个 computed 贵。数据量是 0 或 1 条，计算成本可忽略。
 */
const relatedNotes = computed(() => guide.value?.relatedNotes ?? []);

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
/** 填示例失败（控件在 blur 后拒绝了写入的值）时的可见反馈标记。 */
const exampleFailed = ref(false);
watch(() => route.path, () => {
  exampleApplied.value = false;
  exampleFailed.value = false;
});

/**
 * 主输入控件：工具内容区里第一个可编辑控件。
 *
 * 工具页没有统一的输入组件契约（101 个工具各自实现），这里按「主内容区第一个
 * 可编辑控件」定位，只用于**模板层能统一提供的动作**（填示例 / 清空），
 * 不据此断言任何输出 —— 输出形态差异太大，猜出来的复制按钮必然有失败模式。
 */
function findPrimaryInput(): HTMLTextAreaElement | HTMLInputElement | null {
  const root = document.querySelector('.tool-content');
  if (!root) {
    return null;
  }
  // 优先内容文本域：格式化类工具（json / xml 等）的主输入是文本域，
  // 而「缩进大小 / 数量」等数字参数控件排在前面，会被 querySelector 误判成首个输入，
  // 导致 example 填错框（已确诊的误标缺陷）。
  // 跳过只读/禁用文本域（通常是输出框），避免把示例填进输出域。
  const tas = Array.from(root.querySelectorAll('textarea')) as HTMLTextAreaElement[];
  const editableTA = tas.find(ta => !ta.readOnly && !ta.disabled);
  if (editableTA) {
    return editableTA;
  }
  return root.querySelector(
    'input[type="text"], input[type="search"], input[type="number"], input:not([type])',
  ) as HTMLTextAreaElement | HTMLInputElement | null;
}

/**
 * 写入输入控件的值。
 *
 * 必须用原生 setter + input 事件：直接改 `el.value` 不会触发 Vue 的响应式更新，
 * 界面上看起来「点了没反应」，而数据层其实已经变了 —— 这类假象最难排查。
 *
 * 写入后再派发一次 `blur`：naive-ui 的 n-input-number 只在 blur 时才解析输入框内容，
 * 派发 blur 让它走自己的解析/校验路径，控件才能把「解析后的真实值」回写到 DOM。
 * 不派发 blur 的话，下文 applyExample 读回的就是 setter 写入的瞬间值（对数字控件是假阳性）。
 * 所有控件类型统一处理：setInputValue 不按控件类型分支（详见 applyExample 的读回校验）。
 */
function setInputValue(el: HTMLTextAreaElement | HTMLInputElement, value: string) {
  const proto = Object.getPrototypeOf(el);
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) {
    setter.call(el, value);
  }
  else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  // 让控件走自己的解析/校验（详见上方说明）。applyExample 会在 blur 后读回真实值判定。
  el.dispatchEvent(new Event('blur', { bubbles: true }));
}

/**
 * 填示例：让第一次打开工具的人不用面对空白输入框。
 *
 * 关键：写入 + blur 后**读回真实值**再做判定。
 * naive-ui 的 n-input-number 在 blur 时会把非法输入（非数字文本）回退成 ""，
 * 此时界面上其实「没填进去」——不能再谎报成功（旧实现会置 exampleApplied=true，
 * 按钮文案变「已填入」而数据没进去，正是上一轮确诊的静默失效缺陷）。
 *
 * ⛔ 读回不能同步做：组件在 blur 后的回写多半发生在 nextTick（微任务），
 * 这里用 setTimeout(0)（宏任务，排在微任务之后）确保回写已落定。
 * 判定只看「回写值是否还非空」——对文本/多行框原样保留（非空白），
 * 对数字控件非法文本被清成 "" → 判定为未填入。
 */
function applyExample() {
  const el = findPrimaryInput();
  if (!el || !guide.value?.example) {
    return;
  }
  const expected = guide.value.example.text;
  setInputValue(el, expected);
  // setInputValue 已派发 blur（naive-ui 数字控件据此解析/校验并回写真实值）。
  // 读回真实值做判定（所有控件类型通用，不按类型分支）：
  //  · 数字控件非法文本在 blur 后被清成 ""（survived=false）
  //  · 文本/多行框原样保留（survived=true）
  // ⛔ 读回不能同步：组件回写多在 nextTick（微任务），用 setTimeout(0)（宏任务）等其落定。
  setTimeout(() => {
    const raw = (el as HTMLInputElement).value;
    const survived = raw !== '' && raw != null;
    if (!survived) {
      // 写入的值被控件在 blur 后拒绝（典型：数字控件吃到非数字文本）。
      // 不置 exampleApplied（按钮留在「示例」文案），并给出可见反馈。
      exampleFailed.value = true;
      setTimeout(() => {
        exampleFailed.value = false;
      }, 2000);
      return;
    }
    exampleApplied.value = true;
    setTimeout(() => {
      exampleApplied.value = false;
    }, 2000);
  }, 0);
}

/** 清空：换下一份数据时不用逐字选中删除。 */
function clearInput() {
  const el = findPrimaryInput();
  if (!el) {
    return;
  }
  setInputValue(el, '');
}

/**
 * 分享：把当前工具页链接复制到剪贴板。
 *
 * 三态（idle / done / failed）而不是「点了就算成功」：剪贴板 API 在非安全上下文、
 * 无用户手势、权限被拒时都会抛错，静默吞掉会让用户以为已经复制成功，
 * 粘贴时才发现是旧内容。失败也要明说（文案里告诉他从地址栏复制）。
 */
const shareState = ref<'idle' | 'done' | 'failed'>('idle');

async function shareLink() {
  const url = window.location.href;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    }
    else {
      // 老浏览器 / 非安全上下文没有 clipboard API，退回 execCommand。
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      if (!ok) {
        throw new Error('execCommand copy 返回 false');
      }
    }
    shareState.value = 'done';
  }
  catch {
    shareState.value = 'failed';
  }
  setTimeout(() => {
    shareState.value = 'idle';
  }, 2000);
}

const shareLabel = computed(() => {
  if (shareState.value === 'done') {
    return t('tool.actionShareDone');
  }
  if (shareState.value === 'failed') {
    return t('tool.actionShareFailed');
  }
  return t('tool.actionShare');
});
</script>

<template>
  <BaseLayout>
    <div class="tool-layout">
      <div class="tool-header">
        <div class="breadcrumb">
          <RouterLink to="/">
            {{ $t('home.home') }}
          </RouterLink>
          <span class="sep">/</span>
          <span>{{ currentCategory }}</span>
          <span class="sep">/</span>
          <span class="current">{{ toolTitle }}</span>
        </div>

        <div flex flex-nowrap items-center justify-between>
          <n-h1>
            {{ toolH1 }}
          </n-h1>

          <div>
            <FavoriteButton :tool="{ name: route.meta.name, path: toolPath } as Tool" />
          </div>
        </div>

        <div class="separator" />

        <div class="description">
          {{ toolDescription }}
        </div>

        <!--
          工具动作条：填示例 / 清空 / 分享。
          放在说明面板**外面**：说明默认折叠，如果示例按钮也跟着折叠，
          第一次打开工具的人面对的就是一个空白输入框 —— 那不是「简洁」，是没引导。
        -->
        <div class="actions">
          <button
            v-if="guide?.example"
            class="action-btn action-example"
            type="button"
            @click="applyExample"
          >
            {{ exampleApplied ? $t('tool.guideExampleApplied') : guide.example.label }}
          </button>
          <button class="action-btn" type="button" @click="clearInput">
            {{ $t('tool.actionClear') }}
          </button>
          <button class="action-btn" type="button" @click="shareLink">
            {{ shareLabel }}
          </button>
          <span v-if="guide?.example" class="action-tip">{{ $t('tool.guideExampleTip') }}</span>
          <span v-if="exampleFailed" class="action-tip action-tip--error">{{ $t('tool.guideExampleFailed') }}</span>
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

            <!--
              知识型背景（What is）与 FAQ：与预渲染骨架（ToolSeoPage.vue）读同一份
              guides 数据、同一批 i18n 词条，两边内容逐字一致 —— 骨架红线要求
              「给抓取器看的文字必须真实存在于用户可见的页面上」，这里是可见侧。
            -->
            <section v-if="guide.about" class="guide-about">
              <h4 class="guide-section-head">
                {{ $t('seo.aboutTitle', { name: toolTitle }) }}
              </h4>
              <p>{{ guide.about }}</p>
            </section>

            <ol class="guide-steps">
              <li v-for="(step, index) in guide.steps" :key="index">
                {{ step }}
              </li>
            </ol>

            <!-- 示例按钮已移到折叠面板外的动作条（见 .actions），这里不再重复 -->

            <ul v-if="guide.notes?.length" class="guide-notes">
              <li v-for="(note, index) in guide.notes" :key="index">
                {{ note }}
              </li>
            </ul>

            <section v-if="guide.faqs?.length" class="guide-faqs">
              <h4 class="guide-section-head">
                {{ $t('seo.faqTitle') }}
              </h4>
              <dl class="guide-faq-list">
                <template v-for="(faq, index) in guide.faqs" :key="index">
                  <dt>{{ faq.q }}</dt>
                  <dd>{{ faq.a }}</dd>
                </template>
              </dl>
            </section>
          </div>
        </div>
      </div>
    </div>

    <div class="tool-content">
      <slot />
    </div>

    <!--
      工作流链条：告诉用户「这件事的完整流程长什么样」，并给相邻步骤可直接点的入口。
      与相关工具的区别 —— related 是「你可能还需要什么」（排除自身、可兜底），
      workflow 是「流程本身」（包含自身、只取簇内、不兜底）。没有簇就不渲染。
    -->
    <div v-if="workflowNodes.length" class="workflow">
      <h3 class="workflow-head">
        {{ $t('tool.workflowTitle', { cluster: clusterLabel }) }}
      </h3>
      <div class="workflow-chain">
        <template v-for="(node, index) in workflowNodes" :key="node.item.path">
          <span v-if="index > 0" class="workflow-arrow">→</span>
          <span v-if="node.current" class="workflow-current" :title="$t('tool.workflowCurrent')">
            {{ node.item.name }}
          </span>
          <RouterLink v-else class="workflow-link" :to="node.item.path">
            {{ node.item.name }}
          </RouterLink>
        </template>
      </div>
    </div>

    <div v-if="relatedTools.length" class="related">
      <h3 class="related-head">
        {{ $t('tool.relatedTitle') }}
      </h3>
      <div class="grid grid-cols-1 gap-12px md:grid-cols-3 sm:grid-cols-2">
        <ToolCard v-for="tool in relatedTools" :key="tool.name" :tool="tool" />
      </div>
    </div>

    <!--
      配套长文（站群另一站 notes.digdevbox.com）：与预渲染骨架
      （src/seo/ToolSeoPage.vue 的 dd-tool-notes 区块）读**同一份** guides 数据、
      同一批 i18n 词条，标题与链接集合逐字一致。
      ⛔ 两边必须同时存在，否则就是「给爬虫看一套、给用户看另一套」：
        只有骨架有 = 用户永远看不到（CDP 探针实测过这个失效方向，22 项红），
        只有真实页有 = 不执行 JS 的抓取器读不到。
      放在 related 之后而不是 guide 折叠面板里：guide 默认收起，放进去等于
      默认不可见，而骨架侧的 dd-tool-notes 是常显的 —— 两边可见性也要一致。
    -->
    <div v-if="relatedNotes.length" class="related-notes">
      <h3 class="related-notes-head">
        {{ $t('tool.notesTitle') }}
      </h3>
      <ul class="related-notes-list">
        <li v-for="note in relatedNotes" :key="note.slug">
          <a class="related-notes-link" :href="note.url" target="_blank" rel="noopener">{{ note.title }}</a>
        </li>
      </ul>
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

/* 工具动作条：填示例 / 清空 / 分享 */
.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;

  margin-top: 12px;

  .action-btn {
    padding: 5px 12px;
    border: 1px solid rgba(128, 128, 128, 0.45);
    border-radius: 4px;

    background: none;
    color: inherit;
    cursor: pointer;

    font-size: 13px;

    &:hover {
      border-color: rgba(24, 160, 88, 0.8);
      background: rgba(24, 160, 88, 0.1);
    }
  }

  .action-example {
    border-color: rgba(24, 160, 88, 0.8);
    background: rgba(24, 160, 88, 0.1);
  }

  .action-tip {
    opacity: 0.55;
    font-size: 12px;
  }

  .action-tip--error {
    opacity: 1;
    color: var(--error-color, #d03050);
  }
}

/* 工作流链条：同簇步骤按顺序串起来，当前步骤高亮 */
.workflow {
  max-width: 600px;
  margin: 0 auto;
  box-sizing: border-box;
  padding-top: 24px;

  .workflow-head {
    margin: 0 0 10px;

    font-size: 15px;
    font-weight: 500;
    opacity: 0.75;
  }

  .workflow-chain {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;

    font-size: 14px;
    line-height: 2;
  }

  .workflow-arrow {
    opacity: 0.4;
  }

  .workflow-link {
    color: inherit;
    opacity: 0.8;
    text-decoration: none;

    &:hover {
      opacity: 1;
      text-decoration: underline;
    }
  }

  .workflow-current {
    padding: 2px 8px;
    border-radius: 4px;

    background: rgba(24, 160, 88, 0.14);
    color: inherit;
    font-weight: 500;
  }
}

/* 相关工具：同任务簇优先（见 resolveRelated） */
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

/*
  配套长文区块：宽度、标题样式与 .related 完全一致（两个区块是同级关系），
  区别只是内容是站外文章链接而不是工具卡片。
  375px 窄屏下用 overflow-wrap 而不是固定宽度，避免长英文标题撑出横向滚动。
*/
.related-notes {
  max-width: 600px;
  margin: 0 auto;
  box-sizing: border-box;
  padding-top: 28px;

  .related-notes-head {
    margin: 0 0 12px;

    font-size: 15px;
    font-weight: 500;
    opacity: 0.75;
  }

  .related-notes-list {
    margin: 0;
    padding-left: 20px;

    font-size: 14px;
    line-height: 2;
    opacity: 0.85;
  }

  .related-notes-link {
    overflow-wrap: anywhere;
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

  /* 知识型内容区（about / FAQ）的小节标题，与预渲染骨架同一信息结构 */
  .guide-section-head {
    margin: 14px 0 6px;

    font-size: 14px;
    font-weight: 500;
    opacity: 0.85;
  }

  .guide-about {
    p {
      margin: 0;
      opacity: 0.8;
    }
  }

  .guide-faqs {
    .guide-faq-list {
      margin: 0;

      dt {
        margin-top: 8px;

        font-weight: 500;
        opacity: 0.85;
      }

      dd {
        margin: 2px 0 0;
        padding-left: 0;

        opacity: 0.75;
      }
    }
  }

  .guide-steps {
    margin: 0;
    padding-left: 20px;
    opacity: 0.8;

    li {
      margin-bottom: 4px;
    }
  }

  /* .guide-example 的按钮已移到折叠面板外的动作条（.actions），样式随之移出 */

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
