<script setup lang="ts">
import { decodeSafeLinksBatch, decodeSafeLinksURL } from './safelink-decoder.service';
import type { SafeLinksBatchResult } from './safelink-decoder.service';
import TextareaCopyable from '@/components/TextareaCopyable.vue';

const { t } = useI18n();

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

const inputSafeLinkUrl = ref('');
const outputDecodedUrl = computed(() => {
  try {
    return decodeSafeLinksURL(inputSafeLinkUrl.value);
  }
  catch (e: any) {
    return e.toString();
  }
});

watch(batchInput, () => {
  // Changed input invalidates prior results so copied output cannot look current.
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
    <section class="mx-auto mt-4 max-w-800px px-4" data-test-id="safelink-batch">
      <h2 class="mb-2 text-xl font-semibold">
        {{ t('tools.safelink-decoder.batch.title') }}
      </h2>
      <p class="mb-3">
        {{ t('tools.safelink-decoder.batch.instructions') }}
      </p>

      <label for="safelink-batch-input" class="mb-2 block text-sm font-medium">
        {{ t('tools.safelink-decoder.batch.inputLabel') }}
      </label>
      <n-input
        id="safelink-batch-input"
        v-model:value="batchInput"
        type="textarea"
        :autosize="{ minRows: 5, maxRows: 12 }"
        :placeholder="t('tools.safelink-decoder.batch.placeholder')"
        aria-describedby="safelink-batch-help"
        data-test-id="safelink-batch-input"
      />
      <p id="safelink-batch-help" class="mt-1 text-xs opacity-70">
        {{ t('tools.safelink-decoder.batch.help') }}
      </p>

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
            <dl class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" data-test-id="safelink-batch-metadata">
              <div class="flex gap-1">
                <dt class="font-semibold">{{ t('tools.safelink-decoder.batch.scheme') }}:</dt>
                <dd>{{ result.scheme }}</dd>
              </div>
              <div class="flex gap-1 min-w-0">
                <dt class="font-semibold">{{ t('tools.safelink-decoder.batch.host') }}:</dt>
                <dd class="break-all">{{ result.host }}</dd>
              </div>
              <div class="flex gap-1">
                <dt class="font-semibold">{{ t('tools.safelink-decoder.batch.layers') }}:</dt>
                <dd>{{ result.nestedLayers }}</dd>
              </div>
            </dl>
          </template>
          <p v-else class="mt-1 text-sm text-red-700 dark:text-red-400" role="alert">
            {{ result.error }}
          </p>
        </div>
      </div>
    </section>

    <n-divider />

    <section class="mx-auto max-w-800px px-4" data-test-id="safelink-single">
      <h2 class="mb-2 text-lg font-semibold">
        {{ t('tools.safelink-decoder.single.title') }}
      </h2>
      <p class="mb-3 text-sm opacity-75">
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
    </section>

    <section class="mx-auto mt-8 max-w-800px px-4" data-test-id="safelink-guide">
      <h2 class="mb-3 text-xl font-semibold">
        {{ t('tools.safelink-decoder.guide.title') }}
      </h2>
      <p class="mb-3">
        {{ t('tools.safelink-decoder.guide.intro') }}
      </p>

      <h3 class="mb-2 text-lg font-semibold">
        {{ t('tools.safelink-decoder.guide.exampleTitle') }}
      </h3>
      <pre class="mb-3 overflow-x-auto rounded bg-gray-500:5 p-3"><code>{{ t('tools.safelink-decoder.guide.example') }}</code></pre>

      <h3 class="mb-2 text-lg font-semibold">
        {{ t('tools.safelink-decoder.guide.securityTitle') }}
      </h3>
      <ul class="list-disc pl-6">
        <li>{{ t('tools.safelink-decoder.guide.localParsing') }}</li>
        <li>{{ t('tools.safelink-decoder.guide.noSafetyScan') }}</li>
        <li>{{ t('tools.safelink-decoder.guide.microsoftProtection') }}</li>
      </ul>

      <h3 class="mb-2 mt-4 text-lg font-semibold">
        {{ t('tools.safelink-decoder.guide.relatedTitle') }}
      </h3>
      <p>
        <a href="/url-parser/">{{ t('tools.safelink-decoder.guide.urlParser') }}</a>
        <span aria-hidden="true"> · </span>
        <a href="/url-encoder/">{{ t('tools.safelink-decoder.guide.urlEncoder') }}</a>
        <span aria-hidden="true"> · </span>
        <a href="/guides/safelink-decoder/">{{ t('tools.safelink-decoder.guide.fullGuide') }}</a>
      </p>
    </section>
  </div>
</template>
