import { defineThemes } from '../theme/theme.models';
import { ddTokens } from '@/generated/dd-tokens';

export const { useTheme } = defineThemes({
  dark: {
    // 暗色底收敛到 DigDevBox navy 体系（原 gray #232323 / #282828 → navy）
    backgroundColor: ddTokens.dark.surface, // #131c2b
    borderColor: ddTokens.dark.border, // #1e2d49
  },
  light: {
    backgroundColor: ddTokens.light.surface, // #ffffff
    // #efeff5 与 --dd-border（#e2e8f0）值不同 → 保持原值，列入「待确认统一」
    borderColor: '#efeff5',
  },
});
