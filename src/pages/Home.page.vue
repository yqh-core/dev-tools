<script setup lang="ts">
import { IconDragDrop, IconHeart, IconSearch, IconX } from '@tabler/icons-vue';
import { computed, ref } from 'vue';
import Draggable from 'vuedraggable';
import ColoredCard from '../components/ColoredCard.vue';
import ToolCard from '../components/ToolCard.vue';
import { useToolStore } from '@/tools/tools.store';
import type { ToolWithCategory } from '@/tools/tools.types';
import { toolsWithCategory } from '@/tools/index';
import { ALIASES } from '@/tools/aliases';
import { GUIDES } from '@/tools/guides.en';
import { useFuzzySearch } from '@/composable/fuzzySearch';
import { TOOL_CLUSTERS } from '@/seo/clusters';
import { CLASSIC_SITE_TOOL_COUNT, classicSiteUrl } from '@/classic-site';
import { config } from '@/config';
import { usePageSeo } from '@/seo/use-page-seo';

/**
 * `toolsWithCategory`（@/tools/index）是**未翻译的注册表原始数据**，与 tools.store
 * 里那份的区别：store 那份用 t() 翻译过 display name。POPULAR_TOOL_PATHS 的断言只关心
 * path 这个事实字段，两份都能用，但直接用注册表更直白 —— 不给断言引入
 * 「翻译是否加载成功」这个额外变量，断言失败时只需怀疑 path 写错。
 */

const toolStore = useToolStore();

// description / canonical / og / twitter 统一由 SEO 数据层产出（见 src/seo/）。
const { t } = useI18n();
usePageSeo('/', t('site.homeTitle'));

const favoriteTools = computed(() => toolStore.favoriteTools);

/**
 * 首页搜索（Fuse.js 模糊匹配）。
 *
 * 为什么从 `includes` 子串匹配换成 Fuse：
 *   子串匹配要求用户「记得工具标题里的原文」。但真实用户输入的是**任务**
 *   （「format json」「decode jwt」），不是产品名 —— 子串匹配下这类输入经常 0 命中，
 *   而 0 命中最伤首页第一印象。Fuse 的模糊匹配容忍错字与词序，
 *   配置沿用 Ctrl+K 命令面板的既有口径（`command-palette.store.ts`：threshold 0.3），
 *   两处搜索的「手感」保持一致。
 *
 * 匹配字段比原来的 haystack 更全：标题 / 描述 / 路由 / 工具自带 keywords /
 * aliases.ts 的中文同义词。⛔ keywords 与 aliases 是两套不同的东西：
 *   keywords 来自上游项目（英文）；aliases 是本站为中文叫法补的同义词表。
 *   两者都要进 Fuse，否则「搜美化」这类中文query会失效（aliases.ts 文件头即为此而写）。
 *
 * ⚠ 搜索词**不写入 URL query**：本轮刻意不做 URLSearchParams 同步。
 *   前置调研确认 `URLSearchParams` / `location.search` / `route.query` 在 src/ 下
 *   零命中，属于新增能力面，应另开一轮，不与首页改版混在一起。
 */
const searchQuery = ref('');

/** Fuse 的检索对象：把 aliases 摊平成数组字段，交给 keys 配置检索。 */
const searchTools = computed(() =>
  toolStore.tools.map(tool => ({
    ...tool,
    aliasList: ALIASES[tool.path] ?? [],
  })),
);

const { searchResult: fuzzyMatchedTools } = useFuzzySearch({
  search: searchQuery,
  data: searchTools.value,
  options: {
    keys: [
      { name: 'name', weight: 3 },
      { name: 'description', weight: 2 },
      { name: 'aliasList', weight: 2 },
      { name: 'keywords', weight: 1 },
      { name: 'path', weight: 1 },
    ],
    threshold: 0.3,
  },
});

