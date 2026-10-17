<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToolStore } from '@/tools/tools.store';
import { usePageSeo } from '@/seo/use-page-seo';

// description / canonical / og / twitter 统一由 SEO 数据层产出（见 src/seo/）。
const { t } = useI18n();
usePageSeo('/about', t('site.aboutTitle'));

/**
 * 正文里的工具数是 `{{count}}` 占位，由注册表派生 ——
 * 判据面上的动态值不允许有第二个抄写位置：这里曾经手写过「107」，
 * 而实际数量在 10-17 已经是 114（新增 csv-to-json 等）。
 * 与 Home.page.vue / ToolsCatalog.vue 用同一来源（toolStore.tools.length）。
 */
const toolStore = useToolStore();
const markdown = computed(() => t('about.content', { count: toolStore.tools.length }));
</script>

<template>
  <c-markdown :markdown="markdown" mx-auto mt-50px max-w-600px />
</template>
