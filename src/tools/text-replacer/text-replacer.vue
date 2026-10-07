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
      label="原文："
      placeholder="粘贴要处理的原文"
      multiline
      :rows="6"
      raw-text
      label-position="left"
      label-width="90px"
      label-align="right"
    />

    <c-input-text
      v-model:value="find"
      label="查找："
      placeholder="要查找的内容"
      raw-text
      monospace
      label-position="left"
      label-width="90px"
      label-align="right"
    />

    <c-input-text
      v-model:value="replacement"
      label="替换为："
      placeholder="留空表示删除"
      raw-text
      monospace
      label-position="left"
      label-width="90px"
      label-align="right"
    />

    <div flex items-center gap-4 pl-90px>
      <n-checkbox v-model:checked="useRegex">
        使用正则表达式
      </n-checkbox>
      <n-checkbox v-model:checked="ignoreCase">
        忽略大小写
      </n-checkbox>
    </div>

    <c-alert v-if="regexInvalid" type="warning" title="正则表达式无效">
      请检查括号、转义是否正确。
    </c-alert>

    <template v-else-if="find">
      <div flex flex-wrap gap-6 pl-90px text-13px op-80>
        <span>替换次数：<b>{{ count }}</b></span>
        <span>原文字符：<b>{{ source.length }}</b></span>
        <span>结果字符：<b>{{ output.length }}</b></span>
      </div>
      <TextareaCopyable :value="output" />
    </template>
  </div>
</template>
