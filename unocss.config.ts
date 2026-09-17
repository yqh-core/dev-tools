import {
  defineConfig,
  presetAttributify,
  presetTypography,
  presetUno,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss';

import { presetScrollbar } from 'unocss-preset-scrollbar';

export default defineConfig({
  presets: [presetUno(), presetAttributify({ ignoreAttributes: ['size'] }), presetTypography(), presetScrollbar()],
  transformers: [transformerDirectives(), transformerVariantGroup()],
  theme: {
    colors: {
      // DigDevBox 品牌主色（与 naive-ui 主题一致，消除“同站双主色”冲突）
      primary: '#0f766e',
    },
  },
  shortcuts: {
    'pretty-scrollbar': 'scrollbar scrollbar-rounded scrollbar-thumb-color-gray-300 scrollbar-track-color-gray-100 dark:scrollbar-thumb-color-#424242 dark:scrollbar-track-color-#686868',
    'divider': 'h-1px bg-current op-10',
    // 暗色底收敛到 DigDevBox navy 体系（原 #232323 / #1c1c1c → navy）
    'bg-surface': 'bg-#ffffff dark:bg-#131c2b',
    'bg-background': 'bg-#f1f5f9 dark:bg-#0b1220',
  },
});
