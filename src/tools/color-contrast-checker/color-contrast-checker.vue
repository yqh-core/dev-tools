<script setup lang="ts">
import { evaluatePair, parseColor, toHex } from './contrast.service';
import { useCopy } from '@/composable/copy';

/**
 * 对比度检查器：把两色的 sRGB 相对亮度按 WCAG 2.x 公式算成比值，并按四个门限判定。
 *
 * 判定表用**原始比值**比较，显示才取两位小数 —— 拿显示值判会通过/不通过，
 * 4.4996 会伪装成 4.50 过关（contrast.service.ts 里有对应的证伪用例）。
 */
const foreground = useStorage('color-contrast-checker-fg', '#333333');
const background = useStorage('color-contrast-checker-bg', '#ffffff');

const fg = computed(() => parseColor(foreground.value));
const bg = computed(() => parseColor(background.value));

const verdict = computed(() => evaluatePair(fg.value, bg.value));

const fgError = computed(() => (foreground.value.trim() && !fg.value ? 'Not a colour this tool reads' : undefined));
const bgError = computed(() => (background.value.trim() && !bg.value ? 'Not a colour this tool reads' : undefined));

const rows = computed(() => {
  const v = verdict.value;
  if (!v) {
    return [];
  }
  return [
    { label: 'AA — normal text', need: '4.5:1', pass: v.aaNormal },
    { label: 'AA — large text', need: '3:1', pass: v.aaLarge },
    { label: 'AAA — normal text', need: '7:1', pass: v.aaaNormal },
    { label: 'AAA — large text', need: '4.5:1', pass: v.aaaLarge },
  ];
});

function swap() {
  const a = foreground.value;
  foreground.value = background.value;
  background.value = a;
}

const summary = computed(() => {
  const v = verdict.value;
  if (!v) {
    return '';
  }
  const failed = rows.value.filter(r => !r.pass).map(r => r.label);
  const tail = failed.length === 0
    ? 'Passes AA and AAA at every text size.'
    : `Fails: ${failed.join(', ')}.`;
  return `Contrast ${v.ratioText}:1 between ${toHex(fg.value as never)} and ${toHex(bg.value as never)}. ${tail}`;
});

const { copy } = useCopy({ source: summary, text: 'Summary copied to the clipboard' });
</script>

<template>
  <div flex flex-col gap-3>
    <div flex flex-wrap gap-3>
      <c-input-text
        v-model:value="foreground"
        label="Text colour:"
        placeholder="#777777 or rgb(119,119,119)"
        label-position="left"
        label-width="110px"
        label-align="right"
        raw-text
        flex-1
        min-w-220px
        :validation-status="fgError ? 'error' : undefined"
        :message="fgError"
        data-test-id="fg"
      />
      <c-input-text
        v-model:value="background"
        label="Background:"
        placeholder="#ffffff"
        label-position="left"
        label-width="110px"
        label-align="right"
        raw-text
        flex-1
        min-w-220px
        :validation-status="bgError ? 'error' : undefined"
        :message="bgError"
        data-test-id="bg"
      />
    </div>

    <div v-if="verdict" flex items-center gap-4>
      <div flex-1>
        <div text-13px op-65>
          Contrast ratio
        </div>
        <div text-40px font-bold data-test-id="ratio">
          {{ verdict.ratioText }}<span text-18px op-60>:1</span>
        </div>
      </div>
      <c-button type="primary" size="small" @click="swap">
        Swap colours
      </c-button>
    </div>

    <c-card v-if="rows.length" p-0>
      <div
        v-for="row of rows"
        :key="row.label"
        flex
        items-center
        justify-between
        border-b
        px-4
        py-2
      >
        <span>{{ row.label }}</span>
        <span op-65>{{ row.need }}</span>
        <span :class="row.pass ? 'text-green' : 'text-red'" font-semibold data-test-id="verdict">
          {{ row.pass ? 'Pass' : 'Fail' }}
        </span>
      </div>
    </c-card>

    <c-alert v-if="!verdict" type="warning" title="Two colours needed">
      Enter both values as <b>#rgb</b>, <b>#rrggbb</b> or <b>rgb(r,g,b)</b> to get a verdict.
    </c-alert>

    <div
      v-if="verdict"
      border
      rounded
      p-4
      :style="{ background, color: foreground }"
    >
      <div text-16px>
        Normal body text at 16 pixels — the size most of your UI actually uses.
      </div>
      <div mt-2 text-24px font-bold>
        Large heading at 24 pixels, which only needs 3:1.
      </div>
    </div>

    <div v-if="verdict" flex items-center gap-2>
      <c-button data-test-id="copy-summary" @click="copy()">
        Copy summary
      </c-button>
      <span text-13px op-65>
        Nothing is uploaded; the ratio is computed on this device.
      </span>
    </div>
  </div>
</template>
