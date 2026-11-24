<script setup lang="ts">
import { decodeSafeLinksBatch, decodeSafeLinksURL } from './safelink-decoder.service';
import type { SafeLinksBatchResult } from './safelink-decoder.service';
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
  batchResults.value = decodeSafeLinksBatch(batchInput.value);
}

async function copySuccessfulBatchResults(): Promise<void> {
  const successfulUrls = batchResults.value
    .map(result => result.decodedUrl)
    .filter((url): url is string => Boolean(url));

  if (!successfulUrls.length) {
    return;
  }

  try {
    await navigator.clipboard.writeText(successfulUrls.join('\n'));
    batchCopyStatus.value = t('tools.safelink-decoder.batch.copied');
  }
  catch {
    batchCopyStatus.value = t('tools.safelink-decoder.batch.copyFailed');
  }
}
</script>

<template>
  <div>
    <section class="mx-auto max-w-800px px-4" data-test-id="safelink-batch" aria-labelledby="safelink-batch-heading">
      <h2 id="safelink-batch-heading" class="mb-3 text-xl font-semibold">
        {{ t('tools.safelink-decoder.batch.title') }}
      </h2>
      <p class="mb-3">
        {{ t('tools.safelink-decoder.batch.intro') }}
      </p>
      <p class="mb-3 text-sm text-gray-500">
        {{ t('tools.safelink-decoder.batch.instructions') }}
      </p>

      <n-input
        v-model:value="batchInput"
        type="textarea"
        :autosize="{ minRows: 5, maxRows: 12 }"
        :placeholder="t('tools.safelink-decoder.batch.placeholder')"
        data-test-id="safelink-batch-input"
        aria-label="Outlook Safe Links batch input"
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
            <p class="mt-1 text-xs text-gray-500" data-test-id="safelink-batch-result-details">
              {{ t('tools.safelink-decoder.batch.resultDetails', {
                scheme: result.scheme,
                host: result.host,
                depth: result.depth,
              }) }}
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
      <h2 class="mb-3 text-xl font-semibold">{{ t('tools.safelink-decoder.guide.title') }}</h2>
      <p class="mb-3">
        {{ t('tools.safelink-decoder.guide.intro') }}
      </p>

      <h3 class="mb-2 text-lg font-semibold">{{ t('tools.safelink-decoder.guide.exampleTitle') }}</h3>
      <pre class="mb-3 overflow-x-auto rounded bg-gray-500:5 p-3"><code>{{ t('tools.safelink-decoder.guide.example') }}</code></pre>

      <h3 class="mb-2 text-lg font-semibold">{{ t('tools.safelink-decoder.guide.securityTitle') }}</h3>
      <ul class="list-disc pl-6">
        <li>{{ t('tools.safelink-decoder.guide.security1') }}</li>
        <li>{{ t('tools.safelink-decoder.guide.security2') }}</li>
        <li>{{ t('tools.safelink-decoder.guide.security3') }}</li>
      </ul>

      <h3 class="mb-2 mt-4 text-lg font-semibold">{{ t('tools.safelink-decoder.guide.relatedTitle') }}</h3>
      <p>
        <a href="/url-parser/">{{ t('tools.safelink-decoder.guide.urlParser') }}</a>
        <span> · </span>
        <a href="https://notes.digdevbox.com/posts/outlook-safelinks-decoder-guide" rel="noopener noreferrer">
          {{ t('tools.safelink-decoder.guide.article') }}
        </a>
      </p>
    </section>

    <details class="mx-auto mt-8 max-w-800px px-4" data-test-id="safelink-single">
      <summary class="cursor-pointer text-lg font-semibold">
        {{ t('tools.safelink-decoder.single.title') }}
      </summary>
      <p class="mb-3 mt-2 text-sm text-gray-500">
        {{ t('tools.safelink-decoder.single.instructions') }}
      </p>
      <c-input-text
        v-model:value="inputSafeLinkUrl"
        raw-text
        :placeholder="t('tools.safelink-decoder.single.placeholder')"
        :label="t('tools.safelink-decoder.single.inputLabel')"
      />

      <n-divider />

      <n-form-item :label="t('tools.safelink-decoder.single.outputLabel')">
        <TextareaCopyable :value="outputDecodedUrl" :word-wrap="true" />
      </n-form-item>
    </details>
  </div>
</template>
