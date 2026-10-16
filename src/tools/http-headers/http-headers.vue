<script setup lang="ts">
import { httpHeaderEntries } from './http-headers.constants';
import { useFuzzySearch } from '@/composable/fuzzySearch';

const search = ref('');

const { searchResult } = useFuzzySearch({
  search,
  data: httpHeaderEntries,
  options: { keys: [{ name: 'name', weight: 3 }, { name: 'zh', weight: 2 }, 'dir'] },
});

const rows = computed(() => (search.value ? searchResult.value : httpHeaderEntries));
</script>

<template>
  <div>
    <c-input-text
      v-model:value="search"
      placeholder="Search by header name, e.g. Cookie / CORS / cache…"

      autofocus raw-text clearable mb-6
    />

    <div mb-2 text-13px op-60>
      {{ rows.length }} entries
    </div>

    <c-card v-for="item of rows" :key="item.name" mb-2>
      <div flex flex-wrap items-baseline gap-2>
        <span text-16px font-bold font-mono>{{ item.name }}</span>
        <span b-rd-3px bg-gray-2 px-1 text-13px op-60>{{ item.dir }}</span>
      </div>
      <div mt-1 op-70>
        {{ item.zh }}
      </div>
    </c-card>

    <c-alert v-if="rows.length === 0">
      No matching header. Try another keyword.
    </c-alert>
  </div>
</template>
