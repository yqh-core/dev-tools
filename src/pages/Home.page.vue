<script setup lang="ts">
import { IconDragDrop, IconHeart, IconSearch, IconX } from '@tabler/icons-vue';
import { computed, ref } from 'vue';
import Draggable from 'vuedraggable';
import ColoredCard from '../components/ColoredCard.vue';
import ToolCard from '../components/ToolCard.vue';
import { useToolStore } from '@/tools/tools.store';
import type { ToolWithCategory } from '@/tools/tools.types';
import { ALIASES } from '@/tools/aliases';
import { CLASSIC_SITE_TOOL_COUNT, classicSiteUrl } from '@/classic-site';
import { config } from '@/config';
import { usePageSeo } from '@/seo/use-page-seo';

const toolStore = useToolStore();

// description / canonical / og / twitter 统一由 SEO 数据层产出（见 src/seo/）。
const { t } = useI18n();
usePageSeo('/', t('site.homeTitle'));

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
  if (!q) {
    return [];
  }
  return toolStore.tools.filter(tool => toolHaystack(tool).includes(q));
});

const isSearching = computed(() => normalizedQuery.value.length > 0);

/**
 * 常用工具（Popular Tools）。
 *
 * 为什么是硬编码清单而不是按访问量排序：站点没有后端，拿不到真实访问统计；
 * 硬编码一份**人工确认过的**清单，比拍脑袋造一个「热度算法」诚实。
 *
 * 2026-10-06（G-01a）清单从「随手挑八个」改为**由 Keyword Map V1 驱动**：
 * 排序依据是 27 次真实 SERP 检索后的竞争可切入度 + 工具契合度，见
 * D:/work/_ops/digdevbox-keyword-map-v1.md。
 * 2026-10-07（S2 裁定②）：/regex-memo（S1-a 七个 P0 页之一）换出
 * /chmod-calculator；Popular 保持固定 10 张，不扩容。
 * 早期被换掉的三个：/hash-text（同质化最高，域名即关键词的垂直站已占位）、
 * /token-generator（无关键词证据）、/qrcode-generator（本轮未做 SERP 研究）。
 *
 * 这些 path 全部经过 sitemap 核对 —— 例如「JSON 格式化」的真实 path 是
 * `/json-prettify` 而非直觉上的 `/json-formatter`，凭印象写会渲染成空区块。
 * `filter(Boolean)` 兜底：万一某个工具日后改名下架，区块少一张卡，不会白屏。
 */
const POPULAR_TOOL_PATHS = [
  '/json-prettify',
  '/jwt-parser',
  '/regex-tester',
  '/base64-string-converter',
  '/uuid-generator',
  '/ulid-generator',
  '/date-converter',
  '/regex-memo',
  '/crontab-generator',
  '/docker-run-to-docker-compose-converter',
];

/**
 * 必须联网才能工作的工具。
 *
 * 首页 Privacy 区块要「按工具实际能力分层」，不做「数据一律不上传」的绝对化声明
 * （yqh 纪律：禁止机械写「数据不上传」）。这三条是构建期 grep `axios|fetch(`
 * 的真实结果（src/tools 下只有这三个 vue 发起外部请求）。
 *
 * ⚠ 新增任何会发外部请求的工具，必须同步加到这里，否则首页的隐私声明就是假的。
 */
const NETWORK_TOOL_PATHS = ['/whois-lookup', '/http-status-checker', '/today-in-history'];

const networkTools = computed(() =>
  NETWORK_TOOL_PATHS
    .map(path => toolStore.tools.find(tool => tool.path === path))
    .filter(Boolean) as ToolWithCategory[],
);

/**
 * Why DigDevBox 四条卖点的 key。
 *
 * 为什么不用数组词条 + v-for：SSR 预渲染阶段脚本里的 `t('home.why.points')`
 * 实测返回的是 key 本身（产物里出现过 `<li>home.why.points</li>`），
 * 数组型词条在预渲染这条链路上没被解析。改成 4 个标量 key + 模板内 `$t`，
 * 预渲染与客户端两条路径都用同一套解析，行为一致。
 */
const WHY_POINT_KEYS = [
  'home.why.point1',
  'home.why.point2',
  'home.why.point3',
  'home.why.point4',
];

