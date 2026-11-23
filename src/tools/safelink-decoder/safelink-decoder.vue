<script setup lang="ts">
import { decodeSafeLinksURL } from './safelink-decoder.service';
import TextareaCopyable from '@/components/TextareaCopyable.vue';

const inputSafeLinkUrl = ref('');
const outputDecodedUrl = computed(() => {
  try {
    return decodeSafeLinksURL(inputSafeLinkUrl.value);
  }
  catch (e: any) {
    return e.toString();
  }
});
</script>

<template>
  <div>
    <c-input-text
      v-model:value="inputSafeLinkUrl"
      raw-text
      placeholder="Your input Outlook SafeLink Url..."
      autofocus
      label="Your input Outlook SafeLink Url:"
    />

    <n-divider />

    <n-form-item label="Output decoded URL:">
      <TextareaCopyable :value="outputDecodedUrl" :word-wrap="true" />
    </n-form-item>

    <section class="mx-auto mt-8 max-w-800px px-4" data-test-id="safelink-guide">
      <h2 class="mb-3 text-xl font-semibold">How to decode an Outlook Safe Links URL</h2>
      <p class="mb-3">
        Paste the complete Microsoft Safe Links URL above. This tool reads its url query parameter
        and displays the destination address without opening that destination.
      </p>

      <h3 class="mb-2 text-lg font-semibold">Example</h3>
      <p class="mb-2">A Safe Links URL containing an encoded destination such as example.com/docs resolves to:</p>
      <pre class="mb-3 overflow-x-auto rounded bg-gray-500:5 p-3"><code>https://example.com/docs</code></pre>

      <h3 class="mb-2 text-lg font-semibold">Important security limits</h3>
      <ul class="list-disc pl-6">
        <li>Decoding reveals the destination URL; it does not scan the destination or verify that it is safe.</li>
        <li>Microsoft Safe Links can check links when they are clicked. This decoder does not replace or bypass that protection.</li>
        <li>Before visiting a decoded address, inspect the domain carefully and follow your organization's security process. Do not open a link just because it was successfully decoded.</li>
      </ul>
    </section>
  </div>
</template>
