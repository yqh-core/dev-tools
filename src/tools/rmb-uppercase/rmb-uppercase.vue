<script setup lang="ts">
const DIGITS = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
const UNITS = ['', '拾', '佰', '仟'];
const GROUPS = ['', '万', '亿', '万亿'];

/** 4 位以内数字转中文大写（组内），如 1409 → 壹仟肆佰零玖 */
function groupToCn(g: string): string {
  let out = '';
  let pendingZero = false;
  for (let i = 0; i < g.length; i++) {
    const n = Number(g[i]);
    if (n === 0) {
      pendingZero = true;
      continue;
    }
    if (pendingZero && out !== '') {
      out += '零';
    }
    pendingZero = false;
    out += DIGITS[n] + UNITS[g.length - 1 - i];
  }
  return out;
}

/** 整数部分转大写，如 107000 → 壹拾万柒仟 */
function intToCn(raw: string): string {
  if (/^0*$/.test(raw)) {
    return '零';
  }
  const s = raw.replace(/^0+/, '');
  const groups: string[] = [];
  let rest = s;
  while (rest.length) {
    groups.unshift(rest.slice(-4));
    rest = rest.slice(0, -4);
  }
  const count = groups.length;
  let out = '';
  for (let i = 0; i < count; i++) {
    const g = groups[i];
    const cn = groupToCn(g);
    const unit = GROUPS[count - 1 - i];
    if (cn === '') {
      out += '零';
      continue;
    }
    // 本级以 0 开头（如 1 0700 0000 里的「零柒佰万」）时补一个零
    if (i > 0 && g[0] === '0' && !out.endsWith('零')) {
      out += '零';
    }
    out += cn + unit;
  }
  return out.replace(/零{2,}/g, '零').replace(/零+$/, '');
}

const input = useStorage('rmb-uppercase:input', '');
const withPrefix = ref(false);
const useYuan = ref(true);

const result = computed(() => {
  const raw = input.value.trim().replace(/[,，\s￥¥]/g, '');
  if (!raw) {
    return { text: '', error: '' };
  }
  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    return { text: '', error: '请输入合法的数字金额，如 1234.56' };
  }

  const neg = raw.startsWith('-');
  const abs = raw.replace('-', '');
  const [intPart, decRaw = ''] = abs.split('.');
  const dec = (decRaw + '00').slice(0, 2);
  const jiao = Number(dec[0]);
  const fen = Number(dec[1]);
  const yuanChar = useYuan.value ? '元' : '圆';

  let tail = '';
  if (jiao === 0 && fen === 0) {
    tail = `${yuanChar}整`;
  } else if (jiao > 0 && fen === 0) {
    tail = yuanChar + DIGITS[jiao] + '角';
  } else if (jiao === 0 && fen > 0) {
    tail = `${yuanChar}零${DIGITS[fen]}分`;
  } else {
    tail = yuanChar + DIGITS[jiao] + '角' + DIGITS[fen] + '分';
  }

  const head = intToCn(intPart) + tail;
  return { text: (neg ? '负' : '') + (withPrefix.value ? '人民币' : '') + head, error: '' };
});
</script>

<template>
  <div flex flex-col gap-3>
    <c-input-text
      v-model:value="input"
      label="金额："
      placeholder="输入金额数字，如 1234.56、107000、0.07"
      label-position="left"
      label-width="90px"
      label-align="right"
      clearable
    />

    <div flex items-center gap-4 pl-90px>
      <n-checkbox v-model:checked="withPrefix">
        加「人民币」前缀
      </n-checkbox>
      <n-checkbox v-model:checked="useYuan">
        用「元」（不勾选则用「圆」）
      </n-checkbox>
    </div>

    <c-alert v-if="result.error" type="warning" title="输入有误">
      {{ result.error }}
    </c-alert>

    <InputCopyable v-else-if="result.text" :value="result.text" label="中文大写：" label-position="left" label-width="90px" label-align="right" />
  </div>
</template>