/**
 * 首页 Blog 区块的文章卡片（S3 集成、S2 上移+视觉升级、G-03-1 换英文文章）。
 *
 * 红线（G-03 裁定④）：title / description / url 三字段必须与 forge-notes
 * 文章 frontmatter **逐字一致**（title = frontmatter title；description =
 * frontmatter description；url = https://notes.digdevbox.com/posts/<slug>）。
 * 防止「首页标题 ≠ 文章标题 ≠ JSON-LD 标题」的 SEO 信号分裂。
 * 新文章上线后手动增补，下线文章必须同步移除 —— 外链 404 比少一篇卡片伤害大。
 * tag 从文章主题派生（英文文章用英文 tag，与文章语言一致）。
 */
const BLOG_POSTS = [
  {
    title: 'JWT Decoder Explained: How to Inspect and Debug JSON Web Tokens',
    description:
      'Learn how a JSON Web Token is structured and how to decode one online to inspect its header, payload and registered claims when debugging authentication issues.',
    url: 'https://notes.digdevbox.com/posts/jwt-decoder-guide',
    tag: 'JWT',
  },
  {
    title: 'JSON Formatter Guide: Format, Validate and Compare JSON Online',
    description:
      'How to format, validate, minify and compare JSON online — a practical guide to cleaning up API responses, spotting syntax errors and diffing config files.',
    url: 'https://notes.digdevbox.com/posts/json-formatting-guide',
    tag: 'JSON',
  },
  {
    title: 'Regex Testing Guide: How Developers Debug Regular Expressions',
    description:
      'A practical workflow for testing and debugging regular expressions online — live matches, flags, capture groups and a cheat sheet for the syntax you forget.',
    url: 'https://notes.digdevbox.com/posts/regex-testing-guide',
    tag: 'Regex',
  },
];

/**
 * Hero CTA（S2）：滚动到分类浏览区。
 * 用 button 而不是 <a href="#home-categories">：vue-router 会对同路径 hash 变化
 * 做路由解析，边界行为不可控。
 *
 * 不用 Element.scrollIntoView 而显式查找最近可滚祖先：本站是 naive-ui 双层
 * n-layout 嵌套（外层菜单 layout + 内层内容 layout），中间隔着 overflow:hidden 层，
 * 真实滚动容器是内层 .n-layout-scroll-container。scrollIntoView 的滚动链在这类
 * 嵌套结构上跨浏览器行为不一致（Chrome/154 实测在 CDP 验证窗口中不推进），
 * 显式祖先查找 + scrollTo 只依赖确定性 API，行为可预期。
 * smooth 动画依赖 rAF；CDP 失焦窗口 rAF 冻结属测试环境限制，真实前台不受影响。
 */
function scrollToCategories() {
  const target = document.getElementById('home-categories');
  if (!target) {
    return;
  }
  let el: HTMLElement | null = target.parentElement;
  while (el) {
    const style = getComputedStyle(el);
    if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) {
      const delta = target.getBoundingClientRect().top - el.getBoundingClientRect().top;
      el.scrollTo({ top: el.scrollTop + delta - 12, behavior: 'smooth' });
      return;
    }
    el = el.parentElement;
  }
  // 兜底：结构未知时退回原生行为
  target.scrollIntoView({ behavior: 'smooth' });
}

const popularTools = computed(() =>
  POPULAR_TOOL_PATHS
    .map(path => toolStore.tools.find(tool => tool.path === path))
    .filter(Boolean) as ToolWithCategory[],
);

// Update favorite tools order when drag is finished
function onUpdateFavoriteTools() {
  toolStore.updateFavoriteTools(favoriteTools.value); // Update the store with the new order
}
</script>

