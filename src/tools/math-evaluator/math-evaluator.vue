<script setup lang="ts">
import { evaluate } from 'mathjs';

const expression = ref('');

// 原先用 withDefaultOnError(..., '') 把求值异常吞成空串，模板又用 v-if="result !== ''"
// 判断是否渲染 —— 于是「输入非法表达式」和「没有结果」不可区分，用户点完只看到整块结果区消失，
// 属于典型的静默失败（E1-NEG 实测：卡片从 168px 塌到 38px，无任何提示）。
// 现在把「空输入 / 求值成功 / 求值失败」三态显式分开。
const evaluation = computed(() => {
  const expr = expression.value.trim();
  if (!expr) {
    return { state: 'empty' as const, result: '' };
  }

  try {
    return { state: 'ok' as const, result: String(evaluate(expr) ?? '') };
  }
  catch {
    return { state: 'error' as const, result: '' };
  }
});
</script>

<template>
  <div>
    <c-input-text
      v-model:value="expression"
      rows="1"
      multiline
      placeholder="Your math expression (ex: 2*sqrt(6) )..."
      raw-text
      monospace
      autofocus
      autosize
    />

    <c-card v-if="evaluation.state === 'ok'" title="Result " mt-5>
      {{ evaluation.result }}
    </c-card>

    <c-alert v-else-if="evaluation.state === 'error'" type="error" mt-5>
      Invalid expression. Please check your input.
    </c-alert>
  </div>
</template>
