<script setup lang="ts">
import { linuxCommands } from './linux-commands.constants';
import { useFuzzySearch } from '@/composable/fuzzySearch';

const search = ref('');

const { searchResult } = useFuzzySearch({
  search,
  data: linuxCommands,
  options: { keys: [{ name: 'cmd', weight: 3 }, { name: 'zh', weight: 2 }, 'eg'] },
});

const rows = computed(() => (search.value ? searchResult.value : linuxCommands));
</script>

<template>
  <div>
    <c-input-text
      v-model:value="search"
      placeholder="搜索命令或场景，如 grep / 端口 / 磁盘…"
      autofocus
      raw-text
      mb-6
      clearable
    />

    <div mb-2 op-60 text-13px>
      共 {{ rows.length }} 条
    </div>

    <c-card v-for="item of rows" :key="item.cmd" mb-2>
      <div flex flex-wrap items-baseline gap-2>
        <span text-16px font-bold font-mono>{{ item.cmd }}</span>
        <span op-70>{{ item.zh }}</span>
      </div>
      <div mt-1 op-60 text-13px font-mono>
        {{ item.eg }}
      </div>
    </c-card>

    <c-alert v-if="rows.length === 0">
      没有匹配的命令，换个关键词试试。
    </c-alert>
  </div>
</template>
