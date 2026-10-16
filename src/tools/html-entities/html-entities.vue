<script setup lang="ts">
import { escape, unescape } from 'lodash';

import { htmlEntityEntries } from './html-entities.constants';
import { useCopy } from '@/composable/copy';
import { useFuzzySearch } from '@/composable/fuzzySearch';

const escapeInput = ref('<title>IT Tool</title>');
const escapeOutput = computed(() => escape(escapeInput.value));
const { copy: copyEscaped } = useCopy({ source: escapeOutput });

const unescapeInput = ref('&lt;title&gt;IT Tool&lt;/title&gt;');
const unescapeOutput = computed(() => unescape(unescapeInput.value));
const { copy: copyUnescaped } = useCopy({ source: unescapeOutput });

const entitySearch = ref('');
const { searchResult: entityMatches } = useFuzzySearch({
  search: entitySearch,
  data: htmlEntityEntries,
  options: { keys: [{ name: 'char', weight: 3 }, { name: 'named', weight: 3 }, { name: 'desc', weight: 2 }] },
});
const entityRows = computed(() => (entitySearch.value ? entityMatches.value : htmlEntityEntries));
</script>

<template>
  <c-card title="Escape html entities">
    <n-form-item label="Your string :">
      <c-input-text
        v-model:value="escapeInput"

        placeholder="The string to escape"
        rows="3"

        autosize raw-text multiline
      />
    </n-form-item>

    <n-form-item label="Your string escaped :">
      <c-input-text

        placeholder="Your string escaped"
        :value="escapeOutput"
        rows="3"
        multiline autosize readonly
      />
    </n-form-item>

    <div flex justify-center>
      <c-button @click="copyEscaped()">
        Copy
      </c-button>
    </div>
  </c-card>
  <c-card title="Unescape html entities">
    <n-form-item label="Your escaped string :">
      <c-input-text
        v-model:value="unescapeInput"
        multiline
        placeholder="The string to unescape"
        rows="3"
        autosize
        raw-text
      />
    </n-form-item>

    <n-form-item label="Your string unescaped :">
      <c-input-text
        :value="unescapeOutput"
        multiline
        readonly
        placeholder="Your string unescaped"
        rows="3"
        autosize
      />
    </n-form-item>

    <div flex justify-center>
      <c-button @click="copyUnescaped()">
        Copy
      </c-button>
    </div>
  </c-card>
  <c-card title="Common HTML entities reference" mt-4>
    <c-input-text
      v-model:value="entitySearch"
      placeholder="Search by character, entity name or meaning, e.g. &amp; · em dash · copyright…"

      raw-text clearable mb-3
    />
    <div class="entities-table">
      <div class="entities-row entities-head">
        <span>Char</span>
        <span>Named</span>
        <span>Decimal</span>
        <span>Hex</span>
        <span>Meaning</span>
      </div>
      <div v-for="e of entityRows" :key="e.named" class="entities-row">
        <span class="entities-char">{{ e.char }}</span>
        <span class="entities-mono">{{ e.named }}</span>
        <span class="entities-mono">{{ e.decimal }}</span>
        <span class="entities-mono">{{ e.hex }}</span>
        <span class="entities-desc">{{ e.desc }}</span>
      </div>
    </div>
    <c-alert v-if="entityRows.length === 0" mt-3>
      No matching entity. Try another keyword.
    </c-alert>
  </c-card>
</template>

<style scoped lang="less">
.entities-table {
  overflow-x: auto;

  border: 1px solid var(--dd-border);
  border-radius: var(--dd-radius);
}

.entities-row {
  display: grid;
  gap: 10px;
  align-items: baseline;

  padding: 8px 12px;

  border-bottom: 1px solid var(--dd-border);

  font-size: 13px;
  line-height: 1.55;

  grid-template-columns: 34px 92px 84px 84px minmax(180px, 1fr);

  &:last-child {
    border-bottom: none;
  }
}

.entities-head {
  background: var(--dd-surface-2);
  color: var(--dd-text-soft);
  font-weight: 600;
}

.entities-char {
  font-size: 16px;
  font-weight: 700;
  text-align: center;
}

.entities-mono {
  font-family: var(--dd-font-mono);
}

.entities-desc {
  color: var(--dd-text-soft);
}
</style>
