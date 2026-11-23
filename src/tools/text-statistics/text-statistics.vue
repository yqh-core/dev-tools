<script setup lang="ts">
import { getStringSizeInBytes } from './text-statistics.service';
import { formatBytes } from '@/utils/convert';

const text = ref('');
</script>

<template>
  <div flex flex-col gap-3>
    <c-card title="Text statistics example" data-test-id="text-statistics-example">
      <p mb-2 text-sm opacity-70>
        Paste text to count characters, whitespace-separated words, lines and UTF-8 bytes. All calculations run locally in your browser.
      </p>
      <div rounded bg-gray-500:5 p-3 font-mono text-sm>
        Hello, world!<br>
        This is a test.
      </div>
      <div mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4>
        <div><strong>29</strong><div text-xs opacity-70>characters</div></div>
        <div><strong>6</strong><div text-xs opacity-70>words</div></div>
        <div><strong>2</strong><div text-xs opacity-70>lines</div></div>
        <div><strong>29 B</strong><div text-xs opacity-70>UTF-8 bytes</div></div>
      </div>
      <p mt-2 text-xs opacity-60>
        Word count splits on whitespace; byte size is measured from UTF-8 encoding. Character count follows JavaScript string length.
      </p>
    </c-card>

    <c-card>
      <c-input-text v-model:value="text" multiline placeholder="Your text..." rows="5" />

      <div mt-5 flex>
        <div data-test-id="character-count"><n-statistic label="Character count" :value="text.length" flex-1 /></div>
        <div data-test-id="word-count"><n-statistic label="Word count" :value="text === '' ? 0 : text.split(/\s+/).length" flex-1 /></div>
        <div data-test-id="line-count"><n-statistic label="Line count" :value="text === '' ? 0 : text.split(/\r\n|\r|\n/).length" flex-1 /></div>
        <div data-test-id="byte-size"><n-statistic label="Byte size" :value="formatBytes(getStringSizeInBytes(text))" flex-1 /></div>
      </div>
    </c-card>
  </div>
</template>
