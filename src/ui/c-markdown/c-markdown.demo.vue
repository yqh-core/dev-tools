<script setup lang="ts">
const md = `
# 开发者工具箱

## About
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed euismod, nisl quis
mollis blandit, nunc nisl aliquam nunc, vitae aliquam nisl nunc vitae nisl.

- Lorem ipsum dolor sit amet, consectetur adipiscing elit.
- Sed euismod, nisl quis mollis blandit, nunc nisl aliquam nunc, vitae aliquam nisl nunc vitae nisl.

[开发者工具箱](https://coderkit.pages.dev)
`;
</script>

<template>
  <c-markdown :markdown="md" />
</template>
