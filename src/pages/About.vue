<script setup lang="ts">
import { usePageSeo } from '@/seo/use-page-seo';

// description / canonical / og / twitter 统一由 SEO 数据层产出（见 src/seo/）。
usePageSeo('/about', '关于 - 开发者工具箱');
</script>

<template>
  <c-markdown :markdown="$t('about.content')" mx-auto mt-50px max-w-600px />
</template>