/**
 * 命中列表：**按 path 回查当前 locale 的工具对象**，而不是直接用 Fuse 命中的 item。
 *
 * 为什么不能直接用 Fuse 的 item：`useFuzzySearch` 内部 `new Fuse(data)` 只在建索引时
 * 取一次 data（快照），而 `toolStore.tools` 的 name/description 是 `t()` 派生的、
 * 随 locale 变化。语言切换器是**纯客户端切换、不刷新页面**（locale-selector.vue 直接
 * 绑 `locale`），于是切换后 Fuse 里的快照仍是旧语言，直接渲染会显示英文名。
 * 按 path 回查当前对象即可让结果卡片始终是当前语言 —— 检索语料用快照、显示用实时值。
 *
 * 语料本身不受影响：aliases.ts 的中文同义词与 locale 无关、始终在语料里，
 * keywords 是英文（与命令面板同一口径），所以中文 query 照样能命中。
 */
const matchedTools = computed<ToolWithCategory[]>(() =>
  fuzzyMatchedTools.value
    .map(({ path }) => toolStore.tools.find(tool => tool.path === path))
    .filter(Boolean) as ToolWithCategory[],
);

const isSearching = computed(() => searchQuery.value.trim().length > 0);

/**
 * 常用工具（Popular Tools）—— 8 个，按真实搜索意图排序。
 *
 * 为什么是硬编码清单而不是按访问量排序：站点没有后端，拿不到真实访问统计；
 * 硬编码一份**人工确认过的**清单，比拍脑袋造一个「热度算法」诚实。
 *
 * 排序依据是用户给出的任务优先级（JSON → JWT → Base64 → ID → 正则 → 时间戳 →
 * URL → 哈希），⛔ 顺序即产品语义，不要按字母或按 path 重排。
 *
 * ## 目录名 ≠ 路由 path（本文件最容易踩的坑）
 *   `json-viewer/` 的路由是 `/json-prettify`；`date-time-converter/` → `/date-converter`；
 *   `integer-base-converter/` → `/base-converter`。本清单里有两个踩在这上面：
 *   「Timestamp Converter」= `/date-converter`（不是 `/date-time-converter`）、
 *   「Hash Generator」= `/hash-text`（⛔ 站上没有 `/hash-generator`，别按工具名拼）。
 *
 * ## 为什么这里必须断言，而不能靠 filter(Boolean) 兜底
 *   下面 `popularTools` 沿用既有写法 `.filter(Boolean)` —— 它保证「工具下架时区块少一张卡、
 *   不白屏」，但**同时会把写错的 path 静默丢掉**：少一张卡不会报错，构建全绿，
 *   线上表现为「Popular 只剩 7 个」这种没人会注意的降级。上一轮就是这么漏掉的。
 *   所以这里在**模块求值期**（SSR 预渲染与客户端首帧都会跑，不依赖任何交互）
 *   直接对着 `tools` 注册表断言：8 个 path 必须全部存在、解析结果必须恰好 8 个。
 *   写错一个字符 → 首页在预渲染阶段就抛错，`npm run build` 直接失败。
 */
const POPULAR_TOOL_PATHS = [
  '/json-prettify', // JSON Formatter（目录是 json-viewer/）
  '/jwt-parser', // JWT Decoder
  '/base64-string-converter', // Base64 Encoder
  '/uuid-generator', // UUID Generator
  '/regex-tester', // Regex Tester
  '/date-converter', // Timestamp Converter（目录是 date-time-converter/）
  '/url-encoder', // URL Encoder
  '/hash-text', // Hash Generator（⛔ 没有 /hash-generator 这个路由）
];

/**
 * Popular Tools 的 path 断言（构建期门禁）。
 *
 * 为什么放在模块顶层而不是 computed 里：computed 要等模板访问才求值，
 * 预渲染时只有「真的渲染到该区块」才会执行 —— 一旦有人给区块加了 v-if，
 * 断言就静默失效了。模块顶层在**导入时**就执行，与渲染无关。
 *
 * ⚠️ 实测：这道断言由 **`node scripts/build-seo.mjs`（npm run build 的第四步）**
 *   触发，不是 `vite build` 触发的。原因：`vite build` 只打包首页组件的代码，
 *   **从不执行**它的模块体（没有 ssrLoadModule）；真正执行模块体的是 build-seo.mjs
 *   通过 `vite.ssrLoadModule('/src/entry-server.ts')` 渲染首页的那一刻。
 *   实测把 `/hash-text` 故意写成 `/hash-generator` 后：
 *     - `npx vite build` → exit 0（构建全绿，什么都没报）
 *     - `node scripts/build-seo.mjs` → exit 1，打印缺失 path 与本函数行号
 *   ⇒ 光看 vite build 的绿灯会误以为断言没生效；`npm run build` 串联四步，
 *     所以走 npm run build 才会红。这不是断言失效，是它所在的阶段本来就在第四步。
 *
 * ⛔ 断言的是「注册表里真实存在」，不是「目录名看起来对」：
 *   所有 path 都从 tools 注册表比对，与 tools.store 用的是同一份数据源。
 */
