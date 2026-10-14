<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  canvasToBlob,
  extensionForMime,
  formatBytes,
  getSupportedOutputTypes,
  loadImageFromFile,
} from '@/lib/image-io';
import type { LoadedImage } from '@/lib/image-io';

const { t } = useI18n();

interface Rect { x: number; y: number; w: number; h: number }

const source = ref<LoadedImage | null>(null);
const sourceUrl = ref('');
const sourceName = ref('');
const sourceSize = ref(0);
const error = ref<string | null>(null);
const box = ref<Rect>({ x: 0, y: 0, w: 0, h: 0 });
const displayW = ref(0);

const outputTypes = ref<{ value: string; label: string }[]>([]);
const outputType = ref('image/png');
const quality = ref(85);
const ratio = ref<'free' | '1:1' | '4:3' | '3:2' | '16:9' | 'original'>('free');

const resultUrl = ref('');
const resultSize = ref(0);
const resultType = ref('');

getSupportedOutputTypes().then((types) => {
  outputTypes.value = types.map(({ value, label }) => ({ value, label }));
  if (types.length) {
    outputType.value = types[0].value;
  }
});

/** 显示缩放：把原图宽度压到 ≤640，坐标换算全部以原图像素为准 */
const scale = computed(() => (source.value && displayW.value ? displayW.value / source.value.width : 1));
const displayStyle = computed(() => {
  if (!source.value) {
    return {};
  }
  const s = scale.value;
  return {
    width: `${Math.round(source.value.width * s)}px`,
    height: `${Math.round(source.value.height * s)}px`,
  };
});

const boxStyle = computed(() => {
  const s = scale.value;
  return {
    left: `${box.value.x * s}px`,
    top: `${box.value.y * s}px`,
    width: `${box.value.w * s}px`,
    height: `${box.value.h * s}px`,
  };
});

const lossy = computed(() => outputType.value === 'image/jpeg' || outputType.value === 'image/webp');
const outW = computed(() => Math.round(box.value.w));
const outH = computed(() => Math.round(box.value.h));

function measure() {
  if (typeof window !== 'undefined') {
    displayW.value = Math.min(640, window.innerWidth - 340);
  }
}
onMounted(() => {
  measure();
  window.addEventListener('resize', measure);
});
onBeforeUnmount(() => window.removeEventListener('resize', measure));

function onFilesUpload(file: File) {
  error.value = null;
  revokeResult();
  loadImageFromFile(file)
    .then((img) => {
      if (sourceUrl.value) {
        URL.revokeObjectURL(sourceUrl.value);
      }
      sourceUrl.value = URL.createObjectURL(file);
      source.value = img;
      sourceName.value = file.name;
      sourceSize.value = file.size;
      box.value = { x: 0, y: 0, w: img.width, h: img.height };
      applyRatio();
    })
    .catch(e => (error.value = e instanceof Error ? e.message : String(e)));
}

function clampRect(r: Rect): Rect {
  const img = source.value!;
  const w = Math.max(1, Math.min(r.w, img.width));
  const h = Math.max(1, Math.min(r.h, img.height));
  const x = Math.max(0, Math.min(r.x, img.width - w));
  const y = Math.max(0, Math.min(r.y, img.height - h));
  return { x, y, w, h };
}

function ratioValue(): number | null {
  if (ratio.value === 'free') {
    return null;
  }
  if (ratio.value === 'original') {
    return source.value ? source.value.width / source.value.height : null;
  }
  const [a, b] = ratio.value.split(':').map(Number);
  return a / b;
}

function applyRatio() {
  const img = source.value;
  const k = ratioValue();
  if (!img || !k) {
    return;
  }
  let w = img.width;
  let h = w / k;
  if (h > img.height) {
    h = img.height;
    w = h * k;
  }
  box.value = clampRect({ x: (img.width - w) / 2, y: (img.height - h) / 2, w, h });
}

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'new';
let drag: { mode: DragMode; startX: number; startY: number; orig: Rect } | null = null;

function toImagePoint(e: PointerEvent) {
  const el = document.querySelector('[data-test-id="crop-stage"]') as HTMLElement | null;
  if (!el) {
    return null;
  }
  const rect = el.getBoundingClientRect();
  const s = scale.value || 1;
  return {
    x: Math.max(0, Math.min((e.clientX - rect.left) / s, source.value!.width)),
    y: Math.max(0, Math.min((e.clientY - rect.top) / s, source.value!.height)),
  };
}

