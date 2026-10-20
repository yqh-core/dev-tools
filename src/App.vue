<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router';
import { NGlobalStyle, NMessageProvider, NNotificationProvider, darkTheme } from 'naive-ui';
import { darkThemeOverrides, lightThemeOverrides } from './themes';
import { layouts } from './layouts';
import { useStyleStore } from './stores/style.store';
import { DEFAULT_LOCALE, detectLocale, localeDef } from './i18n/languages';

const route = useRoute();
const layout = computed(() => route?.meta?.layout ?? layouts.base);
const styleStore = useStyleStore();

const theme = computed(() => (styleStore.isDarkTheme ? darkTheme : null));
const themeOverrides = computed(() => (styleStore.isDarkTheme ? darkThemeOverrides : lightThemeOverrides));

const { locale } = useI18n();

// 语言持久化 + 首访自动检测。存储 key 沿用既有的 'locale'（向后兼容老用户的手动选择）。
// 语义变更：null = 从未手动选过 → 按浏览器语言检测；字符串 = 用户显式选过 → 尊重，不再覆盖。
const storedLocale = useStorage<string | null>('locale', null);

if (typeof window !== 'undefined') {
  // 只有「没有手动选择记录」时才自动切换：已显式选过 en 的用户不该被浏览器语言再次改写。
  if (!storedLocale.value) {
    const detected = detectLocale(navigator.languages);
    if (detected !== DEFAULT_LOCALE) {
      locale.value = detected; // 触发下面的 watcher 落库 + 同步 html lang
    }
  }

  // 当前语言与已存值不一致（首访检测 / 用户切换）就落库；并同步 <html lang>（无障碍、Intl 依赖它）。
  watch(
    locale,
    (v) => {
      if (storedLocale.value !== v) {
        storedLocale.value = v;
      }
      document.documentElement.lang = localeDef(v).bcp47;
    },
    { immediate: true },
  );
}
</script>

<template>
  <n-config-provider :theme="theme" :theme-overrides="themeOverrides">
    <NGlobalStyle />
    <NMessageProvider placement="bottom">
      <NNotificationProvider placement="bottom-right">
        <component :is="layout">
          <RouterView />
        </component>
      </NNotificationProvider>
    </NMessageProvider>
  </n-config-provider>
</template>

<style>
body {
  min-height: 100%;
  margin: 0;
  padding: 0;
}

html {
  height: 100%;
  margin: 0;
  padding: 0;
}

* {
  box-sizing: border-box;
}
</style>