function assertPopularToolPaths(paths: string[], tools: ToolWithCategory[]) {
  const known = new Set(tools.map(tool => tool.path));
  const missing = paths.filter(path => !known.has(path));

  if (missing.length > 0) {
    throw new Error(
      `[Home.page] POPULAR_TOOL_PATHS 断言失败：${missing.length}/${paths.length} 个 path `
      + `在 tools 注册表中不存在：\n  - ${missing.join('\n  - ')}\n`
      + '⛔ 目录名 ≠ 路由 path（json-viewer/→/json-prettify、date-time-converter/→/date-converter、'
      + 'integer-base-converter/→/base-converter）。请对照 src/tools/*/index.ts 的 path 字段填写，'
      + '⛔ 不要按目录名或工具显示名拼路径。',
    );
  }

  if (paths.length !== 8) {
    throw new Error(`[Home.page] POPULAR_TOOL_PATHS 应为 8 个，实际 ${paths.length} 个`);
  }
}

assertPopularToolPaths(POPULAR_TOOL_PATHS, toolsWithCategory);

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
 *
 * ⛔ 本轮改版新增的所有区块一律沿用这个模式（标量 key + 模板内硬编码列表），
 *   包括下面 tasks / practice 的文案键 —— 不要再改成数组词条。
 */
const WHY_POINT_KEYS = [
  'home.why.point1',
  'home.why.point2',
  'home.why.point3',
  'home.why.point4',
];

/**
 * 每个任务簇在首页展示的代表工具条数。
 *
 * 为什么限流：簇成员最多 12 个（json 簇），全列出来首页就退化成又一份工具网格，
 * 违背「按任务浏览是为了 3 秒内定位」的初衷。6 个足够让人认出「这一簇能干什么」，
 * 想看全部的用户往下滑还有完整的 101 个 chips 区块与工具侧栏。
 */
const CLUSTER_PREVIEW_LIMIT = 6;

/**
 * 「按任务浏览」区块的数据源 = `TOOL_CLUSTERS`（src/seo/clusters.ts）。
 *
 * ⛔ 为什么复用它而不另建分类表：簇是**单一事实源**，三处已在消费它 ——
 *   ① 构建期强制 en/zh 词条成对（build-seo.mjs:243-248，缺一条 process.exit(1)）；
 *   ② 每个工具页底部的 workflow 区块（顺序即工作流，先做什么再做什么）；
 *   ③ `resolveRelated` 的同簇优先内链推荐。
 *   首页另起一张分类表，等于让「工具页说这是 JSON 簇、首页说这是 format 簇」，
 *   两套语义对不上，且新增工具时容易只改一处。
 *
 * 簇成员 path 直接来自簇定义，再回查 tools 注册表拿展示名（走 i18n
 * `tools.<id>.name` 体系，⛔ 不硬编码英文工具名）。回查同时兜住「簇里写了
 * 一个已下架工具」的情况 —— 那种 path 在 `src/seo/tool-page.ts` 的
 * `auditToolSeoData()` 早已被构建期拦掉，这里只是不让它渲染成空卡片。
 */
const taskClusters = computed(() =>
  TOOL_CLUSTERS.map(cluster => ({
    id: cluster.id,
    // 簇名走 i18n 词条 clusters.<id>（与工具页 workflow 区块同一批词条）
    label: t(`clusters.${cluster.id}`),
    tools: cluster.members
      .map(path => toolStore.tools.find(tool => tool.path === path))
      .filter(Boolean)
      .slice(0, CLUSTER_PREVIEW_LIMIT) as ToolWithCategory[],
  })),
);

