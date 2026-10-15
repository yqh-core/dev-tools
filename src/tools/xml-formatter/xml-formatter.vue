<script setup lang="ts">
import { formatXml, isValidXML, minifyXml } from './xml-formatter.service';
import type { UseValidationRule } from '@/composable/validation';

const defaultValue = '<hello><world>foo</world><world>bar</world></hello>';
const indentSize = useStorage('xml-formatter:indent-size', 2);
const collapseContent = useStorage('xml-formatter:collapse-content', true);
type Mode = 'beautify' | 'minify';
const mode = useStorage<Mode>('xml-formatter:mode', 'beautify');

function transformer(value: string) {
  if (mode.value === 'minify') {
    return minifyXml(value);
  }
  return formatXml(value, {
    indentation: ' '.repeat(indentSize.value),
    collapseContent: collapseContent.value,
    lineSeparator: '\n',
  });
}

const rules: UseValidationRule<string>[] = [
  {
    validator: isValidXML,
    message: 'Provided XML is not valid.',
  },
];
</script>

<template>
  <div important:flex-full important:flex-shrink-0 important:flex-grow-0>
    <div flex flex-wrap justify-center gap-4>
      <c-select
        v-model:value="mode"
        label="Mode"
        w-200px
        :options="[
          { label: 'Beautify (indent)', value: 'beautify' },
          { label: 'Minify (strip tags spacing)', value: 'minify' },
        ]"
      />
      <!-- 压缩模式下这两个控件不参与计算，直接不显示：留着会暗示它们还起作用 -->
      <template v-if="mode === 'beautify'">
        <n-form-item label="Collapse content:" label-placement="left">
          <n-switch v-model:value="collapseContent" />
        </n-form-item>
        <n-form-item label="Indent size:" label-placement="left" label-width="100" :show-feedback="false">
          <n-input-number v-model:value="indentSize" min="0" max="10" w-100px />
        </n-form-item>
      </template>
    </div>
  </div>

  <format-transformer
    input-label="Your XML"
    input-placeholder="Paste your XML here..."
    :output-label="mode === 'minify' ? 'Minified XML' : 'Formatted XML from your XML'"
    output-language="xml"
    :input-validation-rules="rules"
    :transformer="transformer"
    :input-default="defaultValue"
  />
</template>
