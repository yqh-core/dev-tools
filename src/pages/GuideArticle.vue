<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import type { ToolGuide } from '@/tools/guides';
import { usePageSeo } from '@/seo/use-page-seo';
import { GUIDE_PREFIX, buildGuideSections, getGuideArticle } from '@/seo/guide-articles';
import { loadGuides } from '@/tools/guides';

/**
 * 工具指南文章页 `/guides/<slug>`。
 *
 * 正文一律来自 guides 数据的现场组装 —— 这里不写任何解释性文案，也不做第二份数据源。
 *
 * guides 的正文是**纯文本插值**，不是 markdown（仓库既有口径：写成 markdown
 * 会把 `**粗体**` 原样显示出来），所以列表/FAQ 都由模板自己排版。
 */
const { locale, t, te } = useI18n();
const route = useRoute();

const page = computed(() => getGuideArticle(`${GUIDE_PREFIX}/${String(route.params.slug ?? '')}`));
const toolPath = computed(() => page.value?.toolPath ?? '');

/**
 * 正文按语言取，做法与 `tool.layout.vue` 完全一致：预渲染固定英文
 * （构建期只吃 `guides.en.ts`），客户端再按当前 locale 动态加载中英文那份。
 *
 * 这里必须读 locale —— 不读的话中文用户会在中文界面里看到英文正文，
 * 正是「guides 拆成两份语言」当初要消除的那个语言断层。
 */
const localized = ref<ToolGuide | null>(null);

watch(
  [toolPath, locale],
  async ([path, loc]) => {
    if (!path) {
      localized.value = null;
      return;
    }
    const table = await loadGuides(String(loc));
    // 竞态保护：快速切 slug / 语言时，只有最后一次请求的结果才允许落盘。
    if (toolPath.value === path && String(locale.value) === loc) {
      localized.value = table[path] ?? null;
    }
  },
  { immediate: true },
);

const activeGuide = computed(() => localized.value ?? page.value?.entry.guide ?? null);
const sections = computed(() => (activeGuide.value ? buildGuideSections(activeGuide.value) : []));

/**
 * 工具名 / 描述一律按当前语言现取，不复用注册表里的英文快照。
 *
 * 与 `tool.layout.vue` 的 `toolTitle` / `toolH1` 同一套写法：去掉全部斜杠拼 i18n key，
 * H1 取 em dash 前的核心词。注册表里的 name / h1 / description 是模块求值时按默认语言
 * 解析出来的常量，直接拿去渲染会让中文界面露出英文名 —— 实测就是在这条上被抓到
 * （中文文章页写着「CSV to JSON — 使用指南」，点进工具页 H1 却是「CSV 转 JSON」）。
 *
 * 辅助函数用 function 声明并放在使用方之前：仓库 lint 规则
 * （antfu/top-level-function、no-use-before-define）对顶层箭头函数与先用后定义都会判错。
 */
