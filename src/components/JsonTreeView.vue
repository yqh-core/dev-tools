<script setup lang="ts">
import { computed } from 'vue';
import JsonTreeNodeView from './JsonTreeNodeView.vue';
import { buildJsonTree } from '@/utils/json-tree';

const props = defineProps<{ data: unknown }>();
const root = computed(() => buildJsonTree(props.data));
</script>

<template>
  <div class="json-tree" data-test-id="json-tree">
    <JsonTreeNodeView :node="root" :depth="0" />
  </div>
</template>

<style scoped lang="less">
.json-tree {
  width: 100%;
  max-height: 480px;
  overflow: auto;
  padding: 8px 6px;
  border: 1px solid var(--dd-border);
  border-radius: var(--dd-radius);
  background: var(--dd-surface);
  color: var(--dd-text);
}
</style>
