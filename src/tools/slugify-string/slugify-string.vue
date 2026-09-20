<script setup lang="ts">
import slugify from '@sindresorhus/slugify';
import { withDefaultOnError } from '@/utils/defaults';
import { useCopy } from '@/composable/copy';

// slugify 内部没有输入长度保护：1MB 文本会让主线程 >10s 无响应（E1-NEG 实测，
// 其余文本类工具处理同样的 1MB 均 <1.1s，属本工具特有的规模边界缺失）。
// 这里做输入闸门：超限直接拒绝，而不是把 1MB 丢进 slugify 硬算。
const MAX_INPUT_LENGTH = 100_000;

const input = ref('');
const isTooLarge = computed(() => input.value.length > MAX_INPUT_LENGTH);
const slug = computed(() => (isTooLarge.value ? '' : withDefaultOnError(() => slugify(input.value), '')));
const { copy } = useCopy({ source: slug, text: 'Slug copied to clipboard' });
</script>

<template>
  <div>
    <c-input-text v-model:value="input" multiline placeholder="Put your string here (ex: My file path)" label="Your string to slugify" autofocus raw-text mb-5 />

    <c-alert v-if="isTooLarge" type="warning" mb-5>
      Input is too large. Please enter 100,000 characters or less.
    </c-alert>

    <c-input-text :value="slug" multiline readonly placeholder="You slug will be generated here (ex: my-file-path)" label="Your slug" mb-5 />

    <div flex justify-center>
      <c-button :disabled="slug.length === 0" @click="copy()">
        Copy slug
      </c-button>
    </div>
  </div>
</template>
