<script setup lang="ts">
import type { JsonTreeNode } from '@/utils/json-tree';

const props = withDefaults(defineProps<{ node: JsonTreeNode; depth?: number }>(), { depth: 0 });

const open = ref(props.depth < 2);
const expandable = computed(() => props.node.children.length > 0);

function toggle() {
  if (expandable.value) {
    open.value = !open.value;
  }
}
</script>

<template>
  <div class="node">
    <button
      class="row"
      type="button"
      :aria-expanded="expandable ? open : undefined"
      @click="toggle"
    >
      <span class="caret" :class="{ empty: !expandable, open }">▸</span>
      <span class="key">{{ node.key }}</span>
      <span class="preview" :data-kind="node.kind">{{ node.preview }}</span>
    </button>
    <div v-if="expandable && open" class="children">
      <JsonTreeNodeView
        v-for="(child, index) in node.children"
        :key="`${child.key}-${index}`"
        :node="child"
        :depth="depth + 1"
      />
    </div>
  </div>
</template>

<style scoped lang="less">
.node {
  font-family: var(--dd-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  font-size: 13px;
  line-height: 1.45;
}

.row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  width: 100%;
  padding: 2px 4px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: color-mix(in srgb, var(--dd-primary) 8%, transparent);
  }
}

.caret {
  width: 12px;
  flex: none;
  color: var(--dd-text-muted);
  transition: transform 0.12s ease;

  &.open {
    transform: rotate(90deg);
  }

  &.empty {
    visibility: hidden;
  }
}

.key {
  color: var(--dd-text);
  font-weight: 600;
}

.preview {
  color: var(--dd-text-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &[data-kind='string'] {
    color: #0f766e;
  }

  &[data-kind='number'] {
    color: #b45309;
  }

  &[data-kind='boolean'] {
    color: #1d4ed8;
  }

  &[data-kind='null'] {
    color: var(--dd-text-muted);
  }
}

:global(html.dark) .preview[data-kind='string'] {
  color: #5eead4;
}

:global(html.dark) .preview[data-kind='number'] {
  color: #fbbf24;
}

:global(html.dark) .preview[data-kind='boolean'] {
  color: #93c5fd;
}

.children {
  margin-left: 14px;
  padding-left: 8px;
  border-left: 1px solid var(--dd-border);
}
</style>
