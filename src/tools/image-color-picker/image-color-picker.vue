<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMessage } from 'naive-ui';
import { loadImageFromFile } from '@/lib/image-io';
import type { LoadedImage } from '@/lib/image-io';

const { t } = useI18n();
const message = useMessage();

const source = ref<LoadedImage | null>(null);
const error = ref<string | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);
const ctx2d = ref<CanvasRenderingContext2D | null>(null);

const picked = ref<{ x: number; y: number; r: number; g: number; b: number } | null>(null);
const hover = ref<{ x: number; y: number } | null>(null);

function onFilesUpload(file: File) {
  error.value = null;
  picked.value = null;
  loadImageFromFile(file)
    .then(async (img) => {
      source.value = img;
      // <canvas> 在 v-if="source" 里面：设完 source 的同一微任务里 canvasEl 仍是 null，
      // 直接 draw() 会静默 return，页面就得到一块 300×150 的空画布（冒烟实测到的真 bug）。
      await nextTick();
      await draw();
    })
    .catch((e) => {
      source.value = null;
      error.value = e instanceof Error ? e.message : String(e);
    });
}

async function draw() {
  if (!source.value || !canvasEl.value) {
    return;
  }
  const canvas = canvasEl.value;
  canvas.width = source.value.width;
  canvas.height = source.value.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('canvas 2d context unavailable');
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source.value.bitmap, 0, 0);
  ctx2d.value = ctx;
}

// 显示尺寸自适应容器，但坐标一律换算回**原图像素**，避免缩放态下取错像素
const displayStyle = computed(() => {
  if (!source.value) {
    return {};
  }
  const maxW = 720;
  const scale = Math.min(1, maxW / source.value.width);
  return { width: `${Math.round(source.value.width * scale)}px`, cursor: 'crosshair' };
});

function toImageCoords(e: MouseEvent) {
  const canvas = canvasEl.value;
  const img = source.value;
  if (!canvas || !img) {
    return null;
  }
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    return null;
  }
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * img.width);
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * img.height);
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) {
    return null;
  }
  return { x, y };
}

function onMove(e: MouseEvent) {
  hover.value = toImageCoords(e);
}

function onLeave() {
  hover.value = null;
}

function onClick(e: MouseEvent) {
  const pos = toImageCoords(e);
  const ctx = ctx2d.value;
  if (!pos || !ctx) {
    return;
  }
  // 取 1×1 像素：这就是"这个点是什么颜色"的严格定义，不做任何平均
  const d = ctx.getImageData(pos.x, pos.y, 1, 1).data;
  picked.value = { x: pos.x, y: pos.y, r: d[0], g: d[1], b: d[2] };
}

const hex = computed(() => {
  if (!picked.value) {
    return '';
  }
  const { r, g, b } = picked.value;
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
});
const rgbText = computed(() => (picked.value ? `rgb(${picked.value.r}, ${picked.value.g}, ${picked.value.b})` : ''));

function rgbToHsl(r: number, g: number, b: number) {
  const s0 = r / 255;
  const s1 = g / 255;
  const s2 = b / 255;
  const max = Math.max(s0, s1, s2);
  const min = Math.min(s0, s1, s2);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === s0) {
      h = (s1 - s2) / d + (s1 < s2 ? 6 : 0);
    }
    else if (max === s1) {
      h = (s2 - s0) / d + 2;
    }
    else {
      h = (s0 - s1) / d + 4;
    }
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}
const hslText = computed(() => {
  if (!picked.value) {
    return '';
  }
  const { h, s, l } = rgbToHsl(picked.value.r, picked.value.g, picked.value.b);
  return `hsl(${h}, ${s}%, ${l}%)`;
});

async function copy(value: string, label: string) {
  if (!value) {
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
    message.success(`${label} copied`);
  }
  catch {
    message.error('clipboard unavailable');
  }
}

onBeforeUnmount(() => {
  ctx2d.value = null;
});
</script>

<template>
  <div>
    <c-card>
      <c-file-upload accept="image/*" :title="t('tools.image-color-picker.pickFile')" @file-upload="onFilesUpload" />

      <n-alert v-if="error" type="error" mt-4>
        {{ error }}
      </n-alert>

      <div v-if="source" mt-4>
        <p text-sm op-70 data-test-id="picker-hint">
          {{ t('tools.image-color-picker.clickHint') }}
          <span v-if="hover"> · {{ hover.x }},{{ hover.y }}</span>
        </p>
        <canvas
          ref="canvasEl"
          data-test-id="picker-canvas"
          :style="displayStyle"
          max-w-full
          @mousemove="onMove"
          @mouseleave="onLeave"
          @click="onClick"
        />

        <div v-if="picked" mt-4 data-test-id="picker-result">
          <div flex items-center gap-3>
            <span
              data-test-id="picker-swatch"

              inline-block h-10 w-10 border rounded border-solid
              :style="{ background: hex }"
            />
            <div flex flex-col gap-1>
              <c-button size="small" data-test-id="copy-hex" tertiary @click="copy(hex, 'HEX')">
                {{ hex }}
              </c-button>
              <span text-sm data-test-id="value-rgb">{{ rgbText }}</span>
              <span text-sm data-test-id="value-hsl">{{ hslText }}</span>
              <span text-xs op-60 data-test-id="picked-pos">x={{ picked.x }} · y={{ picked.y }}</span>
            </div>
          </div>
        </div>
      </div>
    </c-card>
  </div>
</template>
