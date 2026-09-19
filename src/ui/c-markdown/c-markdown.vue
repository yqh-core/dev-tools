<script setup lang="ts">
import { marked } from 'marked';
import DomPurify from 'dompurify';

const props = withDefaults(defineProps<{ markdown?: string }>(), { markdown: '' });
const { markdown } = toRefs(props);

marked.use({
  renderer: {
    link(href, title, text) {
      return `<a class="text-primary transition decoration-none hover:underline" href="${href}" target="_blank" rel="noopener">${text}</a>`;
    },
  },
});

// DOMPurify 依赖 DOM：Node 下 isSupported=false 且 sanitize 不是函数，
// 构建期预渲染（scripts/build-seo.mjs）会直接 TypeError。
// 预渲染内容来自仓库内的 .md 文件（构建期可信内容），SSR 下只跑 marked。
const isSSR = typeof window === 'undefined';

const html = computed(() =>
  isSSR ? marked(markdown.value) : DomPurify.sanitize(marked(markdown.value), { ADD_ATTR: ['target'] }),
);
</script>

<template>
  <div v-html="html" />
</template>
