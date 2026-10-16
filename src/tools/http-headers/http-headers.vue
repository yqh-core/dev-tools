<script setup lang="ts">
import { httpHeaderEntries, httpMethodEntries } from './http-headers.constants';
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

    <n-h3 mb-2 mt-8>
      HTTP request methods
    </n-h3>
    <div mb-2 text-13px op-60>
      The nine standard verbs, with whether each is safe and idempotent.
    </div>
    <div class="methods-table" mb-2>
      <div class="methods-row methods-head">
        <span>Method</span>
        <span>Safe</span>
        <span>Idempotent</span>
        <span>Description</span>
      </div>
      <div v-for="m of httpMethodEntries" :key="m.name" class="methods-row">
        <span class="methods-name">{{ m.name }}</span>
        <span>{{ m.safe }}</span>
        <span>{{ m.idempotent }}</span>
        <span class="methods-desc">{{ m.zh }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.methods-table {
  overflow-x: auto;

  border: 1px solid var(--dd-border);
  border-radius: var(--dd-radius);
}

.methods-row {
  display: grid;
  gap: 10px;
  align-items: baseline;

  padding: 9px 12px;

  border-bottom: 1px solid var(--dd-border);

  font-size: 13px;
  line-height: 1.55;

  grid-template-columns: 78px 52px 92px minmax(220px, 1fr);

  &:last-child {
    border-bottom: none;
  }
}

.methods-head {
  background: var(--dd-surface-2);
  color: var(--dd-text-soft);
  font-weight: 600;
}

.methods-name {
  font-family: var(--dd-font-mono);
  font-weight: 700;
}

.methods-desc {
  color: var(--dd-text-soft);
}
</style>