<template>
  <div class="pt-50px">
    <div class="grid-wrapper">
      <!--
        页面级标题与站点身份说明。
        S2（裁定+能力真实性校验）：badge 行只放 Free / No signup / 计数三条，
        不放 "Runs in your browser" —— whois 等 3 个工具需联网，笼统 browser-only
        是能力表述风险；browser 声称保留在带限定语的 subtitle 与 Privacy 分层区块里。
        工具总数从 store 取真实值，不写死在文案里。
      -->
      <header class="home-hero">
        <h1 class="home-hero-title">
          {{ $t('home.hero.title') }}
        </h1>
        <p class="home-hero-subtitle">
          {{ $t('home.hero.subtitle', { count: toolStore.tools.length }) }}
        </p>
        <ul class="hero-badges">
          <li class="hero-badge hero-badge-strong">
            {{ t('home.hero.badgeFree') }}
          </li>
          <li class="hero-badge">
            {{ t('home.hero.badgeNoSignup') }}
          </li>
          <li class="hero-badge">
            {{ t('home.hero.badgeTools', { count: toolStore.tools.length }) }}
          </li>
        </ul>
        <button class="hero-cta" type="button" @click="scrollToCategories">
          {{ t('home.hero.cta') }} ↓
        </button>
      </header>

      <!-- 搜索框：工具一多，「找得到」比「有多少」更重要 -->
      <div class="search-bar">
        <n-icon :component="IconSearch" class="search-icon" />
        <input
          v-model="searchQuery"
          class="search-input"
          type="search"
          :placeholder="t('search.placeholder')"
          :aria-label="t('search.inputLabel')"
        >
        <button
          v-if="isSearching"
          class="search-clear"
          type="button"
          :aria-label="t('search.clear')"
          @click="searchQuery = ''"
        >
          <n-icon :component="IconX" size="16" />
        </button>
      </div>

      <div v-if="isSearching" class="search-result-head">
        <span v-if="matchedTools.length > 0">
          {{ t('search.found', { count: matchedTools.length, query: searchQuery.trim() }) }}
        </span>
        <span v-else>
          {{ t('search.empty', { query: searchQuery.trim() }) }}
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
              href="https://digdevbox.com/"
              rel="noopener"
              target="_blank"
              :aria-label="$t('home.follow.githubRepository')"
            >DigDevBox</a>
            {{ $t('home.follow.p2') }}
            <a
              href="https://digdevbox.com/"
              rel="noopener"
              target="_blank"
              :aria-label="$t('home.follow.twitterXAccount')"
            >DigDevBox</a>.
            {{ $t('home.follow.thankYou') }}
            <n-icon :component="IconHeart" />
          </ColoredCard>
        </div>

        <!--
          常用工具：给新用户一个「从哪开始」的入口。
          101 个工具平铺时，第一次来的人只会看到一片网格；这里的 10 个由 Keyword Map V1 驱动。
        -->
        <div v-if="popularTools.length > 0">
          <h3 class="mb-5px mt-25px text-neutral-600 dark:text-neutral-400 font-500">
            {{ t('home.categories.popularTools') }}
          </h3>
          <div class="grid grid-cols-1 gap-12px lg:grid-cols-3 md:grid-cols-3 sm:grid-cols-2 xl:grid-cols-4">
            <ToolCard v-for="tool in popularTools" :key="tool.path" :tool="tool" />
          </div>
        </div>

        <!--
          Blog 区块（S3 集成、S2 上移至第 3 位 + 视觉升级、G-03-1 换英文文章）。
          文章清单手动维护：title/description/url 必须与 forge-notes 文章
          frontmatter 逐字一致（G-03 裁定④红线），新增/下线文章时同步改 BLOG_POSTS。
          英文文章受众 = 全球开发者，与主站英文界面一致（G-03 裁定①）。
        -->
        <section class="home-block">
          <h2 class="home-block-title">
            {{ $t('home.blog.title') }}
          </h2>
          <p class="home-block-text">
            {{ $t('home.blog.intro') }}
          </p>
          <div class="home-blog-list">
            <a
              v-for="post in BLOG_POSTS"
              :key="post.url"
              class="home-blog-card"
              :href="post.url"
              target="_blank"
              rel="noopener"
            >
              <span class="home-blog-card-tag">{{ post.tag }}</span>
              <span class="home-blog-card-title">{{ post.title }}</span>
              <span class="home-blog-card-desc">{{ post.description }}</span>
              <span class="home-blog-card-site">notes.digdevbox.com</span>
            </a>
          </div>
          <a class="home-blog-more" href="https://notes.digdevbox.com/" target="_blank" rel="noopener">
            {{ $t('home.blog.more') }}
          </a>
        </section>

        <!--
          Why DigDevBox（G-01a）。
          竞品类型 A 在比工具数量，我们比的是「为什么在这里做」。
          四条都必须是已实现的事实，不写 roadmap 上的东西。
          S2：整块移到 Blog 之后（裁定③：Blog 是内容获客入口，信任说明居其后）。
        -->
        <section class="home-block">
          <h2 class="home-block-title">
            {{ $t('home.why.title') }}
          </h2>
          <ul class="home-why-list">
            <li v-for="key in WHY_POINT_KEYS" :key="key" class="home-why-item">
              {{ $t(key) }}
            </li>
          </ul>
        </section>

        <!--
          Privacy（G-01a）。按工具实际能力分层 —— 不做「数据一律不上传」的绝对化声明。
          联网工具清单由 NETWORK_TOOL_PATHS 驱动（构建期 grep 的真实结果），
          新增会发外部请求的工具必须同步改那个常量，否则这里的声明就是假的。
        -->
        <section class="home-block">
          <h2 class="home-block-title">
            {{ $t('home.privacy.title') }}
          </h2>
          <p class="home-block-text">
            {{ $t('home.privacy.local') }}
          </p>
          <p class="home-block-text">
            {{ $t('home.privacy.networkIntro') }}
          </p>
          <div class="home-network-tools">
            <RouterLink
              v-for="tool in networkTools"
              :key="tool.path"
              class="home-network-chip"
              :to="tool.path"
            >
              {{ tool.name }}
            </RouterLink>
          </div>
        </section>

        <transition name="height">
          <div v-if="toolStore.favoriteTools.length > 0">
            <h3 class="mb-5px mt-25px text-neutral-600 dark:text-neutral-400 font-500">
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

        <!--
          最近使用：纯客户端 localStorage，不需要登录。
          首次访问没有数据（v-if 为假），不影响 SSG 预渲染出的初始 HTML，
          因此不会给「不执行 JS 的抓取器」看到一个空标题。
        -->
        <div v-if="toolStore.recentTools.length > 0">
          <h3 class="mb-5px mt-25px text-neutral-600 dark:text-neutral-400 font-500">
            {{ t('home.categories.recentTools') }}
            <button
              class="cat-action"
              type="button"
              @click="toolStore.clearRecentTools()"
            >
              {{ t('home.categories.clearRecent') }}
            </button>
          </h3>
          <div class="grid grid-cols-1 gap-12px lg:grid-cols-3 md:grid-cols-3 sm:grid-cols-2 xl:grid-cols-4">
            <ToolCard v-for="tool in toolStore.recentTools" :key="tool.path" :tool="tool" />
          </div>
        </div>

        <div v-if="toolStore.newTools.length > 0">
          <h3 class="mb-5px mt-25px text-neutral-600 dark:text-neutral-400 font-500">
            {{ t('home.categories.newestTools') }}
          </h3>
          <div class="grid grid-cols-1 gap-12px lg:grid-cols-3 md:grid-cols-3 sm:grid-cols-2 xl:grid-cols-4">
            <ToolCard v-for="tool in toolStore.newTools" :key="tool.name" :tool="tool" />
          </div>
        </div>

        <!--
          分类浏览（S2 紧凑化）。
          红线：101 个工具内链必须全部保留在 SSR HTML —— 折叠/紧凑只允许
          通过「chips 密集网格」这种 DOM 全量渲染的方式实现，禁止 v-if 摘链接。
          Hero CTA 锚点滚到 #home-categories。
        -->
        <div id="home-categories">
          <template v-for="cat of toolStore.toolsByCategory" :key="cat.name">
            <h3 class="mb-8px mt-25px text-neutral-600 dark:text-neutral-400 font-500">
              {{ cat.name }}
              <span class="cat-count">{{ cat.components.length }}</span>
            </h3>
            <div class="cat-chips">
              <RouterLink
                v-for="tool in cat.components"
                :key="tool.path"
                class="cat-chip"
                :to="tool.path"
              >
                <n-icon :component="tool.icon" size="15" class="cat-chip-icon" />
                <span class="cat-chip-name">{{ tool.name }}</span>
              </RouterLink>
            </div>
          </template>
        </div>

        <!--
          经典版入口。老站 162 个工具原样保留在 public/legacy/，是独立静态子站，
          不在 vue-router 路由内，因此这里用原生 <a>（用 RouterLink 会落到 404）。
        -->
        <h3 class="mb-5px mt-25px text-neutral-600 dark:text-neutral-400 font-500">
          {{ $t('home.classic.entry') }}
        </h3>
        <a class="classic-card" :href="classicSiteUrl">
          <div class="classic-card-main">
            <span class="classic-card-title">
              {{ $t('home.classic.entry') }}
              <span class="classic-card-count">{{ CLASSIC_SITE_TOOL_COUNT }}</span>
            </span>
            <span class="classic-card-desc">{{ $t('home.classic.desc') }}</span>
          </div>
          <span class="classic-card-go">{{ $t('home.classic.open') }} →</span>
        </a>
      </template>
    </div>
  </div>
