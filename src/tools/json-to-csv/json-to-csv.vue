<script setup lang="ts">
import JSON5 from 'json5';
import { convertArrayToCsv, csvShapeError } from './json-to-csv.service';
import type { UseValidationRule } from '@/composable/validation';
import { withDefaultOnError } from '@/utils/defaults';

function transformer(value: string) {
  return withDefaultOnError(() => {
    if (value === '') {
      return '';
    }
    const parsed = JSON5.parse(value);
    // 形状不对（非对象数组）时不产出内容 —— 具体原因由下面的校验器如实告诉用户，
    // 不再像旧实现那样「输入合法、界面不报错、结果却静默为空」。
    return csvShapeError(parsed) === '' ? convertArrayToCsv({ array: parsed }) : '';
  }, '');
}

const rules: UseValidationRule<string>[] = [
  {
    validator: (v: string) => {
      if (v.trim() === '') {
        return true;
      }
      return csvShapeError(JSON5.parse(v)) === '';
    },
    getErrorMessage: (v: string) => {
      try {
        return csvShapeError(JSON5.parse(v)) || 'Provided JSON is not valid.';
      }
      catch (e: any) {
        return 'Provided JSON is not valid.';
      }
    },
    message: '{0}',
  },
];
</script>

<template>
  <format-transformer
    input-label="Your raw JSON"
    input-placeholder='Paste an array of objects here, e.g. [{"name":"Ada"}]'
    output-label="CSV version of your JSON"
    output-language="csv"
    downloadable
    download-filename="converted"
    :input-validation-rules="rules"
    :transformer="transformer"
  />
</template>