function onStageDown(e: PointerEvent) {
  if (!source.value) {
    return;
  }
  const p = toImagePoint(e);
  if (!p) {
    return;
  }
  const b = box.value;
  const inside = p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  drag = { mode: inside ? 'move' : 'new', startX: p.x, startY: p.y, orig: { ...b } };
  if (!inside) {
    box.value = { x: p.x, y: p.y, w: 0, h: 0 };
  }
  window.addEventListener('pointermove', onWindowMove);
  window.addEventListener('pointerup', onWindowUp);
}

function handleDown(mode: DragMode) {
  return (e: PointerEvent) => {
    e.stopPropagation();
    if (!source.value) {
      return;
    }
    const p = toImagePoint(e);
    if (!p) {
      return;
    }
    drag = { mode, startX: p.x, startY: p.y, orig: { ...box.value } };
    window.addEventListener('pointermove', onWindowMove);
    window.addEventListener('pointerup', onWindowUp);
  };
}

/**
 * 四个角点要绑**函数引用**，不能绑 `handleDown('se')` 这种调用式：
 * Vue 把调用式编译成 ($event) => handleDown('se')，于是每次按下只是新建一个闭包再丢弃，
 * 选区永远不会响应（冒烟实测：CDP 真拖拽事件都到了 span，box 仍是整图）。
 */
const onNw = handleDown('nw');
const onNe = handleDown('ne');
const onSw = handleDown('sw');
const onSe = handleDown('se');

function onWindowMove(e: PointerEvent) {
  if (!drag || !source.value) {
    return;
  }
  const p = toImagePoint(e);
  if (!p) {
    return;
  }
  const dx = p.x - drag.startX;
  const dy = p.y - drag.startY;
  const k = ratioValue();
  let r: Rect = { ...drag.orig };

  if (drag.mode === 'move') {
    r.x = drag.orig.x + dx;
    r.y = drag.orig.y + dy;
  }
  else if (drag.mode === 'new') {
    r = { x: Math.min(drag.startX, p.x), y: Math.min(drag.startY, p.y), w: Math.abs(dx), h: Math.abs(dy) };
    if (k) {
      r.h = r.w / k;
    }
  }
  else {
    // 角点缩放：固定对角，动该角
    const right = drag.orig.x + drag.orig.w;
    const bottom = drag.orig.y + drag.orig.h;
    const fixedX = drag.mode.includes('w') ? right : drag.orig.x;
    const fixedY = drag.mode.includes('n') ? bottom : drag.orig.y;
    const px = drag.mode.includes('w') ? Math.min(p.x, fixedX) : Math.max(p.x, fixedX);
    const py = drag.mode.includes('n') ? Math.min(p.y, fixedY) : Math.max(p.y, fixedY);
    r = { x: Math.min(fixedX, px), y: Math.min(fixedY, py), w: Math.abs(px - fixedX), h: Math.abs(py - fixedY) };
    if (k) {
      r.h = r.w / k;
    }
  }
  box.value = clampRect(r);
}

function onWindowUp() {
  drag = null;
  window.removeEventListener('pointermove', onWindowMove);
  window.removeEventListener('pointerup', onWindowUp);
}

function revokeResult() {
  if (resultUrl.value) {
    URL.revokeObjectURL(resultUrl.value);
  }
  resultUrl.value = '';
  resultSize.value = 0;
  resultType.value = '';
}

