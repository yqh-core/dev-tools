<script lang="ts" setup>
import { isArray, isBoolean, isNil, isNumber } from 'lodash';
import type { CKeyValueListItem } from './c-key-value-list.types';

const props = defineProps<{ item: CKeyValueListItem }>();
const { item } = toRefs(props);
</script>

<template>
  <div v-if="isArray(item.value)">
    <div v-for="value in item.value" :key="value">
      <c-text-copyable :value="value" :show-icon="item.showCopyButton ?? true" />
    </div>
  </div>
  <div v-else-if="isBoolean(item.value)">
    <c-text-copyable :value="item.value ? 'true' : 'false'" :displayed-value="item.value ? 'Yes' : 'No'" :show-icon="item.showCopyButton ?? true" />
  </div>
  <div v-else-if="isNumber(item.value)" font-mono>
    <c-text-copyable :value="String(item.value)" :show-icon="item.showCopyButton ?? true" />
  </div>
  <div v-else-if="isNil(item.value) || item.value === ''" op-70>
    {{ item.placeholder ?? 'N/A' }}
  </div>
  <div v-else>
    <c-text-copyable :value="item.value" :show-icon="item.showCopyButton ?? true" />
  </div>
</template>
