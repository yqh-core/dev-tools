<script setup lang="ts">
import { asciiEntries } from './ascii-table.constants';
import { useFuzzySearch } from '@/composable/fuzzySearch';

const search = ref('');

const { searchResult } = useFuzzySearch({
  search,
  data: asciiEntries,
  options: { keys: [{ name: 'char', weight: 3 }, { name: 'zh', weight: 2 }, 'dec', 'hex'] },
});

const rows = computed(() => (search.value ? searchResult.value : asciiEntries));
</script>

<template>
  <div>
    <c-input-text
      v-model:value="search"
      placeholder="搜索字符或码值，如 65 / A / 0x41…"
      autofocus
      raw-text
      mb-6
      clearable
    />

    <div mb-2 op-60 text-13px>
      共 {{ rows.length }} 条
    </div>

    <c-card v-for="item of rows" :key="item.dec" mb-2>
      <div flex flex-wrap items-baseline gap-3>
        <span text-18px font-bold font-mono w-40px inline-block text-center>{{ item.char }}</span>
        <span op-70 text-13px font-mono>dec {{ item.dec }}</span>
        <span op-70 text-13px font-mono>{{ item.hex }}</span>
        <span op-70 text-13px font-mono>{{ item.oct }}</span>
        <span op-70 text-13px font-mono>{{ item.bin }}</span>
      </div>
      <div v-if="item.zh" mt-1 op-60 text-13px>
        {{ item.zh }}
      </div>
    </c-card>

    <c-alert v-if="rows.length === 0">
      没有匹配项。可搜字符（如 A）、十进制（65）或十六进制（0x41）。
    </c-alert>
  </div>
</template>
