<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  canvasToBlob,
  drawToCanvas,
  extensionForMime,
  formatBytes,
  getSupportedOutputTypes,
  loadImageFromFile,
} from '@/lib/image-io';
import type { LoadedImage } from '@/lib/image-io';

const { t } = useI18n();

const source = ref<LoadedImage | null>(null);
const sourceName = ref('');
const sourceSize = ref(0);
const busy = ref(false);
const error = ref<string | null>(null);

const outputTypes = ref<{ value: string; label: string }[]>([]);
const outputType = ref('image/jpeg');
const quality = ref(70);
/** 可选：压到目标体积（KB）。用质量二分逼近，不引入任何依赖。 */
const targetKb = ref<number | null>(null);

const resultUrl = ref('');
const resultSize = ref(0);
const resultType = ref('');
const usedQuality = ref(0);

getSupportedOutputTypes().then((types) => {
  // PNG 是无损重编码，对照片基本不会变小 —— 压缩页只暴露有损类型
  outputTypes.value = types
    .filter(x => x.value === 'image/jpeg' || x.value === 'image/webp')
    .map(({ value, label }) => ({ value, label }));
  if (outputTypes.value.length) {
    outputType.value = outputTypes.value[0].value;
  }
});

const savings = computed(() => {
  if (!resultSize.value || !sourceSize.value) {
    return '';
  }
  return `${(((sourceSize.value - resultSize.value) / sourceSize.value) * 100).toFixed(1)}%`;
});

function onFilesUpload(file: File) {
  error.value = null;
  revokeResult();
  loadImageFromFile(file)
    .then((img) => {
      source.value = img;
      sourceName.value = file.name;
      sourceSize.value = file.size;
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
  usedQuality.value = 0;
}

async function encodeAt(canvas: HTMLCanvasElement, q: number) {
  return canvasToBlob(canvas, outputType.value, q / 100);
}

async function compress() {
  if (!source.value) {
    return;
  }
  busy.value = true;
  error.value = null;
  revokeResult();
  try {
    const canvas = drawToCanvas(source.value.bitmap, source.value.width, source.value.height);

    if (targetKb.value) {
      // 质量二分：在 10-95 之间找「仍不超过目标体积」的最高质量。
      // 上限 7 次，避免大图上退化成慢循环。
      const limit = targetKb.value * 1024;
      let lo = 10;
      let hi = 95;
      let best: { blob: Blob; q: number } | null = null;
      for (let i = 0; i < 7; i++) {
        const mid = Math.round((lo + hi) / 2);
        const blob = await encodeAt(canvas, mid);
        if (blob.size <= limit) {
          best = { blob, q: mid };
          lo = mid;
        }
        else {
          hi = mid - 1;
        }
        if (hi < lo) {
          break;
        }
      }
      if (!best) {
        // 连最低质量都超预算：不谎报成功，给出可见反馈
        error.value = t('tools.image-compress.errors.targetUnreachable');
        return;
      }
      usedQuality.value = best.q;
      adopt(best.blob);
    }
    else {
      const blob = await encodeAt(canvas, quality.value);
      usedQuality.value = quality.value;
      adopt(blob);
    }
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
  finally {
    busy.value = false;
  }
}

function adopt(blob: Blob) {
  resultUrl.value = URL.createObjectURL(blob);
  resultSize.value = blob.size;
  resultType.value = blob.type;
}

const downloadName = computed(() => {
  const base = sourceName.value.replace(/\.[^.]+$/, '') || 'image';
  return `${base}-compressed.${extensionForMime(resultType.value)}`;
});
</script>

<template>
  <div>
    <c-card>
      <c-file-upload
        accept="image/*"
        :title="t('tools.image-compress.pickFile')"
        @file-upload="onFilesUpload"
      />

      <p v-if="source" data-test-id="source-info" mt-3 text-sm op-70>
        {{ sourceName }} · {{ source!.width }}×{{ source!.height }} · {{ formatBytes(sourceSize) }}
      </p>

      <div v-if="source" grid mt-4 gap-3>
        <div>
          <span text-sm>{{ t('tools.image-compress.format') }}</span>
          <n-select v-model:value="outputType" :options="outputTypes" data-test-id="output-type" />
        </div>

        <div v-if="!targetKb">
          <span text-sm>{{ t('tools.image-compress.quality', { q: quality }) }}</span>
          <n-slider v-model:value="quality" :min="10" :max="95" :step="5" data-test-id="quality" />
        </div>

        <div>
          <span text-sm>{{ t('tools.image-compress.targetSize') }}</span>
          <n-input-number
            v-model:value="targetKb"
            :min="5"
            :max="20000"
            clearable
            data-test-id="target-kb"
            :placeholder="t('tools.image-compress.targetSizePlaceholder')"
          />
        </div>
      </div>

      <div mt-4 flex justify-center>
        <c-button data-test-id="compress-submit" :disabled="busy || !source" :loading="busy" @click="compress">
          {{ busy ? t('tools.image-compress.working') : t('tools.image-compress.button') }}
        </c-button>
      </div>

      <n-alert v-if="error" type="error" mt-4 data-test-id="compress-error">
        {{ error }}
      </n-alert>

      <div v-if="resultUrl" mt-4 data-test-id="compress-result">
        <p text-sm data-test-id="compress-summary">
          {{ formatBytes(sourceSize) }} → {{ formatBytes(resultSize) }}
          <span v-if="savings">（−{{ savings }}）</span>
          · {{ t('tools.image-compress.usedQuality') }} {{ usedQuality }}
        </p>
        <div mt-3>
          <a :href="resultUrl" :download="downloadName">
            <c-button data-test-id="compress-download">{{ t('tools.image-compress.buttonDownload') }}</c-button>
          </a>
        </div>
      </div>
    </c-card>
  </div>
</template>
