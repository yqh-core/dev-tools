import { defineThemes } from '../theme/theme.models';
import { ddTokens } from '@/generated/dd-tokens';

export const { useTheme } = defineThemes({
  dark: {
    // 原 #333333：脱离 navy 体系（实测暗色输入框底确实是 #333333）
    backgroundColor: ddTokens.dark.surface,
    borderColor: ddTokens.dark.border,

    focus: {
      backgroundColor: '#0f766e1a',
    },
  },
  light: {
    backgroundColor: ddTokens.light.surface, // #ffffff
    // #e0e0e69e（带透明度）与 --dd-border 不等值 → 保持原值，列入「待确认统一」
    borderColor: '#e0e0e69e',

    focus: {
      backgroundColor: '#ffffff',
    },
  },
});
