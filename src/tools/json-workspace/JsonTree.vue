<script setup lang="ts">
defineOptions({ name: 'JsonTree' });

const props = defineProps<{ value: unknown; keyName?: string; depth?: number }>();
const expanded = ref((props.depth ?? 0) < 2);

const kind = computed(() => {
  if (props.value === null) {
    return 'null';
  }
  if (Array.isArray(props.value)) {
    return 'array';
  }
  return typeof props.value;
});
const isContainer = computed(() => kind.value === 'object' || kind.value === 'array');
const entries = computed(() => {
  if (kind.value === 'array') {
    return (props.value as unknown[]).map((v, i) => [String(i), v] as [string, unknown]);
  }
  if (kind.value === 'object') {
    return Object.entries(props.value as Record<string, unknown>);
  }
  return [];
});
const preview = computed(() => {
  if (kind.value === 'array') {
    return `Array(${(props.value as unknown[]).length})`;
  }
  if (kind.value === 'object') {
    return `Object{${entries.value.length}}`;
  }
  if (kind.value === 'string') {
    return `"${props.value}"`;
  }
  return String(props.value);
});
</script>

<template>
  <div class="json-tree-node" :style="{ paddingLeft: depth ? '16px' : '0' }">
    <div class="node-line" :class="{ clickable: isContainer }" @click="isContainer && (expanded = !expanded)">
      <span v-if="isContainer" class="caret">{{ expanded ? '▾' : '▸' }}</span>
      <span v-if="keyName !== undefined" class="key">{{ keyName }}:</span>
      <span v-if="!isContainer || !expanded" class="value" :class="kind">{{ preview }}</span>
      <span v-else class="bracket">{{ kind === 'array' ? '[' : '{' }}</span>
    </div>
    <div v-if="isContainer && expanded" class="children">
      <JsonTree v-for="[k, v] in entries" :key="k" :value="v" :key-name="k" :depth="(depth ?? 0) + 1" />
      <div class="bracket close">
        {{ kind === 'array' ? ']' : '}' }}
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
.json-tree-node { font-family: monospace; font-size: 13px; line-height: 1.6; }
.node-line { white-space: nowrap; }
.clickable { cursor: pointer; }
.clickable:hover { background: rgba(127, 127, 127, 0.12); }
.caret { display: inline-block; width: 14px; opacity: 0.6; }
.key { color: var(--dd-primary, #0f766e); margin-right: 6px; }
.value.string { color: #b45309; }
.value.number, .value.integer { color: #2563eb; }
.value.boolean { color: #7c3aed; }
.value.null { color: #9ca3af; font-style: italic; }
.bracket { opacity: 0.6; }
</style>