</template>

<style scoped lang="less">
/* 首页顶部：页面级标题 + 一句话站点身份说明 + badge 行 + CTA（对应 P0-2 / STEP 4 / S2） */
.home-hero {
  margin-bottom: 18px;

  .home-hero-title {
    margin: 0 0 6px;

    font-size: 22px;
    font-weight: 600;
    line-height: 1.3;
  }

  .home-hero-subtitle {
    max-width: 760px;
    margin: 0;

    font-size: 14px;
    line-height: 1.65;
    opacity: 0.65;
  }
}

/* S2：badge 行。真实能力三条（Free / No signup / 计数），不放 browser-only。 */
.hero-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0 0;
  padding: 0;

  list-style: none;
}

.hero-badge {
  padding: 3px 10px;

  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 999px;
  background: rgba(128, 128, 128, 0.06);

  font-size: 12px;
  line-height: 1.6;
  opacity: 0.8;
}

.hero-badge-strong {
  border-color: rgba(24, 160, 88, 0.55);
  background: rgba(24, 160, 88, 0.08);

  color: rgba(16, 128, 67, 1);
  font-weight: 500;
  opacity: 1;

  .dark & {
    color: rgba(60, 200, 130, 1);
  }
}

/* S2：主 CTA。锚点滚动到分类区，链接式弱按钮，不与搜索框抢视觉。 */
.hero-cta {
  margin-top: 12px;
  padding: 6px 14px;

  border: 1px solid rgba(24, 160, 88, 0.55);
  border-radius: 8px;
  background: transparent;

  color: rgba(16, 128, 67, 1);
  cursor: pointer;

  font-size: 13px;
  font-family: inherit;
  font-weight: 500;

  transition: background-color 0.2s ease;

  &:hover {
    background: rgba(24, 160, 88, 0.1);
  }

  .dark & {
    color: rgba(60, 200, 130, 1);
  }
}

