<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { usePageSeo } from '@/seo/use-page-seo';

// description / canonical / og / twitter 统一由 SEO 数据层产出（见 src/seo/）。
const { t } = useI18n();
usePageSeo('/about', t('site.aboutTitle'));
</script>

<template>
  <c-markdown :markdown="$t('about.content')" mx-auto mt-50px max-w-600px />
</template>
