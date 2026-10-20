import messages from '@intlify/unplugin-vue-i18n/messages';
import { get } from '@vueuse/core';
import type { Plugin } from 'vue';
import { createI18n } from 'vue-i18n';
import { DEFAULT_LOCALE, FALLBACK_LOCALE } from '@/i18n/languages';

// 初始 locale 恒为 DEFAULT_LOCALE（en）：预渲染产物就是这份语言，客户端首帧必须与之一致，
// 否则 hydration 会 mismatch。真正的「按浏览器语言自动切换」放在 App.vue 的客户端逻辑里做
// （挂载后再改 locale），而不是在这里读 navigator —— 这里 SSR 也会执行，没有 navigator。
const i18n = createI18n({
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: FALLBACK_LOCALE,
  messages,
});

export const i18nPlugin: Plugin = {
  install: (app) => {
    app.use(i18n);
  },
};

export const translate = function (localeKey: string) {
  const hasKey = i18n.global.te(localeKey, get(i18n.global.locale));
  return hasKey ? i18n.global.t(localeKey) : localeKey;
};