/* S2：分类 chips 密集网格 —— 替代 101 张大卡。
   DOM 全量渲染（101 个 RouterLink 一个不少），紧凑只靠降低单条目视觉体积。 */
.cat-chips {
  display: grid;
  gap: 6px;

  grid-template-columns: repeat(2, 1fr);

  @media (min-width: 640px) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (min-width: 1024px) {
    grid-template-columns: repeat(4, 1fr);
  }
}

.cat-chip {
  display: flex;
  align-items: center;
  gap: 7px;

  min-width: 0;
  padding: 6px 10px;

  border: 1px solid rgba(128, 128, 128, 0.22);
  border-radius: 6px;

  color: inherit;
  text-decoration: none;

  transition: border-color 0.15s ease, background-color 0.15s ease;

  &:hover {
    border-color: rgba(24, 160, 88, 0.7);
    background: rgba(24, 160, 88, 0.05);
  }

  .cat-chip-icon {
    flex: none;

    opacity: 0.5;
  }

  .cat-chip-name {
    overflow: hidden;

    font-size: 12.5px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}

/* G-01a：Why DigDevBox + Privacy 两个信任区块。S2：间距收紧、不引入新视觉重量。
   390px 下单列、chip 换行，不引入横向滚动。 */
.home-block {
  margin-top: 20px;

  .home-block-title {
    margin: 0 0 8px;

    font-size: 15px;
    font-weight: 600;
  }

  .home-block-text {
    max-width: 760px;
    margin: 0 0 6px;

    font-size: 13px;
    line-height: 1.65;
    opacity: 0.7;
  }
}

.home-blog-list {
  display: grid;
  gap: 8px;
  margin: 10px 0 0;

  grid-template-columns: 1fr;

  @media (min-width: 640px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
  }
}

.home-blog-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;

  padding: 12px 14px;

  text-decoration: none;

  border: 1px solid rgb(128, 128, 128, 0.18);
  border-left: 3px solid rgba(24, 160, 88, 0.5);
  border-radius: 8px;

  transition: border-color ease 0.2s, background-color ease 0.2s;

  &:hover {
    border-color: rgb(59, 149, 111, 0.65);
    background: rgba(24, 160, 88, 0.04);
  }

  .home-blog-card-tag {
    padding: 2px 8px;

    border-radius: 999px;
    background: rgba(24, 160, 88, 0.1);

    color: rgba(16, 128, 67, 1);
    font-size: 11px;
    font-weight: 500;
    line-height: 1.5;

    .dark & {
      color: rgba(60, 200, 130, 1);
    }
  }

  .home-blog-card-title {
    font-size: 13px;
    font-weight: 500;
    line-height: 1.5;
  }

  .home-blog-card-desc {
    display: -webkit-box;
    overflow: hidden;

    font-size: 12px;
    line-height: 1.55;
    opacity: 0.7;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .home-blog-card-site {
    font-size: 11px;
    opacity: 0.55;
  }
}

.home-blog-more {
  display: inline-block;
  margin-top: 10px;

  font-size: 13px;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.home-why-list {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;

  list-style: none;
  grid-template-columns: 1fr;

  @media (min-width: 768px) {
    grid-template-columns: 1fr 1fr;
  }
}

.home-why-item {
  position: relative;
  padding-left: 14px;

  font-size: 13px;
  line-height: 1.6;
  opacity: 0.75;

  &::before {
    position: absolute;
    top: 8px;
    left: 0;

    width: 5px;
    height: 5px;

    border-radius: 50%;
    background: rgba(24, 160, 88, 0.85);

    content: '';
  }
}

.home-network-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.home-network-chip {
  padding: 4px 10px;

  border: 1px solid rgba(128, 128, 128, 0.35);
  border-radius: 999px;
  background: rgba(128, 128, 128, 0.06);

  color: inherit;
  font-size: 12px;
  text-decoration: none;

  &:hover {
    border-color: rgba(24, 160, 88, 0.8);
  }
}

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

/* 分类分区标题后的计数徽标，与侧边栏分类风格呼应 */
.cat-count {
  margin-left: 8px;
  padding: 0 7px;
  border-radius: 9px;
  background-color: rgba(128, 128, 128, 0.16);

  font-size: 11px;
  font-weight: 400;
  line-height: 18px;
  opacity: 0.7;
}

/* 「清空最近使用」：与 .cat-count 同尺寸，但可点，因此要有 hover 反馈 */
.cat-action {
  margin-left: 8px;
  padding: 0 7px;
  border: 0;
  border-radius: 9px;
  background-color: rgba(128, 128, 128, 0.16);
  color: inherit;
  cursor: pointer;

  font-size: 11px;
  font-family: inherit;
  font-weight: 400;
  line-height: 18px;
}

.cat-action:hover {
  background-color: rgba(128, 128, 128, 0.32);
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

/*
  经典版入口卡片。刻意用虚线边框与工具卡片（实线）区分：
  它通向的是另一套站点，而不是本页的一个工具。
*/
.classic-card {
  display: flex;
  align-items: center;
  gap: 16px;

  padding: 14px 16px;
  border: 1px dashed rgba(128, 128, 128, 0.4);
  border-radius: 8px;

  color: inherit;
  text-decoration: none;

  transition: border-color 0.2s ease, background-color 0.2s ease;

  &:hover {
    border-color: rgba(24, 160, 88, 0.8);
    background-color: rgba(128, 128, 128, 0.05);
  }

  .classic-card-main {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .classic-card-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 500;
  }

  .classic-card-count {
    padding: 0 6px;
    border-radius: 9px;
    background-color: rgba(128, 128, 128, 0.16);

    font-size: 11px;
    font-weight: 400;
    line-height: 18px;
    opacity: 0.8;
  }

  .classic-card-desc {
    font-size: 13px;
    opacity: 0.6;
  }

  .classic-card-go {
    flex: none;
    font-size: 13px;
    opacity: 0.7;
  }
}
</style>
