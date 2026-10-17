<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePageSeo } from '@/seo/use-page-seo';
import { SITE_FAQ_PATH, fillSiteFaq, getSiteFaqs } from '@/seo/site-faqs';
import { useToolStore } from '@/tools/tools.store';

/**
 * 全站 FAQ 聚合页（参照 nexacove.cc / DevBox Tools 的 faq/index.html）。
 *
 * 数据不在这里：问答全部来自 `@/seo/site-faqs`，构建期的 FAQPage JSON-LD
 * 读的是同一份（见 scripts/build-seo.mjs），页面与结构化数据不允许两个来源。
 *
 * TOC 用 `<a href="#faq-N">` 而不是路由跳转：锚点要能被爬虫与「查看网页源码」看到，
 * 并且预渲染产物里就必须有目录（这是这页存在的意义之一）。
 */
const { locale, t } = useI18n();
const toolStore = useToolStore();

const faqs = computed(() => getSiteFaqs(locale.value).map((item, i) => ({
  id: `faq-${String(i + 1)}`,
  q: item.q,
  a: fillSiteFaq(item.a, toolStore.tools.length),
})));

const title = computed(() => `${t('legal.faq')} - ${t('legal.siteName')}`);
usePageSeo(SITE_FAQ_PATH, title);
</script>

<template>
  <div mx-auto mt-50px max-w-760px px-4>
    <h1 text-28px font-bold>
      {{ t('legal.faq') }}
    </h1>

    <p mt-3 op-75>
      {{ t('faq.intro') }}
    </p>

    <nav mt-6 aria-labelledby="faq-toc-title">
      <h2 id="faq-toc-title" text-18px font-semibold>
        {{ t('faq.contents') }}
      </h2>
      <ol mt-2 pl-5 leading-7>
        <li v-for="item of faqs" :key="`${item.id}-toc`">
          <a :href="`#${item.id}`">{{ item.q }}</a>
        </li>
      </ol>
    </nav>

    <section
      v-for="item of faqs"
      :id="item.id"
      :key="item.id"
      mt-7
      scroll-mt-20
    >
      <h2 text-18px font-semibold>
        {{ item.q }}
      </h2>
      <c-markdown :markdown="item.a" mt-2 />
    </section>

    <p mt-10 op-70>
      {{ t('faq.more') }}
      <RouterLink to="/contact">
        {{ t('legal.contact') }}
      </RouterLink> ·
      <RouterLink to="/tools">
        {{ t('toolsCatalog.title') }}
      </RouterLink> ·
      <RouterLink to="/privacy">
        {{ t('legal.privacy') }}
      </RouterLink>
    </p>
  </div>
</template>
