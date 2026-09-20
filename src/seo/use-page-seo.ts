/**
 * 页面级 SEO head —— 静态页面（`/` `/about` `/privacy` `/terms` `/contact`）与
 * 工具页（通过 `ToolSeoPage.vue` 传入 description）共用。
 *
 * 为什么需要它：这些页面此前只声明了 `title`，没有 description，也没有
 * 页面级的 og / twitter 元数据。而 `index.html` 模板里这些标签**全部写死成首页的值**，
 * 预渲染只是把正文换掉，标签原样保留 —— 结果 `/privacy/` 会带着
 * `og:url = https://digdevbox.com/` 和首页的 og:title，指向的却是隐私政策页。
 *
 * 这里把「title / description / canonical / og / twitter / itemprop」一次性声明齐，
 * 由 `scripts/build-seo.mjs` 在构建期渲染后整体替换模板里的 `<!-- page-seo -->` 区块。
 */
import type { MaybeRef } from 'vue';
import { computed, unref } from 'vue';
import { useHead } from '@vueuse/head';
import { useI18n } from 'vue-i18n';

import { getPageMeta } from './page-meta';
import { canonicalUrl, OG_IMAGE } from './site';

/**
 * 品牌主色 —— 同时用于 `<meta name="theme-color">`（手机浏览器地址栏着色）。
 * 注意：index.html 模板里的 theme-color 写在 `<!-- page-seo -->` 区块内，
 * 构建期会被本文件 useHead 生成的标签整体替换掉，所以必须在这里也声明，
 * 否则线上的 theme-color 会丢失（静态层体检实测到的就是这个问题）。
 */
const BRAND_COLOR = '#0f766e';

/**
 * @param path        该页面的路由路径（不带尾斜杠，如 `/privacy`）。
 *                    由 `canonicalUrl()` 统一规范化，页面无需自己关心尾斜杠。
 * @param title       页面标题。法务页传 i18n `legal.*` 的 computed，
 *                    首页 / 关于页传固定字符串 —— 保持各页原有的 title 来源不变。
 * @param description 可选的 description 覆盖值。
 *                    `page-meta.ts` 只登记 5 个静态路由；工具页的 description
 *                    来自工具定义本身（`tools.<key>.description`），不属于那张表，
 *                    因此由调用方传入。不传时按静态路由表查。
 */
export function usePageSeo(path: string, title: MaybeRef<string>, description?: MaybeRef<string>) {
  const { locale } = useI18n();

  const pageTitle = computed(() => unref(title));
  const pageDescription = computed(() =>
    description === undefined ? getPageMeta(path, locale.value).description : unref(description),
  );
  const canonical = canonicalUrl(path);

  useHead({
    title: pageTitle,
    link: [{ rel: 'canonical', href: canonical }],
    meta: [
      { name: 'description', content: pageDescription },
      { itemprop: 'name', content: pageTitle },
      { itemprop: 'description', content: pageDescription },
      { name: 'theme-color', content: BRAND_COLOR },

      { property: 'og:url', content: canonical },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: pageTitle },
      { property: 'og:description', content: pageDescription },
      { property: 'og:image', content: OG_IMAGE },

      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: pageTitle },
      { name: 'twitter:description', content: pageDescription },
      { name: 'twitter:image', content: OG_IMAGE },
    ],
  });
}
