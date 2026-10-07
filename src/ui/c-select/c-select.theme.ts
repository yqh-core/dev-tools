import { defineThemes } from '../theme/theme.models';
import { appThemes } from '../theme/themes';
import { ddTokens } from '@/generated/dd-tokens';

const sizes = {
  small: {
    height: '28px',
    fontSize: '12px',
  },
  medium: {
    height: '34px',
    fontSize: '14px',
  },
  large: {
    height: '40px',
    fontSize: '16px',
  },
};

export const { useTheme } = defineThemes({
  dark: {
    sizes,

    // 原 #333333 / #444444：脱离 navy 体系（实测暗色下拉底确实是 #333333）
    backgroundColor: ddTokens.dark.surface,
    borderColor: ddTokens.dark.border,
    dropdownShadow: 'rgba(0, 0, 0, 0.2) 0px 8px 24px',

    option: {
      hover: {
        // 原 #444444 → 取 --dd-border(#1e2d49) 作为「在 surface 之上提亮一档」，与 c-card 描边同源
        backgroundColor: ddTokens.dark.border,
      },
      active: {
        textColor: appThemes.dark.primary.color,
      },
    },

    focus: {
      backgroundColor: '#0f766e1a',
    },
  },
  light: {
    sizes,

    backgroundColor: ddTokens.light.surface, // #ffffff
    // #e0e0e69e（带透明度）与 --dd-border 不等值 → 保持原值，列入「待确认统一」
    borderColor: '#e0e0e69e',
    dropdownShadow: 'rgba(149, 157, 165, 0.2) 0px 8px 24px',

    option: {
      hover: {
        backgroundColor: '#eee',
      },
      active: {
        textColor: appThemes.light.primary.color,
      },
    },

    focus: {
      backgroundColor: '#ffffff',
    },
  },
});