function i18nKeyOf(path: string) {
  return path.replace(/\//g, '');
}

function titleOf(path: string, fallback: string) {
  const key = `tools.${i18nKeyOf(path)}.title`;
  return te(key) ? t(key) : fallback;
}

function coreOf(path: string, fallback: string) {
  return titleOf(path, fallback).split(' — ')[0];
}

function descOf(path: string, fallback: string) {
  const key = `tools.${i18nKeyOf(path)}.description`;
  return te(key) ? t(key) : fallback;
}

const toolH1 = computed(() => (page.value ? coreOf(page.value.toolPath, page.value.entry.h1) : ''));

/**
 * 「下一篇」只列**真的有文章页**的相关工具。
 * 不过滤的话，指向无 guide 工具会变成软 404（有 200、有内容，但内容是「没找到」）——
 * 那比 404 更糟，爬虫会把这条链接当成有效页面反复抓。
 */
const relatedArticles = computed(() =>
  (page.value?.entry.related ?? [])
    .map(rel => ({ rel, target: getGuideArticle(`${GUIDE_PREFIX}/${rel.path.replace(/^\//, '')}`) }))
    .filter(item => item.target !== undefined)
    .map(item => ({ path: item.rel.path, name: coreOf(item.rel.path, item.rel.name) })),
);

const title = computed(() => {
  if (!page.value) {
    return t('guideArticle.missingTitle');
  }
  return `${toolH1.value} — ${t('guideArticle.suffix')} - ${t('legal.siteName')}`;
});

const description = computed(() => (page.value ? descOf(page.value.toolPath, page.value.entry.description) : ''));

// 第一个形参是普通字符串（不是 MaybeRef）：一次渲染内 path 不会变。
usePageSeo(String(route.path), title, description);
</script>

<template>
  <div v-if="!page" mx-auto mt-50px max-w-760px px-4>
    <h1 text-24px font-bold>
      {{ t('guideArticle.missingTitle') }}
    </h1>
    <p mt-3 op-75>
      {{ t('guideArticle.missingBody') }}
      <RouterLink to="/tools">
        {{ t('toolsCatalog.title') }}
      </RouterLink>
    </p>
  </div>

  <article v-else mx-auto mt-50px max-w-760px px-4>
    <nav text-13px op-65>
      <RouterLink to="/">
        {{ t('legal.siteName') }}
      </RouterLink>
      ·
      <RouterLink :to="page.toolPath">
        {{ toolH1 }}
      </RouterLink>
      ·
      <span>{{ t('guideArticle.suffix') }}</span>
    </nav>

    <h1 mt-3 text-28px font-bold>
      {{ toolH1 }} — {{ t('guideArticle.suffix') }}
    </h1>

    <p mt-3 text-16px op-80>
      {{ page.entry.description }}
    </p>

    <nav mt-6 aria-labelledby="guide-toc">
      <h2 id="guide-toc" text-18px font-semibold>
        {{ t('guideArticle.contents') }}
      </h2>
      <ol mt-2 pl-5 leading-7>
        <li v-for="s of sections" :key="`toc-${s.id}`">
          <a :href="`#${s.id}`">{{ t(`guideArticle.sections.${s.key}`) }}</a>
        </li>
      </ol>
    </nav>

    <section
      v-for="s of sections"
      :id="s.id"
      :key="s.id"
      mt-8
      scroll-mt-20
    >
      <h2 text-20px font-semibold>
        {{ t(`guideArticle.sections.${s.key}`) }}
      </h2>

      <c-markdown v-if="s.kind === 'prose'" :markdown="s.text ?? ''" mt-2 />

      <ol v-else-if="s.kind === 'steps'" mt-2 pl-5 leading-7>
        <li v-for="(line, i) of s.items ?? []" :key="`${s.id}-${i}`">
          {{ line }}
        </li>
      </ol>

      <ul v-else-if="s.kind === 'list'" mt-2 pl-5 leading-7>
        <li v-for="(line, i) of s.items ?? []" :key="`${s.id}-${i}`">
          {{ line }}
        </li>
      </ul>

      <div v-else-if="s.kind === 'example'" mt-2>
        <p op-80>
          {{ s.text }}
        </p>
        <pre mt-2 ws-pre-wrap break-all border rounded bg-gray-2 p-3 text-13px>{{ s.code }}</pre>
        <p mt-2 text-13px op-65>
          {{ t('guideArticle.exampleHint') }}
          <RouterLink :to="page.toolPath">
            {{ toolH1 }}
          </RouterLink>
        </p>
      </div>

      <dl v-else-if="s.kind === 'faqs'" mt-2>
        <template v-for="(item, i) of s.faqs ?? []" :key="`${s.id}-${i}`">
          <dt mt-4 font-semibold>
            {{ item.q }}
          </dt>
          <dd m-0 mt-1 op-85>
            {{ item.a }}
          </dd>
        </template>
      </dl>
    </section>

    <section mt-10>
      <h2 text-20px font-semibold>
        {{ t('guideArticle.nextTitle') }}
      </h2>
      <p mt-2>
        <RouterLink :to="page.toolPath" font-semibold>
          {{ t('guideArticle.openTool', { name: toolH1 }) }}
        </RouterLink>
      </p>
      <ul v-if="relatedArticles.length" mt-2 pl-5 leading-7>
        <li v-for="rel of relatedArticles" :key="rel.path">
          <RouterLink :to="`/guides${rel.path}`">
            {{ rel.name }}
          </RouterLink>
        </li>
      </ul>
      <p mt-3 text-13px op-65>
        {{ t('guideArticle.feedback') }}
        <RouterLink to="/contact">
          {{ t('legal.contact') }}
        </RouterLink>
      </p>
    </section>
  </article>
</template>
