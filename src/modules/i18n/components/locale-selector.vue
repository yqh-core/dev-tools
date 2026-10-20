<script setup lang="ts">
import { ENABLED_LOCALES } from '@/i18n/languages';

const { availableLocales, locale } = useI18n();

// 选项从语言注册表派生（不再写死 zh/en map）。与 availableLocales 取交集是防御：
// 注册表里声明了某语言、但对应 locales/<code>.yml 缺失时，不把它做成会渲染 key 的死选项。
const localeOptions = computed(() => {
  const loaded = new Set(availableLocales.map(String));
  return ENABLED_LOCALES
    .filter(l => loaded.has(l.code))
    .map(l => ({ label: l.nativeName, value: l.code }));
});

// placeholder 用各语言**自己的原生名**拼出，语言中性、无写死英文，也不引入缺失词条。
const placeholder = computed(() => ENABLED_LOCALES.map(l => l.nativeName).join(' / '));
</script>

<template>
  <c-select
    v-model:value="locale"
    :options="localeOptions"
    :placeholder="placeholder"
    w-100px
  />
</template>
