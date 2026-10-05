import { useDark, useMediaQuery, useStorage, useToggle } from '@vueuse/core';
import { defineStore } from 'pinia';
import { type Ref, watch } from 'vue';

export const useStyleStore = defineStore('style', {
  state: () => {
    const isDarkTheme = useDark();
    const toggleDark = useToggle(isDarkTheme);
    const isSmallScreen = useMediaQuery('(max-width: 700px)');
    const isMenuCollapsed = useStorage('isMenuCollapsed', isSmallScreen.value) as Ref<boolean>;

    // P0-1 修复（产品线第一眼扫描裁定）：小屏一律从「收起」开始。
    // 旧逻辑只有 watch(isSmallScreen) 在尺寸「变化」时才同步，而持久化的
    // isMenuCollapsed（桌面端访问时写入的 false）会在手机首载时被原样读回，
    // 导致 390px 屏幕侧栏默认展开、正文被挤没。immediate 保证「首载即小屏」
    // 也强制收起；桌面端（small=false）不受影响，仍尊重用户 localStorage 偏好。
    watch(isSmallScreen, (small) => {
      if (small) {
        isMenuCollapsed.value = true;
      }
    }, { immediate: true });

    return {
      isDarkTheme,
      toggleDark,
      isMenuCollapsed,
      isSmallScreen,
    };
  },
});
