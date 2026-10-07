<script setup lang="ts">
import { IconBook, IconInfoCircle, IconKeyboard, IconMoon, IconSun } from '@tabler/icons-vue';
import { useStyleStore } from '@/stores/style.store';

const styleStore = useStyleStore();
const { isDarkTheme } = toRefs(styleStore);
</script>

<template>
  <c-tooltip :tooltip="$t('home.nav.blog')" position="bottom">
    <c-button
      circle
      variant="text"
      href="https://notes.digdevbox.com/"
      target="_blank"
      rel="noopener"
      :aria-label="$t('home.nav.blog')"
    >
      <n-icon size="25" :component="IconBook" />
    </c-button>
  </c-tooltip>
  <c-tooltip :tooltip="$t('home.nav.typing')" position="bottom">
    <c-button
      circle
      variant="text"
      href="https://geek-typing.pages.dev/"
      target="_blank"
      rel="noopener"
      :aria-label="$t('home.nav.typing')"
    >
      <n-icon size="25" :component="IconKeyboard" />
    </c-button>
  </c-tooltip>
  <c-tooltip :tooltip="$t('home.nav.about')" position="bottom">
    <c-button circle variant="text" to="/about" :aria-label="$t('home.nav.aboutLabel')">
      <n-icon size="25" :component="IconInfoCircle" />
    </c-button>
  </c-tooltip>
  <c-tooltip :tooltip="isDarkTheme ? $t('home.nav.lightMode') : $t('home.nav.darkMode')" position="bottom">
    <c-button circle variant="text" :aria-label="$t('home.nav.mode')" @click="() => styleStore.toggleDark()">
      <n-icon v-if="isDarkTheme" size="25" :component="IconSun" />
      <n-icon v-else size="25" :component="IconMoon" />
    </c-button>
  </c-tooltip>
</template>

<style lang="less" scoped>
.n-button {
  &:not(:last-child) {
    margin-right: 5px;
  }
}
</style>
