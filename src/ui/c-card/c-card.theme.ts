import { defineThemes } from '../theme/theme.models';

export const { useTheme } = defineThemes({
  dark: {
    // 暗色底收敛到 DigDevBox navy 体系（原 gray #232323 / #282828 → navy）
    backgroundColor: '#131c2b',
    borderColor: '#1e2d49',
  },
  light: {
    backgroundColor: '#ffffff',
    borderColor: '#efeff5',
  },
});
