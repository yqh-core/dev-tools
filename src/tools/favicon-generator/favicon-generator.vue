<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCopy } from '@/composable/copy';
import { buildIco, canvasToBlob, formatBytes, loadImageFromFile } from '@/lib/image-io';
import type { LoadedImage } from '@/lib/image-io';

const { t } = useI18n();
const { copy } = useCopy();

/** ICO 内嵌尺寸（单边 ≤128，见 buildIco 的字节宽度约束） */
const ICO_SIZES = [16, 32, 48];
/** 另外单独导出的 PNG 尺寸 */
const PNG_SIZES = [180, 512];

const source = ref<LoadedImage | null>(null);
const sourceName = ref('');
const busy = ref(false);
const error = ref<string | null>(null);
const background = ref<'transparent' | 'white'>('transparent');

const icoUrl = ref('');
const icoSize = ref(0);
const pngs = ref<{ size: number; url: string; bytes: number }[]>([]);

function revokeAll() {
  if (icoUrl.value) {
    URL.revokeObjectURL(icoUrl.value);
  }
  icoUrl.value = '';
  icoSize.value = 0;
  pngs.value.forEach(p => URL.revokeObjectURL(p.url));
  pngs.value = [];
}

function onFilesUpload(file: File) {
  error.value = null;
  revokeAll();
  loadImageFromFile(file)
    .then((img) => {
      source.value = img;
      sourceName.value = file.name;
    })
    .catch(e => (error.value = e instanceof Error ? e.message : String(e)));
}

async function renderTo(target: number): Promise<Blob> {
  const img = source.value!;
  // 非方图必须**居中裁方**再缩放。直接 drawImage 到 target×target 会把
  // 一张 1200×630 的横图压扁成图标 —— 这是 favicon 工具最常见的质量事故。
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = target;
  canvas.height = target;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img.bitmap, sx, sy, side, side, 0, 0, target, target);
  if (background.value === 'white') {
    const ctx = canvas.getContext('2d')!;
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
  }
  return canvasToBlob(canvas, 'image/png');
}

async function generate() {
  if (!source.value) {
    return;
  }
  busy.value = true;
  error.value = null;
  revokeAll();
  try {
    const icoParts = [];
    for (const size of ICO_SIZES) {
      const blob = await renderTo(size);
      icoParts.push({ size, bytes: new Uint8Array(await blob.arrayBuffer()) });
    }
    const ico = buildIco(icoParts);
    // ICONDIR 前 4 字节 = 保留 2B(0) + 类型 2B(1=icon)，小端。写错了浏览器只会显示坏图标。
    // 逐字节比较而不是拼字符串：拼字符串要写 '\0\0\1\0'，其中 \1 是八进制转义，
    // 在 ESM 严格模式下直接是语法错误（本文件真踩过，被 eslint 拦在构建前）。
    if (ico[0] !== 0 || ico[1] !== 0 || ico[2] !== 1 || ico[3] !== 0) {
      throw new Error(`ico header wrong: ${ico[0]},${ico[1]},${ico[2]},${ico[3]}`);
    }
    const icoBlob = new Blob([ico as unknown as BlobPart], { type: 'image/x-icon' });
    icoUrl.value = URL.createObjectURL(icoBlob);
    icoSize.value = icoBlob.size;

    const made = [];
    for (const size of PNG_SIZES) {
      const blob = await renderTo(size);
      made.push({ size, url: URL.createObjectURL(blob), bytes: blob.size });
    }
    pngs.value = made;
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
  finally {
    busy.value = false;
  }
}

const snippet = computed(() =>
  '<link rel="icon" href="/favicon.ico" sizes="any" />\n'
  + '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />\n'
  + '<link rel="icon" type="image/png" href="/icon-512.png" sizes="512x512" />',
);
</script>

<template>
  <div>
    <c-card>
      <c-file-upload accept="image/*" :title="t('tools.favicon-generator.pickFile')" @file-upload="onFilesUpload" />

      <p v-if="source" mt-3 text-sm op-70 data-test-id="source-info">
        {{ sourceName }} · {{ source!.width }}×{{ source!.height }}
      </p>

      <div v-if="source" mt-3>
        <span text-sm>{{ t('tools.favicon-generator.background') }}</span>
        <n-radio-group v-model:value="background" name="favicon-bg">
          <n-space>
            <n-radio value="transparent">
              {{ t('tools.favicon-generator.bgTransparent') }}
            </n-radio>
            <n-radio value="white">
              {{ t('tools.favicon-generator.bgWhite') }}
            </n-radio>
          </n-space>
        </n-radio-group>
      </div>

      <div mt-4 flex justify-center>
        <c-button data-test-id="favicon-submit" :disabled="busy || !source" :loading="busy" @click="generate">
          {{ busy ? t('tools.favicon-generator.working') : t('tools.favicon-generator.button') }}
        </c-button>
      </div>

      <n-alert v-if="error" type="error" mt-4 data-test-id="favicon-error">
        {{ error }}
      </n-alert>

      <div v-if="icoUrl" mt-4 data-test-id="favicon-result">
        <p text-sm data-test-id="ico-summary">
          favicon.ico · {{ ICO_SIZES.join('/') }}px · {{ formatBytes(icoSize) }}
        </p>
        <a :href="icoUrl" download="favicon.ico">
          <c-button data-test-id="ico-download">{{ t('tools.favicon-generator.downloadIco') }}</c-button>
        </a>

        <div grid mt-4 gap-2>
          <div v-for="p in pngs" :key="p.size" flex items-center gap-3 data-test-id="png-row">
            <img :src="p.url" :alt="`icon ${p.size}`" h-8 w-8>
            <span text-sm>{{ p.size }}×{{ p.size }} · {{ formatBytes(p.bytes) }}</span>
            <a :href="p.url" :download="p.size === 180 ? 'apple-touch-icon.png' : `icon-${p.size}.png`">
              <c-button size="small" tertiary>{{ t('tools.favicon-generator.download') }}</c-button>
            </a>
          </div>
        </div>

        <div mt-4>
          <span text-sm>{{ t('tools.favicon-generator.htmlSnippet') }}</span>
          <c-code data-test-id="html-snippet" language="html" code-class="text-sm">
            {{ snippet }}
          </c-code>
          <c-button size="small" data-test-id="snippet-copy" tertiary mt-2 @click="copy(snippet)">
            {{ t('tools.favicon-generator.copySnippet') }}
          </c-button>
        </div>
      </div>
    </c-card>
  </div>
</template>