/**
 * 首页 Blog 区块的文章卡片 —— **从 guides 的 relatedNotes 反向聚合**（不再手写清单）。
 *
 * ## 为什么改成数据驱动
 *   此前这里是硬编码的 3 篇卡片 + 一句「新文章上线后手动增补」的注释。那个机制正在
 *   **静默失效，且失效方向是最坏的那种**：2026-10-07 上线的两篇英文开发文章
 *   （devops-tools-guide / uuid-vs-ulid-guide）恰好对应 Keyword Map 里标为高优先的
 *   /chmod-calculator + /crontab-generator 与 /uuid-generator + /ulid-generator，
 *   却因为「要记得手动加」而没进首页。硬编码清单的维护成本恒大于收益。
 *
 *   现在：文章清单的唯一事实源是 `ToolGuide.relatedNotes`（src/tools/guides.*.ts），
 *   工具页 related guides 区块与首页 Blog 区块**消费同一份数据**。新文章只要在某个
 *   工具的 relatedNotes 加一条，两处同时出现。
 *
 * ## 红线（G-03 裁定④，由机器守住而不是靠注释提醒）
 *   title / description / url 必须与 forge-notes 文章 frontmatter **逐字一致**，
 *   否则「首页标题 ≠ 文章标题」会分裂 SEO 信号。本文件**只做校验与展示，不生产文案**：
 *   三个字段全部原样取自 guides 的 relatedNotes。
 *   ⛔ 逐字一致性由 `scripts/audit-keyword-map.mjs --frontmatter` 对着真实
 *     forge-notes 仓库做门禁（那个仓库在本项目之外，只能在脚本里去读），
 *     另有 auditToolSeoData 守住 en/zh 成对性。⛔ 不靠注释提醒。
 *
 * ## ⛔ 只收英文文章
 *   forge-notes 现有 22 篇正文，其中 17 篇是中文（AdSense / 跨境电商 / SEO /
 *   VitePress），受众与英文主站不一致。relatedNotes 只登记 `lang: en` 的 5 篇 ——
 *   把中文文章塞进英文主站首页是 Localization 事故，不是「内容更丰富」。
 *
 * ## 排序：按工具分类顺序首次出现的次序
 *   ⛔ 不引入手写顺序数组 —— 那只是把「维护一份清单」换成了「维护另一份清单」。
 *   去重后保留首次出现的位置，因此 JSON 文章一定排在 DevOps 之前（分类顺序稳定），
 *   且完全由 guides 的 key 顺序决定。
 */
