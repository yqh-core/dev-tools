<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { imagesToPdf } from '../pdf-merge/pdf-lib.service';
import type { PdfImageInput } from '../pdf-merge/pdf-lib.service';
import { formatBytes } from '@/lib/image-io';

const { t } = useI18n();

interface Row {
  name: string
  size: number
  width: number
  height: number
  /** 是否需要先转 PNG（webp/bmp/gif 等 pdf-lib 不直接嵌的类型） */
  converted: boolean
}

const files = ref<File[]>([]);
const rows = ref<Row[]>([]);
const marginPt = ref(0);
const busy = ref(false);
const error = ref<string | null>(null);
const resultUrl = ref('');
const resultSize = ref(0);

async function inspect(file: File) {
  const bitmap = await createImageBitmap(file);
  const direct = file.type === 'image/jpeg' || file.type === 'image/png';
  return {
    name: file.name,
    size: file.size,
    width: bitmap.width,
    height: bitmap.height,
    converted: !direct,
  };
}

async function onFilesUpload(list: File[]) {
  error.value = null;
  revokeResult();
  files.value = list;
  const inspected: Row[] = [];
  for (const f of list) {
    try {
      inspected.push(await inspect(f));
    }
    catch {
      error.value = `${t('tools.image-to-pdf.errors.unreadable')}: ${f.name}`;
      files.value = [];
      rows.value = [];
      return;
    }
  }
  rows.value = inspected;
}

/** pdf-lib 只直接嵌 JPEG/PNG；其余用 canvas 转 PNG（canvas 编 PNG 是真支持的）。 */
async function toEmbeddable(file: File): Promise<PdfImageInput> {
  if (file.type === 'image/jpeg' || file.type === 'image/png') {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const bitmap = await createImageBitmap(file);
    const out = { bytes, mime: file.type, width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return out;
  }
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) {
    throw new Error('png conversion failed');
  }
  if (blob.type !== 'image/png') {
    throw new Error(`unexpected conversion result: ${blob.type}`);
  }
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    mime: 'image/png',
    width: canvas.width,
    height: canvas.height,
  };
}

function revokeResult() {
  if (resultUrl.value) {
    URL.revokeObjectURL(resultUrl.value);
  }
  resultUrl.value = '';
  resultSize.value = 0;
}

async function generate() {
  if (!files.value.length) {
    return;
  }
  busy.value = true;
  error.value = null;
  revokeResult();
  try {
    const inputs: PdfImageInput[] = [];
    for (const f of files.value) {
      inputs.push(await toEmbeddable(f));
    }
    const bytes = await imagesToPdf(inputs, marginPt.value);
    if (bytes.length < 5) {
      throw new Error('empty pdf produced');
    }
    const head = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]);
    if (head !== '%PDF-') {
      throw new Error(`produced file is not a PDF (${head})`);
    }
    const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
    resultUrl.value = URL.createObjectURL(blob);
    resultSize.value = blob.size;
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
  finally {
    busy.value = false;
  }
}

const totalInputBytes = computed(() => files.value.reduce((n, f) => n + f.size, 0));
</script>

<template>
  <div>
    <c-card>
      <c-file-upload
        multiple
        accept="image/*"
        :title="t('tools.image-to-pdf.pickFiles')"
        @files-upload="onFilesUpload"
      />

      <div v-if="rows.length" mt-3 data-test-id="image-list">
        <p text-sm op-70 data-test-id="page-count">
          {{ t('tools.image-to-pdf.selected', { count: rows.length }) }}
        </p>
        <ul text-sm>
          <li v-for="(r, i) in rows" :key="i" data-test-id="image-row">
            {{ r.name }} · {{ r.width }}×{{ r.height }} · {{ formatBytes(r.size) }}
            <span v-if="r.converted" op-60>→ PNG</span>
          </li>
        </ul>
      </div>

      <div v-if="rows.length" mt-3>
        <span text-sm>{{ t('tools.image-to-pdf.margin') }}</span>
        <n-input-number v-model:value="marginPt" :min="0" :max="200" data-test-id="margin" />
      </div>

      <div mt-4 flex justify-center>
        <c-button data-test-id="pdf-submit" :disabled="busy || !rows.length" :loading="busy" @click="generate">
          {{ busy ? t('tools.image-to-pdf.working') : t('tools.image-to-pdf.button') }}
        </c-button>
      </div>

      <n-alert v-if="error" type="error" mt-4 data-test-id="pdf-error">
        {{ error }}
      </n-alert>

      <div v-if="resultUrl" mt-4 data-test-id="pdf-result">
        <p text-sm data-test-id="pdf-summary">
          {{ rows.length }} {{ t('tools.image-to-pdf.pagesSuffix') }} · {{ formatBytes(totalInputBytes) }} → {{ formatBytes(resultSize) }}
        </p>
        <a :href="resultUrl" download="images.pdf">
          <c-button data-test-id="pdf-download">{{ t('tools.image-to-pdf.buttonDownload') }}</c-button>
        </a>
      </div>
    </c-card>
  </div>
</template>