async function crop() {
  const img = source.value;
  if (!img) {
    return;
  }
  error.value = null;
  revokeResult();
  try {
    const w = Math.max(1, Math.round(box.value.w));
    const h = Math.max(1, Math.round(box.value.h));
    // 从原图按裁剪矩形取像素，不经过显示缩放 —— 避免把缩放损失带进结果
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img.bitmap, box.value.x, box.value.y, box.value.w, box.value.h, 0, 0, w, h);
    const blob = await canvasToBlob(canvas, outputType.value, lossy.value ? quality.value / 100 : undefined);
    resultUrl.value = URL.createObjectURL(blob);
    resultSize.value = blob.size;
    resultType.value = blob.type;
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

const downloadName = computed(() => {
  const base = sourceName.value.replace(/\.[^.]+$/, '') || 'image';
  return `${base}-crop-${outW.value}x${outH.value}.${extensionForMime(resultType.value)}`;
});
</script>

<template>
  <div>
    <c-card>
      <c-file-upload accept="image/*" :title="t('tools.image-crop.pickFile')" @file-upload="onFilesUpload" />

      <p v-if="source" mt-3 text-sm op-70 data-test-id="source-info">
        {{ sourceName }} · {{ source!.width }}×{{ source!.height }} · {{ formatBytes(sourceSize) }}
      </p>

      <div v-if="source" mt-3 flex flex-wrap items-center gap-3>
        <span text-sm>{{ t('tools.image-crop.ratio') }}</span>
        <n-select
          v-model:value="ratio"
          data-test-id="ratio"
          w-40
          :options="[
            { label: t('tools.image-crop.ratioFree'), value: 'free' },
            { label: '1:1', value: '1:1' },
            { label: '4:3', value: '4:3' },
            { label: '3:2', value: '3:2' },
            { label: '16:9', value: '16:9' },
            { label: t('tools.image-crop.ratioOriginal'), value: 'original' },
          ]"
          @update:value="applyRatio"
        />
      </div>

      <div v-if="source" mt-3 flex items-center gap-3>
        <span text-sm data-test-id="crop-size">
          {{ t('tools.image-crop.selection') }}: {{ outW }}×{{ outH }}
        </span>
      </div>

      <div v-if="source" mt-2 inline-block>
        <div
          data-test-id="crop-stage"
          class="crop-stage"
          :style="displayStyle"
          @pointerdown="onStageDown"
        >
          <img :src="sourceUrl" data-test-id="crop-image" class="crop-img" :style="displayStyle" alt="">
          <div data-test-id="crop-box" class="crop-box" :style="boxStyle">
            <span class="h nw" @pointerdown="onNw" />
            <span class="h ne" @pointerdown="onNe" />
            <span class="h sw" @pointerdown="onSw" />
            <span class="h se" @pointerdown="onSe" />
          </div>
        </div>
      </div>

      <div v-if="source" grid mt-3 gap-3>
        <div>
          <span text-sm>{{ t('tools.image-crop.format') }}</span>
          <n-select v-model:value="outputType" :options="outputTypes" data-test-id="output-type" />
        </div>
        <div v-if="lossy">
          <span text-sm>{{ t('tools.image-crop.quality', { q: quality }) }}</span>
          <n-slider v-model:value="quality" :min="10" :max="100" :step="5" data-test-id="quality" />
        </div>
      </div>

      <div mt-4 flex justify-center>
        <c-button data-test-id="crop-submit" :disabled="!source" @click="crop">
          {{ t('tools.image-crop.button') }}
        </c-button>
      </div>

      <n-alert v-if="error" type="error" mt-4 data-test-id="crop-error">
        {{ error }}
      </n-alert>

      <div v-if="resultUrl" mt-4 data-test-id="crop-result">
        <p text-sm>
          {{ outW }}×{{ outH }} · {{ formatBytes(resultSize) }}
        </p>
        <img :src="resultUrl" data-test-id="crop-output" alt="" max-w-full rounded>
        <div mt-3>
          <a :href="resultUrl" :download="downloadName">
            <c-button data-test-id="crop-download">{{ t('tools.image-crop.buttonDownload') }}</c-button>
          </a>
        </div>
      </div>
    </c-card>
  </div>
</template>

<style scoped>
.crop-stage {
  position: relative;
  user-select: none;
  touch-action: none;
  background: var(--dd-surface-soft, #f1f5f9);
  overflow: hidden;
}
.crop-img {
  display: block;
  pointer-events: none;
  object-fit: fill;
}
.crop-box {
  position: absolute;
  border: 2px solid var(--dd-primary, #0f766e);
  background: rgba(15, 118, 110, 0.10);
  box-sizing: border-box;
  cursor: move;
}
.h {
  position: absolute;
  width: 12px;
  height: 12px;
  background: #fff;
  border: 2px solid var(--dd-primary, #0f766e);
  border-radius: 2px;
}
.h.nw { left: -7px; top: -7px; cursor: nwse-resize; }
.h.ne { right: -7px; top: -7px; cursor: nesw-resize; }
.h.sw { left: -7px; bottom: -7px; cursor: nesw-resize; }
.h.se { right: -7px; bottom: -7px; cursor: nwse-resize; }
</style>