const BLOG_POSTS = (() => {
  const byUrl = new Map<string, { title: string; description: string; url: string; tag: string }>();
  for (const guide of Object.values(GUIDES)) {
    for (const note of guide.relatedNotes ?? []) {
      // 按 url 去重：同一篇文章被多个工具引用（uuid-vs-ulid-guide 同时挂在
      // /uuid-generator 与 /ulid-generator 上）只出现一次。
      if (!byUrl.has(note.url)) {
        byUrl.set(note.url, {
          title: note.title,
          description: note.description,
          url: note.url,
          tag: note.tag,
        });
      }
    }
  }
  return [...byUrl.values()];
})();

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

        <!--
          工具搜索框：从 hero 下方的独立区块搬进 hero 内部。
          它是首页真正的行动召唤点（用户要的是「输入意图 → 落到工具」），
          所以放大到 hero 的收尾元素，placeholder 直接示范任务式输入
          （Try "format JSON"...）。匹配走 Fuse.js，见脚本段注释。
        ⛔ 搜索词不写入 URL query（本轮刻意不做 URLSearchParams 同步）。
        -->
        <div class="hero-search">
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
        </div>

        <button class="hero-cta" type="button" @click="scrollToCategories">
          {{ t('home.hero.cta') }} ↓
        </button>
      </header>

      <div v-if="isSearching" class="search-result-head">
        <span v-if="matchedTools.length > 0">
          {{ t('search.found', { count: matchedTools.length, query: searchQuery.trim() }) }}
        </span>
        <span v-else>
          {{ t('search.empty', { query: searchQuery.trim() }) }}
        </span>
      </div>

      <div v-if="isSearching" class="grid grid-cols-1 gap-12px lg:grid-cols-3 md:grid-cols-3 sm:grid-cols-2 xl:grid-cols-4">
        <ToolCard v-for="tool in matchedTools" :key="tool.path" :tool="tool" />
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
          Popular Tools：8 个高频工具，按用户搜索意图排序（脚本段 POPULAR_TOOL_PATHS）。
          101 个工具平铺时，第一次来的人只会看到一片网格。⛔ 这 8 个 path 已由模块级
          断言校验存在于 tools 注册表 —— 不要绕过断言，也不要靠 filter(Boolean) 兜底。
        -->
        <section id="home-popular">
          <h2 class="home-block-title">
            {{ $t('home.categories.popularTools') }}
          </h2>
          <div class="grid grid-cols-1 gap-12px lg:grid-cols-3 md:grid-cols-3 sm:grid-cols-2 xl:grid-cols-4">
            <ToolCard v-for="tool in popularTools" :key="tool.path" :tool="tool" />
          </div>
        </section>

        <!--
          Browse by task（新增区块）：数据源是 TOOL_CLUSTERS（src/seo/clusters.ts），
          ⛔ 不另建分类表 —— 簇是单一事实源，构建期强制 en/zh 词条成对，且工具页
          workflow 区块与 related 推荐都在消费它。
          簇名走 i18n 词条 clusters.<id>（⛔ 标量 key，非数组 —— 见 WHY_POINT_KEYS 注释）。
          每个簇展示最多 6 个代表工具的真链接（RouterLink → SSR HTML 里是真 <a href>）。
          ⚠ 红线：下方「全部分类」区块的 101 个内链一个都不能少，这个区块**新增**而非替代。
        -->
        <section id="home-tasks" class="home-block">
          <h2 class="home-block-title">
            {{ $t('home.tasks.title') }}
          </h2>
          <p class="home-block-text">
            {{ $t('home.tasks.intro') }}
          </p>
          <div class="task-grid">
            <div
              v-for="cluster in taskClusters"
              :key="cluster.id"
              class="task-card"
            >
              <h3 class="task-card-title">
                {{ cluster.label }}
              </h3>
              <div class="task-card-tools">
                <RouterLink
                  v-for="tool in cluster.tools"
                  :key="tool.path"
                  class="task-chip"
                  :to="tool.path"
                >
                  <n-icon :component="tool.icon" size="14" class="task-chip-icon" />
                  <span class="task-chip-name">{{ tool.name }}</span>
                </RouterLink>
              </div>
            </div>
          </div>
        </section>

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
          Developer Practice（新增区块）：引流到同站的 geek-typing。
          ⛔ 不带 ?bank= query —— 跨站 canonical 页面不带 query，带了等于给同一个
            练习页制造多个「重复内容」入口。
          ⛔ 不写死统计数字（「6 个词库 9438 词」这类）：geek-typing 是独立部署的长站，
            数字会变而首页是构建产物 —— 写死就是一个必然过期的值。这与 BLOG_POSTS
            「文章清单手动维护」是同一类需要人工同步的腐坏点，能不写就不写。
          ⛔ 不编造用户评价 / 使用人数 / 星级。
          文案全部走标量词条 home.practice.*（⛔ 数组词条在 SSR 下会渲染成 key 本身）。
        -->
        <section class="home-block">
          <h2 class="home-block-title">
            {{ $t('home.practice.title') }}
          </h2>
          <p class="home-practice-subtitle">
            {{ $t('home.practice.subtitle') }}
          </p>
          <p class="home-block-text">
            {{ $t('home.practice.intro') }}
          </p>
          <p class="home-practice-topics">
            {{ $t('home.practice.topics') }}
          </p>
          <a
            class="home-practice-cta"
            href="https://geek-typing.pages.dev/"
            target="_blank"
            rel="noopener"
          >{{ $t('home.practice.cta') }} →</a>
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

    font-size: 28px;
    font-weight: 650;
    line-height: 1.25;

    @media (min-width: 640px) {
      font-size: 34px;
    }
  }

  .home-hero-subtitle {
    max-width: 760px;
    margin: 0;

    font-size: 15px;
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

/* Hero 内的搜索框：从原独立区块搬进来后放大 —— 它是首页最重要的行动召唤点。
   ⛔ 375px 窄屏下必须仍可用：flex + min-width:0 让 input 收缩而不是把容器撑破，
   .search-bar 自身 width 100% 且不给固定宽度。 */
.hero-search {
  width: 100%;
  max-width: 620px;
  margin-top: 16px;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 10px;

  width: 100%;
  padding: 14px 18px;

  border: 1px solid rgba(128, 128, 128, 0.35);
  border-radius: 12px;
  background: rgba(128, 128, 128, 0.06);

  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &:focus-within {
    border-color: rgba(24, 160, 88, 0.8);
    box-shadow: 0 0 0 3px rgba(24, 160, 88, 0.12);
  }

  .search-icon {
    flex: none;

    font-size: 20px;
    opacity: 0.5;
  }

  .search-input {
    flex: 1;
    min-width: 0;

    border: none;
    background: transparent;
    outline: none;

    color: inherit;
    font-size: 16px;
    font-family: inherit;

    &::placeholder {
      color: inherit;
      opacity: 0.45;
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

/* 「按任务浏览」区块：14 个任务簇的网格。
   ⛔ 375px 窄屏必须降为单列 —— 用 auto-fill + minmax 让它自然折行，
   不写死 3/4 列，否则窄屏会横向溢出。 */
.task-grid {
  display: grid;
  gap: 10px;
  margin-top: 12px;

  grid-template-columns: 1fr;

  @media (min-width: 640px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
  }
}

.task-card {
  padding: 12px 14px;

  border: 1px solid rgb(128, 128, 128, 0.18);
  border-radius: 10px;

  transition: border-color 0.2s ease, background-color 0.2s ease;

  &:hover {
    border-color: rgba(24, 160, 88, 0.6);
    background: rgba(24, 160, 88, 0.03);
  }

  .task-card-title {
    margin: 0 0 8px;

    font-size: 13.5px;
    font-weight: 600;
    line-height: 1.4;
  }

  .task-card-tools {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
}

.task-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;

  /* ⛔ 不要 max-width:100% + ellipsis：簇内工具名普遍是长SEO 标题
     （实测 10 个超过 34 字符，最长「JSON Formatter & Validator — Beautify and
     Validate JSON Online」），限宽会被截成「UUID Generator — Free Online UUID v4…」
     反而认不出是哪个工具。这里让 chip 按内容自适应宽度：flex-wrap 负责换行，
     窄屏时整枚 chip 会移到下一行，而不是被裁掉一半。 */
  padding: 3px 9px;

  border: 1px solid rgba(128, 128, 128, 0.22);
  border-radius: 999px;

  color: inherit;
  text-decoration: none;

  transition: border-color 0.15s ease, background-color 0.15s ease;

  &:hover {
    border-color: rgba(24, 160, 88, 0.7);
    background: rgba(24, 160, 88, 0.06);
  }

  .task-chip-icon {
    flex: none;

    opacity: 0.5;
  }

  .task-chip-name {
    /* 保留自然换行能力：超长标题在窄 chip 里折行，而不是被省略号吃掉 */
    min-width: 0;

    font-size: 12px;
    line-height: 1.5;
  }
}

/* Developer Practice 引流区块 */
.home-practice-subtitle {
  margin: 0 0 6px;

  font-size: 14px;
  font-weight: 500;
  opacity: 0.85;
}

.home-practice-topics {
  margin: 8px 0 0;

  font-size: 12.5px;
  letter-spacing: 0.02em;
  opacity: 0.6;
}

.home-practice-cta {
  display: inline-block;
  margin-top: 10px;
  padding: 7px 16px;

  border: 1px solid rgba(24, 160, 88, 0.55);
  border-radius: 8px;

  color: rgba(16, 128, 67, 1);
  text-decoration: none;

  font-size: 13px;
  font-weight: 500;

  transition: background-color 0.2s ease;

  &:hover {
    background: rgba(24, 160, 88, 0.1);
  }

  .dark & {
    color: rgba(60, 200, 130, 1);
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
