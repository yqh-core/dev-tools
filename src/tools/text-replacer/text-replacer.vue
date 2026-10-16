<script setup lang="ts">
const source = useStorage('text-replacer:source', '');
const find = ref('');
const replacement = ref('');
const useRegex = ref(false);
const ignoreCase = ref(false);

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const pattern = computed<RegExp | null>(() => {
  if (!find.value) {
    return null;
  }
  try {
    return new RegExp(useRegex.value ? find.value : escapeRe(find.value), ignoreCase.value ? 'gi' : 'g');
  }
  catch {
    return null;
  }
});

const regexInvalid = computed(() => useRegex.value && !!find.value && pattern.value === null);

const count = computed(() => (pattern.value ? source.value.match(pattern.value)?.length ?? 0 : 0));

const output = computed(() => {
  if (regexInvalid.value) {
    return '';
  }
  if (!pattern.value) {
    return source.value;
  }
  // 用函数式替换，避免替换文本里的 $& / $1 被当成捕获组引用
  return source.value.replace(pattern.value, () => replacement.value);
});
</script>

<template>
  <div flex flex-col gap-3>
    <c-input-text
      v-model:value="source"
      label="Source text:"
      placeholder="Paste the text to process"
      multiline
      :rows="6"
      raw-text
      label-position="left"
      label-width="90px"
      label-align="right"
    />

    <c-input-text
      v-model:value="find"
      label="Find:"
      placeholder="What to look for"
      raw-text
      monospace
      label-position="left"
      label-width="90px"
      label-align="right"
    />

    <c-input-text
      v-model:value="replacement"
      label="Replace with:"
      placeholder="Leave empty to delete"
      raw-text
      monospace
      label-position="left"
      label-width="90px"
      label-align="right"
    />

    <div flex items-center gap-4 pl-90px>
      <n-checkbox v-model:checked="useRegex">
        Use regular expression
      </n-checkbox>
      <n-checkbox v-model:checked="ignoreCase">
        Ignore case
      </n-checkbox>
    </div>

    <c-alert v-if="regexInvalid" type="warning" title="Invalid regular expression">
      Check your groups and escapes.
    </c-alert>

    <template v-else-if="find">
      <div flex flex-wrap gap-6 pl-90px text-13px op-80>
        <span>Replacements: <b>{{ count }}</b></span>
        <span>Source characters: <b>{{ source.length }}</b></span>
        <span>Result characters: <b>{{ output.length }}</b></span>
      </div>
      <TextareaCopyable :value="output" />
    </template>
  </div>
</template>
