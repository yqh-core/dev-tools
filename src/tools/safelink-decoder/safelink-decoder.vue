<script setup lang="ts">
import { decodeSafeLinksURL } from './safelink-decoder.service';
import TextareaCopyable from '@/components/TextareaCopyable.vue';

const { t } = useI18n();

const inputSafeLinkUrl = ref('');
const outputDecodedUrl = computed(() => {
  try {
    return decodeSafeLinksURL(inputSafeLinkUrl.value);
  }
  catch (e: any) {
    return e.toString();
  }
});

interface SafeLinksBatchResult {
  line: number;
  input: string;
  decodedUrl: string | null;
  error: string | null;
}

const batchInput = ref('');
const batchResults = ref<SafeLinksBatchResult[]>([]);
const batchCopyStatus = ref('');

const batchSuccessCount = computed(() => batchResults.value.filter(result => result.decodedUrl).length);
const batchFailureCount = computed(() => batchResults.value.filter(result => result.error).length);
const batchSummary = computed(() => batchResults.value.length
  ? t('tools.safelink-decoder.batch.summary', {
      success: batchSuccessCount.value,
      total: batchResults.value.length,
      failed: batchFailureCount.value,
    })
  : '');

watch(batchInput, () => {
  // A changed input invalidates prior results, so copied output can never look current.
  batchResults.value = [];
  batchCopyStatus.value = '';
});

function decodeBatch(): void {
  const rows = batchInput.value
    .split(/\\r?\\n/)
    .map((value, index) => ({ line: index + 1, value: value.trim() }))
    .filter(row => row.value.length > 0);

  batchResults.value = rows.map(({ line, value }) => {
    try {
      return {
        line,
        input: value,
        decodedUrl: decodeSafeLinksURL(value),
        error: null,
      };
    }
    catch (error) {
      return {
        line,
        input: value,
        decodedUrl: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

async function copySuccessfulBatchResults(): Promise<void> {
  const successfulUrls = batchResults.value
    .map(result => result.decodedUrl)
    .filter((url): url is string => Boolean(url));

  if (!successfulUrls.length) {
    return;
  }

  try {
    await navigator.clipboard.writeText(successfulUrls.join('\\n'));
    batchCopyStatus.value = t('tools.safelink-decoder.batch.copied');
  }
  catch {
    batchCopyStatus.value = t('tools.safelink-decoder.batch.copyFailed');
  }
}
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

    <section class="mx-auto mt-8 max-w-800px px-4" data-test-id="safelink-batch">
      <h2 class="mb-3 text-xl font-semibold">{{ t('tools.safelink-decoder.batch.title') }}</h2>
      <p class="mb-3">{{ t('tools.safelink-decoder.batch.instructions') }}</p>

      <n-input
        v-model:value="batchInput"
        type="textarea"
        :autosize="{ minRows: 4, maxRows: 10 }"
        :placeholder="t('tools.safelink-decoder.batch.placeholder')"
        data-test-id="safelink-batch-input"
      />

      <div class="mt-3 flex flex-wrap gap-2">
        <c-button
          data-test-id="safelink-batch-decode"
          :disabled="!batchInput.trim()"
          @click="decodeBatch"
        >
          {{ t('tools.safelink-decoder.batch.decode') }}
        </c-button>
        <c-button
          size="small"
          data-test-id="safelink-batch-copy"
          :disabled="batchSuccessCount === 0"
          @click="copySuccessfulBatchResults"
        >
          {{ t('tools.safelink-decoder.batch.copy') }}
        </c-button>
      </div>

      <p v-if="batchSummary" class="mt-3 text-sm" role="status" data-test-id="safelink-batch-summary">
        {{ batchSummary }}
      </p>
      <p v-if="batchCopyStatus" class="mt-1 text-sm" role="status" data-test-id="safelink-batch-copy-status">
        {{ batchCopyStatus }}
      </p>

      <div v-if="batchResults.length" class="mt-3 space-y-2" aria-live="polite">
        <div
          v-for="result in batchResults"
          :key="result.line"
          class="rounded border border-gray-200 p-3 dark:border-gray-700"
          :data-test-line="result.line"
          :data-test-status="result.decodedUrl ? 'success' : 'error'"
          data-test-id="safelink-batch-result"
        >
          <strong>{{ t('tools.safelink-decoder.batch.line', { line: result.line }) }}</strong>
          <template v-if="result.decodedUrl">
            <p class="mt-1 text-xs text-green-700 dark:text-green-400">
              {{ t('tools.safelink-decoder.batch.success') }}
            </p>
            <code class="mt-1 block break-all" data-test-id="safelink-batch-decoded-url">{{ result.decodedUrl }}</code>
          </template>
          <p v-else class="mt-1 text-sm text-red-700 dark:text-red-400" role="alert">
            {{ result.error }}
          </p>
        </div>
      </div>
    </section>

    <section class="mx-auto mt-8 max-w-800px px-4" data-test-id="safelink-guide">
      <h2 class="mb-3 text-xl font-semibold">How to decode an Outlook Safe Links URL</h2>
      <p class="mb-3">
        Paste the complete Microsoft Safe Links URL above. This tool reads its url query parameter,
        unwraps nested Outlook Safe Links URLs up to five layers, and displays the destination
        address without opening it. Only HTTPS wrappers on the Outlook Safe Links domain are accepted.
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

      <h3 class="mb-2 text-lg font-semibold">Related URL tools</h3>
      <p>
        Use the <a href="/url-parser/">URL Parser</a> to inspect the decoded address components, or the
        <a href="/url-encoder/">URL Encoder</a> to encode or decode URL components.
      </p>
    </section>
  </div>
</template>
