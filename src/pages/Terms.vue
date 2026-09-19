<script setup lang="ts">
import { computed } from 'vue';
import { useHead } from '@vueuse/head';
import { useI18n } from 'vue-i18n';

import zh from '@/content/legal/terms.zh.md?raw';
import en from '@/content/legal/terms.en.md?raw';
import { CONTACT_EMAIL } from '@/config/contact';

const { locale, t } = useI18n();

const markdown = computed(() => {
  const raw = locale.value === 'zh' ? zh : en;
  return raw.replace(/\{\{CONTACT_EMAIL\}\}/g, CONTACT_EMAIL);
});

const title = computed(() => `${t('legal.terms')} - ${t('legal.siteName')}`);

useHead({ title });
</script>

<template>
  <c-markdown :markdown="markdown" mx-auto mt-50px max-w-700px />
</template>
