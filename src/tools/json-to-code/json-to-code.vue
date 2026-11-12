<script setup lang="ts">
import { LANGS, type Lang, type Model, inferModels, renderCode } from './json-to-code.models';

const input = useStorage('json-to-code:input', '');
const rootName = useStorage('json-to-code:rootName', 'Root');
const lang = ref<Lang>('ts');

const parseError = ref('');
const models = ref<Model[]>([]);

function build(): void {
  const result = inferModels(input.value, rootName.value);
  parseError.value = result.error;
  models.value = result.models;
}

watch([input, rootName], build, { immediate: true });

const code = computed(() => renderCode(models.value, lang.value));
</script>

<template>
  <div flex flex-col gap-3>
    <c-input-text
      v-model:value="rootName"
      label="Root class name:"
      placeholder="Root"
      label-position="left"
      label-width="90px"
      label-align="right"
    />

    <c-buttons-select
      v-model:value="lang"
      :options="LANGS"
      label="Target language:"
      label-position="left"
      label-width="90px"
      label-align="right"
    />

    <c-input-text
      v-model:value="input"
      label="JSON："
      placeholder="Paste a JSON object or array of objects, e.g. [{&quot;id&quot;:1,&quot;name&quot;:&quot;devbox&quot;}]"
      multiline
      :rows="6"
      raw-text
      label-position="left"
      label-width="90px"
      label-align="right"
    />

    <c-alert v-if="parseError" type="warning" title="Parse failed">
      {{ parseError }}
    </c-alert>

    <div v-else-if="code" mt-1>
      <TextareaCopyable :value="code" />
    </div>
  </div>
</template>
