<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  canvasToBlob,
  extensionForMime,
  formatBytes,
  getSupportedOutputTypes,
  loadImageFromFile,
  resizeHighQuality,
} from '@/lib/image-io';
import type { LoadedImage } from '@/lib/image-io';

const { t } = useI18n();

const source = ref<LoadedImage | null>(null);
const sourceName = ref('');
const sourceSize = ref(0);
const busy = ref(false);
const error = ref<string | null>(null);

const targetWidth = ref(800);
const targetHeight = ref(600);
const lockAspect = ref(true);

const outputTypes = ref<{ value: string; label: string }[]>([]);
const outputType = ref('image/png');
const quality = ref(80);

const resultUrl = ref('');
const resultSize = ref(0);
const resultType = ref('');
const resultWidth = ref(0);
const resultHeight = ref(0);

getSupportedOutputTypes().then((types) => {
  outputTypes.value = types.map(({ value, label }) => ({ value, label }));
  if (types.length) {
    outputType.value = types[0].value;
  }
});

const lossy = computed(() => outputType.value === 'image/jpeg' || outputType.value === 'image/webp');

const sizeDelta = computed(() => {
  if (!resultSize.value || !sourceSize.value) {
    return '';
  }
  const pct = ((resultSize.value - sourceSize.value) / sourceSize.value) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
});

function onFilesUpload(file: File) {
  error.value = null;
  revokeResult();
  loadImageFromFile(file)
    .then((img) => {
      source.value = img;
      sourceName.value = file.name;
      sourceSize.value = file.size;
      targetWidth.value = img.width;
      targetHeight.value = img.height;
    })
    .catch((e) => {
      source.value = null;
      error.value = e instanceof Error ? e.message : String(e);
    });
}

function revokeResult() {
  if (resultUrl.value) {
    URL.revokeObjectURL(resultUrl.value);
  }
  resultUrl.value = '';
  resultSize.value = 0;
  resultType.value = '';
  resultWidth.value = 0;
  resultHeight.value = 0;
}

// 锁比例时改宽自动算高（反之亦然），避免用户手算缩放比
function onWidthChange(v: number | null) {
  if (!source.value || !lockAspect.value || !v) {
    return;
  }
  targetHeight.value = Math.max(1, Math.round((v * source.value.height) / source.value.width));
}
function onHeightChange(v: number | null) {
  if (!source.value || !lockAspect.value || !v) {
    return;
  }
  targetWidth.value = Math.max(1, Math.round((v * source.value.width) / source.value.height));
}

async function resize() {
  if (!source.value) {
    return;
  }
  busy.value = true;
  error.value = null;
  revokeResult();
  try {
    const canvas = resizeHighQuality(source.value.bitmap, targetWidth.value, targetHeight.value);
    const blob = await canvasToBlob(canvas, outputType.value, lossy.value ? quality.value / 100 : undefined);
    resultUrl.value = URL.createObjectURL(blob);
    resultSize.value = blob.size;
    resultType.value = blob.type;
    resultWidth.value = canvas.width;
    resultHeight.value = canvas.height;
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
  finally {
    busy.value = false;
  }
}

const downloadName = computed(() => {
  const base = sourceName.value.replace(/\.[^.]+$/, '') || 'image';
  return `${base}-${resultWidth.value}x${resultHeight.value}.${extensionForMime(resultType.value)}`;
});
</script>

<template>
  <div>
    <c-card>
      <c-file-upload
        accept="image/*"
        :title="t('tools.image-resize.pickFile')"
        @file-upload="onFilesUpload"
      />

      <p v-if="source" data-test-id="source-info" mt-3 text-sm op-70>
        {{ sourceName }} · {{ source!.width }}×{{ source!.height }} · {{ formatBytes(sourceSize) }}
      </p>

      <div v-if="source" grid grid-cols-2 mt-4 gap-3>
        <div>
          <span text-sm>{{ t('tools.image-resize.width') }}</span>
          <n-input-number v-model:value="targetWidth" :min="1" :max="8000" data-test-id="target-width" @update:value="onWidthChange" />
        </div>
        <div>
          <span text-sm>{{ t('tools.image-resize.height') }}</span>
          <n-input-number v-model:value="targetHeight" :min="1" :max="8000" data-test-id="target-height" @update:value="onHeightChange" />
        </div>
        <n-checkbox v-model:checked="lockAspect" data-test-id="lock-aspect">
          {{ t('tools.image-resize.lockAspect') }}
        </n-checkbox>
      </div>

      <div v-if="source" grid mt-4 gap-3>
        <div>
          <span text-sm>{{ t('tools.image-resize.format') }}</span>
          <n-select v-model:value="outputType" :options="outputTypes" data-test-id="output-type" />
        </div>
        <div v-if="lossy">
          <span text-sm>{{ t('tools.image-resize.quality', { q: quality }) }}</span>
          <n-slider v-model:value="quality" :min="10" :max="100" :step="5" data-test-id="quality" />
        </div>
      </div>

      <div mt-4 flex justify-center>
        <c-button
          data-test-id="resize-submit"
          :disabled="busy || !source"
          :loading="busy"
          @click="resize"
        >
          {{ busy ? t('tools.image-resize.working') : t('tools.image-resize.button') }}
        </c-button>
      </div>

      <n-alert v-if="error" type="error" mt-4 data-test-id="resize-error">
        {{ error }}
      </n-alert>

      <div v-if="resultUrl" mt-4 data-test-id="resize-result">
        <p text-sm>
          {{ resultWidth }}×{{ resultHeight }} · {{ formatBytes(resultSize) }}
          <span v-if="sizeDelta"> ({{ sizeDelta }} {{ t('tools.image-resize.vsSource') }})</span>
        </p>
        <img
          :src="resultUrl"
          :alt="t('tools.image-resize.previewAlt')"
          data-test-id="resize-output"

          mt-2 max-w-full rounded
        >
        <div mt-3>
          <a :href="resultUrl" :download="downloadName">
            <c-button data-test-id="resize-download">{{ t('tools.image-resize.buttonDownload') }}</c-button>
          </a>
        </div>
      </div>
    </c-card>
  </div>
</template>
