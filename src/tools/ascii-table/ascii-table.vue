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
      placeholder="Search by character or code, e.g. 65 / A / 0x41…"

      autofocus raw-text clearable mb-6
    />

    <div mb-2 text-13px op-60>
      {{ rows.length }} entries
    </div>

    <c-card v-for="item of rows" :key="item.dec" mb-2>
      <div flex flex-wrap items-baseline gap-3>
        <span inline-block w-40px text-center text-18px font-bold font-mono>{{ item.char }}</span>
        <span text-13px font-mono op-70>dec {{ item.dec }}</span>
        <span text-13px font-mono op-70>{{ item.hex }}</span>
        <span text-13px font-mono op-70>{{ item.oct }}</span>
        <span text-13px font-mono op-70>{{ item.bin }}</span>
      </div>
      <div v-if="item.zh" mt-1 text-13px op-60>
        {{ item.zh }}
      </div>
    </c-card>

    <c-alert v-if="rows.length === 0">
      No match. Try a character (A), a decimal code (65) or a hex code (0x41).
    </c-alert>
  </div>
</template>
