<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { CompressLevel } from '../pdf-merge/pdf-lib.service';
import { compressPdf } from '../pdf-merge/pdf-lib.service';

const { t } = useI18n();
const file = ref<File | null>(null);
const level = ref<CompressLevel>('balanced');
const busy = ref(false);
const error = ref<string | null>(null);
const result = ref<{ url: string; from: number; to: number } | null>(null);
const optimal = ref(false);

// 上限：再大浏览器内存与耗时都会失控，且这类文件本就该用桌面工具
const MAX_BYTES = 80 * 1024 * 1024;

function fmtBytes(n: number) {
  if (n < 1024) {
    return `${n} B`;
  }
  if (n < 1024 ** 2) {
    return `${(n / 1024).toFixed(1)} KB`;
  }
  return `${(n / 1024 ** 2).toFixed(2)} MB`;
}

const savedPct = computed(() => {
  if (!result.value || result.value.from === 0) {
    return 0;
  }
  return Math.max(0, Math.round((1 - result.value.to / result.value.from) * 100));
});

function onFileChange(f: File | null) {
  error.value = null;
  clearResult();
  file.value = f;
}

function clearResult() {
  if (result.value) {
    URL.revokeObjectURL(result.value.url);
  }
  result.value = null;
  optimal.value = false;
}

async function apply() {
  if (!file.value) {
    return;
  }
  if (file.value.size > MAX_BYTES) {
    error.value = t('tools.pdf-compress.errors.tooLarge');
    return;
  }
  busy.value = true;
  error.value = null;
  clearResult();
  try {
    const out = await compressPdf(await file.value.arrayBuffer(), level.value);
    optimal.value = out.alreadyOptimal;
    result.value = {
      url: URL.createObjectURL(new Blob([out.bytes as BlobPart], { type: 'application/pdf' })),
      from: out.originalSize,
      to: out.compressedSize,
    };
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
  finally {
    busy.value = false;
  }
}
</script>

<template>
  <div>
    <c-card>
      <c-file-upload
        accept="application/pdf"
        :title="t('tools.pdf-compress.pickFile')"
        @file-upload="onFileChange"
      />

      <n-form label-placement="left" label-width="140" mt-3>
        <n-form-item :label="t('tools.pdf-compress.levelLabel')">
          <n-radio-group v-model:value="level">
            <n-space>
              <n-radio value="balanced">
                {{ t('tools.pdf-compress.balanced') }}
              </n-radio>
              <n-radio value="strong">
                {{ t('tools.pdf-compress.strong') }}
              </n-radio>
            </n-space>
          </n-radio-group>
        </n-form-item>
        <div mb-3 text-sm op-70>
          {{ level === 'balanced' ? t('tools.pdf-compress.balancedHint') : t('tools.pdf-compress.strongHint') }}
        </div>
      </n-form>

      <div mt-3 flex justify-center>
        <c-button data-test-id="compress-btn" :disabled="busy || !file" @click="apply">
          {{ busy ? t('tools.pdf-compress.working') : t('tools.pdf-compress.button.compress') }}
        </c-button>
      </div>

      <n-alert v-if="error" type="error" mt-4>
        {{ error }}
      </n-alert>

      <div v-if="result" mt-4>
        <n-alert v-if="optimal" type="info" mb-3>
          {{ t('tools.pdf-compress.optimalNote') }}
        </n-alert>
        <div v-else flex flex-col gap-1 text-sm>
          <span>{{ t('tools.pdf-compress.result.from') }}{{ fmtBytes(result.from) }}</span>
          <span>{{ t('tools.pdf-compress.result.to') }}{{ fmtBytes(result.to) }}</span>
          <span>{{ t('tools.pdf-compress.result.saved') }}{{ savedPct }}%</span>
        </div>
        <div mt-3 flex justify-center>
          <a :href="result.url" download="compressed.pdf">
            <c-button>{{ t('tools.pdf-compress.button.download') }}</c-button>
          </a>
        </div>
      </div>
    </c-card>
  </div>
</template>
