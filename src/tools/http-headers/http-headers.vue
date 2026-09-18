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
      placeholder="搜索头部字段，如 Cookie / CORS / 缓存…"
      autofocus
      raw-text
      mb-6
      clearable
    />

    <div mb-2 op-60 text-13px>
      共 {{ rows.length }} 条
    </div>

    <c-card v-for="item of rows" :key="item.name" mb-2>
      <div flex flex-wrap items-baseline gap-2>
        <span text-16px font-bold font-mono>{{ item.name }}</span>
        <span op-60 text-13px px-1 b-rd-3px bg-gray-2>{{ item.dir }}</span>
      </div>
      <div mt-1 op-70>
        {{ item.zh }}
      </div>
    </c-card>

    <c-alert v-if="rows.length === 0">
      没有匹配的头部字段，换个关键词试试。
    </c-alert>
  </div>
</template>
