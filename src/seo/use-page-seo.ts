/**
 * 页面级 SEO head —— 5 个静态路由（`/` `/about` `/privacy` `/terms` `/contact`）共用。
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
 * @param path  该页面的路由路径（不带尾斜杠，如 `/privacy`）。
 *              由 `canonicalUrl()` 统一规范化，页面无需自己关心尾斜杠。
 * @param title 页面标题。法务页传 i18n `legal.*` 的 computed，
 *              首页 / 关于页传固定字符串 —— 保持各页原有的 title 来源不变。
 */
export function usePageSeo(path: string, title: MaybeRef<string>) {
  const { locale } = useI18n();

  const pageTitle = computed(() => unref(title));
  const description = computed(() => getPageMeta(path, locale.value).description);
  const canonical = canonicalUrl(path);

  useHead({
    title: pageTitle,
    link: [{ rel: 'canonical', href: canonical }],
    meta: [
      { name: 'description', content: description },
      { itemprop: 'name', content: pageTitle },
      { itemprop: 'description', content: description },

      { property: 'og:url', content: canonical },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: pageTitle },
      { property: 'og:description', content: description },
      { property: 'og:image', content: OG_IMAGE },

      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: pageTitle },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: OG_IMAGE },
    ],
  });
}
