<script setup lang="ts">
/**
 * 工具页「SEO 骨架」—— 构建期预渲染专用，**不参与客户端渲染**。
 *
 * 为什么不用真实的工具页组件（`src/layouts/tool.layout.vue` + 工具组件）做预渲染：
 * tool.layout 外层是 base.layout，其导航栏用到 naive-ui 的 Follower（vueuc + css-render），
 * 在 setup 阶段就访问 `document`，Node 下必崩（STEP 1 实测）。而 101 个工具组件
 * 各自的浏览器 API 依赖（canvas / localStorage / WebRTC / FileReader）无法一次性验证完，
 * 逐个踩坑的成本远大于收益。
 *
 * 因此这里渲染的是**与页面主题一致的正文骨架**：H1、工具简介、一句话描述、
 * 真实使用说明、所属分类、同类工具互链。文字全部来自既有真实数据
 * （见 `src/seo/tool-page.ts` 的内容来源说明），不新增任何臆断文案。
 *
 * 客户端挂载时 `createApp().mount('#app')` 会**替换** `#app` 的内容，
 * 用户看到的是真实工具页；骨架只对「不执行 JS 的抓取器」和首屏渲染前的一瞬间可见。
 * 因此骨架里的文字必须与真实页面一致 —— 不写任何真实页面上没有的内容，
 * 否则就构成「给爬虫看一套、给用户看另一套」。
 */
// 一律用相对路径导入：`defineProps<{ entry: ToolSeoEntry }>()` 的类型需要被
// @vue/compiler-sfc 静态解析，别名路径在部分版本下会解析失败（Unresolvable type reference）。
import type { ToolSeoEntry } from './tool-page';
import { useI18n } from 'vue-i18n';
import { usePageSeo } from './use-page-seo';

const props = defineProps<{ entry: ToolSeoEntry }>();

const { entry } = props;
const { t } = useI18n();

usePageSeo(entry.path, `${entry.name} - ${t('site.name')}`, entry.description);

/**
 * 第 2 项「工具用途简介」。
 *
 * 优先用人工编写的 guide.intro（当前 101/101 全覆盖，逐工具独有）；
 * 万一将来新增了还没写说明的工具，**不编造**用途，退回一句只陈述既有事实的分类说明。
 *
 * 骨架是给「不执行 JS 的抓取器」看的，所以这里的文案必须走 i18n 并落在**默认语言
 * （en）**上 —— 写死中文字面量会让英文页面的正文混进中文（与 guides 同一类问题）。
 */
const lead = entry.guide?.intro
  ?? t('seo.leadFallback', { name: entry.name, category: entry.category });

// 骨架是纯静态 HTML（无响应式状态），样式只能用内联属性：
// SFC 的 <style scoped> 会被提取进客户端 chunk，不会出现在预渲染出的 HTML 里。
const box = 'max-width:800px;margin:0 auto;padding:32px 16px;box-sizing:border-box';
</script>

