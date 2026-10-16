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
      placeholder="Search by command or task, e.g. grep / port / disk…"

      autofocus raw-text clearable mb-6
    />

    <div mb-2 text-13px op-60>
      {{ rows.length }} entries
    </div>

    <c-card v-for="item of rows" :key="item.cmd" mb-2>
      <div flex flex-wrap items-baseline gap-2>
        <span text-16px font-bold font-mono>{{ item.cmd }}</span>
        <span op-70>{{ item.zh }}</span>
      </div>
      <div mt-1 text-13px font-mono op-60>
        {{ item.eg }}
      </div>
    </c-card>

    <c-alert v-if="rows.length === 0">
      No matching command. Try another keyword.
    </c-alert>
  </div>
</template>
