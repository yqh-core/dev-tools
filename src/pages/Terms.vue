<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import zh from '@/content/legal/terms.zh.md?raw';
import en from '@/content/legal/terms.en.md?raw';
import { CONTACT_EMAIL } from '@/config/contact';
import { usePageSeo } from '@/seo/use-page-seo';

const { locale, t } = useI18n();

const markdown = computed(() => {
  const raw = locale.value === 'zh' ? zh : en;
  return raw.replace(/\{\{CONTACT_EMAIL\}\}/g, CONTACT_EMAIL);
});

const title = computed(() => `${t('legal.terms')} - ${t('legal.siteName')}`);

// description / canonical / og / twitter 统一由 SEO 数据层产出（见 src/seo/）。
usePageSeo('/terms', title);
</script>

<template>
  <c-markdown :markdown="markdown" mx-auto mt-50px max-w-700px />
</template>