<template>
  <article class="dd-tool-seo" :style="box">
    <nav style="font-size:13px;opacity:.6;margin-bottom:16px">
      <a href="/" style="color:inherit">{{ t('home.home') }}</a>
      <span> / </span>
      <span>{{ entry.category }}</span>
      <span> / </span>
      <span style="opacity:.9">{{ entry.name }}</span>
    </nav>

    <h1 style="font-size:32px;font-weight:400;line-height:1.25;margin:0 0 12px">
      {{ entry.h1 }}
    </h1>

    <p class="dd-tool-lead" style="font-size:16px;line-height:1.8;opacity:.85;margin:0 0 10px">
      {{ lead }}
    </p>

    <!-- 与首段不同来源：这句是 tools.<key>.description 的原文 -->
    <p v-if="lead !== entry.description" class="dd-tool-desc" style="font-size:15px;line-height:1.8;opacity:.75;margin:0 0 20px">
      {{ entry.description }}
    </p>

    <!--
      第 4 项「基本使用说明」。
      用 <details> 而非默认展开 —— 真实页面上说明也是默认折叠的（tool.layout 的 guide 面板），
      折叠起来既不遮挡内容、也不会出现「先展开再收起」的跳动，而文字确实存在于
      HTML 源码里，能被不执行 JS 的抓取器读到。
      工具的用途简介（guide.intro）不在这里，它已作为上方可见的首段输出。
    -->
    <details v-if="entry.guide" class="dd-tool-guide" style="margin:0 0 20px;font-size:15px;line-height:1.8">
      <summary style="cursor:pointer;opacity:.9">{{ t('seo.guideSummary') }}</summary>
      <!--
        about / faqs 与真实工具页（tool.layout 的 guide 面板）读同一份 guides 数据、
        同一批 i18n 词条：骨架侧多输出的任何一句话，都必须在用户展开面板后逐字可见。
      -->
      <section v-if="entry.guide.about" class="dd-tool-about">
        <h2 style="font-size:16px;font-weight:500;opacity:.85;margin:10px 0 6px">
          {{ t('seo.aboutTitle', { name: entry.name }) }}
        </h2>
        <p style="margin:0;opacity:.85">{{ entry.guide.about }}</p>
      </section>
      <ol style="margin:10px 0 0;padding-left:22px;opacity:.85">
        <li v-for="(step, index) in entry.guide.steps" :key="index">
          {{ step }}
        </li>
      </ol>
      <ul v-if="entry.guide.notes?.length" style="margin:10px 0 0;padding-left:22px;opacity:.75;font-size:14px">
        <li v-for="(note, index) in entry.guide.notes" :key="index">
          {{ note }}
        </li>
      </ul>
      <section v-if="entry.guide.faqs?.length" class="dd-tool-faqs">
        <h2 style="font-size:16px;font-weight:500;opacity:.85;margin:14px 0 6px">
          {{ t('seo.faqTitle') }}
        </h2>
        <dl style="margin:0">
          <template v-for="(faq, index) in entry.guide.faqs" :key="index">
            <dt style="font-weight:500;opacity:.85;margin-top:8px">{{ faq.q }}</dt>
            <dd style="margin:2px 0 0;opacity:.75">{{ faq.a }}</dd>
          </template>
        </dl>
      </section>
    </details>

    <p class="dd-tool-category" style="font-size:14px;opacity:.7;margin:0 0 24px">
      {{ t('seo.categoryLine', { category: entry.category }) }}
      <span v-if="!entry.guide">{{ t('seo.guideMissing') }}</span>
    </p>

    <!--
      工作流链条：与真实工具页的 workflow 区块读同一份簇数据（src/seo/clusters.ts），
      链接集合与顺序逐字一致 —— 骨架不写任何真实页面上没有的内容。
      「当前工具」在真实页上是高亮态，这里用 <strong> 表达同一事实。
    -->
    <section v-if="entry.workflow.length" class="dd-tool-workflow" style="margin:0 0 24px">
      <h2 style="font-size:16px;font-weight:500;opacity:.8;margin:0 0 10px">
        {{ t('tool.workflowTitle', { cluster: t(`clusters.${entry.cluster}`) }) }}
      </h2>
      <p style="margin:0;font-size:15px;line-height:2.2">
        <template v-for="(node, index) in entry.workflow" :key="node.path">
          <span v-if="index > 0" style="opacity:.4"> → </span>
          <strong v-if="node.current" style="font-weight:600">{{ node.name }}</strong>
          <a v-else :href="`${node.path}/`" style="color:inherit">{{ node.name }}</a>
        </template>
      </p>
    </section>

    <section v-if="entry.related.length" class="dd-tool-related">
      <h2 style="font-size:16px;font-weight:500;opacity:.8;margin:0 0 10px">
        {{ t('tool.relatedTitle') }}
      </h2>
      <ul style="margin:0;padding-left:22px;line-height:2;font-size:15px">
        <li v-for="item in entry.related" :key="item.path">
          <a :href="`${item.path}/`" style="color:inherit">{{ item.name }}</a>
        </li>
      </ul>
    </section>

    <!--
      站群互链 + 信任声明：与真实页 base.layout footer 读同一批 i18n 词条、
      同一组外链 —— 骨架与真实页逐字一致，不构成 cloaking。
    -->
    <footer class="dd-site-footer" style="margin-top:28px;padding-top:14px;border-top:1px solid rgba(128,128,128,.25);font-size:13px;opacity:.8">
      <p style="margin:0">
        {{ t('network.label') }}
        <a href="https://ip.digdevbox.com/" style="color:inherit">{{ t('network.ip') }}</a> ·
        <a href="https://fangdai.digdevbox.com/" style="color:inherit">{{ t('network.fangdai') }}</a> ·
        <a href="https://play.digdevbox.com/" style="color:inherit">{{ t('network.play') }}</a> ·
        <a href="https://draw.digdevbox.com/" style="color:inherit">{{ t('network.draw') }}</a> ·
        <a href="https://notes.digdevbox.com/" style="color:inherit">{{ t('network.notes') }}</a> ·
        <a href="https://geek-typing.pages.dev/" style="color:inherit">{{ t('network.typing') }}</a>
      </p>
      <p style="margin:6px 0 0;opacity:.85">
        {{ t('trust') }}
      </p>
    </footer>
  </article>
</template>
